/**
 * Caso de uso: ciclo de vida financeiro da recorrência — a integração
 * fim-a-fim que a Fase 8 fecha (autorização → ciclo → cobrança →
 * instrução → pagamento), e as transições que precisam desfazer isso
 * direito quando o relacionamento comercial muda.
 *
 * ⚠ SERVIDOR APENAS. Server Actions (`app/(app)/app/recorrencias/acoes.ts`)
 * chamam isto, nunca escrevem a lógica direto lá — mesma regra de
 * camadas das Fases 2–7.
 *
 * ────────────────────────────────────────────────────────────────────
 * ENCERRAMENTO — corrige o gap identificado nas Fases 6–7
 * ────────────────────────────────────────────────────────────────────
 * `encerrarRecorrencia()` (CRM) só marcava `status='encerrada'` — nunca
 * tocava na autorização Pix Automático nem nas cobranças em aberto.
 * Duas coisas precisam ser desfeitas ANTES de marcar `encerrada`, senão
 * o pagador continua exposto a algo que a Zelo já considera morto:
 *
 * 1. Cobranças em aberto (pendente/enviada) desta recorrência — se
 *    ficarem penduradas, continuam pagáveis no Asaas mesmo depois do
 *    relacionamento ter acabado.
 * 2. A autorização Pix Automático viva, se houver — cancelar no Asaas
 *    (`DELETE /v3/pix/automatic/authorizations/{id}`) é o que revoga o
 *    CONSENTIMENTO do pagador. Confirmado em
 *    docs.asaas.com/reference/cancelar-uma-autorizacao-pix-automatico
 *    (01/09/2026): cancelar a autorização cancela automaticamente as
 *    instruções já agendadas — não precisamos tratar instrução aqui, o
 *    webhook (Fase 7) já espelha isso quando o evento chegar. Uma
 *    autorização cancelada é definitiva (mesma regra de
 *    `lib/core/autorizacao.ts`); se o profissional quiser cobrar este
 *    cliente de novo, precisa de uma recorrência e autorização novas.
 *
 * Se qualquer cancelamento no Asaas falhar, a recorrência NÃO é marcada
 * como encerrada — mesmo princípio de `cancelarCobrancaFinanceira`: não
 * fingir que algo parou quando ainda pode estar ativo lá. Cada passo é
 * idempotente, então uma nova tentativa só refaz o que ainda não foi
 * confirmado.
 *
 * ────────────────────────────────────────────────────────────────────
 * VALOR TRAVADO PELA AUTORIZAÇÃO
 * ────────────────────────────────────────────────────────────────────
 * Confirmado em docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico
 * (01/09/2026): quando a autorização é criada com valor fixo (é sempre
 * o caso aqui — `criarAutorizacaoPix` sempre envia `value`), "todas as
 * cobranças criadas para essa autorização devem utilizar esse valor", e
 * "não é possível fazer essa alteração na mesma autorização — cancele a
 * atual e crie uma nova". Editar `recorrencias.valor_centavos` sem
 * cancelar a autorização deixaria Zelo e Asaas divergentes — e só
 * apareceria como erro obscuro do Asaas meses depois, no próximo ciclo.
 *
 * ────────────────────────────────────────────────────────────────────
 * VÍNCULO CORRETO APÓS A MORTE DA AUTORIZAÇÃO
 * ────────────────────────────────────────────────────────────────────
 * O webhook (Fase 6/7) zera `recorrencias.autorizacao_atual_id` sempre
 * que a autorização morre (cancelada pelo pagador, recusada, expirada) —
 * independente do status da recorrência. Sem essa checagem,
 * `gerarProximoCiclo` cairia de volta pro caminho manual (CRM puro) em
 * silêncio, e o profissional continuaria achando que está recebendo por
 * Pix Automático. `jaTeveAutorizacaoPix` distingue "nunca usou Pix
 * Automático" (cai no manual, sempre funcionou assim) de "usou e a
 * autorização morreu" (bloqueia, pede decisão explícita).
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { cancelarCobrancaFinanceira } from "./cobranca-financeira";
import { cancelarAutorizacaoPix } from "./autorizacao-pix";
import { estaViva, StatusAutorizacao } from "./autorizacao";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira } from "./auditoria";

/** Injetáveis só para teste — em produção são sempre as funções reais. */
export type CanceladorDeCobrancaEmAberto = typeof cancelarCobrancaFinanceira;
export type CanceladorDeAutorizacaoDaRecorrencia = typeof cancelarAutorizacaoPix;

