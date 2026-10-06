/**
 * Constantes jurídicas CENTRAIS — o único lugar onde versões, prazos e
 * regras legais do produto são declarados.
 *
 * Nada aqui é texto jurídico: são números e identificadores que o código
 * precisa. O que ainda depende do advogado ou do proprietário fica como
 * `[PREENCHER]` / `null` e o comportamento correspondente permanece DESLIGADO
 * até alguém preencher.
 */

export const PREENCHER = "[PREENCHER]";

/**
 * Versão dos documentos que o usuário ACEITA. Os textos de /termos e
 * /privacidade ainda são rascunho (sem versão vigente aprovada pelo
 * advogado); quando forem aprovados, trocar estas duas strings — todo mundo
 * é levado a aceitar de novo no próximo acesso (`/aceite`).
 */
export const TERMS_VERSION = "2026-10-06-rascunho";
export const PRIVACY_VERSION = "2026-10-06-rascunho";

/** Direito de arrependimento (CDC, art. 49): 7 dias a contar do pagamento da contratação. */
export const ARREPENDIMENTO_DIAS = 7;

/**
 * Prazo de retenção dos registros fiscais/contábeis depois da exclusão da
 * conta (cobranças, pagamentos, assinaturas, taxas, comissões).
 *
 * `null` = [PREENCHER] (decisão do advogado/contador). Enquanto for `null`
 * o job de eliminação definitiva NÃO elimina nada — mesmo ligado.
 */
export const RETENCAO_FISCAL_ANOS: number | null = null;
export const RETENCAO_FISCAL_ROTULO = RETENCAO_FISCAL_ANOS === null ? PREENCHER : `${RETENCAO_FISCAL_ANOS} anos`;

/** O job de eliminação definitiva só roda com esta variável de ambiente = "true". Começa desligado. */
export const RETENCAO_JOB_ENV = "RETENCAO_JOB_ATIVO";

export function retencaoJobLigado(env: Record<string, string | undefined> = process.env): boolean {
  return env[RETENCAO_JOB_ENV]?.trim().toLowerCase() === "true";
}

/** Data a partir da qual a empresa excluída em `excluidaEm` pode ser eliminada de vez. `null` se o prazo ainda não foi definido. */
export function dataLimiteDeRetencao(excluidaEm: Date, anos: number | null = RETENCAO_FISCAL_ANOS): Date | null {
  if (anos === null || !Number.isFinite(anos) || anos <= 0) return null;
  const d = new Date(excluidaEm.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  return d;
}

/** O pagador ainda aparece no registro fiscal só pelo documento (CPF/CNPJ) — nunca por nome, e-mail ou telefone. */
export const RETER_DOCUMENTO_DO_PAGADOR_EM_REGISTRO_FISCAL = true;
