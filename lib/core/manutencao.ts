/**
 * Manutenção diária (cron `/api/cron/manutencao`): duas tarefas, ambas
 * idempotentes.
 *
 * 1. FIM DO PERÍODO PAGO — quem cancelou e chegou ao fim do período pago vai
 *    para o plano Grátis, sem apagar nenhum dado (`encerrar_assinaturas_vencidas`).
 * 2. ELIMINAÇÃO DEFINITIVA — contas excluídas há mais que o prazo de retenção
 *    de registros fiscais (`lib/legal.ts`) são eliminadas de vez. Esta etapa
 *    COMEÇA DESLIGADA e exige DUAS coisas: `RETENCAO_JOB_ATIVO=true` e o
 *    prazo preenchido (`RETENCAO_FISCAL_ANOS` ≠ null). Com qualquer uma
 *    faltando, nada é eliminado. Só sai o que JÁ passou do prazo.
 */

import { supabaseAdmin } from "../supabase/admin";
import { RETENCAO_FISCAL_ANOS, retencaoJobLigado } from "../legal";

export type ResumoRetencao =
  | { estado: "desligado" }
  | { estado: "prazo_nao_definido" }
  | { estado: "executado"; eliminadas: number; falhas: number };

export type ResumoManutencao = { assinaturasEncerradas: number; retencao: ResumoRetencao };

export async function eliminarContasVencidas(
  agora: Date = new Date(),
  opcoes: { ligado?: boolean; anos?: number | null } = {}
): Promise<ResumoRetencao> {
  const ligado = opcoes.ligado ?? retencaoJobLigado();
  const anos = opcoes.anos === undefined ? RETENCAO_FISCAL_ANOS : opcoes.anos;

  if (!ligado) return { estado: "desligado" };
  if (anos === null || anos <= 0) return { estado: "prazo_nao_definido" };

  const admin = supabaseAdmin();
  // só entra o que foi excluído há mais que o prazo: corte = agora − anos
  const corte = new Date(agora.getTime());
  corte.setUTCFullYear(corte.getUTCFullYear() - anos);

  const { data: vencidas } = await admin
    .from("empresas")
    .select("id")
    .not("deleted_at", "is", null)
    .lte("deleted_at", corte.toISOString())
    .limit(50);

  let eliminadas = 0;
  let falhas = 0;
  for (const e of vencidas ?? []) {
    const id = e.id as string;
    const { data: membros } = await admin.from("membros").select("user_id").eq("empresa_id", id);
    const { error } = await admin.rpc("eliminar_empresa_definitivamente", { p_empresa: id });
    if (error) {
      falhas++;
      console.error("[manutencao] não foi possível eliminar uma conta vencida:", error.code);
      continue;
    }
    for (const m of membros ?? []) await admin.auth.admin.deleteUser(m.user_id as string);
    eliminadas++;
  }
  return { estado: "executado", eliminadas, falhas };
}

export async function executarManutencaoDiaria(agora: Date = new Date()): Promise<ResumoManutencao> {
  const { data, error } = await supabaseAdmin().rpc("encerrar_assinaturas_vencidas");
  if (error) console.error("[manutencao] encerrar assinaturas falhou:", error.code);
  const retencao = await eliminarContasVencidas(agora);
  return { assinaturasEncerradas: Number(data ?? 0), retencao };
}
