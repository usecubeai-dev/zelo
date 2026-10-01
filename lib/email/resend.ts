/**
 * Provider Resend — a ÚNICA parte desta camada que sabe o formato da API
 * do Resend. Mesmo padrão de `lib/asaas/cliente-api.ts` (`asaasRequisicao`):
 * `fetch` cru, sem SDK, timeout via `AbortController`, nunca lança.
 *
 * Servidor apenas. `RESEND_API_KEY` nunca sai daqui — nem em retorno de
 * função, nem em log (ver `lib/email/registrar.ts`).
 */

import { EmailEnvio, ResultadoEnvioEmail, ProvedorDeEmail } from "./tipos";
import { getEmailConfiguration } from "./config";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_PADRAO_MS = 15_000;

type RespostaResendSucesso = { id: string };
type RespostaResendErro = { message?: string; name?: string };

export const provedorResend: ProvedorDeEmail = {
  nome: "resend",

  async enviar(envio: EmailEnvio): Promise<ResultadoEnvioEmail> {
    const config = getEmailConfiguration();
    if (!config.apiKey || !config.from) return { status: "nao_configurado" };

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_PADRAO_MS);

    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [envio.to],
          reply_to: config.replyTo,
          subject: envio.subject,
          html: envio.html,
          text: envio.text,
        }),
        cache: "no-store",
        signal: controlador.signal,
      });

      const texto = await res.text();
      let corpo: unknown = null;
      try {
        corpo = texto ? JSON.parse(texto) : null;
      } catch {
        corpo = null;
      }

      if (res.ok) {
        const id = (corpo as RespostaResendSucesso | null)?.id ?? "desconhecido";
        return { status: "enviado", id };
      }

      const mensagem = (corpo as RespostaResendErro | null)?.message || `HTTP ${res.status}`;

      /* 4xx = o Resend recusou o payload/config (domínio não verificado,
         endereço inválido, remetente não autorizado) — tentar de novo sem
         mudar nada não ajuda. 5xx/outros = problema do lado do provider,
         pode valer retry numa fase futura. */
      if (res.status >= 400 && res.status < 500) {
        return { status: "rejeitado", detalhe: mensagem };
      }
      return { status: "falhou", detalhe: mensagem };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "falhou", detalhe: "tempo esgotado ao contatar o Resend" };
      }
      return { status: "falhou", detalhe: err instanceof Error ? err.message : "erro de rede" };
    } finally {
      clearTimeout(temporizador);
    }
  },
};
