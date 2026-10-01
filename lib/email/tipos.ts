/**
 * Contrato da camada de e-mail — sem SDK de provider nenhum aqui. O
 * restante do sistema depende só destes tipos e de `sendEmail`
 * (`lib/email/enviar.ts`), nunca de `lib/email/resend.ts` diretamente.
 */

export type EmailEnvio = {
  to: string;
  subject: string;
  html: string;
  /** Sempre enviado junto do HTML — alguns clientes de e-mail e provedores anti-spam penalizam mensagens sem alternativa em texto puro. */
  text: string;
};

/**
 * Quatro resultados possíveis, nunca um quinto "sucesso fingido":
 *
 * - `enviado`: o provider aceitou o envio (não garante entrega — só que
 *   a chamada foi bem-sucedida do lado do Resend).
 * - `nao_configurado`: `RESEND_API_KEY`/`EMAIL_FROM` ausentes — comportamento
 *   esperado em desenvolvimento local, nunca tratado como erro.
 * - `rejeitado`: o provider recusou o payload (4xx — domínio não
 *   verificado, destinatário inválido, etc.). Não adianta tentar de novo
 *   sem mudar algo.
 * - `falhou`: erro de infraestrutura (timeout, rede, 5xx do provider).
 *   Pode fazer sentido tentar de novo depois.
 */
export type ResultadoEnvioEmail =
  | { status: "enviado"; id: string }
  | { status: "nao_configurado" }
  | { status: "rejeitado"; detalhe: string }
  | { status: "falhou"; detalhe: string };

export interface ProvedorDeEmail {
  nome: string;
  enviar(envio: EmailEnvio): Promise<ResultadoEnvioEmail>;
}
