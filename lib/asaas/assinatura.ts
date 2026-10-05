/**
 * Módulo de Assinaturas do Asaas (subscriptions).
 *
 * Dois usos que não devem se misturar:
 *
 * - **a mensalidade do Zelo**, paga pelo profissional. Vive na conta da
 *   plataforma — chame sem `credencial`.
 * - **contratos recorrentes do profissional**, pagos pelos clientes dele.
 *   Vivem na subconta — passe a credencial da empresa.
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";
import {
  AsaasBillingType,
  AsaasListResponse,
  AsaasPayment,
  AsaasSubscription,
  AsaasSubscriptionCycle,
} from "./tipos";

export type CriarAssinaturaAsaasDados = {
  customer: string;
  billingType?: AsaasBillingType;
  valorCentavos: number;
  nextDueDate: string;
  cycle?: AsaasSubscriptionCycle;
  description: string;
  externalReference?: string | null;
};

/**
 * Cria uma assinatura recorrente no Asaas.
 */
export async function criarAssinaturaAsaas(
  dados: CriarAssinaturaAsaasDados,
  credencial?: CredencialAsaas
) {
  const corpo = {
    customer: dados.customer,
    billingType: dados.billingType || "PIX",
    value: dados.valorCentavos / 100,
    nextDueDate: dados.nextDueDate,
    cycle: dados.cycle || "MONTHLY",
    description: dados.description,
    externalReference: dados.externalReference || undefined,
  };

  return asaasRequisicao<AsaasSubscription>("/subscriptions", {
    metodo: "POST",
    corpo,
    credencial,
  });
}

/**
 * Consulta uma assinatura no Asaas por ID.
 */
export async function obterAssinaturaAsaas(id: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasSubscription>(`/subscriptions/${id}`, {
    metodo: "GET",
    credencial,
  });
}

/**
 * Cancela uma assinatura no Asaas.
 */
export async function cancelarAssinaturaAsaas(id: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<{ id: string; deleted: boolean }>(`/subscriptions/${id}`, {
    metodo: "DELETE",
    credencial,
  });
}

/**
 * Lista as cobranças geradas por uma assinatura (a primeira nasce junto
 * com a assinatura). Usado para obter o link de pagamento (`invoiceUrl`).
 */
export async function listarCobrancasDaAssinatura(id: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasListResponse<AsaasPayment>>(`/subscriptions/${id}/payments`, {
    metodo: "GET",
    credencial,
  });
}
