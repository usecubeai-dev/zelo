"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/supabase/server";
import { ehAdministradorZelo } from "@/lib/core/influenciadores";
import { iniciarAssinaturaZelo, type ResultadoAssinaturaZelo } from "@/lib/core/assinatura-zelo";
import { cancelarAssinaturaZelo, exercerArrependimento, type ResultadoCancelamento } from "@/lib/core/cancelamento";

/**
 * Escolher o plano e gerar a cobrança da mensalidade.
 *
 * A empresa vem da SESSÃO (nunca de um parâmetro) e o preço vem do servidor
 * (`lib/plano.ts`) — do navegador só chegam o plano escolhido e o documento.
 * Isto NÃO ativa a assinatura: ela só vira `ativa` quando o pagamento é
 * confirmado pelo webhook.
 */
export async function assinarPlano(plano: string, documento: string): Promise<ResultadoAssinaturaZelo> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, codigo: "empresa", mensagem: "Sessão expirada. Entre de novo." };
  }

  const resultado = await iniciarAssinaturaZelo({
    empresaId: atual.membro.empresa_id,
    userId: atual.user.id,
    papel: atual.membro.papel,
    email: atual.user.email ?? null,
    plano,
    documento,
    permitirPlanoDeTeste: await ehAdministradorZelo(atual.user.id),
  });

  revalidatePath("/app/assinatura");
  revalidatePath("/app");
  return resultado;
}

/**
 * Cancelar a assinatura: nenhuma cobrança nova; o acesso continua até o fim
 * do período já pago e depois a conta vai para o plano Grátis, sem apagar
 * nada. Idempotente. A empresa e o usuário vêm da SESSÃO.
 */
export async function cancelarAssinatura(motivo?: string): Promise<ResultadoCancelamento> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, codigo: "erro", mensagem: "Sessão expirada. Entre de novo." };
  const r = await cancelarAssinaturaZelo({
    empresaId: atual.membro.empresa_id as string,
    userId: atual.user.id,
    papel: atual.membro.papel,
    motivo,
  });
  revalidatePath("/app/assinatura");
  revalidatePath("/app");
  return r;
}

/**
 * Arrependimento (até 7 dias da contratação paga, CDC art. 49): encerra o
 * plano pago agora e abre o PEDIDO de reembolso integral. O dinheiro só
 * volta quando o administrador processa o pedido — esta ação não estorna nada.
 */
export async function exercerArrependimentoAction(motivo?: string): Promise<ResultadoCancelamento> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, codigo: "erro", mensagem: "Sessão expirada. Entre de novo." };
  const r = await exercerArrependimento({
    empresaId: atual.membro.empresa_id as string,
    userId: atual.user.id,
    papel: atual.membro.papel,
    motivo,
  });
  revalidatePath("/app/assinatura");
  revalidatePath("/app");
  return r;
}
