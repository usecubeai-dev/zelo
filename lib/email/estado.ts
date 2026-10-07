/**
 * Disponibilidade do e-mail para o cliente final — decidida no SERVIDOR
 * (depende de variáveis de ambiente que nunca vão ao navegador).
 */

import { getEmailConfiguration } from "./config";

export type EstadoEmail = "disponivel" | "sem_email" | "nao_configurado";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function enderecoDeEmailValido(valor: string | null | undefined): boolean {
  return EMAIL_VALIDO.test((valor ?? "").trim());
}

/** "joao.silva@gmail.com" → "j***@gmail.com": confirma o destino sem expor o endereço inteiro. */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  return `${(usuario ?? "").slice(0, 1)}***@${dominio ?? ""}`;
}

export function estadoDoEmailDoCliente(email: string | null | undefined): EstadoEmail {
  if (!enderecoDeEmailValido(email)) return "sem_email";
  return getEmailConfiguration().isConfigured ? "disponivel" : "nao_configurado";
}
