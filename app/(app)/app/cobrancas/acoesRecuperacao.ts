"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { ehRegraDeLembrete, ehTipoDeAcao, type RegraLembrete, type TipoAcaoCobranca } from "@/lib/recuperacao";

/**
 * Ações de RECUPERAÇÃO. Nenhuma delas envia mensagem, cria cobrança ou mexe
 * em dinheiro: só REGISTRAM o que o profissional fez (abriu o WhatsApp,
 * copiou o link, combinou uma negociação). O envio de verdade continua sendo
 * dele, no WhatsApp.
 *
 * Isolamento: a empresa vem da SESSÃO; a escrita passa pelo cliente de
 * sessão (RLS exige ser membro e `usuario_id = auth.uid()`) e a chave
 * estrangeira composta (cobranca_id, empresa_id) impede apontar para a
 * cobrança de outra empresa.
 */

export type ResultadoRecuperacao = { ok: true } | { ok: false; mensagem: string };

const TIPOS_DO_CLIENTE: readonly TipoAcaoCobranca[] = ["whatsapp", "link_copiado", "lembrete_whatsapp"];

async function contexto() {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return null;
  return { supabase: await supabaseServer(), empresaId: atual.membro.empresa_id as string, userId: atual.user.id };
}

async function cobrancaAberta(supabase: Awaited<ReturnType<typeof supabaseServer>>, empresaId: string, id: string) {
  const { data } = await supabase
    .from("cobrancas")
    .select("id, status, negociada_em")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data) return { ok: false as const, erro: "Cobrança não encontrada." };
  if (data.status !== "pendente" && data.status !== "enviada") return { ok: false as const, erro: "Esta cobrança não está em aberto." };
  return { ok: true as const, cobranca: data };
}

/** "WhatsApp aberto", "link copiado", "lembrete feito" — registro leve, sem efeito financeiro. */
export async function registrarAcaoCobranca(
  cobrancaId: string,
  tipo: string,
  regra?: string | null
): Promise<ResultadoRecuperacao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  if (!ehTipoDeAcao(tipo) || !TIPOS_DO_CLIENTE.includes(tipo)) return { ok: false, mensagem: "Ação inválida." };
  const regraValida: RegraLembrete | null = regra && ehRegraDeLembrete(regra) ? regra : null;

  const aberta = await cobrancaAberta(ctx.supabase, ctx.empresaId, cobrancaId);
  if (!aberta.ok) return { ok: false, mensagem: aberta.erro };

  const { error } = await ctx.supabase.from("acoes_cobranca").insert({
    empresa_id: ctx.empresaId,
    cobranca_id: cobrancaId,
    tipo,
    regra: tipo === "lembrete_whatsapp" ? regraValida : null,
    usuario_id: ctx.userId,
  });
  if (error) {
    console.error("[recuperacao] falha ao registrar ação:", error.code);
    return { ok: false, mensagem: "Não conseguimos registrar agora." };
  }
  return { ok: true };
}

/** Tira a cobrança da fila de atraso: o profissional combinou algo com o cliente. Reversível. */
export async function marcarComoNegociada(cobrancaId: string): Promise<ResultadoRecuperacao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const aberta = await cobrancaAberta(ctx.supabase, ctx.empresaId, cobrancaId);
  if (!aberta.ok) return { ok: false, mensagem: aberta.erro };
  if (aberta.cobranca.negociada_em) return { ok: true }; // idempotente

  const { count, error } = await ctx.supabase
    .from("cobrancas")
    .update({ negociada_em: new Date().toISOString() }, { count: "exact" })
    .eq("id", cobrancaId)
    .eq("empresa_id", ctx.empresaId)
    .in("status", ["pendente", "enviada"])
    .is("negociada_em", null);
  if (error) return { ok: false, mensagem: "Não conseguimos salvar agora." };

  if (count) {
    await ctx.supabase
      .from("acoes_cobranca")
      .insert({ empresa_id: ctx.empresaId, cobranca_id: cobrancaId, tipo: "negociada", usuario_id: ctx.userId });
  }
  revalidarTelas(cobrancaId);
  return { ok: true };
}

export async function reabrirNegociacao(cobrancaId: string): Promise<ResultadoRecuperacao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const aberta = await cobrancaAberta(ctx.supabase, ctx.empresaId, cobrancaId);
  if (!aberta.ok) return { ok: false, mensagem: aberta.erro };
  if (!aberta.cobranca.negociada_em) return { ok: true };

  const { count, error } = await ctx.supabase
    .from("cobrancas")
    .update({ negociada_em: null }, { count: "exact" })
    .eq("id", cobrancaId)
    .eq("empresa_id", ctx.empresaId)
    .in("status", ["pendente", "enviada"])
    .not("negociada_em", "is", null);
  if (error) return { ok: false, mensagem: "Não conseguimos salvar agora." };

  if (count) {
    await ctx.supabase
      .from("acoes_cobranca")
      .insert({ empresa_id: ctx.empresaId, cobranca_id: cobrancaId, tipo: "reaberta", usuario_id: ctx.userId });
  }
  revalidarTelas(cobrancaId);
  return { ok: true };
}

function revalidarTelas(cobrancaId: string) {
  revalidatePath("/app/inadimplencia");
  revalidatePath(`/app/cobrancas/${cobrancaId}`);
  revalidatePath("/app");
}
