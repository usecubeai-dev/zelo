/**
 * Módulo de Autorizações Pix Automático do Asaas.
 *
 * ⚠ SERVIDOR APENAS. Toda função aceita `credencial` — nasce na
 * subconta do profissional (é o dinheiro dele que está sendo
 * consentido), nunca na plataforma.
 *
 * Confirmado por consulta direta à API Reference em 01/09/2026 (não
 * assumido de versões antigas):
 * - `POST /v3/pix/automatic/authorizations` — criação
 * - `GET /v3/pix/automatic/authorizations/{id}` — consulta
 * - `DELETE /v3/pix/automatic/authorizations/{id}` — cancelamento
 * - `GET /v3/pix/automatic/authorizations?customerId=` — listagem (para
 *   reconciliação; NÃO existe filtro por `contractId`, então a busca
 *   pelo nosso `contractId` é feita no cliente, sobre os resultados de
 *   `customerId`)
 *
 * `contractId` tem limite de 35 caracteres — um UUID com hífens tem 36.
 * Por isso usamos o UUID da recorrência SEM hífens (32 chars) como
 * `contractId`, e a mesma transformação para comparar de volta.
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";
import {
  AsaasFrequenciaPix,
  AsaasListResponse,
  AsaasPaymentCreationMode,
  AsaasPixAutomaticAuthorization,
  AsaasRetryPolicyPix,
} from "./tipos";

if (typeof window !== "undefined") {
  throw new Error("lib/asaas/autorizacao-pix.ts é servidor-apenas e foi importado no cliente.");
}

/** `recorrenciaId` sem hífens — determinístico, sempre o mesmo para a mesma recorrência. */
export function contractIdDaRecorrencia(recorrenciaId: string): string {
  return recorrenciaId.replace(/-/g, "");
}

export type CriarAutorizacaoPixDados = {
  customerId: string;
  contractId: string;
  frequency: AsaasFrequenciaPix;
  startDate: string;
  finishDate: string;
  /** Valor fixo do ciclo recorrente, em centavos — convertido pra decimal aqui. */
  valorCentavos: number;
  description: string;
  paymentCreationMode: AsaasPaymentCreationMode;
  retryPolicy: AsaasRetryPolicyPix;
  immediateQrCode: {
    /** Valor da primeira cobrança (o QR combinado), em centavos. */
    valorOriginalCentavos: number;
    expirationSeconds: number;
    description?: string;
  };
};

/**
 * Cria uma autorização Pix Automático — gera junto o QR de primeiro
 * pagamento/consentimento (`immediateQrCode` é obrigatório na criação).
 */
export async function criarAutorizacaoPixAsaas(
  dados: CriarAutorizacaoPixDados,
  credencial: CredencialAsaas
) {
  const corpo = {
    customerId: dados.customerId,
    contractId: dados.contractId,
    frequency: dados.frequency,
    startDate: dados.startDate,
    finishDate: dados.finishDate,
    value: dados.valorCentavos / 100,
    description: dados.description,
    paymentCreationMode: dados.paymentCreationMode,
    retryPolicy: dados.retryPolicy,
    immediateQrCode: {
      originalValue: dados.immediateQrCode.valorOriginalCentavos / 100,
      expirationSeconds: dados.immediateQrCode.expirationSeconds,
      description: dados.immediateQrCode.description,
    },
  };

  return asaasRequisicao<AsaasPixAutomaticAuthorization>("/pix/automatic/authorizations", {
    metodo: "POST",
    corpo,
    credencial,
  });
}

export async function consultarAutorizacaoPixAsaas(id: string, credencial: CredencialAsaas) {
  return asaasRequisicao<AsaasPixAutomaticAuthorization>(`/pix/automatic/authorizations/${id}`, {
    metodo: "GET",
    credencial,
  });
}

/** Idempotente do lado do Asaas: cancelar uma autorização já cancelada não deve ser tratado como falha de verdade — checar `status` na resposta de erro se necessário. */
export async function cancelarAutorizacaoPixAsaas(id: string, credencial: CredencialAsaas) {
  return asaasRequisicao<AsaasPixAutomaticAuthorization>(`/pix/automatic/authorizations/${id}`, {
    metodo: "DELETE",
    credencial,
  });
}

/**
 * Lista autorizações de um cliente — usada só para reconciliação
 * (resposta perdida / retry após timeout). Filtra por `customerId` no
 * servidor Asaas; filtrar por `contractId` é responsabilidade de quem
 * chama, sobre os resultados.
 */
export async function listarAutorizacoesPixAsaas(customerId: string, credencial: CredencialAsaas) {
  return asaasRequisicao<AsaasListResponse<AsaasPixAutomaticAuthorization>>("/pix/automatic/authorizations", {
    metodo: "GET",
    parametros: { customerId },
    credencial,
  });
}
