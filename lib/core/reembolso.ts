/**
 * Pedidos de reembolso do arrependimento (CDC, art. 49) — ação do ADMIN.
 *
 * O cliente pede (`lib/core/cancelamento.ts`) e o pedido fica `pendente`. O
 * Zelo NÃO devolve dinheiro sozinho: o estorno só acontece quando um
 * administrador aciona `processarReembolso`, que pede ao Asaas o estorno
 * INTEGRAL da mensalidade paga. Quando o Asaas confirma, o webhook
 * (`PAYMENT_REFUNDED`) já cuida do resto: mensalidade `estornada` e comissão
 * cancelada/sinalizada.
 *
 * Nenhuma chave aparece em retorno ou log. Servidor apenas.
 */

import { supabaseAdmin } from "../supabase/admin";
import { estornarCobrancaAsaas } from "../asaas/cobranca";
import { credencialDaPlataforma } from "../asaas/config";
import { registrarAcaoFinanceira } from "./auditoria";

export type PedidoReembolso = {
  id: string;
  empresa_id: string | null;
  empresaNome: string | null;
  valor_centavos: number;
  status: "pendente" | "processando" | "processado" | "recusado" | "falhou";
  motivo: string | null;
  solicitado_em: string;
  processado_em: string | null;
  observacao: string | null;
};

export async function listarPedidosReembolso(): Promise<PedidoReembolso[]> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("pedidos_reembolso")
    .select("id, empresa_id, valor_centavos, status, motivo, solicitado_em, processado_em, observacao")
    .order("solicitado_em", { ascending: false })
    .limit(200);
  const linhas = data ?? [];
  const ids = [...new Set(linhas.map((l) => l.empresa_id).filter(Boolean))] as string[];
  const { data: emps } = ids.length ? await admin.from("empresas").select("id, nome").in("id", ids) : { data: [] };
  const nomes = new Map((emps ?? []).map((e) => [e.id as string, e.nome as string]));
  return linhas.map((l) => ({ ...(l as Omit<PedidoReembolso, "empresaNome">), empresaNome: l.empresa_id ? nomes.get(l.empresa_id) ?? null : null }));
}

export type ResultadoReembolso = { ok: true } | { ok: false; mensagem: string };

/**
 * Estorna no Asaas. Idempotência: o pedido é "reservado" (`processando`) numa
 * única atualização condicional — duas pessoas clicando ao mesmo tempo não
 * mandam dois estornos. Só sai de `pendente` ou `falhou`.
 */
export async function processarReembolso(pedidoId: string, adminUserId: string): Promise<ResultadoReembolso> {
  if (!credencialDaPlataforma()) return { ok: false, mensagem: "Pagamentos não configurados neste ambiente." };

  const admin = supabaseAdmin();
  const { data: reservado } = await admin
    .from("pedidos_reembolso")
    .update({ status: "processando" })
    .eq("id", pedidoId)
    .in("status", ["pendente", "falhou"])
    .select("id, empresa_id, asaas_payment_id, valor_centavos")
    .maybeSingle();
  if (!reservado) return { ok: false, mensagem: "Este pedido não está pendente (já processado, recusado ou em andamento)." };

  const r = await estornarCobrancaAsaas(
    reservado.asaas_payment_id as string,
    reservado.valor_centavos as number,
    "Reembolso por arrependimento (CDC art. 49)"
  );

  if (!r.ok) {
    await admin
      .from("pedidos_reembolso")
      .update({ status: "falhou", observacao: `Asaas recusou o estorno (HTTP ${r.status}).` })
      .eq("id", pedidoId);
    return { ok: false, mensagem: "O Asaas não aceitou o estorno. Confira no painel do Asaas e tente de novo." };
  }

  await admin
    .from("pedidos_reembolso")
    .update({ status: "processado", processado_em: new Date().toISOString(), processado_por: adminUserId, observacao: null })
    .eq("id", pedidoId);
  if (reservado.empresa_id) {
    await registrarAcaoFinanceira(reservado.empresa_id as string, adminUserId, "reembolso_arrependimento_processado", pedidoId);
  }
  return { ok: true };
}

export async function recusarReembolso(pedidoId: string, adminUserId: string, observacao: string): Promise<ResultadoReembolso> {
  const obs = observacao.trim().slice(0, 500);
  if (obs.length < 3) return { ok: false, mensagem: "Informe o motivo da recusa." };
  const { data } = await supabaseAdmin()
    .from("pedidos_reembolso")
    .update({ status: "recusado", observacao: obs, processado_em: new Date().toISOString(), processado_por: adminUserId })
    .eq("id", pedidoId)
    .in("status", ["pendente", "falhou"])
    .select("id")
    .maybeSingle();
  return data ? { ok: true } : { ok: false, mensagem: "Este pedido não está pendente." };
}
