"use server";

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { COOKIE_INDICACAO, normalizarCodigo } from "@/lib/indicacao-codigo";
import { vincularIndicacaoDoUsuario } from "@/lib/core/indicacao";

/** Código de indicação guardado no cookie (ou `null`). Só formato — a validade real é do banco. */
export async function indicacaoDoCookie(): Promise<string | null> {
  const armazem = await cookies();
  return normalizarCodigo(armazem.get(COOKIE_INDICACAO)?.value);
}

/**
 * Cadastro que já volta com sessão (projeto sem confirmação de e-mail):
 * não passa pelo `/auth/callback`, então o vínculo da indicação é feito aqui.
 * Idempotente; nunca lança e nunca atrapalha a entrada.
 */
export async function vincularIndicacaoAposCadastro(): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const metadata = (user.user_metadata ?? {}) as { ref?: unknown };
    await vincularIndicacaoDoUsuario({
      userId: user.id,
      email: user.email ?? null,
      metadataRef: metadata.ref,
      cookieRef: (await cookies()).get(COOKIE_INDICACAO)?.value,
    });
  } catch (e) {
    console.error("[criar-conta] vínculo de indicação falhou:", e instanceof Error ? e.message : "erro");
  }
}
