"use server";

import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase/admin";
import { sincronizarStatusAutorizacaoPix } from "@/lib/core/autorizacao-pix";
import type { StatusAutorizacao } from "@/lib/core/autorizacao";

export type ResultadoAtualizacaoPublica =
  | { ok: true; status: StatusAutorizacao }
  | { ok: false; mensagem: string };

/**
 * Botão "Já autorizei, atualizar" da tela pública.
 *
 * Sem sessão nenhuma — o `id` da autorização É a credencial de quem pode
 * chamar isto (mesmo raciocínio de `obterAutorizacaoPublica`). O
 * `empresa_id` usado na reconciliação vem da PRÓPRIA linha encontrada por
 * esse id, nunca de um parâmetro que o visitante controla — por isso é
 * seguro reutilizar `sincronizarStatusAutorizacaoPix` tal como ele já
 * existe para o painel autenticado, sem duplicar a lógica de
 * reconciliação (transição válida, origem permitida, etc.).
 */
export async function atualizarStatusAutorizacaoPublicaAcao(
  autorizacaoId: string
): Promise<ResultadoAtualizacaoPublica> {
  if (!supabaseConfigurado()) {
    return { ok: false, mensagem: "Indisponível no momento. Tente novamente em instantes." };
  }

  const { data: linha } = await supabaseAdmin()
    .from("autorizacoes_pix")
    .select("empresa_id")
    .eq("id", autorizacaoId)
    .maybeSingle();

  if (!linha) return { ok: false, mensagem: "Link inválido." };

  const resultado = await sincronizarStatusAutorizacaoPix(autorizacaoId, linha.empresa_id);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };
  return { ok: true, status: resultado.dado.status };
}
