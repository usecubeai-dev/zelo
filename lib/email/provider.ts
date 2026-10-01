/**
 * Resolve qual `ProvedorDeEmail` usar.
 *
 * Só existe o Resend hoje — este arquivo é o único ponto que precisaria
 * mudar para suportar um segundo provider (ex.: trocar por env var), sem
 * tocar `lib/email/enviar.ts` nem nenhum chamador.
 */

import { ProvedorDeEmail } from "./tipos";
import { provedorResend } from "./resend";

export function obterProvedorDeEmail(): ProvedorDeEmail {
  return provedorResend;
}
