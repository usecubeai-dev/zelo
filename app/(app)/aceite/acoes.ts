"use server";

import { headers } from "next/headers";
import { usuarioAtual } from "@/lib/supabase/server";
import { origemDaRequisicao, registrarAceite } from "@/lib/core/aceite-legal";

export type ResultadoAceite = { ok: true } | { ok: false; mensagem: string };

/**
 * Novo aceite (a versão dos Termos ou da Política mudou, ou a conta é de
 * antes do aceite existir). A pessoa vem da SESSÃO; IP e user agent são os
 * que o servidor viu. Sem o "marcou o checkbox", nada é gravado.
 */
export async function registrarAceiteAction(aceite: boolean): Promise<ResultadoAceite> {
  if (aceite !== true) {
    return { ok: false, mensagem: "Para continuar, aceite os Termos de Uso e a Política de Privacidade." };
  }
  const atual = await usuarioAtual();
  if (!atual) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const origem = origemDaRequisicao(await headers());
  const r = await registrarAceite({
    userId: atual.user.id,
    empresaId: (atual.membro?.empresa_id as string | undefined) ?? null,
    origem: "reaceite",
    ip: origem.ip,
    userAgent: origem.userAgent,
  });
  return r.ok ? { ok: true } : { ok: false, mensagem: "Não foi possível registrar agora. Tente novamente." };
}
