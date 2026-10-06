/**
 * Identificação da empresa e canais de atendimento — fonte única para
 * rodapé, fluxo de contratação, páginas legais e e-mails.
 *
 * Os dados de CNPJ, razão social e endereço são os que o proprietário já
 * forneceu e que já constam nas páginas legais. O que ainda não foi
 * informado fica como `[PREENCHER]` — nada é presumido ou inventado.
 */

import { PREENCHER } from "./legal";

export const EMPRESA = {
  razaoSocial: "GOGOMOB TECNOLOGIA BR LTDA",
  nomeFantasia: "Zelo",
  cnpj: "48.443.579/0001-93",
  endereco:
    "Av. Portugal, 1148, Cond. Orion Business, Sala C 2501, Setor Marista, Goiânia - GO, CEP 74.150-030",
  emailSuporte: PREENCHER,
  emailPrivacidade: PREENCHER,
  telefoneAtendimento: PREENCHER,
  horarioAtendimento: PREENCHER,
} as const;

export type CampoEmpresa = keyof typeof EMPRESA;

export function estaPendente(valor: string): boolean {
  return valor.includes(PREENCHER);
}

/** Campos que ainda aguardam preenchimento. */
export function camposPendentesDaEmpresa(): CampoEmpresa[] {
  return (Object.keys(EMPRESA) as CampoEmpresa[]).filter((k) => estaPendente(EMPRESA[k]));
}

/** `mailto:` só quando o e-mail é real; com placeholder devolve `null` (a tela mostra o texto, sem link quebrado). */
export function mailtoDe(email: string): string | null {
  return estaPendente(email) ? null : `mailto:${email}`;
}
