import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import type { StatusInstrucao } from "@/lib/core/instrucao-pagamento";
import s from "../../../App.module.css";

export const metadata = { title: "Instruções de pagamento" };

const POR_PAGINA = 20;

const FILTROS: { v: string; r: string }[] = [
  { v: "todas", r: "Todas" },
  { v: "SCHEDULED", r: "Agendadas" },
  { v: "AWAITING_REQUEST", r: "Aguardando" },
  { v: "REFUSED", r: "Recusadas" },
  { v: "DONE", r: "Processadas" },
  { v: "CANCELLED", r: "Canceladas" },
];

const ROTULO_STATUS: Record<StatusInstrucao, string> = {
  AWAITING_REQUEST: "Aguardando processamento",
  SCHEDULED: "Agendada",
  DONE: "Processada",
  REFUSED: "Recusada",
  CANCELLED: "Cancelada",
};

const CLASSE_STATUS: Record<StatusInstrucao, string> = {
  AWAITING_REQUEST: s.sitVencida,
  SCHEDULED: s.sitEnviada,
  DONE: s.sitPaga,
  REFUSED: s.sitEstornada,
  CANCELLED: s.sitCancelada,
};

type Instrucao = {
  id: string;
  cobranca_id: string;
  status: StatusInstrucao;
  due_date: string | null;
  refusal_reason: string | null;
  criado_em: string;
  cobrancas: { id: string; descricao: string; status: string; clientes: { id: string; nome: string } | null } | null;
};

/**
 * Instruções de pagamento — Fase 12 do Core Financeiro.
 *
 * O lado "o Asaas vai processar isso" de um ciclo Pix Automático,
 * listado por si — hoje só era visível uma de cada vez, na ficha da
 * recorrência (Fase 7). "Recusadas" é a categoria que mais importa
 * olhar aqui: cada uma é um ciclo que precisa de decisão (a cobrança
 * comercial continua pendente, a instrução não resolve isso sozinha —
 * ver `CicloInstrucao.tsx`).
 */
export default async function ListaInstrucoes({
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
  let consulta = supabase
    .from("instrucoes_pagamento")
    .select("id, cobranca_id, status, due_date, refusal_reason, criado_em, cobrancas!inner(id, descricao, status, clientes(id, nome))", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  if (f !== "todas") consulta = consulta.eq("status", f);

  const { data, count, error } = await consulta;
  const instrucoes = (data ?? []) as unknown as Instrucao[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));

  const url = (m: { f?: string; pagina?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { f, pagina: String(p), ...m };
    if (alvo.f && alvo.f !== "todas") sp.set("f", alvo.f);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const t = sp.toString();
    return t ? `/app/recorrencias/instrucoes?${t}` : "/app/recorrencias/instrucoes";
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Instruções de pagamento</h1>
        <p className={s.subtitulo}>
          {total === 0 ? "Nenhuma instrução gerada ainda." : `${total} instrução${total > 1 ? "ões" : ""}.`}
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
          Não conseguimos carregar as instruções agora. Recarregue a página.
        </div>
      )}

      {!error && instrucoes.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {f !== "todas" ? "Nenhuma instrução encontrada" : "Nenhuma instrução gerada ainda"}
          </h2>
          <p className={s.vazioTexto}>
            {f !== "todas"
              ? "Mude o filtro pra ver outras instruções."
              : "Instrução de pagamento nasce automaticamente quando um ciclo Pix Automático é enviado para processamento."}
          </p>
        </section>
      )}

      {instrucoes.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Cobrança</th>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {instrucoes.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Cobrança">
                      <Link href={`/app/cobrancas/${i.cobranca_id}`} className={s.linkTabela}>
                        {i.cobrancas?.descricao ?? "—"}
                      </Link>
                    </td>
                    <td className={s.celulaFraca} data-label="Cliente">{i.cobrancas?.clientes?.nome ?? "—"}</td>
                    <td className={s.celulaFraca} data-label="Vencimento">{i.due_date ? new Date(`${i.due_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                    <td data-label="Status">
                      <span className={`${s.etiqueta} ${CLASSE_STATUS[i.status]}`}>{ROTULO_STATUS[i.status]}</span>
                    </td>
                  </tr>
                ))}
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
