/**
 * Cancelamento da assinatura do Zelo e direito de arrependimento (7 dias).
 *
 * Sem React, sem DOM. Três regras, nessa ordem de importância:
 *
 * 1. CANCELAR É INTERROMPER A COBRANÇA, não perder o que já foi pago: a
 *    assinatura é removida no Asaas (nenhuma mensalidade nova), mas o acesso
 *    continua até o fim do período pago; o cron diário então leva a conta ao
 *    plano Grátis (`encerrar_assinaturas_vencidas`). Nenhum dado é apagado.
 * 2. ARREPENDIMENTO (CDC, art. 49): contratação paga há no máximo 7 dias →
 *    o plano pago termina agora, a conta vai ao Grátis e nasce um PEDIDO de
 *    reembolso integral da mensalidade. O dinheiro NÃO é devolvido aqui: o
 *    estorno é uma ação do administrador (`lib/core/reembolso.ts`).
 * 3. IDEMPOTENTE: pedir de novo não duplica nada e, se o Asaas tinha falhado
 *    antes, apenas tenta de novo interromper a cobrança.
 *
 * Ordem das operações (para não perder acesso por corrida com o webhook):
 * marca no banco → remove no Asaas → desvincula. O webhook ignora o
 * SUBSCRIPTION_DELETED de quem já pediu cancelamento (`webhook.ts`).
 */

import { supabaseAdmin } from "../supabase/admin";
import { credencialDaPlataforma } from "../asaas/config";
import { cancelarAssinaturaAsaas } from "../asaas/assinatura";
import { ARREPENDIMENTO_DIAS } from "../legal";
import { normalizarPlano, planoPago } from "../plano";
import { registrarAcaoFinanceira } from "./auditoria";

const DIA_MS = 86_400_000;

/**
 * Fim do período já pago: o vencimento da última mensalidade paga + 1 mês
 * (ciclo mensal), às 00:00 de Brasília. Sem vencimento, usa o dia do
 * pagamento. Dia 31 em mês curto cai no último dia do mês.
 */
