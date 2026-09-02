/**
 * Consultas de situação da conta (subconta) — sem criar nem alterar.
 *
 * ⚠ SERVIDOR APENAS.
 *
 * `/myAccount/*` são endpoints "eu mesmo": autenticam pela credencial de
 * QUEM PERGUNTA. Para saber a situação de UMA empresa, a chamada precisa
 * sair com a credencial DAQUELA subconta (`credencialDaEmpresa`), nunca
 * com a credencial da plataforma — são contas diferentes na visão do
 * Asaas, e `/myAccount/status/` responderia sobre a conta errada.
 *
 * `GET /accounts` (busca de subconta por CPF/CNPJ), ao contrário, sai
 * com a credencial da PLATAFORMA — é ela quem enxerga as subcontas que
 * criou.
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";

if (typeof window !== "undefined") {
  throw new Error("lib/asaas/conta.ts é servidor-apenas e foi importado no cliente.");
}

/**
 * Enum real do Asaas, confirmado em `GET /v3/myAccount/status/`
 * (docs.asaas.com/reference/consultar-situacao-cadastral-da-conta).
 * "A conta estará 100% aprovada quando `general` for APPROVED" — citação
 * literal da doc.
 */
export type StatusAprovacaoAsaas = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";

export type SituacaoContaAsaas = {
  id: string;
  commercialInfo: StatusAprovacaoAsaas;
  bankAccountInfo: StatusAprovacaoAsaas;
  documentation: StatusAprovacaoAsaas;
  general: StatusAprovacaoAsaas;
};

/** `GET /v3/myAccount/status/` — precisa da credencial DA SUBCONTA. */
export async function consultarSituacaoConta(credencial: CredencialAsaas) {
  return asaasRequisicao<SituacaoContaAsaas>("/myAccount/status/", { metodo: "GET", credencial });
}

/**
 * Um documento pendente, confirmado em
 * docs.asaas.com/reference/verificar-documentos-pendentes.
 * `onboardingUrl` é POR DOCUMENTO, não uma URL única de conta — achado
 * que corrigiu a suposição inicial do plano da Fase 2/3 (ver
 * ZELO_FINANCIAL_CORE_ARCHITECTURE.md).
 */
export type DocumentoPendenteAsaas = {
  id: string;
  status: "NOT_SENT" | "PENDING" | "APPROVED" | "REJECTED" | "IGNORED";
  type: string;
  title: string;
  description: string;
  onboardingUrl: string | null;
  onboardingUrlExpirationDate: string | null;
};

/**
 * `GET /v3/myAccount/documents` — precisa da credencial DA SUBCONTA.
 * A doc recomenda esperar 15s depois da criação da subconta antes de
 * chamar isto — quem chama decide quando, esta função só faz a chamada.
 */
export async function consultarDocumentosPendentes(credencial: CredencialAsaas) {
  return asaasRequisicao<{ data: DocumentoPendenteAsaas[] }>("/myAccount/documents", {
    metodo: "GET",
    credencial,
  });
}

/**
 * `POST /myAccount/documents/{id}` — envio de documento via API.
 *
 * ⚠ NÃO IMPLEMENTADO nesta fase: o corpo exato da requisição
 * (content-type, campo do arquivo, formatos aceitos, tamanho máximo) não
 * foi confirmado na documentação oficial durante esta pesquisa — a
 * página de referência retornou 404. Implementar um upload sem essa
 * confirmação seria inventar contrato de API, que as regras desta fase
 * proíbem explicitamente.
 *
 * Para esta fase, TODO documento pendente é tratado pela via do
 * `onboardingUrl` — que é, aliás, o caminho documentado como padrão para
 * identificação/selfie no modelo BaaS. Reavaliar quando a API Reference
 * do upload puder ser confirmada.
 */
export const enviarDocumentoViaApi = null;

export type SubcontaEncontrada = {
  id: string;
  walletId: string;
  cpfCnpj: string;
  email: string;
};

/**
 * `GET /v3/accounts?cpfCnpj=...` — busca subconta já existente pelo
 * documento, com a credencial da PLATAFORMA (é a conta-pai quem lista as
 * subcontas que criou). Usado só em reconciliação: descobrir se uma
 * criação que pareceu falhar do lado do Zelo na verdade se completou do
 * lado do Asaas.
 */
export async function buscarSubcontaPorDocumento(cpfCnpj: string) {
  return asaasRequisicao<{ data: SubcontaEncontrada[] }>("/accounts", {
    metodo: "GET",
    parametros: { cpfCnpj: cpfCnpj.replace(/\D/g, "") },
  });
}
