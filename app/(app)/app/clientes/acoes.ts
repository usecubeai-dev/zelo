"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  DadosCliente,
  ErrosCliente,
  paraBanco,
  validarCliente,
} from "@/lib/cliente";
import { mensagemDeLimite } from "@/lib/plano";
import { sincronizarClienteFinanceiro } from "@/lib/core/cliente-financeiro";
import { credencialDaEmpresa } from "@/lib/asaas/credenciais";
import { atualizarClienteAsaas } from "@/lib/asaas/cliente";

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
  | { ok: true; id?: string; /** Fase 23 — só em `criarCliente`: é o primeiro cliente desta empresa? Usado para não confundir `client_created` (toda criação) com o marco de funil "primeiro cliente cadastrado". */ primeiro?: boolean }
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

  if (error) {
    /* O limite do plano é imposto por trigger no banco, não aqui: a API
       REST é pública e uma checagem só no servidor da aplicação seria
       contornável. Aqui só traduzimos a exceção para o usuário. */
    const limite = mensagemDeLimite(error.message);
    if (limite) return { ok: false, mensagem: limite };
    return { ok: false, mensagem: mensagemDeErro(error) };
  }

  /* Sincronização com o Asaas é best-effort e NUNCA bloqueia o cadastro:
     o CRM funciona sem conta financeira conectada (produto atual), e uma
     falha aqui (empresa sem subconta, Asaas fora do ar) só deixa o
     cliente com `asaas_sync_status = 'erro'`, retentável depois — nunca
     impede o profissional de cadastrar o cliente. */
  const atual = await usuarioAtual();
  await sincronizarClienteFinanceiro(data.id, ctx.empresaId, atual?.user.id ?? null);

  /* Fase 23 — conta depois de inserir: mais simples que guardar o "antes"
     e não interfere no compare-and-swap nenhum (esta tabela não tem um).
     `count` inclui o cliente recém-criado, então "é o primeiro" é
     count <= 1. `head: true` não traz linha nenhuma, só o número. */
  const { count } = await ctx.supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", ctx.empresaId);

  revalidatePath("/app/clientes");
  revalidatePath("/app");
  return { ok: true, id: data.id, primeiro: (count ?? 0) <= 1 };
}

/** Botão manual de retry — mesma sincronização, exposta para quando a automática falhou. */
export async function sincronizarClienteAsaasAcao(clienteId: string): Promise<ResultadoAcao> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const atual = await usuarioAtual();
  const resultado = await sincronizarClienteFinanceiro(clienteId, ctx.empresaId, atual?.user.id ?? null);

  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/clientes/${clienteId}`);
  return { ok: true, id: clienteId };
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

  /* Se o cliente já está sincronizado, propaga a edição pro Asaas —
     best-effort, não bloqueia a edição local. Um cliente ainda não
     sincronizado (`asaas_customer_id` nulo) não tem o que atualizar lá. */
  await atualizarClienteAsaasSeSincronizado(ctx.supabase, id, ctx.empresaId);

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${id}`);
  return { ok: true, id };
}

async function atualizarClienteAsaasSeSincronizado(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  clienteId: string,
  empresaId: string
) {
  /* RLS já libera esta leitura ("membro le clientes") — não há motivo
     para o client admin (service_role) aqui. Ver lib/supabase/admin.ts:
     nenhuma tela do sistema deveria importar esse módulo. */
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome, email, whatsapp, documento, asaas_customer_id")
    .eq("id", clienteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!cliente?.asaas_customer_id) return;

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) return;

  const resultado = await atualizarClienteAsaas(
    cliente.asaas_customer_id,
    { name: cliente.nome, email: cliente.email || undefined, mobilePhone: cliente.whatsapp || undefined, cpfCnpj: cliente.documento || undefined },
    credencial
  );

  if (!resultado.ok) {
    console.error("[clientes] falha ao propagar edição pro Asaas:", resultado.erro);
  }
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
