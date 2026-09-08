"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosRecorrencia,
  ErrosRecorrencia,
  calcularPrimeiroVencimento,
  calcularProximoVencimento,
  podeEditarRecorrencia,
  podePausarRecorrencia,
  podeReativarRecorrencia,
  recorrenciaParaBanco,
  validarRecorrencia,
} from "@/lib/recorrencia";
import { sincronizarCobrancaFinanceira } from "@/lib/core/cobranca-financeira";
import {
  criarAutorizacaoPix,
  sincronizarStatusAutorizacaoPix,
  cancelarAutorizacaoPix,
  DadosQrAutorizacao,
} from "@/lib/core/autorizacao-pix";
import {
  encerrarRecorrenciaFinanceira,
  jaTeveAutorizacaoPix,
  valorBloqueadoPelaAutorizacao,
} from "@/lib/core/recorrencia-financeira";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { paraCentavos } from "@/lib/dinheiro";
import { mensagemDeLimiteDeCobrancas } from "@/lib/plano";
import type { AutorizacaoPix } from "@/lib/core/autorizacao";
import { prepararCicloPixAutomatico, sincronizarStatusInstrucao } from "@/lib/core/instrucao-pagamento-pix";
import type { InstrucaoPagamento } from "@/lib/core/instrucao-pagamento";

export type ResultadoRecorrencia =
  | { ok: true; id?: string }
  | { ok: false; erros: ErrosRecorrencia }
  | { ok: false; mensagem: string };

async function contexto() {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return null;
  return {
    supabase: await supabaseServer(),
    empresaId: atual.membro.empresa_id as string,
  };
}

/** O cliente existe, é desta empresa e não está arquivado? */
async function clienteValido(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  empresaId: string,
  clienteId: string
): Promise<"ok" | "inexistente" | "arquivado"> {
  const { data } = await supabase
    .from("clientes")
    .select("id,status")
    .eq("id", clienteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!data) return "inexistente";
  return data.status === "arquivado" ? "arquivado" : "ok";
}

export async function criarRecorrencia(
  dados: DadosRecorrencia
): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarRecorrencia(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const check = await clienteValido(ctx.supabase, ctx.empresaId, dados.cliente_id);
  if (check === "inexistente") {
    return { ok: false, erros: { cliente_id: "Cliente não encontrado." } };
  }
  if (check === "arquivado") {
    return {
      ok: false,
      erros: { cliente_id: "Este cliente está arquivado. Reative antes de criar recorrência." },
    };
  }

  const payload = {
    ...recorrenciaParaBanco(dados),
    empresa_id: ctx.empresaId,
    status: "ativa",
  };

  const { data: rec, error: recError } = await ctx.supabase
    .from("recorrencias")
    .insert(payload)
    .select("id")
    .single();

  if (recError) return { ok: false, mensagem: mensagemDeErro(recError) };

  /* Gera automaticamente a primeira cobrança (primeiro ciclo) */
  const primeiroVencimento = calcularPrimeiroVencimento(
    dados.inicia_em,
    Number(dados.dia_vencimento)
  );

  const { data: primeiraCob, error: cobError } = await ctx.supabase
    .from("cobrancas")
    .insert({
      empresa_id: ctx.empresaId,
      cliente_id: dados.cliente_id,
      recorrencia_id: rec.id,
      descricao: dados.descricao.trim().replace(/\s+/g, " "),
      valor_centavos: payload.valor_centavos,
      vence_em: primeiroVencimento,
      status: "pendente",
    })
    .select("id")
    .single();

  if (cobError) {
    console.error("[recorrencias] aviso ao gerar 1º ciclo:", cobError.code, cobError.message);
  } else {
    // Best-effort, mesmo padrão de criarCobranca() — nunca bloqueia a criação da recorrência.
    const usuario = await usuarioAtual();
    await sincronizarCobrancaFinanceira(primeiraCob.id, ctx.empresaId, usuario?.user.id ?? null);
  }

  revalidatePath("/app/recorrencias");
  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/clientes/${dados.cliente_id}`);
  revalidatePath("/app");
  return { ok: true, id: rec.id };
}

export async function atualizarRecorrencia(
  id: string,
  dados: DadosRecorrencia
): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("recorrencias")
    .select("status, valor_centavos, autorizacao_atual_id")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Recorrência não encontrada." };
  if (!podeEditarRecorrencia(atual.status)) {
    return { ok: false, mensagem: "Recorrência encerrada não pode ser editada." };
  }

  const erros = validarRecorrencia(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const check = await clienteValido(ctx.supabase, ctx.empresaId, dados.cliente_id);
  if (check !== "ok") {
    return { ok: false, erros: { cliente_id: "Cliente inválido." } };
  }

  // Ver `lib/core/recorrencia-financeira.ts` — o Asaas trava o valor de
  // cobranças recorrentes na própria autorização Pix Automático quando
  // criada com valor fixo. Bloqueia cedo, com explicação acionável, em
  // vez de deixar o erro estourar meses depois no próximo ciclo.
  const novoValorCentavos = paraCentavos(dados.valor);
  if (
    novoValorCentavos !== null &&
    valorBloqueadoPelaAutorizacao(!!atual.autorizacao_atual_id, atual.valor_centavos, novoValorCentavos)
  ) {
    return {
      ok: false,
      erros: {
        valor:
          "Não é possível alterar o valor com Pix Automático ativo — o Asaas trava o valor na autorização. Cancele a autorização atual e solicite uma nova para cobrar o novo valor.",
      },
    };
  }

  const { error, count } = await ctx.supabase
    .from("recorrencias")
    .update(recorrenciaParaBanco(dados), { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Recorrência não encontrada." };

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${id}`);
  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/clientes/${dados.cliente_id}`);
  revalidatePath("/app");
  return { ok: true, id };
}

export async function pausarRecorrencia(id: string): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("recorrencias")
    .select("status")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Recorrência não encontrada." };
  if (!podePausarRecorrencia(atual.status)) {
    return { ok: false, mensagem: "Apenas recorrências ativas podem ser pausadas." };
  }

  const { error } = await ctx.supabase
    .from("recorrencias")
    .update({ status: "pausada" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${id}`);
  return { ok: true, id };
}

