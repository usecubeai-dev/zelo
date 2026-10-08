import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Cliente, formatarWhatsapp } from "@/lib/cliente";
import { hojeISO } from "@/lib/cobranca";
import PageHeader from "../PageHeader";
import ResumoCards from "../ResumoCards";
import s from "../../App.module.css";

export const metadata = { title: "Clientes" };

const POR_PAGINA = 20;

type Busca = { q?: string; status?: string; pagina?: string };

export default async function ListaClientes({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const { q = "", status = "ativo", pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("clientes")
    .select("id,nome,email,whatsapp,status,criado_em", { count: "exact" })
    /* redundante com o RLS de propósito: se uma policy for afrouxada por
       engano, esta linha ainda segura */
    .eq("empresa_id", empresaId)
    .order("nome")
    .range(de, de + POR_PAGINA - 1);

  if (status !== "todos") consulta = consulta.eq("status", status);
  if (q.trim()) {
    const termo = `%${q.trim()}%`;
    consulta = consulta.or(`nome.ilike.${termo},email.ilike.${termo}`);
  }

  const { data, count, error } = await consulta;
  const clientes = (data ?? []) as Pick<
    Cliente,
    "id" | "nome" | "email" | "whatsapp" | "status" | "criado_em"
  >[];
  const total = count ?? 0;

  /* "Em atraso" — retenção: quem tem cobrança vencida aparece marcado na
     própria lista, não só como contagem solta no dashboard. Só busca
     pros clientes desta página (não a base inteira), e só quando há
     clientes pra checar. */
  const idsAtraso = new Set<string>();
  if (clientes.length > 0) {
    const { data: vencidas } = await supabase
      .from("cobrancas")
      .select("cliente_id")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .lt("vence_em", hojeISO())
      .in("cliente_id", clientes.map((c) => c.id));
    (vencidas ?? []).forEach((v) => idsAtraso.add(v.cliente_id));
  }
  /* Resumo do topo (da empresa toda, não só desta página): ativos, em atraso
     (cliente com cobrança vencida em aberto) e novos neste mês. */
  const inicioDoMes = `${hojeISO().slice(0, 7)}-01`;
  const [ativosTotal, atrasoTotal, novosMes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ativo"),
    supabase.from("cobrancas").select("cliente_id").eq("empresa_id", empresaId).in("status", ["pendente", "enviada"]).lt("vence_em", hojeISO()),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gte("criado_em", `${inicioDoMes}T00:00:00`),
  ]);
  const clientesEmAtraso = new Set((atrasoTotal.data ?? []).map((v) => v.cliente_id)).size;

  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = Boolean(q.trim()) || status !== "ativo";

  const url = (mudanca: Partial<Busca>) => {
    const sp = new URLSearchParams();
    const alvo = { q, status, pagina: String(p), ...mudanca };
    if (alvo.q) sp.set("q", alvo.q);
    if (alvo.status && alvo.status !== "ativo") sp.set("status", alvo.status);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const s = sp.toString();
    return s ? `/app/clientes?${s}` : "/app/clientes";
  };

  return (
    <>
      <PageHeader
        titulo="Clientes"
        subtitulo={total === 0 ? "Nenhum cliente ainda." : `${total} cliente${total > 1 ? "s" : ""}.`}
        acoes={
          <Link href="/app/clientes/novo" className={s.botao}>
            Novo cliente
          </Link>
        }
      />

      <ResumoCards
        rotulo="Resumo dos clientes"
        itens={[
          { rotulo: "Clientes ativos", valor: String(ativosTotal.count ?? 0) },
          {
            rotulo: "Em atraso",
            valor: String(clientesEmAtraso),
            tom: clientesEmAtraso > 0 ? "alerta" : undefined,
            apoio: clientesEmAtraso > 0 ? "com cobrança vencida" : undefined,
          },
          { rotulo: "Novos este mês", valor: String(novosMes.count ?? 0) },
        ]}
      />

      <section className={s.painelFiltros} aria-label="Buscar e filtrar">
        <div className={s.barraTopo}>
          {/* GET puro: a busca fica na URL, então é compartilhável, volta no
              botão de voltar e funciona sem JavaScript */}
          <form className={s.busca} method="get" action="/app/clientes">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar clientes"
            />
            {status !== "ativo" && <input type="hidden" name="status" value={status} />}
            <button type="submit" className={s.botaoSec}>Buscar</button>
          </form>

          <div className={s.filtros}>
            {[
              { v: "ativo", r: "Ativos" },
              { v: "arquivado", r: "Arquivados" },
              { v: "todos", r: "Todos" },
            ].map((f) => (
              <Link
                key={f.v}
                href={url({ status: f.v, pagina: "1" })}
                className={status === f.v ? `${s.filtro} ${s.filtroAtivo}` : s.filtro}
                aria-current={status === f.v ? "true" : undefined}
              >
                {f.r}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar seus clientes agora. Recarregue a página.
        </div>
      )}

      {!error && clientes.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {filtrando ? "Nenhum cliente encontrado" : "Cadastre seu primeiro cliente"}
          </h2>
          <p className={s.vazioTexto}>
            {filtrando
              ? "Tente outro termo ou mude o filtro."
              : "Seus clientes ficam aqui. Depois de cadastrar, você cria cobranças para eles."}
          </p>
          {!filtrando && (
            <div className={s.acoes} style={{ justifyContent: "center" }}>
              <Link href="/app/clientes/novo" className={s.botao}>Novo cliente</Link>
            </div>
          )}
        </section>
      )}

      {clientes.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>WhatsApp</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nome">
                      <Link href={`/app/clientes/${c.id}`} className={s.linkTabela}>
                        {c.nome}
                      </Link>
                    </td>
                    <td className={s.celulaFraca} data-label="E-mail">{c.email ?? "—"}</td>
                    <td className={s.celulaFraca} data-label="WhatsApp">{formatarWhatsapp(c.whatsapp)}</td>
                    <td data-label="Situação">
                      <span
                        className={
                          c.status === "ativo"
                            ? `${s.etiqueta} ${s.etiquetaAtivo}`
                            : `${s.etiqueta} ${s.etiquetaArquivado}`
                        }
                      >
                        {c.status === "ativo" ? "Ativo" : "Arquivado"}
                      </span>
                      {idsAtraso.has(c.id) && (
                        <span className={`${s.etiqueta} ${s.sitVencida}`} style={{ marginLeft: 6 }}>
                          Em atraso
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ultimaPagina > 1 && (
            <nav className={s.paginacao} aria-label="Paginação">
              <span>Página {p} de {ultimaPagina}</span>
              <span className={s.paginacaoAcoes}>
                {p > 1 && (
                  <Link href={url({ pagina: String(p - 1) })} className={s.botaoSec}>
                    Anterior
                  </Link>
                )}
                {p < ultimaPagina && (
                  <Link href={url({ pagina: String(p + 1) })} className={s.botaoSec}>
                    Próxima
                  </Link>
                )}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
