"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/supabase/server";
import { marcarComoLida, marcarTodasComoLidas } from "@/lib/core/notificacoes";

async function empresaAtual(): Promise<string | null> {
  const atual = await usuarioAtual();
  return (atual?.membro?.empresa_id as string | undefined) ?? null;
}

export async function marcarNotificacaoLidaAcao(id: string): Promise<{ ok: boolean }> {
  const empresaId = await empresaAtual();
  if (!empresaId) return { ok: false };

  const ok = await marcarComoLida(id, empresaId);
  revalidatePath("/app/notificacoes");
  return { ok };
}

export async function marcarTodasNotificacoesLidasAcao(): Promise<{ ok: boolean }> {
  const empresaId = await empresaAtual();
  if (!empresaId) return { ok: false };

  await marcarTodasComoLidas(empresaId);
  revalidatePath("/app/notificacoes");
  return { ok: true };
}
