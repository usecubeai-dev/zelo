/**
 * Exclusão de conta — LÓGICA + ANONIMIZAÇÃO, nunca "apaga tudo".
 *
 * O que acontece ao excluir (nessa ordem):
 *  1. a assinatura paga é removida no Asaas (sem novas cobranças);
 *  2. `anonimizar_empresa` (SQL, atômica): marca a empresa como excluída
 *     (`deleted_at`), tira os dados pessoais que a lei NÃO manda guardar
 *     (nome, e-mail, telefone e observações dos clientes; serviços;
 *     notificações; chave da subconta; payload bruto dos eventos) e MANTÉM o
 *     que é registro fiscal/contábil: cobranças, pagamentos, recorrências,
 *     assinaturas, taxas, comissões e o log de auditoria — com o mínimo de
 *     identificação (documento do pagador, só de quem tem cobrança);
 *  3. o login do usuário é anonimizado e bloqueado (nada de nome ou e-mail
 *     reais sobra no cadastro de acesso).
 *
 * A eliminação DEFINITIVA do que sobrou só ocorre depois do prazo de
 * retenção (`lib/legal.ts` → `RETENCAO_FISCAL_ANOS`, hoje [PREENCHER]), pelo
 * job de `lib/core/manutencao.ts`, que começa desligado.
 *
 * Idempotente: repetir não faz nada a mais. Servidor apenas.
 */

import { supabaseAdmin } from "../supabase/admin";
import { credencialDaPlataforma } from "../asaas/config";
import { cancelarAssinaturaAsaas } from "../asaas/assinatura";
import { registrarAcaoFinanceira } from "./auditoria";

/** A pessoa precisa digitar isto para confirmar — evita clique acidental. */
export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

export type ResultadoExclusao =
  | { ok: true; jaExcluida: boolean }
  | { ok: false; codigo: "sem_permissao" | "confirmacao" | "provedor" | "erro"; mensagem: string };

export function confirmacaoValida(texto: string | null | undefined): boolean {
  return (texto ?? "").trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}

export async function excluirContaZelo(d: {
  empresaId: string;
  userId: string;
  papel: string | null | undefined;
  confirmacao: string | null | undefined;
}): Promise<ResultadoExclusao> {
  if (d.papel !== "dono") {
    return { ok: false, codigo: "sem_permissao", mensagem: "Só o responsável pela conta pode excluí-la." };
  }
  if (!confirmacaoValida(d.confirmacao)) {
    return { ok: false, codigo: "confirmacao", mensagem: `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.` };
  }

  const admin = supabaseAdmin();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, asaas_subscription_id, deleted_at")
    .eq("id", d.empresaId)
    .maybeSingle();
  if (!empresa) return { ok: false, codigo: "erro", mensagem: "Conta não encontrada." };

  // 1. nenhuma cobrança nova depois de excluir
  const subscriptionId = (empresa.asaas_subscription_id as string | null) ?? null;
  if (subscriptionId && !empresa.deleted_at) {
    if (!credencialDaPlataforma()) {
      return { ok: false, codigo: "provedor", mensagem: "Não conseguimos interromper a cobrança agora. Nada foi excluído — tente novamente." };
    }
    const r = await cancelarAssinaturaAsaas(subscriptionId);
    if (!r.ok && r.status !== 404) {
      return { ok: false, codigo: "provedor", mensagem: "Não conseguimos interromper a cobrança agora. Nada foi excluído — tente novamente." };
    }
    // desvincula já: o SUBSCRIPTION_DELETED que vem do Asaas não acha mais a empresa
    await admin.from("empresas").update({ asaas_subscription_id: null }).eq("id", d.empresaId);
  }

  // 2. exclusão lógica + anonimização (atômica)
  const { data, error } = await admin.rpc("anonimizar_empresa", { p_empresa: d.empresaId });
  if (error) {
    console.error("[exclusao-conta] anonimização falhou:", error.code);
    return { ok: false, codigo: "erro", mensagem: "Não foi possível excluir agora. Nada foi perdido — tente novamente." };
  }
  const resultado = data as { ok: boolean; ja_excluida?: boolean };
  if (!resultado.ok) return { ok: false, codigo: "erro", mensagem: "Conta não encontrada." };

  // 3. o acesso: login anonimizado e bloqueado (idempotente)
  const { data: membros } = await admin.from("membros").select("user_id").eq("empresa_id", d.empresaId);
  for (const m of membros ?? []) {
    const id = m.user_id as string;
    const { error: eAuth } = await admin.auth.admin.updateUserById(id, {
      email: `excluido+${id}@zelo.invalid`,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {},
      ban_duration: "876000h",
    });
    if (eAuth) console.error("[exclusao-conta] não foi possível anonimizar o login de um membro");
  }

  if (!resultado.ja_excluida) {
    await registrarAcaoFinanceira(d.empresaId, d.userId, "conta_excluida_anonimizada", d.empresaId);
  }
  return { ok: true, jaExcluida: Boolean(resultado.ja_excluida) };
}
