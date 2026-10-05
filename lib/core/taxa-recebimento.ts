/**
 * Taxa de R$ 1,99 por recebimento — a regra central.
 *
 * Sem React, sem DOM. Segundo dos três fluxos financeiros separados
 * (mensalidade / TAXA / comissão): aqui é dinheiro que o profissional deve
 * ao Zelo por cada pagamento que recebeu pelo Zelo.
 *
 * QUANDO nasce uma taxa — e só então:
 *   o webhook do Asaas, em contexto de SUBCONTA, traz PAYMENT_RECEIVED ou
 *   PAYMENT_CONFIRMED de uma cobrança que EXISTE nesta empresa e foi
 *   marcada como paga agora (`lib/asaas/webhook.ts`). Esse é o único
 *   caminho. Em particular NÃO gera taxa: cobrança criada, pendente,
 *   cancelada, vencida sem pagamento, baixa manual pelo profissional
 *   (`pago_via` ≠ asaas) ou pagamento em ambiente de teste (a linha é
 *   gravada com `ambiente = 'sandbox'` e nunca entra na soma devida).
 *
 * Idempotência: UNIQUE(cobranca_id) no banco. A mesma cobrança paga, mesmo
 * com PAYMENT_CONFIRMED + PAYMENT_RECEIVED + reenvios, gera UMA taxa.
 *
 * Reversão: se a cobrança é removida ou estornada por completo, a taxa é
 * cancelada (a linha fica, com `status = 'cancelada'`); se a cobrança for
 * restaurada e paga de novo, a mesma linha volta a valer.
 */

import { supabaseAdmin } from "../supabase/admin";
import { ambienteAsaas } from "../asaas/config";
import { TAXA_DE_RECEBIMENTO_CENTAVOS } from "../plano";

/** Exposto para teste: a taxa é um valor, não texto de marketing. */
export function taxaPorRecebimentoCentavos(): number {
  return TAXA_DE_RECEBIMENTO_CENTAVOS;
}

export async function registrarTaxaDeRecebimento(dados: {
  empresaId: string;
  cobrancaId: string;
  paymentId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("registrar_taxa_recebimento", {
    p_empresa: dados.empresaId,
    p_cobranca: dados.cobrancaId,
    p_payment_id: dados.paymentId,
    p_valor_centavos: taxaPorRecebimentoCentavos(),
    p_ambiente: ambienteAsaas(),
  });
  if (error) throw new Error(`registrar_taxa_recebimento falhou (${error.code ?? "sem código"})`);
  return Boolean(data);
}

export async function cancelarTaxaDeRecebimento(cobrancaId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("cancelar_taxa_recebimento", {
    p_cobranca: cobrancaId,
  });
  if (error) throw new Error(`cancelar_taxa_recebimento falhou (${error.code ?? "sem código"})`);
  return Boolean(data);
}
