"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosCliente,
  ErrosCliente,
  paraBanco,
  validarCliente,
} from "@/lib/cliente";

/**
 * Server Actions do módulo de clientes.
 *
 * Três camadas de proteção, e cada uma cobre uma falha diferente:
 *
 *   1. sessão .... o `proxy` já barrou quem não tem, mas Server Action é
 *                  um endpoint HTTP de verdade e pode ser chamada direto;
 *   2. validação . repetida aqui porque a do navegador não vale nada para
 *                  quem monta a requisição na mão;
 *   3. RLS ....... a que realmente impede tocar em dado de outra empresa.
 *
 * Nenhuma ação recebe `empresa_id` do cliente. Ele vem SEMPRE da sessão —
 * aceitar do formulário seria entregar a chave do isolamento ao atacante.
 */

export type ResultadoAcao =
  | { ok: true; id?: string }
  | { ok: false; erros: ErrosCliente }
  | { ok: false; mensagem: string };

async function contexto() {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return null;
  return {
    supabase: await supabaseServer(),
    empresaId: atual.membro.empresa_id as string,
  };
}

export async function criarCliente(dados: DadosCliente): Promise<ResultadoAcao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarCliente(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  const { data, error } = await ctx.supabase
    .from("clientes")
    .insert({ ...paraBanco(dados), empresa_id: ctx.empresaId })
    .select("id")
    .single();

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  revalidatePath("/app/clientes");
  revalidatePath("/app");
  return { ok: true, id: data.id };
}

export async function atualizarCliente(
  id: string,
  dados: DadosCliente
): Promise<ResultadoAcao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const erros = validarCliente(dados);
  if (Object.keys(erros).length) return { ok: false, erros };

  /* O `eq("empresa_id")` é redundante com o RLS de propósito: se um dia uma
     policy for afrouxada por engano, esta linha ainda impede a edição
     cruzada. Defesa em profundidade custa uma cláusula. */
  const { error, count } = await ctx.supabase
    .from("clientes")
    .update(paraBanco(dados), { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Cliente não encontrado." };

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${id}`);
  return { ok: true, id };
}

/**
 * Arquivar, não apagar.
 *
 * Cliente com cobrança paga não pode sumir: o histórico financeiro perderia
 * o pagador. Arquivado some da lista e não aceita cobrança nova.
 */
export async function alternarArquivamento(
  id: string,
  arquivar: boolean
): Promise<ResultadoAcao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { error, count } = await ctx.supabase
    .from("clientes")
    .update({ status: arquivar ? "arquivado" : "ativo" }, { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Cliente não encontrado." };

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${id}`);
  return { ok: true, id };
}

/**
 * Exclusão definitiva. Só permitida enquanto não houver histórico —
 * a checagem real virá com o módulo de cobranças (FK com RESTRICT).
 */
export async function excluirCliente(id: string): Promise<ResultadoAcao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { error, count } = await ctx.supabase
    .from("clientes")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };
  if (!count) return { ok: false, mensagem: "Cliente não encontrado." };

  revalidatePath("/app/clientes");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Traduz o erro do Postgres sem vazar tabela, coluna ou constraint.
 * O detalhe fica no log do servidor; para a tela vai uma frase útil.
 */
function mensagemDeErro(erro: { code?: string; message: string }): string {
  if (erro.code === "23505") {
    return "Já existe um cliente com este e-mail.";
  }
  /* FK RESTRICT de `cobrancas.cliente_id`: cliente com cobrança não pode
     ser apagado, ou o histórico financeiro perde o pagador. A saída é
     arquivar — e a mensagem precisa dizer isso, não só "erro". */
  if (erro.code === "23503") {
    return "Este cliente tem cobranças registradas e não pode ser excluído. Arquive-o.";
  }
  if (erro.code === "42501" || erro.code === "PGRST301") {
    /* violação de RLS — nesta tela significa trial expirado, porque a
       policy de INSERT exige `empresa_liberada` */
    return "Seu teste grátis terminou. Assine para cadastrar novos clientes.";
  }
  console.error("[clientes] erro:", erro.code, erro.message);
  return "Não conseguimos salvar agora. Tente de novo em instantes.";
}
