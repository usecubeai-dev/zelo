/**
 * Caso de uso: descobrir o e-mail de quem deveria receber a notificação
 * de uma empresa — o profissional dono da conta.
 *
 * ⚠ SERVIDOR APENAS. `empresas` não guarda e-mail nenhum (de propósito —
 * o e-mail de login vive só em `auth.users`, gerenciado pelo Supabase
 * Auth). O caminho é sempre `empresa_id` → `membros` (papel `dono`) →
 * `user_id` → `auth.users.email`, resolvido via
 * `lib/supabase/admin.ts::obterEmailDoUsuario`.
 *
 * Nunca lança: usado só para decidir se um e-mail de notificação pode
 * ser enviado — a ausência de destinatário nunca deveria impedir o caso
 * de uso principal (ex.: processar um webhook) de terminar.
 */

import { supabaseAdmin, supabaseConfigurado, obterEmailDoUsuario } from "../supabase/admin";

export async function emailDoResponsavelDaEmpresa(empresaId: string): Promise<string | null> {
  if (!supabaseConfigurado()) return null;

  try {
    const admin = supabaseAdmin();

    const { data: dono } = await admin
      .from("membros")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .eq("papel", "dono")
      .limit(1)
      .maybeSingle();

    // Defensivo: toda empresa deveria ter um `dono` (é o papel default na
    // criação), mas se por algum motivo não houver, cai para qualquer
    // membro em vez de simplesmente não notificar ninguém.
    const membro =
      dono ??
      (await admin.from("membros").select("user_id").eq("empresa_id", empresaId).limit(1).maybeSingle()).data;

    const userId = membro?.user_id as string | undefined;
    if (!userId) return null;

    return await obterEmailDoUsuario(userId);
  } catch {
    return null;
  }
}
