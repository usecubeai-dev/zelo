"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosCobranca,
  ErrosCobranca,
  cobrancaParaBanco,
  hojeISO,
  podeCancelar,
  podeEditar,
  podeMarcarPaga,
  validarCobranca,
} from "@/lib/cobranca";

/**
 * Server Actions de cobranças.
 *
 * `empresa_id` vem SEMPRE da sessão, nunca do formulário. O `cliente_id`
 * vem do formulário, mas é conferido contra a empresa antes de gravar —
 * senão daria para pendurar uma cobrança no cliente de outra empresa.
 */

export type ResultadoCobranca =
  | { ok: true; id?: string }
  | { ok: false; erros: ErrosCobranca }
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

export async function criarCobranca(
  dados: DadosCobranca
): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarCobranca(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const check = await clienteValido(ctx.supabase, ctx.empresaId, dados.cliente_id);
  if (check === "inexistente") {
    return { ok: false, erros: { cliente_id: "Cliente não encontrado." } };
  }
  if (check === "arquivado") {
    return {
      ok: false,
      erros: { cliente_id: "Este cliente está arquivado. Reative antes de cobrar." },
    };
  }

  const { data, error } = await ctx.supabase
    .from("cobrancas")
    .insert({ ...cobrancaParaBanco(dados), empresa_id: ctx.empresaId })
    .select("id")
    .single();

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, id: data.id };
}

export async function atualizarCobranca(
  id: string,
  dados: DadosCobranca
): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atualCobranca } = await ctx.supabase
    .from("cobrancas")
    .select("status,vence_em")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atualCobranca) return { ok: false, mensagem: "Cobrança não encontrada." };
  if (!podeEditar(atualCobranca.status)) {
    return {
      ok: false,
      mensagem: "Cobrança paga ou cancelada não pode ser editada.",
    };
  }

  /* Revalida com a data ORIGINAL como piso quando ela já é passado: sem
     isso, corrigir a descrição de uma cobrança vencida seria impossível,
     porque a regra "vencimento não pode ser no passado" barraria a data
     que já estava lá. */
  const piso =
    atualCobranca.vence_em < hojeISO() ? atualCobranca.vence_em : hojeISO();
  const erros = validarCobranca(dados, piso);
  if (Object.keys(erros).length) return { ok: false, erros };

  const check = await clienteValido(ctx.supabase, ctx.empresaId, dados.cliente_id);
  if (check !== "ok") {
    return { ok: false, erros: { cliente_id: "Cliente inválido." } };
  }

  const { error, count } = await ctx.supabase
    .from("cobrancas")
    .update(cobrancaParaBanco(dados), { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Cobrança não encontrada." };

  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/cobrancas/${id}`);
  revalidatePath("/app");
  return { ok: true, id };
}

export async function cancelarCobranca(id: string): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("cobrancas")
    .select("status")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Cobrança não encontrada." };
  if (!podeCancelar(atual.status)) {
    return { ok: false, mensagem: "Esta cobrança não pode mais ser cancelada." };
  }

  const { error } = await ctx.supabase
    .from("cobrancas")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/cobrancas/${id}`);
  revalidatePath("/app");
  return { ok: true, id };
}

/**
 * Baixa manual.
 *
 * Existe porque, sem o Asaas ligado, é o único jeito de o usuário fechar o
 * mês. **Não é confirmação de pagamento pelo frontend**: é o dono da conta
 * declarando que recebeu por fora. Quando o webhook existir, ele passa a
 * ser a fonte da verdade e esta ação vira exceção.
 */
export async function marcarComoPaga(id: string): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atual } = await ctx.supabase
    .from("cobrancas")
    .select("status,valor_centavos")
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .maybeSingle();

  if (!atual) return { ok: false, mensagem: "Cobrança não encontrada." };
  if (!podeMarcarPaga(atual.status)) {
    return { ok: false, mensagem: "Esta cobrança já foi paga ou cancelada." };
  }

  const { error } = await ctx.supabase
    .from("cobrancas")
    .update({
      status: "paga",
      pago_em: new Date().toISOString(),
      valor_pago_centavos: atual.valor_centavos,
    })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    /* idempotência: se duas abas clicarem junto, a segunda não acha mais
       nada em `pendente`/`enviada` e não sobrescreve a data do pagamento */
    .in("status", ["pendente", "enviada"]);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/cobrancas/${id}`);
  revalidatePath("/app");
  return { ok: true, id };
}

/** Marca como enviada — o usuário avisou o cliente por fora. */
export async function marcarComoEnviada(id: string): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { error, count } = await ctx.supabase
    .from("cobrancas")
    .update({ status: "enviada" }, { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    .eq("status", "pendente");

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Esta cobrança não está pendente." };

  revalidatePath("/app/cobrancas");
  revalidatePath(`/app/cobrancas/${id}`);
  return { ok: true, id };
}

function mensagemDeErro(erro: { code?: string; message: string }): string {
  if (erro.code === "42501" || erro.code === "PGRST301") {
    return "Seu teste grátis terminou. Assine para criar novas cobranças.";
  }
  if (erro.code === "23503") {
    return "Cliente inválido para esta cobrança.";
  }
  if (erro.code === "23514") {
    return "Os dados da cobrança não são válidos.";
  }
  console.error("[cobrancas] erro:", erro.code, erro.message);
  return "Não conseguimos salvar agora. Tente de novo em instantes.";
}
