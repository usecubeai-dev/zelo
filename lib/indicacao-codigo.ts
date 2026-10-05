/**
 * Código de indicação — parte PURA (sem banco, sem Node), para poder ser
 * importada pelo `proxy.ts` e pelos componentes sem puxar o cliente admin
 * do Supabase. O restante (vínculo, validação real) está em
 * `lib/core/indicacao.ts`.
 */

export const COOKIE_INDICACAO = "zelo_ref";
export const DURACAO_COOKIE_INDICACAO_DIAS = 90;

/** Alfabeto sem 0/O/1/I — o código é lido e digitado por gente. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Maiúsculas e dígitos, 4 a 20 — o mesmo CHECK do banco. `null` se inválido. */
export function normalizarCodigo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(limpo) ? limpo : null;
}

export function gerarCodigo(tamanho = 8): string {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function linkDeIndicacao(codigo: string, base?: string): string {
  const origem = (base ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.zelopay.com.br").replace(/\/+$/, "");
  return `${origem}/criar-conta?ref=${encodeURIComponent(codigo)}`;
}
