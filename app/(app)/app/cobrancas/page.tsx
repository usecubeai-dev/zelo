import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  CobrancaComCliente,
  ROTULO_SITUACAO,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { formatarCentavos, paraCentavos } from "@/lib/dinheiro";
import PageHeader from "../PageHeader";
import ResumoCards from "../ResumoCards";
import s from "../../App.module.css";

export const metadata = { title: "Cobranças" };

const POR_PAGINA = 20;

const FILTROS = [
  { v: "todas", r: "Todas" },
  { v: "pendentes", r: "Pendentes" },
  { v: "vencidas", r: "Vencidas" },
  { v: "pagas", r: "Pagas" },
  { v: "canceladas", r: "Canceladas" },
  { v: "estornadas", r: "Estornadas" },
];

const CLASSE: Record<string, string> = {
  pendente: s.sitPendente,
  enviada: s.sitEnviada,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
  estornada: s.sitEstornada,
};

export default async function ListaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; pagina?: string; de?: string; ate?: string; valorMin?: string; valorMax?: string }>;
}) {
  const { q = "", f = "todas", pagina = "1", de: dataDe = "", ate: dataAte = "", valorMin = "", valorMax = "" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const hoje = hojeISO();
  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("cobrancas")
    .select("*, clientes(id,nome)", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("vence_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  /* "vencida" não é coluna: é pendente/enviada com vencimento no passado.
     O filtro reproduz exatamente a mesma regra da derivação em lib. */
  if (f === "pendentes") consulta = consulta.in("status", ["pendente", "enviada"]).gte("vence_em", hoje);
  else if (f === "vencidas") consulta = consulta.in("status", ["pendente", "enviada"]).lt("vence_em", hoje);
  else if (f === "pagas") consulta = consulta.eq("status", "paga");
  else if (f === "canceladas") consulta = consulta.eq("status", "cancelada");
  else if (f === "estornadas") consulta = consulta.eq("status", "estornada");

  if (q.trim()) consulta = consulta.ilike("descricao", `%${q.trim()}%`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataDe)) consulta = consulta.gte("vence_em", dataDe);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataAte)) consulta = consulta.lte("vence_em", dataAte);
  const valorMinCentavos = paraCentavos(valorMin);
  const valorMaxCentavos = paraCentavos(valorMax);
  if (valorMinCentavos !== null) consulta = consulta.gte("valor_centavos", valorMinCentavos);
  if (valorMaxCentavos !== null) consulta = consulta.lte("valor_centavos", valorMaxCentavos);

  const { data, count, error } = await consulta;
  const cobrancas = (data ?? []) as CobrancaComCliente[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = Boolean(q.trim()) || f !== "todas" || Boolean(dataDe) || Boolean(dataAte) || Boolean(valorMin) || Boolean(valorMax);

  /* Resumo do topo — mesmas regras do painel: recebido no mês, a receber (em
     aberto que ainda não venceu) e atrasado (em aberto já vencido). Soma de
     inteiros em centavos, feita aqui no servidor. */
  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const [recebidoMes, aReceberAberto, atrasadoAberto] = await Promise.all([
    supabase.from("cobrancas").select("valor_pago_centavos").eq("empresa_id", empresaId).eq("status", "paga").gte("pago_em", `${inicioDoMes}T00:00:00`),
    supabase.from("cobrancas").select("valor_centavos").eq("empresa_id", empresaId).in("status", ["pendente", "enviada"]).gte("vence_em", hoje),
    supabase.from("cobrancas").select("valor_centavos").eq("empresa_id", empresaId).in("status", ["pendente", "enviada"]).lt("vence_em", hoje),
  ]);
  const somar = (linhas: { valor_centavos?: number | null; valor_pago_centavos?: number | null }[] | null, campo: "valor_centavos" | "valor_pago_centavos") =>
    (linhas ?? []).reduce((acc, l) => acc + (l[campo] ?? 0), 0);
  const valorRecebido = somar(recebidoMes.data, "valor_pago_centavos");
  const valorAReceber = somar(aReceberAberto.data, "valor_centavos");
  const valorAtrasado = somar(atrasadoAberto.data, "valor_centavos");
  const qtdAtrasadas = (atrasadoAberto.data ?? []).length;

  const { count: totalClientes } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  const url = (m: { q?: string; f?: string; pagina?: string; de?: string; ate?: string; valorMin?: string; valorMax?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { q, f, pagina: String(p), de: dataDe, ate: dataAte, valorMin, valorMax, ...m };
    if (alvo.q) sp.set("q", alvo.q);
    if (alvo.f && alvo.f !== "todas") sp.set("f", alvo.f);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    if (alvo.de) sp.set("de", alvo.de);
    if (alvo.ate) sp.set("ate", alvo.ate);
    if (alvo.valorMin) sp.set("valorMin", alvo.valorMin);
    if (alvo.valorMax) sp.set("valorMax", alvo.valorMax);
    const t = sp.toString();
    return t ? `/app/cobrancas?${t}` : "/app/cobrancas";
  };

  return (
    <>
      <PageHeader
        titulo="Cobranças"
        subtitulo={total === 0 ? "Nenhuma cobrança ainda." : `${total} cobrança${total > 1 ? "s" : ""}.`}
        acoes={
          (totalClientes ?? 0) > 0 ? (
            <Link href="/app/cobrancas/nova" className={s.botao}>Nova cobrança</Link>
          ) : undefined
        }
      />

      <ResumoCards
        rotulo="Resumo das cobranças"
        itens={[
          { rotulo: "Recebido no mês", valor: formatarCentavos(valorRecebido), tom: "sucesso" },
          { rotulo: "A receber", valor: formatarCentavos(valorAReceber) },
          {
            rotulo: "Atrasado",
            valor: formatarCentavos(valorAtrasado),
            tom: qtdAtrasadas > 0 ? "alerta" : undefined,
            apoio: qtdAtrasadas > 0 ? `${qtdAtrasadas} cobrança${qtdAtrasadas > 1 ? "s" : ""}` : undefined,
          },
        ]}
      />

      <section className={s.painelFiltros} aria-label="Buscar e filtrar">
        <div className={s.barraTopo}>
          <form className={s.busca} method="get" action="/app/cobrancas">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar pela descrição"
              aria-label="Buscar cobranças"
            />
            {f !== "todas" && <input type="hidden" name="f" value={f} />}
            <button type="submit" className={s.botaoSec}>Buscar</button>
          </form>

          <div className={s.filtros}>
            {FILTROS.map((x) => (
              <Link
                key={x.v}
                href={url({ f: x.v, pagina: "1" })}
                className={f === x.v ? `${s.filtro} ${s.filtroAtivo}` : s.filtro}
                aria-current={f === x.v ? "true" : undefined}
              >
                {x.r}
              </Link>
            ))}
          </div>
        </div>

        <form className={s.filtroIntervalo} method="get" action="/app/cobrancas">
          {q && <input type="hidden" name="q" value={q} />}
          {f !== "todas" && <input type="hidden" name="f" value={f} />}
          <div className={s.filtroIntervaloCampo}>
            <label htmlFor="de">Vencimento de</label>
            <input type="date" id="de" name="de" defaultValue={dataDe} />
          </div>
          <div className={s.filtroIntervaloCampo}>
            <label htmlFor="ate">até</label>
            <input type="date" id="ate" name="ate" defaultValue={dataAte} />
          </div>
          <div className={s.filtroIntervaloCampo}>
            <label htmlFor="valorMin">Valor mínimo</label>
            <input type="text" id="valorMin" name="valorMin" defaultValue={valorMin} placeholder="0,00" inputMode="decimal" />
          </div>
          <div className={s.filtroIntervaloCampo}>
            <label htmlFor="valorMax">Valor máximo</label>
            <input type="text" id="valorMax" name="valorMax" defaultValue={valorMax} placeholder="0,00" inputMode="decimal" />
          </div>
          <button type="submit" className={s.botaoSec}>Filtrar</button>
          {(dataDe || dataAte || valorMin || valorMax) && (
            <Link href={url({ de: "", ate: "", valorMin: "", valorMax: "", pagina: "1" })} className={s.botaoSec}>
              Limpar período/valor
            </Link>
          )}
        </form>
      </section>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar suas cobranças agora. Recarregue a página.
        </div>
      )}

      {!error && cobrancas.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {filtrando
              ? "Nenhuma cobrança encontrada"
              : (totalClientes ?? 0) === 0
                ? "Você ainda não tem clientes"
                : "Crie sua primeira cobrança"}
          </h2>
          <p className={s.vazioTexto}>
            {filtrando
              ? "Tente outro termo ou mude o filtro."
              : (totalClientes ?? 0) === 0
                ? "Cadastre seu primeiro cliente para começar a cobrar."
                : "Escolha o cliente, o valor e o vencimento. Leva menos de um minuto."}
          </p>
          {!filtrando && (
            <div className={s.acoes} style={{ justifyContent: "center" }}>
              {(totalClientes ?? 0) === 0 ? (
                <Link href="/app/clientes/novo?voltar=cobranca" className={s.botao}>Cadastrar cliente</Link>
              ) : (
                <Link href="/app/cobrancas/nova" className={s.botao}>Nova cobrança</Link>
              )}
            </div>
          )}
        </section>
      )}

      {cobrancas.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th><span className={s.somenteLeitor}>Ação</span></th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const sit = situacaoDaCobranca(c, hoje);
                  return (
                    <tr key={c.id}>
                      <td data-label="Descrição">
                        <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                          {c.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca} data-label="Cliente">{c.clientes?.nome ?? "—"}</td>
                      <td className={s.celulaFraca} data-label="Vencimento">{formatarData(c.vence_em)}</td>
                      <td className={s.valorCelula} data-label="Valor">{formatarCentavos(c.valor_centavos)}</td>
                      <td data-label="Situação">
                        <span className={`${s.etiqueta} ${CLASSE[sit]}`}>
                          {ROTULO_SITUACAO[sit]}
                        </span>
                      </td>
                      <td data-label="Ação" className={s.celulaAcao}>
                        <Link
                          href={`/app/cobrancas/${c.id}`}
                          className={`${sit === "vencida" || sit === "pendente" || sit === "enviada" ? s.botao : s.botaoSec} ${s.botaoPequeno}`}
                          aria-label={`${sit === "vencida" ? "Recuperar" : sit === "pendente" || sit === "enviada" ? "Enviar" : "Ver"} cobrança: ${c.descricao}`}
                        >
                          {sit === "vencida" ? "Recuperar" : sit === "pendente" || sit === "enviada" ? "Enviar" : "Ver"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {ultima > 1 && (
            <nav className={s.paginacao} aria-label="Paginação">
              <span>Página {p} de {ultima}</span>
              <span className={s.paginacaoAcoes}>
                {p > 1 && <Link href={url({ pagina: String(p - 1) })} className={s.botaoSec}>Anterior</Link>}
                {p < ultima && <Link href={url({ pagina: String(p + 1) })} className={s.botaoSec}>Próxima</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
