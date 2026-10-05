/**
 * Cobrança da MENSALIDADE do Zelo — o checkout.
 *
 * Sem React, sem DOM. Quem é cobrado: o profissional. Quem cobra: a
 * conta PLATAFORMA do Asaas (nunca a subconta dele). Reaproveita o que já
 * existia: `lib/asaas/cliente.ts` e `lib/asaas/assinatura.ts` sem
 * credencial = conta da plataforma, e as colunas
 * `empresas.asaas_customer_id` / `asaas_subscription_id`, que o webhook em
 * contexto "plataforma" já usava para achar a empresa.
 *
 * O que este módulo FAZ: cria (ou reaproveita) o customer e a assinatura
 * recorrente mensal e devolve o link de pagamento.
 * O que ele NÃO faz, de propósito: ativar a assinatura. Escolher plano e
 * gerar a cobrança deixa a conta `pendente`. Só o webhook, com o pagamento
 * CONFIRMADO, leva a `ativa` (`lib/asaas/webhook.ts`).
 *
 * O preço NUNCA vem do cliente: o chamador diz qual plano, o valor sai de
 * `lib/plano.ts`.
 */

import { supabaseAdmin } from "../supabase/admin";
import { credencialDaPlataforma } from "../asaas/config";
import { criarClienteAsaas, buscarClientePorExternalReference } from "../asaas/cliente";
import {
  cancelarAssinaturaAsaas,
  criarAssinaturaAsaas,
  listarCobrancasDaAssinatura,
} from "../asaas/assinatura";
import { ehPlano, NOME_DO_PLANO, Plano, precoDoPlano } from "../plano";
import { StatusAssinatura } from "../empresa";
import { registrarAcaoFinanceira } from "./auditoria";
import { registrarMensalidade } from "./mensalidade";
import { transicaoValidaAssinatura, origemPermitidaAssinatura } from "./assinatura";

export type CodigoErroAssinaturaZelo =
  | "plano_invalido"
  | "documento_invalido"
  | "sem_permissao"
  | "ja_ativa"
  | "indisponivel"
  | "provedor"
  | "empresa";

export type ResultadoAssinaturaZelo =
  | {
      ok: true;
      plano: Plano;
      valorCentavos: number;
      /** link de pagamento do Asaas; null só se o provedor ainda não o devolveu */
      linkPagamento: string | null;
      jaExistia: boolean;
    }
  | { ok: false; codigo: CodigoErroAssinaturaZelo; mensagem: string };

const falha = (codigo: CodigoErroAssinaturaZelo, mensagem: string): ResultadoAssinaturaZelo => ({
  ok: false,
  codigo,
  mensagem,
});

/** Data de hoje no fuso de São Paulo, `YYYY-MM-DD` (formato do Asaas). */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function documentoValido(digitos: string): boolean {
  return digitos.length === 11 || digitos.length === 14;
}

type EmpresaCheckout = {
  id: string;
  nome: string;
  documento: string | null;
  plano: string;
  assinatura_status: StatusAssinatura;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
};

/**
 * Um link de pagamento por assinatura: a cobrança em aberto (PENDING ou
 * OVERDUE) mais antiga.
 */
async function linkDaCobrancaEmAberto(subscriptionId: string): Promise<string | null> {
  const r = await listarCobrancasDaAssinatura(subscriptionId);
  if (!r.ok) return null;
  const aberta = r.data.data.find((p) => p.status === "PENDING" || p.status === "OVERDUE") ?? r.data.data[0];
  return aberta?.invoiceUrl ?? null;
}

/** Registra a cobrança que o Asaas acabou de gerar, sem esperar o webhook. Idempotente por payment id. */
async function registrarPrimeiraCobranca(empresaId: string, subscriptionId: string) {
  const r = await listarCobrancasDaAssinatura(subscriptionId);
  if (!r.ok) return;
  for (const p of r.data.data) {
    if (p.status !== "PENDING" && p.status !== "OVERDUE") continue;
    try {
      await registrarMensalidade({
        empresaId,
        paymentId: p.id,
        subscriptionId,
        valorCentavos: Math.round(p.value * 100),
        vencimento: p.dueDate,
        evento: "criada",
      });
    } catch (e) {
      console.error("[assinatura-zelo] falha ao registrar cobrança inicial:", e instanceof Error ? e.message : "erro");
    }
  }
}

