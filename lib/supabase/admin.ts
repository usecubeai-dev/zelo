/**
 * Cliente ADMIN do Supabase — service_role, SOMENTE SERVIDOR.
 *
 * ⚠ ESTA CHAVE IGNORA O RLS. Ela enxerga e altera qualquer linha de
 * qualquer empresa. Use APENAS onde não existe usuário autenticado:
 * captura de lead e webhook do Asaas.
 *
 * NENHUMA tela do sistema pode importar este arquivo. Para dados do
 * usuário logado use `lib/supabase/server.ts` ou `lib/supabase/browser.ts`,
 * que passam pelo RLS. Se este módulo vazar para o código do app, o
 * isolamento entre empresas cai inteiro — e sem erro nenhum aparecer.
 */

import { createClient } from "@supabase/supabase-js";
import { Lead } from "../lead";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin.ts é servidor-apenas e foi importado no cliente."
  );
}

function getCredenciaisAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, chave };
}

const TABELA_LEADS = "leads";

export function supabaseConfigurado(): boolean {
  const { url, chave } = getCredenciaisAdmin();
  return Boolean(url && chave);
}

/**
 * Retorna o cliente admin do Supabase (service_role).
 * Usado estritamente para tarefas administrativas em segundo plano (webhooks).
 */
export function supabaseAdmin() {
  const { url, chave } = getCredenciaisAdmin();
  if (!url || !chave) {
    throw new Error(
      "Supabase Admin não configurado: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente."
    );
  }
  return createClient(url, chave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Lê o e-mail de um usuário pelo id, via API Admin do Auth
 * (`GET /auth/v1/admin/users/{id}`) — `auth.users` não é uma tabela
 * exposta via PostgREST, então não dá para usar `.from("users")` aqui.
 * Usado por `lib/core/destinatario-email.ts` para resolver quem recebe
 * o e-mail de uma notificação (o profissional dono da empresa).
 *
 * Nunca lança: e-mail é conveniência de notificação, nunca pode derrubar
 * o caso de uso que a originou.
 */
export async function obterEmailDoUsuario(userId: string): Promise<string | null> {
  const { url, chave } = getCredenciaisAdmin();
  if (!url || !chave) return null;

  try {
    const resposta = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      cache: "no-store",
    });
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as { email?: string | null };
    return dados.email ?? null;
  } catch {
    return null;
  }
}

export type ResultadoInsercao =
  | { ok: true }
  | { ok: false; motivo: "nao-configurado" }
  | { ok: false; motivo: "falha"; detalhe: string };

/**
 * Grava um lead.
 */
export async function inserirLead(
  lead: Lead,
  origem: string
): Promise<ResultadoInsercao> {
  const { url, chave } = getCredenciaisAdmin();
  if (!url || !chave) return { ok: false, motivo: "nao-configurado" };

  try {
    const resposta = await fetch(
      `${url}/rest/v1/${TABELA_LEADS}?on_conflict=email`,
      {
        method: "POST",
        headers: {
          apikey: chave,
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal,resolution=merge-duplicates",
        },
        body: JSON.stringify([{ ...lead, origem }]),
        cache: "no-store",
      }
    );

    if (resposta.ok) return { ok: true };

    const texto = await resposta.text().catch(() => "");
    return {
      ok: false,
      motivo: "falha",
      detalhe: `HTTP ${resposta.status} ${texto.slice(0, 300)}`,
    };
  } catch (erro) {
    return {
      ok: false,
      motivo: "falha",
      detalhe: erro instanceof Error ? erro.message : "erro de rede",
    };
  }
}
