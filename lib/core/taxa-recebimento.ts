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

/**
 * Cobrança POSTERIOR da taxa — infraestrutura, não automação.
 *
 * Não existe (ainda) um mecanismo seguro para debitar a taxa do profissional
 * sozinho; improvisar um seria mexer em dinheiro sem garantia. O que há:
 * saber, por profissional, quanto é devido (só recebimentos REAIS, em
 * produção, ainda não cobrados) e marcar de uma vez, de forma atômica, o que
 * já foi cobrado por fora — sem nunca contar a mesma taxa duas vezes.
 */
export type TaxaACobrar = {
  empresaId: string | null;
  empresaNome: string;
  quantidade: number;
  totalCentavos: number;
  maisAntiga: string;
};

export async function listarTaxasACobrar(): Promise<TaxaACobrar[]> {
  const { data, error } = await supabaseAdmin().rpc("taxas_a_cobrar");
  if (error) throw new Error(`taxas_a_cobrar falhou (${error.code ?? "sem código"})`);
  return (
    (data ?? []) as {
      empresa_id: string | null;
      empresa_nome: string;
      quantidade: number;
      total_centavos: number;
      mais_antiga: string;
    }[]
  ).map((r) => ({
    empresaId: r.empresa_id,
    empresaNome: r.empresa_nome,
    quantidade: Number(r.quantidade),
    totalCentavos: Number(r.total_centavos),
    maisAntiga: r.mais_antiga,
  }));
}

export async function marcarTaxasFaturadas(
  empresaId: string,
  referencia: string
): Promise<{ quantidade: number; totalCentavos: number }> {
  const { data, error } = await supabaseAdmin().rpc("marcar_taxas_faturadas", {
    p_empresa: empresaId,
    p_referencia: referencia,
  });
  if (error) throw new Error(`marcar_taxas_faturadas falhou (${error.code ?? "sem código"})`);
  const linha = (Array.isArray(data) ? data[0] : data) as { quantidade: number; total_centavos: number } | null;
  return { quantidade: Number(linha?.quantidade ?? 0), totalCentavos: Number(linha?.total_centavos ?? 0) };
}
