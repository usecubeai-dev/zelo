/**
 * Ponto único de configuração para a integração com Asaas.
 *
 * Este módulo não é importado pelo cliente.
 * Toda comunicação com o Asaas ocorre exclusivamente no servidor.
 *
 * Duas credenciais coexistem, e confundi-las é o erro mais caro possível:
 *
 * - a **credencial da plataforma** (`ASAAS_API_KEY`) é a conta do próprio
 *   Zelo. Serve para criar subcontas e para cobrar a mensalidade do
 *   profissional. Nunca deve criar cobrança de cliente final.
 * - a **credencial da subconta** vive em `asaas_credenciais`, uma por
 *   empresa, e é resolvida em `lib/asaas/credenciais.ts`. É ela que
 *   movimenta o dinheiro do profissional.
 */

export type AsaasEnvironment = "sandbox" | "production";

export type AsaasConfiguration = {
  apiKey?: string;
  webhookToken?: string;
  environment: AsaasEnvironment;
  baseUrl: string;
  isConfigured: boolean;
};

/**
 * Credencial resolvida, pronta para uso numa requisição.
 *
 * `origem` existe para que um erro de roteamento apareça no log como o que
 * é — dinheiro indo para a conta errada — em vez de virar um 401 genérico.
 */
export type CredencialAsaas = {
  apiKey: string;
  baseUrl: string;
  origem: "plataforma" | "subconta";
  empresaId?: string;
};

export const ASAAS_URLS = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://api.asaas.com/api/v3",
} as const;

export function ambienteAsaas(): AsaasEnvironment {
  return process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
}

export function baseUrlAsaas(): string {
  return ASAAS_URLS[ambienteAsaas()];
}

export function getAsaasConfiguration(): AsaasConfiguration {
  const env = ambienteAsaas();
  const apiKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : undefined;
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
    ? process.env.ASAAS_WEBHOOK_TOKEN.trim()
    : undefined;

  return {
    apiKey,
    webhookToken,
    environment: env,
    baseUrl: ASAAS_URLS[env],
    isConfigured: Boolean(apiKey),
  };
}

/**
 * Credencial da conta do próprio Zelo.
 *
 * É o comportamento que já existia: quando nenhuma credencial é passada
 * explicitamente, a requisição sai por esta conta.
 */
export function credencialDaPlataforma(): CredencialAsaas | null {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, baseUrl: baseUrlAsaas(), origem: "plataforma" };
}

/**
 * Identificador da conta raiz do Zelo no Asaas.
 *
 * O webhook usa este valor para distinguir um evento da própria plataforma
 * (a mensalidade que o profissional paga ao Zelo) de um evento de subconta
 * (a cobrança que o cliente do profissional paga a ele).
 */
export function contaDaPlataforma(): string | null {
  return process.env.ASAAS_PLATFORM_ACCOUNT_ID?.trim() || null;
}

/**
 * Token do webhook — **sem fallback**.
 *
 * Antes, quando `ASAAS_WEBHOOK_TOKEN` faltava, o código aceitava a própria
 * `ASAAS_API_KEY` como token. Isso fazia o segredo que movimenta dinheiro
 * viajar em header de webhook e ficar exposto a qualquer log intermediário.
 * Uma chave de API é segredo financeiro; um token de webhook é segredo de
 * autenticação de origem. Reutilizar um como o outro faz o vazamento de um
 * virar o comprometimento dos dois.
 *
 * Sem token configurado, o endpoint não processa — falha explícita em vez
 * de proteção imaginária.
 */
export function tokenDoWebhook(): string | null {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  return token ? token : null;
}
