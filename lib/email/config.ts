/**
 * Ponto único de configuração da camada de e-mail transacional.
 *
 * Mesma disciplina de `lib/asaas/config.ts`: um único lugar lê
 * `process.env`, todo o resto do sistema lê a configuração já resolvida.
 * Servidor apenas — nunca importar isto (nem transitivamente) de um
 * componente `"use client"`.
 *
 * `RESEND_API_KEY` nunca deve ter o prefixo `NEXT_PUBLIC_` — isso é o que
 * garante que o Next nunca a inclui no bundle do navegador.
 */

// Mesma defesa de lib/supabase/admin.ts: mesmo que Next.js já não injete
// uma env var sem prefixo NEXT_PUBLIC_ no bundle do navegador, este
// módulo lê RESEND_API_KEY — se algum dia vazar para o cliente por
// engano (import indireto de um componente "use client"), falha alto e
// cedo em vez de silenciosamente nunca configurar nada no navegador.
if (typeof window !== "undefined") {
  throw new Error("lib/email/config.ts é servidor-apenas e foi importado no cliente.");
}

export type EmailConfiguration = {
  apiKey?: string;
  from?: string;
  replyTo?: string;
  /** `true` só quando há chave E remetente — sem `from`, o Resend recusa qualquer envio. */
  isConfigured: boolean;
};

export function getEmailConfiguration(): EmailConfiguration {
  const apiKey = process.env.RESEND_API_KEY?.trim() || undefined;
  const from = process.env.EMAIL_FROM?.trim() || undefined;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  return {
    apiKey,
    from,
    replyTo,
    isConfigured: Boolean(apiKey && from),
  };
}