export async function iniciarAssinaturaZelo(dados: {
  empresaId: string;
  userId: string;
  papel: string | null | undefined;
  email: string | null;
  plano: unknown;
  documento: string;
}): Promise<ResultadoAssinaturaZelo> {
  if (!ehPlano(dados.plano)) {
    return falha("plano_invalido", "Escolha um dos planos para continuar.");
  }
  const plano: Plano = dados.plano;

  if (dados.papel !== "dono") {
    return falha("sem_permissao", "Só o responsável pela conta pode assinar o plano.");
  }

  const documento = dados.documento.replace(/\D/g, "");
  if (!documentoValido(documento)) {
    return falha("documento_invalido", "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
  }

  if (!credencialDaPlataforma()) {
    return falha("indisponivel", "O pagamento ainda não está disponível. Tente novamente em instantes.");
  }

  const admin = supabaseAdmin();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nome, documento, plano, assinatura_status, asaas_customer_id, asaas_subscription_id")
    .eq("id", dados.empresaId)
    .maybeSingle();
  if (!empresa) return falha("empresa", "Conta não encontrada.");
  const e = empresa as EmpresaCheckout;

  if (e.assinatura_status === "ativa") {
    return falha("ja_ativa", "Sua assinatura já está ativa.");
  }

  const valorCentavos = precoDoPlano(plano);

  // 1. customer na conta da plataforma (reaproveita se já existe)
  let customerId = e.asaas_customer_id;
  if (!customerId) {
    const existente = await buscarClientePorExternalReference(e.id);
    customerId = existente.ok ? existente.data.data[0]?.id ?? null : null;
  }
  if (!customerId) {
    const criado = await criarClienteAsaas({
      name: e.nome,
      cpfCnpj: documento,
      email: dados.email,
      externalReference: e.id,
    });
    if (!criado.ok) {
      console.error("[assinatura-zelo] customer recusado pelo provedor, status", criado.status);
      return falha("provedor", "Não foi possível iniciar o pagamento agora. Confira o CPF/CNPJ e tente de novo.");
    }
    customerId = criado.data.id;
  }

  // 2. reaproveita a assinatura se for o mesmo plano e ainda estiver aberta
  if (e.asaas_subscription_id && e.assinatura_status !== "cancelada" && e.plano === plano) {
    const link = await linkDaCobrancaEmAberto(e.asaas_subscription_id);
    if (link) {
      return { ok: true, plano, valorCentavos, linkPagamento: link, jaExistia: true };
    }
  }

  // 3. nova assinatura mensal. UNDEFINED = quem paga escolhe Pix, boleto ou cartão.
  const criada = await criarAssinaturaAsaas({
    customer: customerId,
    billingType: "UNDEFINED",
    valorCentavos,
    nextDueDate: hojeEmSaoPaulo(),
    cycle: "MONTHLY",
    description: `Assinatura Zelo — plano ${NOME_DO_PLANO[plano]}`,
    externalReference: e.id,
  });
  if (!criada.ok) {
    console.error("[assinatura-zelo] assinatura recusada pelo provedor, status", criada.status);
    return falha("provedor", "Não foi possível gerar a cobrança agora. Tente novamente em instantes.");
  }
  const novaSubscriptionId = criada.data.id;
  const antiga = e.asaas_subscription_id;

  // 4. grava ANTES de apagar a antiga: assim o SUBSCRIPTION_DELETED dela,
  //    quando chegar, não acha mais a empresa e é ignorado.
  const atualizacao: Record<string, unknown> = {
    plano,
    asaas_customer_id: customerId,
    asaas_subscription_id: novaSubscriptionId,
    documento,
  };
  if (e.assinatura_status === "cancelada") {
    // recomeçar depois de cancelar: único caminho para 'pendente'
    if (
      transicaoValidaAssinatura("cancelada", "pendente") &&
      origemPermitidaAssinatura("pendente", "caso_de_uso")
    ) {
      atualizacao.assinatura_status = "pendente";
      atualizacao.assinatura_atualizada_em = new Date().toISOString();
    }
  }
  const { error: erroGravar } = await admin.from("empresas").update(atualizacao).eq("id", e.id);
  if (erroGravar) {
    console.error("[assinatura-zelo] falha ao gravar assinatura:", erroGravar.code);
    return falha("provedor", "Não foi possível concluir agora. Tente novamente.");
  }

  if (antiga && antiga !== novaSubscriptionId) {
    const apagada = await cancelarAssinaturaAsaas(antiga);
    if (!apagada.ok) {
      console.error("[assinatura-zelo] não foi possível remover a assinatura anterior, status", apagada.status);
    }
  }

  await registrarPrimeiraCobranca(e.id, novaSubscriptionId);
  await registrarAcaoFinanceira(e.id, dados.userId, `assinatura_zelo_iniciada:${plano}`, novaSubscriptionId);

  const link = await linkDaCobrancaEmAberto(novaSubscriptionId);
  return { ok: true, plano, valorCentavos, linkPagamento: link, jaExistia: false };
}

/** Link da cobrança em aberto da empresa — para a tela de assinatura. Nunca lança. */
export async function obterLinkDePagamentoPendente(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId || !credencialDaPlataforma()) return null;
  try {
    return await linkDaCobrancaEmAberto(subscriptionId);
  } catch {
    return null;
  }
}
