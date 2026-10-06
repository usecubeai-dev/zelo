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
import { AsaasBillingType, AsaasListResponse, AsaasPayment, AsaasPixQrCode } from "./tipos";

export type CriarCobrancaAsaasDados = {
  customer: string;
  billingType?: AsaasBillingType;
  valorCentavos: number;
  dueDate: string;
  description: string;
  externalReference?: string | null;
  /**
   * Vincula a cobrança a uma autorização Pix Automático ACTIVE — sem
   * isso a cobrança vira um Pix convencional (confirmado em
   * docs.asaas.com/reference/create-new-payment, Fase 7, 01/09/2026).
   * É o que faz o Asaas gerar a `paymentInstruction` correspondente.
   */
  pixAutomaticAuthorizationId?: string | null;
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
    pixAutomaticAuthorizationId: dados.pixAutomaticAuthorizationId || undefined,
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

/**
 * Busca cobranças por `externalReference` — usado só em reconciliação:
 * descobrir se uma criação que pareceu falhar do lado do Zelo (resposta
 * perdida) na verdade se completou do lado do Asaas, antes de criar de
 * novo. Confirmado em docs.asaas.com/reference/listar-cobrancas
 * (`externalReference` é filtro válido de `GET /v3/payments`).
 */
export async function buscarCobrancaPorExternalReference(
  externalReference: string,
  credencial?: CredencialAsaas
) {
  return asaasRequisicao<AsaasListResponse<AsaasPayment>>("/payments", {
    metodo: "GET",
    parametros: { externalReference },
    credencial,
  });
}

/**
 * Estorna uma cobrança JÁ PAGA. Usado só no reembolso do arrependimento
 * (`lib/core/reembolso.ts`), por ação de um administrador — nunca
 * automaticamente. Confirmado em docs.asaas.com (Estornar cobrança):
 * `POST /v3/payments/{id}/refund` com `value` (parcial ou total) e
 * `description`.
 */
export async function estornarCobrancaAsaas(
  paymentId: string,
  valorCentavos: number,
  descricao: string,
  credencial?: CredencialAsaas
) {
  return asaasRequisicao<AsaasPayment>(`/payments/${paymentId}/refund`, {
    metodo: "POST",
    corpo: { value: valorCentavos / 100, description: descricao },
    credencial,
  });
}