export function fimDoPeriodoPago(vencimentoIso: string | null, pagoEmIso: string | null): Date | null {
  const base = vencimentoIso ?? (pagoEmIso ? new Date(pagoEmIso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : null);
  const m = base ? /^(\d{4})-(\d{2})-(\d{2})/.exec(base) : null;
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  const proximoMes = new Date(Date.UTC(ano, mes + 1, 1));
  const ultimoDia = new Date(Date.UTC(proximoMes.getUTCFullYear(), proximoMes.getUTCMonth() + 1, 0)).getUTCDate();
  const fim = new Date(Date.UTC(proximoMes.getUTCFullYear(), proximoMes.getUTCMonth(), Math.min(dia, ultimoDia), 3, 0, 0));
  return fim;
}

/** 7 dias corridos a partir do pagamento da contratação. */
export function dentroDoPrazoDeArrependimento(pagoEm: Date, agora: Date = new Date(), dias = ARREPENDIMENTO_DIAS): boolean {
  const decorrido = agora.getTime() - pagoEm.getTime();
  return decorrido <= dias * DIA_MS;
}

export type SituacaoCancelamento = {
  /** a conta tem assinatura PAGA ativa — só então "Cancelar assinatura" faz sentido */
  planoPagoAtivo: boolean;
  /** cancelamento já pedido: continua com acesso até `acessoAte` */
  cancelamentoAgendado: { solicitadoEm: string; acessoAte: string | null } | null;
  /** primeira mensalidade paga há ≤ 7 dias e ainda sem pedido de reembolso */
  arrependimento: { ateIso: string; valorCentavos: number; mensalidadeId: string } | null;
  /** último pedido de reembolso, para mostrar o andamento */
  ultimoPedidoReembolso: { status: string; valorCentavos: number; solicitadoEm: string } | null;
};

export async function situacaoDeCancelamento(empresaId: string, agora: Date = new Date()): Promise<SituacaoCancelamento> {
  const admin = supabaseAdmin();
  const { data: e } = await admin
    .from("empresas")
    .select("plano, assinatura_status, cancelamento_solicitado_em, acesso_ate, deleted_at")
    .eq("id", empresaId)
    .maybeSingle();

  const plano = normalizarPlano(e?.plano);
  const planoPagoAtivo = Boolean(e && !e.deleted_at && e.assinatura_status === "ativa" && plano && planoPago(plano));

  const { data: pedido } = await admin
    .from("pedidos_reembolso")
    .select("status, valor_centavos, solicitado_em")
    .eq("empresa_id", empresaId)
    .order("solicitado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  let arrependimento: SituacaoCancelamento["arrependimento"] = null;
  if (planoPagoAtivo) {
    const { data: primeira } = await admin
      .from("mensalidades")
      .select("id, pago_em, valor_pago_centavos, valor_centavos")
      .eq("empresa_id", empresaId)
      .eq("eh_primeira", true)
      .eq("status", "paga")
      .maybeSingle();
    if (primeira?.pago_em && dentroDoPrazoDeArrependimento(new Date(primeira.pago_em), agora)) {
      const { data: jaPediu } = await admin.from("pedidos_reembolso").select("id").eq("mensalidade_id", primeira.id).maybeSingle();
      if (!jaPediu) {
        arrependimento = {
          ateIso: new Date(new Date(primeira.pago_em).getTime() + ARREPENDIMENTO_DIAS * DIA_MS).toISOString(),
          valorCentavos: (primeira.valor_pago_centavos ?? primeira.valor_centavos) as number,
          mensalidadeId: primeira.id as string,
        };
      }
    }
  }

  return {
    planoPagoAtivo,
    cancelamentoAgendado: e?.cancelamento_solicitado_em
      ? { solicitadoEm: e.cancelamento_solicitado_em as string, acessoAte: (e.acesso_ate as string | null) ?? null }
      : null,
    arrependimento,
    ultimoPedidoReembolso: pedido
      ? { status: pedido.status as string, valorCentavos: pedido.valor_centavos as number, solicitadoEm: pedido.solicitado_em as string }
      : null,
  };
}

export type CodigoErroCancelamento = "sem_permissao" | "sem_assinatura_paga" | "fora_do_prazo" | "provedor" | "erro";

export type ResultadoCancelamento =
  | { ok: true; jaSolicitado: boolean; acessoAte: string | null; reembolsoSolicitado: boolean }
  | { ok: false; codigo: CodigoErroCancelamento; mensagem: string };

const falha = (codigo: CodigoErroCancelamento, mensagem: string): ResultadoCancelamento => ({ ok: false, codigo, mensagem });

type Pedido = {
  empresaId: string;
  userId: string;
  papel: string | null | undefined;
  motivo?: string | null;
  agora?: Date;
};

/** Remove a assinatura no Asaas. 404 = já removida (idempotente). `null` = nada a remover. */
async function removerAssinaturaNoProvedor(subscriptionId: string | null): Promise<"ok" | "falhou"> {
  if (!subscriptionId) return "ok";
  if (!credencialDaPlataforma()) return "falhou";
  const r = await cancelarAssinaturaAsaas(subscriptionId);
  if (r.ok || r.status === 404) return "ok";
  console.error("[cancelamento] o provedor não removeu a assinatura, status", r.status);
  return "falhou";
}

async function executar(tipo: "cancelamento" | "arrependimento", d: Pedido): Promise<ResultadoCancelamento> {
  if (d.papel !== "dono") return falha("sem_permissao", "Só o responsável pela conta pode cancelar a assinatura.");

  const admin = supabaseAdmin();
  const agora = d.agora ?? new Date();
  const motivo = d.motivo?.trim().slice(0, 500) || null;

  const { data: empresa } = await admin
    .from("empresas")
    .select("id, plano, assinatura_status, asaas_subscription_id")
    .eq("id", d.empresaId)
    .maybeSingle();
  if (!empresa) return falha("erro", "Conta não encontrada.");

  // período pago (cancelamento) ou a mensalidade de 7 dias (arrependimento)
  let acessoAte: Date | null = null;
  let mensalidadeId: string | null = null;
  if (tipo === "cancelamento") {
    const { data: ultima } = await admin
      .from("mensalidades")
      .select("vencimento, pago_em")
      .eq("empresa_id", d.empresaId)
      .eq("status", "paga")
      .order("pago_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    acessoAte = fimDoPeriodoPago((ultima?.vencimento as string | null) ?? null, (ultima?.pago_em as string | null) ?? null) ?? agora;
  } else {
    const { data: primeira } = await admin
      .from("mensalidades")
      .select("id, pago_em")
      .eq("empresa_id", d.empresaId)
      .eq("eh_primeira", true)
      .eq("status", "paga")
      .maybeSingle();
    if (!primeira?.pago_em || !dentroDoPrazoDeArrependimento(new Date(primeira.pago_em), agora)) {
      return falha("fora_do_prazo", `O prazo de arrependimento de ${ARREPENDIMENTO_DIAS} dias já passou.`);
    }
    mensalidadeId = primeira.id as string;
  }

  // 1. marca no banco (atômico e idempotente)
  const { data: marcado, error } = await admin.rpc("solicitar_cancelamento", {
    p_empresa: d.empresaId,
    p_user: d.userId,
    p_tipo: tipo,
    p_motivo: motivo,
    p_acesso_ate: acessoAte ? acessoAte.toISOString() : null,
    p_mensalidade: mensalidadeId,
  });
  if (error) {
    console.error("[cancelamento] falha ao registrar pedido:", error.code);
    return falha("erro", "Não foi possível registrar agora. Tente novamente.");
  }
  const r = marcado as {
    ok: boolean;
    erro?: string;
    ja_solicitado?: boolean;
    cancelamento_id?: string;
    pedido_id?: string | null;
    acesso_ate?: string | null;
  };
  if (!r.ok) {
    if (r.erro === "sem_assinatura_paga") return falha("sem_assinatura_paga", "Você não tem uma assinatura paga ativa para cancelar.");
    if (r.erro === "fora_do_prazo") return falha("fora_do_prazo", `O prazo de arrependimento de ${ARREPENDIMENTO_DIAS} dias já passou.`);
    return falha("erro", "Não foi possível registrar agora. Tente novamente.");
  }

  // 2. interrompe a cobrança no Asaas (também no reenvio, se antes tinha falhado)
  const remocao = await removerAssinaturaNoProvedor((empresa.asaas_subscription_id as string | null) ?? null);
  if (remocao === "falhou") {
    // pedido novo que o provedor não aceitou: desfaz, para a pessoa tentar de novo sem estado pela metade
    if (!r.ja_solicitado && r.cancelamento_id) {
      await admin.rpc("desfazer_cancelamento", { p_cancelamento: r.cancelamento_id, p_pedido: r.pedido_id ?? null });
    }
    return falha("provedor", "Não conseguimos interromper a cobrança agora. Nada foi alterado — tente novamente em instantes.");
  }

  // 3. desvincula (e, no arrependimento, encerra o plano pago agora)
  await admin.rpc("concluir_cancelamento", { p_empresa: d.empresaId, p_tipo: tipo });
  if (!r.ja_solicitado) {
    await registrarAcaoFinanceira(
      d.empresaId,
      d.userId,
      tipo === "arrependimento" ? "assinatura_zelo_arrependimento" : "assinatura_zelo_cancelamento_solicitado",
      r.cancelamento_id ?? null
    );
  }

  return {
    ok: true,
    jaSolicitado: Boolean(r.ja_solicitado),
    acessoAte: tipo === "arrependimento" ? null : (r.acesso_ate ?? (acessoAte ? acessoAte.toISOString() : null)),
    reembolsoSolicitado: tipo === "arrependimento",
  };
}

/** Cancelar a assinatura: sem novas cobranças, acesso mantido até o fim do período pago. */
export function cancelarAssinaturaZelo(d: Pedido): Promise<ResultadoCancelamento> {
  return executar("cancelamento", d);
}

/** Arrependimento (≤ 7 dias): encerra o plano pago agora e abre o pedido de reembolso integral. */
export function exercerArrependimento(d: Pedido): Promise<ResultadoCancelamento> {
  return executar("arrependimento", d);
}
