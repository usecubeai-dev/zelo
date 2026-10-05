/**
 * Mensalidade do Zelo — receita de ASSINATURA.
 *
 * Sem React, sem DOM. É um dos três fluxos financeiros que NUNCA se
 * misturam (os outros: `taxa-recebimento.ts` e `indicacao.ts`).
 *
 * Toda a escrita passa pela função SQL `registrar_mensalidade`, que roda
 * numa transação e serializa por empresa (lock na linha de `empresas`).
 * É isso — e não um "select e depois insert" aqui no TS — que garante que
 * dois webhooks simultâneos (PAYMENT_CONFIRMED + PAYMENT_RECEIVED) não
 * gerem duas "primeiras mensalidades" nem duas comissões.
 */

import { supabaseAdmin } from "../supabase/admin";
import { ambienteAsaas } from "../asaas/config";

export type EventoMensalidade = "criada" | "paga" | "vencida" | "cancelada" | "estornada";

/**
 * Traduz o evento do Asaas para o evento de domínio. `null` = não é um
 * evento que muda a mensalidade (ignorado, sem erro).
 */
export function eventoMensalidadeDoWebhook(eventoAsaas: string): EventoMensalidade | null {
  switch (eventoAsaas) {
    case "PAYMENT_CREATED":
      return "criada";
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      return "paga";
    case "PAYMENT_OVERDUE":
      return "vencida";
    case "PAYMENT_DELETED":
      return "cancelada";
    case "PAYMENT_REFUNDED":
      return "estornada";
    default:
      return null;
  }
}

export type DadosMensalidade = {
  empresaId: string;
  paymentId: string;
  subscriptionId?: string | null;
  valorCentavos: number;
  vencimento?: string | null;
  evento: EventoMensalidade;
  pagoEm?: string | null;
};

export type ResultadoMensalidade = {
  mensalidadeId: string | null;
  /** esta foi a primeira mensalidade paga da empresa (só em `paga`) */
  primeira: boolean;
  /** comissão criada por ESTE evento (null quando não houve) */
  comissaoId: string | null;
  /** o evento não alterou nada: reenvio, ou transição que já tinha acontecido */
  jaProcessada: boolean;
};

export async function registrarMensalidade(dados: DadosMensalidade): Promise<ResultadoMensalidade> {
  const { data, error } = await supabaseAdmin().rpc("registrar_mensalidade", {
    p_empresa: dados.empresaId,
    p_payment_id: dados.paymentId,
    p_subscription_id: dados.subscriptionId ?? null,
    p_valor_centavos: dados.valorCentavos,
    p_vencimento: dados.vencimento ?? null,
    p_evento: dados.evento,
    p_pago_em: dados.pagoEm ?? null,
    p_ambiente: ambienteAsaas(),
  });

  if (error) {
    throw new Error(`registrar_mensalidade falhou (${error.code ?? "sem código"})`);
  }

  const r = (data ?? {}) as {
    mensalidade_id?: string | null;
    primeira?: boolean;
    comissao_id?: string | null;
    ja_processada?: boolean;
  };

  return {
    mensalidadeId: r.mensalidade_id ?? null,
    primeira: Boolean(r.primeira),
    comissaoId: r.comissao_id ?? null,
    jaProcessada: Boolean(r.ja_processada),
  };
}

export type MensalidadeLinha = {
  id: string;
  plano: string;
  valor_centavos: number;
  status: "pendente" | "paga" | "vencida" | "cancelada" | "estornada";
  vencimento: string | null;
  pago_em: string | null;
  eh_primeira: boolean;
  ambiente: "sandbox" | "production";
  criada_em: string;
};