/** Pura: não fala com banco nem Asaas. Ver "VALOR TRAVADO" acima. */
export function valorBloqueadoPelaAutorizacao(
  temAutorizacaoAtiva: boolean,
  valorAtualCentavos: number,
  novoValorCentavos: number
): boolean {
  return temAutorizacaoAtiva && novoValorCentavos !== valorAtualCentavos;
}

type LinhaRecorrencia = {
  id: string;
  empresa_id: string;
  status: string;
  autorizacao_atual_id: string | null;
};

async function buscarRecorrencia(
  admin: ReturnType<typeof supabaseAdmin>,
  recorrenciaId: string,
  empresaId: string
): Promise<LinhaRecorrencia | null> {
  const { data } = await admin
    .from("recorrencias")
    .select("id, empresa_id, status, autorizacao_atual_id")
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data ?? null;
}

export async function encerrarRecorrenciaFinanceira(
  recorrenciaId: string,
  empresaId: string,
  usuarioId: string | null = null,
  cancelarCobranca: CanceladorDeCobrancaEmAberto = cancelarCobrancaFinanceira,
  cancelarAutorizacao: CanceladorDeAutorizacaoDaRecorrencia = cancelarAutorizacaoPix
): Promise<ResultadoDominio<{ recorrenciaId: string }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const recorrencia = await buscarRecorrencia(admin, recorrenciaId, empresaId);
  if (!recorrencia) return falha("nao_encontrado", "Recorrência não encontrada.");
  if (recorrencia.status !== "ativa" && recorrencia.status !== "pausada") {
    return falha("conflito", "Esta recorrência já está encerrada.");
  }

  const { data: cobrancasAbertas } = await admin
    .from("cobrancas")
    .select("id")
    .eq("recorrencia_id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"]);

  for (const cobranca of cobrancasAbertas ?? []) {
    const resultado = await cancelarCobranca(cobranca.id, empresaId, usuarioId);
    if (!resultado.ok) return resultado;
  }

  if (recorrencia.autorizacao_atual_id) {
    const { data: autorizacaoRow } = await admin
      .from("autorizacoes_pix")
      .select("status")
      .eq("id", recorrencia.autorizacao_atual_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (autorizacaoRow && estaViva(autorizacaoRow.status as StatusAutorizacao)) {
      const resultado = await cancelarAutorizacao(
        recorrencia.autorizacao_atual_id,
        empresaId,
        usuarioId,
        "Recorrência encerrada"
      );
      if (!resultado.ok) return resultado;
    }
  }

  const { error, count } = await admin
    .from("recorrencias")
    .update({ status: "encerrada" }, { count: "exact" })
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .in("status", ["ativa", "pausada"]);

  if (error) return falha("infraestrutura", undefined, error.message);
  if (!count) return falha("conflito", "Esta recorrência já está encerrada.");

  await registrarAcaoFinanceira(empresaId, usuarioId, "recorrencia_encerrada", recorrenciaId);
  return ok({ recorrenciaId });
}

/** Ver "VÍNCULO CORRETO APÓS A MORTE DA AUTORIZAÇÃO" acima. */
export async function jaTeveAutorizacaoPix(recorrenciaId: string, empresaId: string): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  const { data } = await supabaseAdmin()
    .from("autorizacoes_pix")
    .select("id")
    .eq("recorrencia_id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .limit(1)
    .maybeSingle();
  return !!data;
}
