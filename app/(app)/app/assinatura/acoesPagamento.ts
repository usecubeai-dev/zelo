"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/supabase/server";
import {
  conferirPagamentoDaAssinatura,
  obterPagamentoDaAssinatura,
  type PagamentoDaAssinatura,
} from "@/lib/core/pagamento-assinatura";
import type { EstadoPagamento } from "@/lib/checkout";

/**
 * Ações do checkout. A empresa vem SEMPRE da sessão; só o dono vê o pagamento.
 * Nenhuma delas muda a assinatura por conta própria: lêem o estado e, na
 * conferência, só aplicam o que o parceiro de pagamentos já confirmou — pelo
 * mesmo caminho (e a mesma idempotência) do webhook.
 */

export type ResultadoLeitura =
  | { ok: true; pagamento: PagamentoDaAssinatura | null }
  | { ok: false; mensagem: string };

export async function lerPagamentoDaAssinatura(): Promise<ResultadoLeitura> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  if (atual.membro.papel !== "dono") return { ok: false, mensagem: "Só o responsável pela conta vê o pagamento." };
  return obterPagamentoDaAssinatura(atual.membro.empresa_id as string);
}

export type ResultadoAtualizacao =
  | { ok: true; estado: EstadoPagamento | "sem_pagamento" }
  | { ok: false; mensagem: string };

/** "Já paguei — atualizar": pede ao servidor o estado ATUAL. Não marca nada como pago. */
export async function atualizarPagamentoDaAssinatura(): Promise<ResultadoAtualizacao> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  if (atual.membro.papel !== "dono") return { ok: false, mensagem: "Só o responsável pela conta pode atualizar o pagamento." };

  const r = await conferirPagamentoDaAssinatura(atual.membro.empresa_id as string);
  if (r.ok) {
    revalidatePath("/app/assinatura");
    revalidatePath("/app");
  }
  return r;
}
