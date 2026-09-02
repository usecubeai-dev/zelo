/**
 * Log de auditoria financeira — `log_acoes_financeiras`.
 *
 * Extraído de `lib/core/onboarding.ts` (Fase 2) para ser reusado pela
 * Fase 4 sem duplicar a mesma função. `entidade_id` é `text`, não `uuid`
 * — de propósito: referencia tanto IDs internos do Zelo (uuid) quanto
 * IDs externos do Asaas ("acc_...", "cus_..."), e forçar uuid rejeitava
 * o segundo caso em silêncio (achado em teste na Fase 2, corrigido em
 * `fase8_corrige_tipo_entidade_id_log`).
 */

import { supabaseAdmin } from "../supabase/admin";

export async function registrarAcaoFinanceira(
  empresaId: string,
  usuarioId: string | null,
  acao: string,
  entidadeId?: string | null
) {
  const { error } = await supabaseAdmin()
    .from("log_acoes_financeiras")
    .insert({ empresa_id: empresaId, usuario_id: usuarioId, acao, entidade_id: entidadeId ?? null });

  if (error) {
    /* Não derruba a operação principal — mas fica visível no log do
       servidor. Engolir em silêncio total foi o que escondeu o bug do
       tipo de coluna até o teste flagrar; nunca mais silencioso demais. */
    console.error("[core/auditoria] falha ao registrar auditoria:", acao, error.code);
  }
}
