"use server";

import { revalidatePath } from "next/cache";
import { administradorAtual } from "./acesso";
import {
  criarInfluenciador,
  definirStatusInfluenciador,
  moverComissao,
  type AcaoComissao,
  type Influenciador,
} from "@/lib/core/influenciadores";
import { linkDeIndicacao } from "@/lib/indicacao-codigo";

export type ResultadoAdmin = { ok: true } | { ok: false; mensagem: string };

const NEGADO: ResultadoAdmin = { ok: false, mensagem: "Acesso negado." };

export async function criarInfluenciadorAction(
  nome: string,
  email: string,
  codigo: string
): Promise<(ResultadoAdmin & { influenciador?: Influenciador; link?: string }) | { ok: false; mensagem: string }> {
  if (!(await administradorAtual())) return NEGADO;

  const r = await criarInfluenciador({ nome, email, codigo });
  if (!r.ok) return r;

  revalidatePath("/app/admin/influenciadores");
  return { ok: true, influenciador: r.influenciador, link: linkDeIndicacao(r.influenciador.codigo) };
}

export async function definirStatusInfluenciadorAction(id: string, status: "ativo" | "inativo"): Promise<ResultadoAdmin> {
  if (!(await administradorAtual())) return NEGADO;
  if (status !== "ativo" && status !== "inativo") return { ok: false, mensagem: "Status inválido." };

  const ok = await definirStatusInfluenciador(id, status);
  revalidatePath("/app/admin/influenciadores");
  return ok ? { ok: true } : { ok: false, mensagem: "Não foi possível atualizar agora." };
}

/**
 * Liberar / marcar como paga / cancelar uma comissão. "Paga" é só o REGISTRO
 * de que o pagamento foi feito por fora — não movimenta dinheiro.
 */
export async function moverComissaoAction(
  comissaoId: string,
  acao: AcaoComissao,
  observacao?: string
): Promise<ResultadoAdmin> {
  const admin = await administradorAtual();
  if (!admin) return NEGADO;
  if (acao !== "liberar" && acao !== "pagar" && acao !== "cancelar") {
    return { ok: false, mensagem: "Ação inválida." };
  }

  const r = await moverComissao(comissaoId, acao, admin.user.id, observacao ?? null);
  revalidatePath("/app/admin/influenciadores");
  return r;
}
