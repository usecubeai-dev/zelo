import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  ROTULO_STATUS_RECORRENCIA,
  RecorrenciaComCliente,
} from "@/lib/recorrencia";
import { formatarCentavos } from "@/lib/dinheiro";
import s from "../../App.module.css";

export const metadata = { title: "Recorrências" };

const POR_PAGINA = 20;

const FILTROS = [
  { v: "todas", r: "Todas" },
  { v: "ativas", r: "Ativas" },
  { v: "pausadas", r: "Pausadas" },
  { v: "encerradas", r: "Encerradas" },
];

const CLASSE_STATUS: Record<string, string> = {
  ativa: s.sitPaga,
  pausada: s.sitVencida,
  encerrada: s.sitCancelada,
};

export default async function ListaRecorrencias({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; pagina?: string }>;
}) {
  const { q = "", f = "todas", pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("recorrencias")
    .select("*, clientes(id,nome)", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  if (f === "ativas") consulta = consulta.eq("status", "ativa");
  else if (f === "pausadas") consulta = consulta.eq("status", "pausada");
  else if (f === "encerradas") consulta = consulta.eq("status", "encerrada");

  if (q.trim()) consulta = consulta.ilike("descricao", `%${q.trim()}%`);

  const { data, count, error } = await consulta;
  const recorrencias = (data ?? []) as RecorrenciaComCliente[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = Boolean(q.trim()) || f !== "todas";

  const { count: totalClientes } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  const url = (m: { q?: string; f?: string; pagina?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { q, f, pagina: String(p), ...m };
    if (alvo.q) sp.set("q", alvo.q);
    if (alvo.f && alvo.f !== "todas") sp.set("f", alvo.f);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const t = sp.toString();
    return t ? `/app/recorrencias?${t}` : "/app/recorrencias";
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Recorrências</h1>
        <p className={s.subtitulo}>
          {total === 0
            ? "Nenhum acordo recorrente ainda."
            : `${total} recorrência${total > 1 ? "s" : ""}.`}
        </p>
      </header>

      <div className={s.barraTopo}>
        <form className={s.busca} method="get" action="/app/recorrencias">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar pela descrição"
            aria-label="Buscar recorrências"
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
          <Link href="/app/recorrencias/nova" className={s.botao}>
            Nova recorrência
          </Link>
        )}
      </div>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar suas recorrências agora. Recarregue a página.
        </div>
      )}

      {!error && recorrencias.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {filtrando
              ? "Nenhuma recorrência encontrada"
              : (totalClientes ?? 0) === 0
                ? "Cadastre um cliente primeiro"
                : "Crie sua primeira recorrência"}
          </h2>
          <p className={s.vazioTexto}>
            {filtrando
              ? "Tente outro termo ou mude o filtro."
              : (totalClientes ?? 0) === 0
                ? "Toda recorrência pertence a um cliente. Comece cadastrando quem você cobra."
                : "Configure uma mensalidade para gerar cobranças automáticas sem esforço manual."}
          </p>
          {!filtrando && (
            <div className={s.acoes} style={{ justifyContent: "center" }}>
              {(totalClientes ?? 0) === 0 ? (
                <Link href="/app/clientes/novo" className={s.botao}>
                  Cadastrar cliente
                </Link>
              ) : (
                <Link href="/app/recorrencias/nova" className={s.botao}>
                  Nova recorrência
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {recorrencias.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Valor mensal</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {recorrencias.map((r) => {
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/app/recorrencias/${r.id}`} className={s.linkTabela}>
                          {r.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca}>{r.clientes?.nome ?? "—"}</td>
                      <td className={s.celulaFraca}>Todo dia {r.dia_vencimento}</td>
                      <td className={s.valorCelula}>
                        {formatarCentavos(r.valor_centavos)}
                      </td>
                      <td>
                        <span className={`${s.etiqueta} ${CLASSE_STATUS[r.status] || ""}`}>
                          {ROTULO_STATUS_RECORRENCIA[r.status]}
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
              <span style={{ display: "flex", gap: 8 }}>
                {p > 1 && (
                  <Link href={url({ pagina: String(p - 1) })} className={s.botaoSec}>
                    Anterior
                  </Link>
                )}
                {p < ultima && (
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
