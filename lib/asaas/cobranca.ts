/**
 * Módulo de Cobranças do Asaas (payments).
 *
 * Mapeia cobranças individuais do Zelo para payments no Asaas.
 *
 * Toda função aceita `credencial`. Omitir mantém o comportamento anterior
 * (conta da plataforma); passar a credencial da subconta faz a cobrança
 * nascer — e o dinheiro cair — na conta do profissional.
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";
import { AsaasBillingType, AsaasPayment, AsaasPixQrCode } from "./tipos";

export type CriarCobrancaAsaasDados = {
  customer: string;
  billingType?: AsaasBillingType;
  valorCentavos: number;
  dueDate: string;
  description: string;
  externalReference?: string | null;
};

/**
 * Cria uma cobrança no Asaas.
 * Converte centavos inteiros do Zelo para o valor decimal (float) exigido pelo Asaas.
 */
export async function criarCobrancaAsaas(
  dados: CriarCobrancaAsaasDados,
  credencial?: CredencialAsaas
) {
  const corpo = {
    customer: dados.customer,
    billingType: dados.billingType || "PIX",
    value: dados.valorCentavos / 100,
    dueDate: dados.dueDate,
    description: dados.description,
    externalReference: dados.externalReference || undefined,
  };

  return asaasRequisicao<AsaasPayment>("/payments", {
    metodo: "POST",
    corpo,
    credencial,
  });
}

/**
 * Obtém o QR Code e código copia-e-cola do Pix para uma cobrança.
 */
export async function obterPixQrCode(paymentId: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, {
    metodo: "GET",
    credencial,
  });
}

/**
 * Consulta o status atual de uma cobrança no Asaas.
 */
export async function obterCobrancaAsaas(paymentId: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasPayment>(`/payments/${paymentId}`, {
    metodo: "GET",
    credencial,
  });
}

/**
 * Remove/cancela uma cobrança no Asaas.
 */
export async function cancelarCobrancaAsaas(paymentId: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<{ id: string; deleted: boolean }>(`/payments/${paymentId}`, {
    metodo: "DELETE",
    credencial,
  });
}
