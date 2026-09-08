"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosServico,
  ErrosServico,
  servicoParaBanco,
  validarServico,
} from "@/lib/servico";

/**
 * Server Actions de serviços — mesmo padrão de três camadas de
 * `app/(app)/app/clientes/acoes.ts` (sessão / validação / RLS).
 * `empresa_id` vem sempre da sessão, nunca do formulário.
 */

export type ResultadoServico =
  | { ok: true; id?: string }
  | { ok: false; erros: ErrosServico }
  | { ok: false; mensagem: string };

async function contexto() {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return null;
  return {
    supabase: await supabaseServer(),
    empresaId: atual.membro.empresa_id as string,
  };
}

export async function criarServico(dados: DadosServico): Promise<ResultadoServico> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarServico(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const { data, error } = await ctx.supabase
    .from("servicos")
    .insert({ ...servicoParaBanco(dados), empresa_id: ctx.empresaId })
    .select("id")
    .single();

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/servicos");
  revalidatePath("/app/cobrancas/nova");
  revalidatePath("/app/recorrencias/nova");
  return { ok: true, id: data.id };
}

export async function atualizarServico(id: string, dados: DadosServico): Promise<ResultadoServico> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarServico(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const { error, count } = await ctx.supabase
    .from("servicos")
    .update(servicoParaBanco(dados), { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Serviço não encontrado." };

  revalidatePath("/app/servicos");
  return { ok: true, id };
}

/** Arquivar, não apagar — cobrança/recorrência já vinculada mantém a referência. */
export async function alternarArquivamentoServico(id: string, arquivar: boolean): Promise<ResultadoServico> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { error, count } = await ctx.supabase
    .from("servicos")
    .update({ status: arquivar ? "arquivado" : "ativo" }, { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Serviço não encontrado." };

  revalidatePath("/app/servicos");
  return { ok: true, id };
}

function mensagemDeErro(erro: { code?: string; message: string }): string {
  if (erro.code === "42501" || erro.code === "PGRST301") {
    return "Seu teste grátis terminou. Assine para cadastrar novos serviços.";
  }
  if (erro.code === "23514") {
    return "Os dados do serviço não são válidos.";
  }
  return "Não foi possível salvar agora. Tente novamente.";
}
