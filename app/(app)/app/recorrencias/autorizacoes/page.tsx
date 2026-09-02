import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import type { StatusAutorizacao } from "@/lib/core/autorizacao";
import s from "../../../App.module.css";

export const metadata = { title: "Autorizações Pix Automático" };

const POR_PAGINA = 20;

const FILTROS: { v: string; r: string }[] = [
  { v: "todas", r: "Todas" },
  { v: "ACTIVE", r: "Ativas" },
  { v: "CREATED", r: "Aguardando" },
  { v: "REFUSED", r: "Recusadas" },
  { v: "EXPIRED", r: "Expiradas" },
  { v: "CANCELLED", r: "Canceladas" },
];

const ROTULO_STATUS: Record<StatusAutorizacao, string> = {
  CREATED: "Aguardando autorização",
  ACTIVE: "Ativa",
  REFUSED: "Recusada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

const CLASSE_STATUS: Record<StatusAutorizacao, string> = {
  CREATED: s.sitVencida,
  ACTIVE: s.sitPaga,
  REFUSED: s.sitEstornada,
  CANCELLED: s.sitCancelada,
  EXPIRED: s.sitEstornada,
};

type Autorizacao = {
  id: string;
  recorrencia_id: string;
  status: StatusAutorizacao;
  finish_date: string;
  cancellation_reason: string | null;
  criado_em: string;
  recorrencias: { id: string; descricao: string; clientes: { id: string; nome: string } | null } | null;
};

/**
 * Autorizações Pix Automático — Fase 12 do Core Financeiro.
 *
 * O CONSENTIMENTO do pagador, listado por si — hoje só era visível uma
 * de cada vez, na ficha da própria recorrência (Fase 6). Aqui dá pra
 * ver todas de uma vez, o que importa pra achar rápido as que precisam
 * de atenção (recusadas/expiradas).
 */
export default async function ListaAutorizacoes({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; pagina?: string }>;
}) {
  const { f = "todas", pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  /* `recorrencias!autorizacoes_pix_recorrencia_id_fkey`: `autorizacoes_pix`
     tem DUAS relações com `recorrencias` (a FK direta `recorrencia_id`, e
     a reversa `recorrencias.autorizacao_atual_id` apontando de volta) —
     sem o nome explícito da constraint, o PostgREST recusa o embed por
     ambiguidade (`PGRST201`, achado ao testar esta consulta de verdade). */
  let consulta = supabase
    .from("autorizacoes_pix")
    .select(
      "id, recorrencia_id, status, finish_date, cancellation_reason, criado_em, recorrencias!autorizacoes_pix_recorrencia_id_fkey!inner(id, descricao, clientes(id, nome))",
      { count: "exact" }
    )
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  if (f !== "todas") consulta = consulta.eq("status", f);

  const { data, count, error } = await consulta;
  const autorizacoes = (data ?? []) as unknown as Autorizacao[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));

  const url = (m: { f?: string; pagina?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { f, pagina: String(p), ...m };
    if (alvo.f && alvo.f !== "todas") sp.set("f", alvo.f);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const t = sp.toString();
    return t ? `/app/recorrencias/autorizacoes?${t}` : "/app/recorrencias/autorizacoes";
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Autorizações Pix Automático</h1>
        <p className={s.subtitulo}>
          {total === 0 ? "Nenhuma autorização solicitada ainda." : `${total} autorização${total > 1 ? "ões" : ""}.`}
        </p>
      </header>

      <div className={s.barraTopo}>
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
        <Link href="/app/recorrencias" className={s.botaoSec}>← Recorrências</Link>
      </div>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar as autorizações agora. Recarregue a página.
        </div>
      )}

      {!error && autorizacoes.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {f !== "todas" ? "Nenhuma autorização encontrada" : "Nenhuma autorização solicitada ainda"}
          </h2>
          <p className={s.vazioTexto}>
            {f !== "todas"
              ? "Mude o filtro pra ver outras autorizações."
              : "Autorização Pix Automático é solicitada a partir da ficha de uma recorrência ativa."}
          </p>
        </section>
      )}

      {autorizacoes.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Recorrência</th>
                  <th>Cliente</th>
                  <th>Solicitada em</th>
                  <th>Válida até</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {autorizacoes.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/app/recorrencias/${a.recorrencia_id}`} className={s.linkTabela}>
                        {a.recorrencias?.descricao ?? "—"}
                      </Link>
                    </td>
                    <td className={s.celulaFraca}>{a.recorrencias?.clientes?.nome ?? "—"}</td>
                    <td className={s.celulaFraca}>
                      {new Date(a.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                    <td className={s.celulaFraca}>
                      {new Date(a.finish_date).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <span className={`${s.etiqueta} ${CLASSE_STATUS[a.status]}`}>{ROTULO_STATUS[a.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ultima > 1 && (
            <nav className={s.paginacao} aria-label="Paginação">
              <span>Página {p} de {ultima}</span>
              <span style={{ display: "flex", gap: 8 }}>
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
