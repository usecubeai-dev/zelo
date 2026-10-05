"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/supabase/server";
import { iniciarAssinaturaZelo, type ResultadoAssinaturaZelo } from "@/lib/core/assinatura-zelo";

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
  });

  revalidatePath("/app/assinatura");
  revalidatePath("/app");
  return resultado;
}
