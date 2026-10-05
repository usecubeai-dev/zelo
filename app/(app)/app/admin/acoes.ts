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
import { marcarTaxasFaturadas } from "@/lib/core/taxa-recebimento";

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

/**
 * Registra que as taxas de recebimento pendentes de uma empresa já foram
 * cobradas POR FORA. Só marca — não cobra nem movimenta dinheiro.
 */
export async function marcarTaxasFaturadasAction(
  empresaId: string,
  referencia: string
): Promise<ResultadoAdmin & { quantidade?: number; totalCentavos?: number }> {
  if (!(await administradorAtual())) return NEGADO;
  const ref = referencia.trim();
  if (ref.length < 3 || ref.length > 80) {
    return { ok: false, mensagem: "Informe uma referência da cobrança (3 a 80 caracteres)." };
  }
  try {
    const r = await marcarTaxasFaturadas(empresaId, ref);
    revalidatePath("/app/admin/influenciadores");
    if (r.quantidade === 0) return { ok: false, mensagem: "Não há taxa pendente para esta conta." };
    return { ok: true, ...r };
  } catch {
    return { ok: false, mensagem: "Não foi possível atualizar agora." };
  }
}
