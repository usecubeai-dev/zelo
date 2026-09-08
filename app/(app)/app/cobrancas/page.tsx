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
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Cobranças</h1>
        <p className={s.subtitulo}>
          {total === 0 ? "Nenhuma cobrança ainda." : `${total} cobrança${total > 1 ? "s" : ""}.`}
        </p>
      </header>

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

        {(totalClientes ?? 0) > 0 && (
          <Link href="/app/cobrancas/nova" className={s.botao}>Nova cobrança</Link>
        )}
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
                ? "Cadastre um cliente primeiro"
                : "Crie sua primeira cobrança"}
          </h2>
          <p className={s.vazioTexto}>
            {filtrando
              ? "Tente outro termo ou mude o filtro."
              : (totalClientes ?? 0) === 0
                ? "Toda cobrança pertence a um cliente. Comece cadastrando quem você cobra."
                : "Escolha o cliente, o valor e o vencimento. Leva menos de um minuto."}
          </p>
          {!filtrando && (
            <div className={s.acoes} style={{ justifyContent: "center" }}>
              {(totalClientes ?? 0) === 0 ? (
                <Link href="/app/clientes/novo" className={s.botao}>Cadastrar cliente</Link>
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
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const sit = situacaoDaCobranca(c, hoje);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                          {c.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca}>{c.clientes?.nome ?? "—"}</td>
                      <td className={s.celulaFraca}>{formatarData(c.vence_em)}</td>
                      <td className={s.valorCelula}>{formatarCentavos(c.valor_centavos)}</td>
                      <td>
                        <span className={`${s.etiqueta} ${CLASSE[sit]}`}>
                          {ROTULO_SITUACAO[sit]}
                        </span>
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
