/**
 * Caso de uso: gerar automaticamente o próximo ciclo de TODAS as
 * recorrências com Pix Automático ativo — o lado "automático" de
 * "cobrança recorrente automática".
 *
 * ⚠ SERVIDOR APENAS, e diferente de todo outro arquivo em `lib/core/`:
 * este não é chamado por uma Server Action de um usuário logado, é
 * chamado por `app/api/cron/gerar-cobrancas/route.ts` (Vercel Cron,
 * sem sessão, sem `empresa_id` de contexto). Por isso itera TODAS as
 * empresas com `supabaseAdmin`, uma de cada vez — RLS não se aplica
 * aqui, então cada leitura já vem filtrada por query, nunca por policy.
 *
 * NÃO reimplementa nenhuma regra financeira: cada recorrência passa
 * inteira por `prepararCicloPixAutomatico` (Fase 7), que já é
 * idempotente (índice único em `recorrencia_id`+`vence_em`, compare-
 * and-swap em `asaas_sync_status`) e já respeita a janela operacional
 * de 2–10 dias úteis — chamar de novo numa recorrência fora da janela
 * é barato (uma leitura, nenhuma chamada ao Asaas) e seguro (nunca cria
 * duplicata). Isso é o que torna rodar isto todo dia, para toda
 * recorrência ativa, correto em vez de arriscado.
 *
 * FALHA ISOLADA POR RECORRÊNCIA — o motivo de este arquivo existir e
 * não só um loop dentro da rota: uma recorrência com erro (crédito
 * expirado, Asaas fora do ar, autorização revogada) nunca pode
 * interromper o processamento das outras. Cada chamada é isolada em
 * try/catch; o resumo devolvido lista o que falhou, para virar
 * notificação/log, nunca para travar o job inteiro.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { prepararCicloPixAutomatico } from "./instrucao-pagamento-pix";
import { criarNotificacao } from "./notificacoes";

export type ResumoAgendador = {
  elegveis: number;
  preparadas: number;
  jaExistiam: number;
  aguardandoJanela: number;
  falhas: { recorrenciaId: string; empresaId: string; mensagem: string }[];
};

/**
 * Roda uma vez, processa toda recorrência ativa com autorização Pix
 * Automático vigente. Retorna um resumo — nunca lança: erro de UMA
 * recorrência vira uma entrada em `falhas`, não uma exceção que aborta
 * as demais (ver cabeçalho do arquivo).
 */
export async function executarGeracaoAutomaticaDeCobrancas(): Promise<ResumoAgendador> {
  const resumo: ResumoAgendador = {
    elegveis: 0,
    preparadas: 0,
    jaExistiam: 0,
    aguardandoJanela: 0,
    falhas: [],
  };

  if (!supabaseConfigurado()) return resumo;
  const admin = supabaseAdmin();

  /* LIMIT defensivo (Fase 21) — não resolve o custo O(total) do scan (a
     correção real é indexar por próximo vencimento e filtrar por data,
     documentado como P1 em ZELO_LAUNCH_BLOCKERS.md), só evita que uma
     query sem nenhum teto tente carregar um número ilimitado de linhas
     numa function serverless com tempo de execução finito. 5000 é uma
     folga generosa acima de qualquer volume atual (zero clientes
     pagantes) — ajustar para baixo (com paginação) faz parte do P1. */
  const { data: recorrencias } = await admin
    .from("recorrencias")
    .select("id, empresa_id")
    .eq("status", "ativa")
    .not("autorizacao_atual_id", "is", null)
    .limit(5000);

  const lista = recorrencias ?? [];
  resumo.elegveis = lista.length;

  for (const rec of lista) {
    try {
      const resultado = await prepararCicloPixAutomatico(rec.id, rec.empresa_id);

      if (!resultado.ok) {
        resumo.falhas.push({
          recorrenciaId: rec.id,
          empresaId: rec.empresa_id,
          mensagem: resultado.erro.mensagem,
        });
        // Falha real (não "aguardando janela", que é `ok`) é a única que merece
        // atenção do profissional — sem isso, um cartão recusado no ciclo N
        // fica invisível até o cliente reclamar de não ter sido cobrado.
        await criarNotificacao(
          rec.empresa_id,
          "cobranca_automatica_falhou",
          "Não conseguimos gerar uma cobrança automática",
          resultado.erro.mensagem,
          "alta",
          `/app/recorrencias/${rec.id}`,
          `cobranca_automatica_falhou:${rec.id}:${new Date().toISOString().slice(0, 10)}`
        );
        continue;
      }

      if (resultado.dado.status === "aguardando_janela") resumo.aguardandoJanela++;
      else if (resultado.dado.status === "cobranca_ja_existia") resumo.jaExistiam++;
      else resumo.preparadas++;
    } catch (erro) {
      // Nunca deveria chegar aqui (prepararCicloPixAutomatico devolve
      // ResultadoDominio, não lança) — mas um throw inesperado de uma
      // recorrência não pode derrubar as outras 200 do loop.
      resumo.falhas.push({
        recorrenciaId: rec.id,
        empresaId: rec.empresa_id,
        mensagem: erro instanceof Error ? erro.message : "erro desconhecido",
      });
    }
  }

  return resumo;
}
