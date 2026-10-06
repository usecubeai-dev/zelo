/**
 * Aceite dos Termos de Uso e da Política de Privacidade — a PROVA.
 *
 * Cada aceite grava quem (usuário/empresa), o quê (versão dos dois
 * documentos), quando, e de onde (IP e user agent da requisição que o
 * servidor recebeu — nunca um valor enviado pelo navegador). Sem linha com as
 * versões VIGENTES (`lib/legal.ts`), a pessoa não passa de `/aceite`.
 *
 * Servidor apenas. A escrita usa a chave de serviço de propósito: a tabela
 * não tem policy de INSERT, então ninguém "se dá" um aceite pela API.
 */

import { supabaseAdmin } from "../supabase/admin";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal";

export type OrigemAceite = "cadastro" | "reaceite";

type CabecalhosLeitura = { get(nome: string): string | null };

/** IP e user agent como o SERVIDOR os viu (atrás da Vercel, o IP real vem em `x-forwarded-for`). */
export function origemDaRequisicao(h: CabecalhosLeitura): { ip: string | null; userAgent: string | null } {
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (encaminhado || h.get("x-real-ip") || "").slice(0, 64) || null;
  const userAgent = (h.get("user-agent") || "").slice(0, 300) || null;
  return { ip, userAgent };
}

export async function registrarAceite(dados: {
  userId: string;
  empresaId?: string | null;
  origem: OrigemAceite;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false }> {
  const admin = supabaseAdmin();

  let empresaId = dados.empresaId ?? null;
  if (!empresaId) {
    const { data } = await admin.from("membros").select("empresa_id").eq("user_id", dados.userId).maybeSingle();
    empresaId = (data?.empresa_id as string | undefined) ?? null;
  }

  const { error } = await admin.from("aceites_legais").insert({
    user_id: dados.userId,
    empresa_id: empresaId,
    termos_versao: TERMS_VERSION,
    privacidade_versao: PRIVACY_VERSION,
    origem: dados.origem,
    ip: dados.ip,
    user_agent: dados.userAgent,
  });

  if (error) {
    console.error("[aceite-legal] falha ao registrar aceite:", error.code);
    return { ok: false };
  }
  return { ok: true };
}

/** A pessoa já aceitou as versões que estão valendo AGORA? */
export async function aceiteVigente(userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin()
      .from("aceites_legais")
      .select("id")
      .eq("user_id", userId)
      .eq("termos_versao", TERMS_VERSION)
      .eq("privacidade_versao", PRIVACY_VERSION)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    // na dúvida (falha de leitura) não trava quem já está usando o produto
    return true;
  }
}
