"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosRecorrencia,
  ErrosRecorrencia,
  calcularPrimeiroVencimento,
  calcularProximoVencimento,
  podeEditarRecorrencia,
  podeEncerrarRecorrencia,
  podePausarRecorrencia,
  podeReativarRecorrencia,
  recorrenciaParaBanco,
  validarRecorrencia,
} from "@/lib/recorrencia";

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

  const { error: cobError } = await ctx.supabase
    .from("cobrancas")
    .insert({
      empresa_id: ctx.empresaId,
      cliente_id: dados.cliente_id,
      recorrencia_id: rec.id,
      descricao: dados.descricao.trim().replace(/\s+/g, " "),
      valor_centavos: payload.valor_centavos,
      vence_em: primeiroVencimento,
      status: "pendente",
    });

  if (cobError) {
    console.error("[recorrencias] aviso ao gerar 1º ciclo:", cobError.code, cobError.message);
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
    .select("status")
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

export async function encerrarRecorrencia(id: string): Promise<ResultadoRecorrencia> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("recorrencias")
    .select("status")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Recorrência não encontrada." };
  if (!podeEncerrarRecorrencia(atual.status)) {
    return { ok: false, mensagem: "Esta recorrência já está encerrada." };
  }

  const { error } = await ctx.supabase
    .from("recorrencias")
    .update({ status: "encerrada" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${id}`);
  return { ok: true, id };
}

/**
 * Gera o próximo ciclo de cobrança para uma recorrência ativa de forma determinística e idempotente.
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

  revalidatePath("/app/recorrencias");
  revalidatePath(`/app/recorrencias/${recorrenciaId}`);
  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, id: novaCob.id };
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
  console.error("[recorrencias] erro:", erro.code, erro.message);
  return "Não conseguimos salvar agora. Tente de novo em instantes.";
}
