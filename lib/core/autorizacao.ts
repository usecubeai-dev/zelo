/**
 * Contrato de Autorização Pix Automático — sem React, sem DOM.
 *
 * Representa o CONSENTIMENTO do pagador, separado da cobrança (a
 * obrigação comercial) e da instrução de pagamento (um ciclo específico).
 * Ver `ZELO_FINANCIAL_CORE_ARCHITECTURE.md` §3.1 pro motivo da separação.
 *
 * O enum de `status` é o enum REAL da API do Asaas — confirmado por
 * leitura direta da API Reference em 31/08/2026
 * (`POST/DELETE /v3/pix/automatic/authorizations`), não inventado.
 * Nenhum estado intermediário foi acrescentado: `CREATED` já cobre o
 * período entre a criação e o pagamento do QR combinado.
 */

export type StatusAutorizacao = "CREATED" | "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED";

export type AutorizacaoPix = {
  id: string;
  empresa_id: string;
  recorrencia_id: string;
  cliente_id: string;
  asaas_authorization_id: string | null;
  asaas_subscription_id: string | null;
  status: StatusAutorizacao;
  finish_date: string;
  retry_policy: string;
  cancellation_date: string | null;
  cancellation_reason: string | null;
  criado_em: string;
  atualizado_em: string;
};

/**
 * Só estes dois estados são "vivos" — é a mesma regra que o índice único
 * `autorizacoes_pix_uma_viva_por_recorrencia` impõe no banco. Manter os
 * dois lugares em sincronia é responsabilidade de quem editar aqui.
 */
const ESTADOS_VIVOS: readonly StatusAutorizacao[] = ["CREATED", "ACTIVE"];

export function estaViva(status: StatusAutorizacao): boolean {
  return ESTADOS_VIVOS.includes(status);
}

/** Só uma autorização ATIVA libera a recorrência a gerar instruções. */
export function autorizaCobranca(status: StatusAutorizacao): boolean {
  return status === "ACTIVE";
}

/**
 * Transições válidas, espelhando o fluxo real (ver arquitetura §5.2):
 *
 *   CREATED → ACTIVE     (QR combinado pago — webhook)
 *   CREATED → REFUSED    (QR combinado expirou sem pagar — webhook)
 *   ACTIVE  → CANCELLED  (DELETE explícito ou revogação do payer — webhook/caso de uso)
 *   ACTIVE  → EXPIRED    (finish_date alcançada)
 *   CREATED → CANCELLED  (cancelamento antes mesmo de ativar)
 *
 * Qualquer outra combinação é rejeitada — inclusive reabrir uma
 * CANCELLED/REFUSED/EXPIRED. Uma autorização nesse estado é definitiva;
 * o caminho é criar uma NOVA (ver arquitetura §5.2, "nova autorização
 * após cancelamento").
 */
const TRANSICOES_VALIDAS: Record<StatusAutorizacao, readonly StatusAutorizacao[]> = {
  CREATED: ["ACTIVE", "REFUSED", "CANCELLED"],
  ACTIVE: ["CANCELLED", "EXPIRED"],
  CANCELLED: [],
  REFUSED: [],
  EXPIRED: [],
};

export function transicaoValida(de: StatusAutorizacao, para: StatusAutorizacao): boolean {
  return TRANSICOES_VALIDAS[de].includes(para);
}

/**
 * Quem pode provocar cada transição — documentado aqui porque é regra de
 * segurança, não só de domínio (ver arquitetura §14: nenhum status
 * financeiro muda pela mão do frontend).
 */
export type OrigemTransicao = "webhook" | "caso_de_uso" | "reconciliacao";

const ORIGEM_PERMITIDA: Record<StatusAutorizacao, readonly OrigemTransicao[]> = {
  CREATED: ["caso_de_uso"], // só a criação, que já nasce CREATED
  ACTIVE: ["webhook", "reconciliacao"],
  CANCELLED: ["webhook", "caso_de_uso", "reconciliacao"], // caso_de_uso = DELETE explícito
  REFUSED: ["webhook", "reconciliacao"],
  EXPIRED: ["webhook", "reconciliacao"], // normalmente detectado por reconciliação, contra finish_date
};

export function origemPermitida(para: StatusAutorizacao, origem: OrigemTransicao): boolean {
  return ORIGEM_PERMITIDA[para].includes(origem);
}
