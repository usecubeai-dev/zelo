/**
 * Decisão centralizada: qual método de cobrança está disponível para uma
 * recorrência agora — Pix Automático ou Pix comum.
 *
 * Fase 21 ("dois modos de cobrança"). Regra explícita do escopo: o
 * critério é elegibilidade/configuração do RECEBEDOR (a empresa), nunca
 * profissão, nicho ou qualquer heurística inventada sobre o cliente. Uma
 * função pura, sem acesso a banco — quem chama já leu `StatusElegibilidadePix`
 * (`lib/core/elegibilidade-pix.ts`) e o estado da recorrência.
 *
 * Não substitui nenhum fluxo existente: Pix Automático continua sendo
 * `autorizacao_atual_id` + `autorizacoes_pix` (Fases 6–7); Pix comum
 * continua sendo `sincronizarCobrancaFinanceira` com `billingType: "PIX"`
 * (Fase 5), já em uso em toda cobrança avulsa. Esta função só decide QUAL
 * dos dois caminhos, já existentes, uma recorrência deveria oferecer —
 * nunca implementa um caminho novo.
 */

import { StatusElegibilidadePix } from "./elegibilidade-pix";

export type MetodoCobranca = "PIX_AUTOMATICO" | "PIX_COMUM";

export type ContextoMetodoCobranca = {
  elegibilidadePix: StatusElegibilidadePix;
  /** `recorrencias.autorizacao_atual_id` — presença de uma autorização viva (CREATED/ACTIVE) já em curso. */
  autorizacaoAtivaId: string | null;
};

/**
 * `PIX_AUTOMATICO` só quando a conta não está confirmadamente inelegível
 * E já existe (ou está em andamento) uma autorização para esta
 * recorrência — nunca oferece Pix Automático como novo caminho para uma
 * conta `INELIGIBLE`, mas não interrompe uma autorização que já existia
 * antes de a conta ficar inelegível (isso é responsabilidade do webhook
 * de `AUTHORIZATION_CANCELLED`, que o Asaas dispara à parte — ver
 * `lib/asaas/webhook.ts`).
 *
 * `UNKNOWN`/`PENDING` não bloqueiam Pix Automático: a ausência de sinal
 * do Asaas não é evidência de inelegibilidade — só `INELIGIBLE`
 * confirmado é.
 */
export function determinarMetodoDeCobranca(ctx: ContextoMetodoCobranca): MetodoCobranca {
  if (ctx.autorizacaoAtivaId && ctx.elegibilidadePix !== "INELIGIBLE") {
    return "PIX_AUTOMATICO";
  }
  return "PIX_COMUM";
}

/** Se a empresa deveria conseguir SOLICITAR uma autorização nova agora. */
export function podeSolicitarPixAutomatico(elegibilidadePix: StatusElegibilidadePix): boolean {
  return elegibilidadePix !== "INELIGIBLE";
}
