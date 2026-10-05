import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  CobrancaComCliente,
  ROTULO_SITUACAO,
  diasAte,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { formatarCentavos } from "@/lib/dinheiro";
import { rotuloAcao } from "@/lib/atividade";
import AcoesCobranca from "../AcoesCobranca";
import WhatsappCobranca, { WhatsappPreparando } from "./WhatsappCobranca";
import s from "../../../App.module.css";

export const metadata = { title: "Cobrança" };

export default async function FichaCobranca({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("cobrancas")
    .select("*, clientes(id,nome,whatsapp)")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  /* 404 e não "sem permissão": dizer que existe mas é de outra empresa já
     entrega informação sobre dados alheios. */
  if (!data) notFound();
  const cobranca = data as CobrancaComCliente;

  const hoje = hojeISO();
  const sit = situacaoDaCobranca(cobranca, hoje);
  const dias = diasAte(cobranca.vence_em, hoje);

  /* Timeline real (Fase 12) — "não inventar etapas": a lista vem do
     próprio log de auditoria (`log_acoes_financeiras`), que já registra
     cada transição de verdade que aconteceu com esta cobrança ou (se
     Pix Automático) com a instrução do ciclo. "Criada" é o único item
     sintético — não é auditado à parte, mas `criado_em` é uma coluna
     real, não um valor inventado. */
  const { data: instrucao } = await supabase
    .from("instrucoes_pagamento")
    .select("id, status, refusal_reason")
    .eq("cobranca_id", cobranca.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const idsParaTimeline = [cobranca.id, instrucao?.id].filter(Boolean) as string[];
  const { data: eventos } = await supabase
    .from("log_acoes_financeiras")
    .select("id, acao, criado_em")
    .eq("empresa_id", empresaId)
    .in("entidade_id", idsParaTimeline)
    .order("criado_em", { ascending: true });

  const timeline = [
    { id: "criada", rotulo: "Cobrança criada", quando: cobranca.criado_em },
    ...(eventos ?? []).map((e) => ({ id: e.id, rotulo: rotuloAcao(e.acao), quando: e.criado_em })),
  ];

  const prazo =
    sit === "paga"
      ? `Paga em ${
          cobranca.pago_em
            ? new Date(cobranca.pago_em).toLocaleDateString("pt-BR")
            : "—"
        }`
      : sit === "estornada"
        ? `Estornada em ${
            cobranca.estornado_em
              ? new Date(cobranca.estornado_em).toLocaleDateString("pt-BR")
              : "—"
          }`
        : sit === "cancelada"
        ? "Cancelada"
        : dias === 0
          ? "Vence hoje"
          : dias > 0
            ? `Vence em ${dias} dia${dias > 1 ? "s" : ""}`
            : `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{cobranca.descricao}</h1>
        <p className={s.subtitulo}>
          {cobranca.clientes?.nome ?? "—"} · {prazo}
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Valor</span>
          <span className={s.numeroValor}>
            {formatarCentavos(cobranca.valor_centavos)}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Vencimento</span>
          <span className={s.numeroValor}>{formatarData(cobranca.vence_em)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>{ROTULO_SITUACAO[sit]}</span>
        </div>
        {cobranca.valor_estornado_centavos != null && (
          <div className={s.numero}>
            <span className={s.numeroRotulo}>Valor estornado</span>
            <span className={s.numeroValor}>
              {formatarCentavos(cobranca.valor_estornado_centavos)}
            </span>
          </div>
        )}
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Tipo</span>
          <span className={s.numeroValor}>
            {cobranca.recorrencia_id ? "Recorrente" : "Única"}
          </span>
        </div>
      </div>

      <div className={s.acoes}>
        {/* Só para cobrança em aberto: paga/cancelada/estornada não tem o que cobrar.
            Ação de COMUNICAÇÃO — abre o WhatsApp com a mensagem pronta; não muda nada na cobrança. */}
        {(cobranca.status === "pendente" || cobranca.status === "enviada") && cobranca.clientes && (
          <Suspense fallback={<WhatsappPreparando />}>
            <WhatsappCobranca
              empresaId={empresaId}
              cobranca={{
                valor_centavos: cobranca.valor_centavos,
                vence_em: cobranca.vence_em,
                asaas_payment_id: cobranca.asaas_payment_id,
              }}
              cliente={{
                id: cobranca.clientes.id,
                nome: cobranca.clientes.nome,
                whatsapp: cobranca.clientes.whatsapp ?? null,
              }}
            />
          </Suspense>
        )}
        <AcoesCobranca id={cobranca.id} status={cobranca.status} temPaymentAsaas={!!cobranca.asaas_payment_id} />
      </div>

      <div className={s.acoes}>
        <Link href="/app/cobrancas" className={s.faixaLink}>
          ← Voltar para cobranças
        </Link>
        {cobranca.clientes && (
          <Link
            href={`/app/clientes/${cobranca.clientes.id}`}
            className={s.faixaLink}
          >
            Ver cliente
          </Link>
        )}
        {cobranca.recorrencia_id && (
          <Link
            href={`/app/recorrencias/${cobranca.recorrencia_id}`}
            className={s.faixaLink}
          >
            Ver recorrência
          </Link>
        )}
      </div>

      {instrucao?.status === "REFUSED" && (
        <div className={`${s.avisoConexao} ${s.avisoConexaoPerigo}`}>
          {instrucao.refusal_reason ? (
            <details>
              <summary style={{ cursor: "pointer" }}>Débito automático recusado — ver motivo</summary>
              <p style={{ marginTop: 8 }}>Motivo informado pelo parceiro de pagamentos: {instrucao.refusal_reason}</p>
            </details>
          ) : (
            <span>Débito automático recusado.</span>
          )}
        </div>
      )}

      <div className={s.bloco} style={{ marginTop: 26 }}>
        <h3 className={s.blocoTitulo}>Histórico</h3>
        <div className={s.atividadeLista}>
          {timeline.map((ev) => (
            <div key={ev.id} className={s.atividadeItem}>
              <span className={s.atividadeTexto}>{ev.rotulo}</span>
              <span className={s.atividadeQuando}>
                {new Date(ev.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
