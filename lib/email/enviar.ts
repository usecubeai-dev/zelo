/**
 * `sendEmail` — o único ponto de entrada da camada de e-mail. Todo o
 * resto do sistema (notificações, futuros fluxos) chama isto, nunca
 * `lib/email/resend.ts` diretamente. Trocar de provider, mudar timeout,
 * adicionar retry — tudo isso muda aqui ou em `lib/email/provider.ts`,
 * nunca nos chamadores.
 *
 * Nunca lança. Nunca finge sucesso. Servidor apenas.
 */

import { EmailEnvio, ResultadoEnvioEmail } from "./tipos";
import { obterProvedorDeEmail } from "./provider";
import { registrarEnvioEmail, dominioDoEmail } from "./registrar";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param envio Dados do e-mail (já renderizado — ver `lib/email/templates/`).
 * @param template Rótulo só para log/diagnóstico (ex.: "pix_automatico_inelegivel") — nunca decide comportamento.
 */
export async function sendEmail(envio: EmailEnvio, template: string): Promise<ResultadoEnvioEmail> {
  const provedor = obterProvedorDeEmail();

  const destino = envio.to.trim();
  if (!EMAIL_REGEX.test(destino)) {
    registrarEnvioEmail("destinatario_invalido", { provider: provedor.nome, template });
    return { status: "rejeitado", detalhe: "endereço de destino inválido" };
  }

  try {
    const resultado = await provedor.enviar({ ...envio, to: destino });
    registrarEnvioEmail("envio", {
      provider: provedor.nome,
      template,
      resultado: resultado.status,
      destinoDominio: dominioDoEmail(destino),
      erro: resultado.status === "falhou" || resultado.status === "rejeitado" ? resultado.detalhe : undefined,
    });
    return resultado;
  } catch {
    // O provider já não deveria lançar (ver lib/email/resend.ts) — esta é
    // a rede de segurança final: nenhum chamador de sendEmail pode ser
    // derrubado por uma falha de envio de e-mail.
    registrarEnvioEmail("erro_inesperado", { provider: provedor.nome, template });
    return { status: "falhou", detalhe: "erro inesperado ao enviar" };
  }
}
