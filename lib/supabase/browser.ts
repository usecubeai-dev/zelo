"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do NAVEGADOR — chave publicável, sessão do usuário, RLS ativo.
 *
 * A chave daqui é pública de propósito e não é segredo: quem protege os
 * dados é o RLS, que aplica as policies com base no `auth.uid()` da sessão.
 * Uma chave publicável sem sessão não lê nada de nenhuma empresa.
 *
 * Use em componentes cliente (formulários de login, ações de UI). Para ler
 * dados no servidor use `server.ts`.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