export async function reativarRecorrencia(id: string): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("recorrencias")
    .select("status")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Recorrência não encontrada." };
  if (!podeReativarRecorrencia(atual.status)) {
    return { ok: false, mensagem: "Apenas recorrências pausadas podem ser reativadas." };
  }

  const { error } = await ctx.supabase
    .from("recorrencias")
    .update({ status: "ativa" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${id}`);
  return { ok: true, id };
}

/**
 * Encerra a recorrência — decisão comercial definitiva (sem volta:
 * `podeReativarRecorrencia` só aceita "pausada"). Fase 8: corrige o gap
 * identificado nas Fases 6–7 — encerrar não pode deixar Pix Automático
 * "pendurado". A orquestração completa (cobranças em aberto + autorização
 * viva) vive em `lib/core/recorrencia-financeira.ts` — ver lá o porquê.
 */
export async function encerrarRecorrencia(id: string): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const usuario = await usuarioAtual();
  const resultado = await encerrarRecorrenciaFinanceira(id, ctx.empresaId, usuario?.user.id ?? null);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${id}`);
  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, id };
}

/**
 * Gera o próximo ciclo de cobrança para uma recorrência ativa de forma determinística e idempotente.
 *
 * Fase 7: quando a recorrência tem Pix Automático ativo
 * (`autorizacao_atual_id`), delega inteiramente pro caso de uso
 * dedicado (`prepararCicloPixAutomatico`) — que valida autorização
 * ACTIVE, respeita a janela operacional de 2–10 dias úteis, e já
 * envia a cobrança ao Asaas com `pixAutomaticAuthorizationId`. Sem
 * Pix Automático, o caminho antigo (CRM puro) continua exatamente
 * igual — nada muda pra quem não ligou a autorização.
 */
export async function gerarProximoCiclo(recorrenciaId: string): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: rec } = await ctx.supabase
    .from("recorrencias")
    .select("*")
    .eq("id", recorrenciaId)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!rec) return { ok: false, mensagem: "Recorrência não encontrada." };
  if (rec.status !== "ativa") {
    return { ok: false, mensagem: "Não é possível gerar cobrança de uma recorrência que não esteja ativa." };
  }

  if (rec.autorizacao_atual_id) {
    const usuario = await usuarioAtual();
    const resultado = await prepararCicloPixAutomatico(recorrenciaId, ctx.empresaId, usuario?.user.id ?? null);
    if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

    if (resultado.dado.status === "aguardando_janela") {
      return {
        ok: false,
        mensagem: `Ainda não é hora de enviar esta cobrança ao Asaas — faltam ${resultado.dado.diasUteisAteVencimento} dia(s) útil(eis) até o vencimento (${resultado.dado.vencimento}). A janela é de 2 a 10 dias úteis antes.`,
      };
    }

    revalidatePath("/app/recorrencias");
    revalidatePath(`/app/recorrencias/${recorrenciaId}`);
    revalidatePath("/app/cobrancas");
    revalidatePath("/app");
    return { ok: true, id: resultado.dado.cobrancaId };
  }

  // Fase 8 — "vínculo correto": ver `jaTeveAutorizacaoPix` em
  // `lib/core/recorrencia-financeira.ts`. Cair pro caminho manual em
  // silêncio faria o Zelo parar de auto-debitar sem avisar ninguém.
  if (await jaTeveAutorizacaoPix(recorrenciaId, ctx.empresaId)) {
    return {
      ok: false,
      mensagem:
        "A autorização Pix Automático desta recorrência não está mais ativa. Solicite uma nova autorização antes de gerar o próximo ciclo.",
    };
  }

  /* Busca a última cobrança gerada para calcular a data seguinte */
  const { data: ultimas } = await ctx.supabase
    .from("cobrancas")
    .select("vence_em")
    .eq("recorrencia_id", recorrenciaId)
    .eq("empresa_id", ctx.empresaId)
    .order("vence_em", { ascending: false })
    .limit(1);

  let proximoVencimento: string;
  if (ultimas && ultimas.length > 0) {
    proximoVencimento = calcularProximoVencimento(ultimas[0].vence_em, rec.dia_vencimento);
  } else {
    proximoVencimento = calcularPrimeiroVencimento(rec.inicia_em, rec.dia_vencimento);
  }

  /* Verificação de idempotência: se já existe cobrança com este vencimento e recorrência */
  const { data: existente } = await ctx.supabase
    .from("cobrancas")
    .select("id")
    .eq("recorrencia_id", recorrenciaId)
    .eq("vence_em", proximoVencimento)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      mensagem: `A cobrança com vencimento em ${proximoVencimento} já foi gerada.`,
    };
  }

  const { data: novaCob, error } = await ctx.supabase
    .from("cobrancas")
    .insert({
      empresa_id: ctx.empresaId,
      cliente_id: rec.cliente_id,
      recorrencia_id: rec.id,
      descricao: rec.descricao,
      valor_centavos: rec.valor_centavos,
      vence_em: proximoVencimento,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  const usuario = await usuarioAtual();
  await sincronizarCobrancaFinanceira(novaCob.id, ctx.empresaId, usuario?.user.id ?? null);

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, id: novaCob.id };
}

