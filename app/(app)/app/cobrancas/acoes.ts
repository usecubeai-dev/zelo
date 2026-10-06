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
import {
  sincronizarCobrancaFinanceira,
  cancelarCobrancaFinanceira,
  sincronizarStatusCobranca,
} from "@/lib/core/cobranca-financeira";
import { registrarAcaoFinanceira } from "@/lib/core/auditoria";
import { mensagemDeLimiteDeCobrancas } from "@/lib/plano";
import { percentualParaCampo } from "@/lib/encargos";

/**
 * Server Actions de cobranças.
 *
 * `empresa_id` vem SEMPRE da sessão, nunca do formulário. O `cliente_id`
 * vem do formulário, mas é conferido contra a empresa antes de gravar —
 * senão daria para pendurar uma cobrança no cliente de outra empresa.
 */

export type ResultadoCobranca =
  | { ok: true; id?: string; /** Fase 23 — só em `criarCobranca`: é a primeira cobrança desta empresa? */ primeiro?: boolean }
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

  if (error) {
    /* Mesmo raciocínio do limite de clientes (`app/(app)/app/clientes/acoes.ts`):
       o limite é imposto por trigger no banco, não aqui — aqui só traduz. */
    const limite = mensagemDeLimiteDeCobrancas(error.message);
    if (limite) return { ok: false, mensagem: limite };
    return { ok: false, mensagem: mensagemDeErro(error) };
  }

  /* Envio ao Asaas é best-effort e NUNCA bloqueia o cadastro: o CRM
     funciona sem conta financeira conectada. Uma falha aqui (empresa sem
     subconta, cliente sem sincronizar, Asaas fora do ar) só deixa a
     cobrança com `asaas_sync_status = 'erro'`, retentável depois. */
  const atual = await usuarioAtual();
  await sincronizarCobrancaFinanceira(data.id, ctx.empresaId, atual?.user.id ?? null);

  /* Fase 23 — mesmo raciocínio de app/(app)/app/clientes/acoes.ts: conta
     depois de inserir, "é a primeira" é count <= 1. */
  const { count } = await ctx.supabase
    .from("cobrancas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", ctx.empresaId);

  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, id: data.id, primeiro: (count ?? 0) <= 1 };
}

/** Botão manual de retry — mesma sincronização, exposta para quando a automática falhou. */
export async function sincronizarCobrancaAsaasAcao(id: string): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const atual = await usuarioAtual();
  const resultado = await sincronizarCobrancaFinanceira(id, ctx.empresaId, atual?.user.id ?? null);

  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/cobrancas/${id}`);
  return { ok: true, id };
}

export async function atualizarCobranca(
  id: string,
  dados: DadosCobranca
): Promise<ResultadoCobranca> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const { data: atualCobranca } = await ctx.supabase
    .from("cobrancas")
    .select("status,vence_em,asaas_payment_id,forma_pagamento,multa_pct,juros_pct_mes")
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

  /* Cobrança JÁ enviada ao Asaas: forma de pagamento e encargos ficam como
     foram criados. O Zelo não reescreve no Asaas uma cobrança que existe
     lá (nem altera sozinho o que o cliente vai ver); o que vier do
     navegador para esses campos é ignorado, e o que vale é o que está salvo. */
  if (atualCobranca.asaas_payment_id) {
    dados = {
      ...dados,
      forma_pagamento: atualCobranca.forma_pagamento === "cliente_escolhe" ? "cliente_escolhe" : "pix",
      multa: percentualParaCampo(atualCobranca.multa_pct),
      juros: percentualParaCampo(atualCobranca.juros_pct_mes),
    };
  }

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

/**
 * Cancela local e, quando a cobrança já foi enviada ao Asaas, cancela lá
 * também — nessa ordem: só marca cancelada localmente depois que o
 * Asaas confirma (ou já não tinha mais nada a cancelar). Ver
 * `cancelarCobrancaFinanceira` para o motivo de não inverter essa ordem.
 */
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

  const usuario = await usuarioAtual();
  const resultado = await cancelarCobrancaFinanceira(id, ctx.empresaId, usuario?.user.id ?? null);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

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

  const { error, count } = await ctx.supabase
    .from("cobrancas")
    .update(
      {
        status: "paga",
        pago_em: new Date().toISOString(),
        valor_pago_centavos: atual.valor_centavos,
        pago_via: "manual",
      },
      { count: "exact" }
    )
    .eq("id", id)
    .eq("empresa_id", ctx.empresaId)
    /* idempotência: se duas abas clicarem junto, a segunda não acha mais
       nada em `pendente`/`enviada` e não sobrescreve a data do pagamento */
    .in("status", ["pendente", "enviada"]);

  if (error) return { ok: false, mensagem: mensagemDeErro(error) };

  // Fase 11: registrado com `pago_via='manual'` — o dashboard nunca
  // mistura isso com confirmação real do Asaas. Auditoria também estava
  // faltando aqui (achado ao ligar o dashboard nessa distinção).
  if (count) {
    const usuario = await usuarioAtual();
    await registrarAcaoFinanceira(ctx.empresaId, usuario?.user.id ?? null, "cobranca_marcada_paga_manualmente", id);
  }

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

/**
 * Verifica o status atual no Asaas — botão manual, complementa o
 * webhook (Fase 9: a mesma reconciliação por consulta ativa que já
 * existe para autorização e instrução, agora também para cobrança).
 */
export async function sincronizarStatusCobrancaAcao(
  id: string
): Promise<{ ok: true; status: string } | { ok: false; mensagem: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const resultado = await sincronizarStatusCobranca(id, ctx.empresaId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };

  revalidatePath(`/app/cobrancas/${id}`);
  revalidatePath("/app/cobrancas");
  revalidatePath("/app");
  return { ok: true, status: resultado.dado.status };
}

function mensagemDeErro(erro: { code?: string; message: string }): string {
  if (erro.code === "42501" || erro.code === "PGRST301") {
    return "Sua assinatura não está ativa. Assine para criar novas cobranças.";
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
