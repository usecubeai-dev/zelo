"use server";

import { revalidatePath } from "next/cache";
import { administradorAtual } from "./acesso";
import {
  criarInfluenciador,
  definirStatusInfluenciador,
  definirTermoDeParceria,
  moverComissao,
  type AcaoComissao,
  type Influenciador,
} from "@/lib/core/influenciadores";
import { linkDeIndicacao } from "@/lib/indicacao-codigo";
import { marcarTaxasFaturadas } from "@/lib/core/taxa-recebimento";
import { processarReembolso, recusarReembolso } from "@/lib/core/reembolso";
import { atualizarStatusSolicitacao, type StatusSolicitacao } from "@/lib/core/solicitacao-titular";

export type ResultadoAdmin = { ok: true } | { ok: false; mensagem: string };

const NEGADO: ResultadoAdmin = { ok: false, mensagem: "Acesso negado." };

export async function criarInfluenciadorAction(
  nome: string,
  email: string,
  codigo: string,
  termoAssinadoEm?: string
): Promise<(ResultadoAdmin & { influenciador?: Influenciador; link?: string }) | { ok: false; mensagem: string }> {
  if (!(await administradorAtual())) return NEGADO;

  const r = await criarInfluenciador({ nome, email, codigo, termoAssinadoEm: termoAssinadoEm || null });
  if (!r.ok) return r;

  revalidatePath("/app/admin/influenciadores");
  return { ok: true, influenciador: r.influenciador, link: linkDeIndicacao(r.influenciador.codigo) };
}

export async function definirStatusInfluenciadorAction(id: string, status: "ativo" | "inativo"): Promise<ResultadoAdmin> {
  if (!(await administradorAtual())) return NEGADO;
  if (status !== "ativo" && status !== "inativo") return { ok: false, mensagem: "Status inválido." };

  const ok = await definirStatusInfluenciador(id, status);
  revalidatePath("/app/admin/influenciadores");
  if (ok) return { ok: true };
  return {
    ok: false,
    mensagem:
      status === "ativo"
        ? "Não foi possível ativar: registre antes a data em que o termo de parceria foi assinado."
        : "Não foi possível atualizar agora.",
  };
}

/** Registra (ou limpa, com `null`) a data do termo de parceria. Limpar desativa o influenciador. */
export async function definirTermoParceriaAction(id: string, data: string | null): Promise<ResultadoAdmin> {
  if (!(await administradorAtual())) return NEGADO;
  const r = await definirTermoDeParceria(id, data);
  revalidatePath("/app/admin/influenciadores");
  return r;
}

/** Estorna no Asaas o reembolso do arrependimento. Só administrador; idempotente (não manda dois estornos). */
export async function processarReembolsoAction(pedidoId: string): Promise<ResultadoAdmin> {
  const admin = await administradorAtual();
  if (!admin) return NEGADO;
  const r = await processarReembolso(pedidoId, admin.user.id);
  revalidatePath("/app/admin/influenciadores");
  revalidatePath("/app/admin/solicitacoes");
  return r;
}

export async function recusarReembolsoAction(pedidoId: string, observacao: string): Promise<ResultadoAdmin> {
  const admin = await administradorAtual();
  if (!admin) return NEGADO;
  const r = await recusarReembolso(pedidoId, admin.user.id, observacao);
  revalidatePath("/app/admin/influenciadores");
  revalidatePath("/app/admin/solicitacoes");
  return r;
}

export async function atualizarStatusSolicitacaoAction(id: string, status: StatusSolicitacao): Promise<ResultadoAdmin> {
  if (!(await administradorAtual())) return NEGADO;
  const ok = await atualizarStatusSolicitacao(id, status);
  revalidatePath("/app/admin/solicitacoes");
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