export type ResultadoAutorizacaoPix =
  | { ok: true; dado: DadosQrAutorizacao }
  | { ok: false; mensagem: string };

/** Solicita a autorização Pix Automático — Fase 6 do Core Financeiro. */
export async function solicitarAutorizacaoPixAcao(recorrenciaId: string): Promise<ResultadoAutorizacaoPix> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const atual = await usuarioAtual();
  const resultado = await criarAutorizacaoPix(recorrenciaId, ctx.empresaId, atual?.user.id ?? null);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  return { ok: true, dado: resultado.dado };
}

/** Verifica o status atual no Asaas — botão manual, complementa o webhook. */
export async function sincronizarAutorizacaoPixAcao(
  autorizacaoId: string,
  recorrenciaId: string
): Promise<{ ok: true; status: string } | { ok: false; mensagem: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const resultado = await sincronizarStatusAutorizacaoPix(autorizacaoId, ctx.empresaId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  return { ok: true, status: resultado.dado.status };
}

/** Cancela a autorização — não confundir com cancelar cobrança ou encerrar recorrência. */
export async function cancelarAutorizacaoPixAcao(
  autorizacaoId: string,
  recorrenciaId: string
): Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const atual = await usuarioAtual();
  const resultado = await cancelarAutorizacaoPix(autorizacaoId, ctx.empresaId, atual?.user.id ?? null);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  return { ok: true, id: recorrenciaId };
}

/** Lê a autorização atual da recorrência, se existir — para a tela renderizar sem esperar uma ação. */
export async function obterAutorizacaoAtual(recorrenciaId: string): Promise<AutorizacaoPix | null> {
  const ctx = await contexto();
  if (!ctx) return null;

  const { data: rec } = await ctx.supabase
    .from("recorrencias")
    .select("autorizacao_atual_id")
    .eq("id", recorrenciaId)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!rec?.autorizacao_atual_id) return null;

  const { data } = await supabaseAdmin()
    .from("autorizacoes_pix")
    .select("*")
    .eq("id", rec.autorizacao_atual_id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  return (data as AutorizacaoPix) ?? null;
}

/** Verifica o status da instrução no Asaas — botão manual, complementa o webhook. */
export async function sincronizarInstrucaoAcao(
  instrucaoId: string,
  recorrenciaId: string
): Promise<{ ok: true; status: string } | { ok: false; mensagem: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const resultado = await sincronizarStatusInstrucao(instrucaoId, ctx.empresaId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  return { ok: true, status: resultado.dado.status };
}

/** Lê a instrução de pagamento da cobrança mais recente da recorrência, se existir. */
export async function obterInstrucaoDaUltimaCobranca(recorrenciaId: string): Promise<InstrucaoPagamento | null> {
  const ctx = await contexto();
  if (!ctx) return null;

  const { data: ultimaCobranca } = await ctx.supabase
    .from("cobrancas")
    .select("id")
    .eq("recorrencia_id", recorrenciaId)
    .eq("empresa_id", ctx.empresaId)
    .order("vence_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimaCobranca) return null;

  const { data } = await supabaseAdmin()
    .from("instrucoes_pagamento")
    .select("*")
    .eq("cobranca_id", ultimaCobranca.id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  return (data as InstrucaoPagamento) ?? null;
}

function mensagemDeErro(erro: { code?: string; message: string }): string {
  if (erro.code === "42501" || erro.code === "PGRST301") {
    return "Seu teste grátis terminou. Assine para criar novas recorrências.";
  }
  if (erro.code === "23503") {
    return "Cliente inválido para esta recorrência.";
  }
  if (erro.code === "23514") {
    return "Os dados da recorrência não são válidos.";
  }
  const limiteCobrancas = mensagemDeLimiteDeCobrancas(erro.message);
  if (limiteCobrancas) return limiteCobrancas;
  console.error("[recorrencias] erro:", erro.code, erro.message);
  return "Não conseguimos salvar agora. Tente de novo em instantes.";
}
