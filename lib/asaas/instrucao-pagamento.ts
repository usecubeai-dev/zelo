/**
 * Módulo de Instruções de Pagamento do Pix Automático (Asaas).
 *
 * ⚠ SERVIDOR APENAS. Toda função aceita `credencial` — sempre a da
 * subconta do profissional.
 *
 * **Não existe endpoint de criação.** A instrução nasce automaticamente
 * quando o Zelo cria um `payment` com `pixAutomaticAuthorizationId`
 * (`lib/asaas/cobranca.ts`) — este módulo só DESCOBRE (consulta/lista) e
 * RETENTA, nunca cria. Confirmado por consulta direta à API Reference em
 * 01/09/2026:
 * - `GET /v3/pix/automatic/paymentInstructions/{id}` — consulta
 * - `GET /v3/pix/automatic/paymentInstructions?authorizationId=&customerId=&paymentId=&status=` — listagem
 * - `POST /v3/pix/automatic/paymentInstructions/{id}/retries` — retentativa (instrução recusada)
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";
import { AsaasListResponse, AsaasPixAutomaticPaymentInstruction, AsaasStatusInstrucaoPix } from "./tipos";

if (typeof window !== "undefined") {
  throw new Error("lib/asaas/instrucao-pagamento.ts é servidor-apenas e foi importado no cliente.");
}

export async function consultarInstrucaoPagamentoAsaas(id: string, credencial: CredencialAsaas) {
  return asaasRequisicao<AsaasPixAutomaticPaymentInstruction>(`/pix/automatic/paymentInstructions/${id}`, {
    metodo: "GET",
    credencial,
  });
}

export type FiltroInstrucoesPagamento = {
  authorizationId?: string;
  customerId?: string;
  paymentId?: string;
  status?: AsaasStatusInstrucaoPix;
};

/**
 * Listagem — usada pra DESCOBRIR a instrução gerada por uma cobrança
 * (filtrando por `paymentId`, a correlação mais direta que existe: é o
 * `asaas_payment_id` que o Zelo já guarda em `cobrancas`) e pra
 * reconciliação.
 */
export async function listarInstrucoesPagamentoAsaas(
  filtro: FiltroInstrucoesPagamento,
  credencial: CredencialAsaas
) {
  return asaasRequisicao<AsaasListResponse<AsaasPixAutomaticPaymentInstruction>>("/pix/automatic/paymentInstructions", {
    metodo: "GET",
    parametros: {
      authorizationId: filtro.authorizationId,
      customerId: filtro.customerId,
      paymentId: filtro.paymentId,
      status: filtro.status,
    },
    credencial,
  });
}

/** Nova data de vencimento para a retentativa — obrigatória, formato `YYYY-MM-DD`. */
export async function criarRetentativaInstrucaoAsaas(id: string, novoVencimento: string, credencial: CredencialAsaas) {
  return asaasRequisicao<AsaasPixAutomaticPaymentInstruction>(`/pix/automatic/paymentInstructions/${id}/retries`, {
    metodo: "POST",
    corpo: { dueDate: novoVencimento },
    credencial,
  });
}
