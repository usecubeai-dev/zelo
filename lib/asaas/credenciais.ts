/**
 * Guarda e resolve a credencial Asaas de cada empresa.
 *
 * ⚠ SERVIDOR APENAS. A chave de API de uma subconta dá controle total
 * sobre o dinheiro de um terceiro — vale mais que a senha do usuário.
 *
 * Três decisões governam este arquivo:
 *
 * 1. **A chave não fica em `empresas`.** Aquela tabela é legível pelo
 *    próprio tenant via RLS; um `select *` numa tela levaria a chave para
 *    o navegador. Ela vive em `asaas_credenciais`, que tem RLS ligado e
 *    NENHUMA policy — invisível a `anon` e a `authenticated`.
 * 2. **A chave é cifrada em repouso.** RLS protege contra o tenant; a
 *    cifra protege contra um dump do banco. São ameaças diferentes.
 * 3. **Nada aqui devolve a chave em claro para fora do servidor.** As
 *    funções exportadas retornam uma `CredencialAsaas`, consumida apenas
 *    por `cliente-api.ts`, que também é servidor-apenas.
 */

import crypto from "node:crypto";
import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { CredencialAsaas, baseUrlAsaas } from "./config";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/asaas/credenciais.ts é servidor-apenas e foi importado no cliente."
  );
}

const TABELA = "asaas_credenciais";
const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12;

/**
 * Chave-mestra de cifra, 32 bytes em base64 ou hex.
 * Gerar com: `openssl rand -base64 32`
 */
function chaveMestra(): Buffer | null {
  const bruta = process.env.ASAAS_CREDENTIALS_KEY?.trim();
  if (!bruta) return null;

  let buffer: Buffer;
  if (/^[0-9a-f]{64}$/i.test(bruta)) {
    buffer = Buffer.from(bruta, "hex");
  } else {
    buffer = Buffer.from(bruta, "base64");
  }

  return buffer.length === 32 ? buffer : null;
}

export function cifraConfigurada(): boolean {
  return chaveMestra() !== null;
}

/** Formato: `iv.tag.texto`, tudo em base64. */
export function cifrar(texto: string): string {
  const chave = chaveMestra();
  if (!chave) {
    throw new Error("ASAAS_CREDENTIALS_KEY ausente ou não tem 32 bytes.");
  }

  const iv = crypto.randomBytes(TAMANHO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, chave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(".");
}

export function decifrar(pacote: string): string {
  const chave = chaveMestra();
  if (!chave) {
    throw new Error("ASAAS_CREDENTIALS_KEY ausente ou não tem 32 bytes.");
  }

  const partes = pacote.split(".");
  if (partes.length !== 3) {
    throw new Error("Credencial cifrada em formato inválido.");
  }

  const [iv, tag, dados] = partes;
  const decipher = crypto.createDecipheriv(ALGORITMO, chave, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dados, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export type ResultadoCredencial =
  | { ok: true }
  | { ok: false; erro: string };

/**
 * Grava (ou substitui) a credencial de uma empresa.
 *
 * Chamada apenas logo após a criação da subconta, com a `apiKey` que o
 * Asaas devolve uma única vez. Não há caminho de leitura em claro exposto
 * ao app: quem precisa da chave usa `credencialDaEmpresa`.
 */
export async function salvarCredencialDaEmpresa(
  empresaId: string,
  apiKey: string
): Promise<ResultadoCredencial> {
  if (!supabaseConfigurado()) {
    return { ok: false, erro: "Banco de dados não configurado." };
  }
  if (!cifraConfigurada()) {
    return { ok: false, erro: "ASAAS_CREDENTIALS_KEY não configurada." };
  }

  try {
    const { error } = await supabaseAdmin()
      .from(TABELA)
      .upsert(
        { empresa_id: empresaId, api_key_cifrada: cifrar(apiKey) },
        /* A unicidade passou a ser (empresa_id, provider): uma empresa pode
           ter credencial em mais de um provedor durante uma migração. */
        { onConflict: "empresa_id,provider" }
      );

    if (error) {
      /* A mensagem do Postgres pode ecoar o valor enviado. Registra-se o
         código, nunca o conteúdo. */
      console.error("[asaas/credenciais] falha ao gravar:", error.code);
      return { ok: false, erro: "Não foi possível gravar a credencial." };
    }

    return { ok: true };
  } catch {
    console.error("[asaas/credenciais] erro inesperado ao gravar.");
    return { ok: false, erro: "Não foi possível gravar a credencial." };
  }
}

/**
 * Resolve a credencial de uma empresa.
 *
 * Devolve `null` quando a empresa ainda não tem subconta — estado normal
 * durante a migração, não erro. Quem chama decide o que fazer com isso.
 */
export async function credencialDaEmpresa(
  empresaId: string
): Promise<CredencialAsaas | null> {
  if (!supabaseConfigurado() || !cifraConfigurada()) return null;

  try {
    const { data, error } = await supabaseAdmin()
      .from(TABELA)
      .select("api_key_cifrada")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error || !data?.api_key_cifrada) return null;

    return {
      apiKey: decifrar(data.api_key_cifrada),
      baseUrl: baseUrlAsaas(),
      origem: "subconta",
      empresaId,
    };
  } catch {
    console.error("[asaas/credenciais] falha ao resolver credencial da empresa.");
    return null;
  }
}

/** Se a empresa já tem credencial gravada — sem tocar no valor. */
export async function empresaTemCredencial(empresaId: string): Promise<boolean> {
  if (!supabaseConfigurado()) return false;

  const { data } = await supabaseAdmin()
    .from(TABELA)
    .select("id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return Boolean(data?.id);
}
