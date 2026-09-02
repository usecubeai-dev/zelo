/**
 * Fase 9 do Core Financeiro — webhooks financeiros + reconciliação
 * completa.
 *
 * Foco: a lacuna que faltava no fluxo de PAGAMENTO — estorno (total e
 * parcial) e chargeback, que não tinham nenhum tratamento até aqui — e a
 * reconciliação por consulta ativa de cobrança (`sincronizarStatusCobranca`),
 * completando o conjunto que autorização (Fase 6) e instrução (Fase 7) já
 * tinham. Mesmo espírito das fases anteriores: sem credencial real, com
 * `consultor` injetado simulando a resposta do Asaas onde for preciso.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { processarEventoWebhook } from "../lib/asaas/webhook";
import { AsaasWebhookPayload } from "../lib/asaas/tipos";
import { sincronizarStatusCobranca, ConsultadorDeCobrancaAsaas } from "../lib/core/cobranca-financeira";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!process.env.ASAAS_CREDENTIALS_KEY) {
  process.env.ASAAS_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let passou = 0,
  falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

console.log("\n=== CORE FINANCEIRO — FASE 9 (webhooks + reconciliação) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_webhook_reconc_fase9_12345";

async function criarEmpresa(nome: string) {
  const email = `webh9_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA_TESTE, email_confirm: true, user_metadata: { nome } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);

  const accountId = `acc_mock_${empresaId.slice(0, 8)}`;
  await admin
    .from("empresas")
    .update({ provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: accountId })
    .eq("id", empresaId);

  return { empresaId, accountId };
}

async function criarCliente(empresaId: string) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente teste", email: `cli${Date.now()}@zelo.test`, documento: "98765432100" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${data.id.slice(0, 8)}` }).eq("id", data.id);
  return data.id as string;
}

let contadorVencimento = 0;
async function criarCobrancaPaga(empresaId: string, clienteId: string, valorCentavos = 25000) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const asaasPaymentId = `pay_mock_${Math.random().toString(36).slice(2, 10)}`;
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Cobrança teste",
      valor_centavos: valorCentavos,
      vence_em: `2027-03-${dia}`,
      status: "paga",
      pago_em: "2027-03-01T12:00:00.000Z",
      valor_pago_centavos: valorCentavos,
      pago_via: "asaas",
      asaas_payment_id: asaasPaymentId,
      asaas_sync_status: "sincronizado",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { cobrancaId: data.id as string, asaasPaymentId };
}

async function criarCobrancaPendente(empresaId: string, clienteId: string, comPaymentId = true) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const asaasPaymentId = comPaymentId ? `pay_mock_${Math.random().toString(36).slice(2, 10)}` : null;
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Cobrança pendente teste",
      valor_centavos: 10000,
      vence_em: `2027-04-${dia}`,
      status: "pendente",
      asaas_payment_id: asaasPaymentId,
      asaas_sync_status: comPaymentId ? "sincronizado" : "pendente",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { cobrancaId: data.id as string, asaasPaymentId };
}

async function buscarCobranca(id: string) {
  const { data } = await admin.from("cobrancas").select("*").eq("id", id).single();
  return data;
}

async function logExiste(empresaId: string, acao: string, entidadeId: string) {
  const { data } = await admin
    .from("log_acoes_financeiras")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("acao", acao)
    .eq("entidade_id", entidadeId)
    .maybeSingle();
  return !!data;
}

function paymentBase(overrides: Partial<NonNullable<AsaasWebhookPayload["payment"]>>): NonNullable<AsaasWebhookPayload["payment"]> {
  return {
    id: "pay_x",
    customer: "cus_x",
    dateCreated: "2027-03-01",
    dueDate: "2027-03-05",
    value: 250,
    billingType: "PIX",
    status: "RECEIVED",
    ...overrides,
  };
}

async function run() {
  console.log("\nESTORNO TOTAL — PAYMENT_REFUNDED marca 'estornada' e preserva o histórico de pagamento");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa estorno total");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPaga(empresaId, clienteId, 25000);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId, value: 250, status: "REFUNDED", externalReference: cobrancaId }),
    };

    const r = await processarEventoWebhook(evento);
    t("processado com sucesso", r.ok);

    const cob = await buscarCobranca(cobrancaId);
    t("status vira 'estornada'", cob.status === "estornada");
    t("valor_estornado_centavos = valor total (sem refunds no payload, usa o value)", cob.valor_estornado_centavos === 25000);
    t("estornado_em preenchido", !!cob.estornado_em);
    t("pago_em preservado (fato histórico, não apaga)", cob.pago_em === "2027-03-01T12:00:00+00:00" || !!cob.pago_em);
    t("valor_pago_centavos preservado", cob.valor_pago_centavos === 25000);
    t("auditoria 'cobranca_estornada' registrada", await logExiste(empresaId, "cobranca_estornada", asaasPaymentId));

    // Idempotência: reenvio do mesmo evento não reprocessa (constraint única em eventos_asaas).
    const r2 = await processarEventoWebhook(evento);
    t("reenvio do mesmo evento é idempotente", r2.ok && (r2 as any).idempotente === true);
    const cobDepois = await buscarCobranca(cobrancaId);
    t("nada muda no reenvio", cobDepois.status === "estornada" && cobDepois.valor_estornado_centavos === 25000);
  }

  console.log("\nESTORNO PARCIAL — PAYMENT_PARTIALLY_REFUNDED mantém 'paga', só registra o valor");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa estorno parcial");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPaga(empresaId, clienteId, 25000);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_PARTIALLY_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({
        id: asaasPaymentId,
        value: 250,
        status: "RECEIVED",
        externalReference: cobrancaId,
        refunds: [{ value: 50 }],
      }),
    };

    const r = await processarEventoWebhook(evento);
    t("processado com sucesso", r.ok);

    const cob = await buscarCobranca(cobrancaId);
    t("status continua 'paga' (não é estorno total)", cob.status === "paga");
    t("valor_estornado_centavos = soma de refunds (5000)", cob.valor_estornado_centavos === 5000);
    t("auditoria 'cobranca_parcialmente_estornada' registrada", await logExiste(empresaId, "cobranca_parcialmente_estornada", asaasPaymentId));
  }

  console.log("\nESTORNO PARCIAL QUE SOMA O VALOR TOTAL — vira 'estornada' mesmo com o evento sendo PARTIALLY_REFUNDED");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa estorno parcial total");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPaga(empresaId, clienteId, 25000);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_PARTIALLY_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({
        id: asaasPaymentId,
        value: 250,
        status: "RECEIVED",
        externalReference: cobrancaId,
        refunds: [{ value: 150 }, { value: 100 }],
      }),
    };

    const r = await processarEventoWebhook(evento);
    t("processado com sucesso", r.ok);
    const cob = await buscarCobranca(cobrancaId);
    t("soma dos refunds (25000) bate o valor total: vira 'estornada'", cob.status === "estornada" && cob.valor_estornado_centavos === 25000);
  }

  console.log("\nESTORNO SEM COBRANÇA 'paga' CORRESPONDENTE — não corrompe estado, não finge sucesso");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa estorno fora de ordem");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPendente(empresaId, clienteId);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId!, value: 100, status: "REFUNDED", externalReference: cobrancaId }),
    };

    const r = await processarEventoWebhook(evento);
    t("evento aceito (não é erro de infraestrutura)", r.ok);
    const cob = await buscarCobranca(cobrancaId);
    t("cobrança pendente NÃO vira estornada (nada pra estornar)", cob.status === "pendente");
    t("nenhuma auditoria de estorno registrada", !(await logExiste(empresaId, "cobranca_estornada", asaasPaymentId!)));
  }

  console.log("\nCHARGEBACK — etapas intermediárias só auditam, não inventam status novo");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa chargeback");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPaga(empresaId, clienteId, 25000);

    const eventos: AsaasWebhookPayload["event"][] = [
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      "PAYMENT_REFUND_IN_PROGRESS",
      "PAYMENT_REFUND_DENIED",
    ];

    for (const nomeEvento of eventos) {
      const evento: AsaasWebhookPayload = {
        id: `evt_${Math.random().toString(36).slice(2, 10)}`,
        event: nomeEvento,
        dateCreated: new Date().toISOString(),
        account: { id: accountId },
        payment: paymentBase({ id: asaasPaymentId, value: 250, status: "CHARGEBACK_REQUESTED", externalReference: cobrancaId }),
      };
      const r = await processarEventoWebhook(evento);
      t(`${nomeEvento} processado com sucesso`, r.ok);
    }

    const cob = await buscarCobranca(cobrancaId);
    t("status da cobrança continua 'paga' (nenhuma etapa intermediária é terminal)", cob.status === "paga");
    t(
      "auditoria registrada pra cada etapa do chargeback",
      (await logExiste(empresaId, "cobranca_chargeback_requested", asaasPaymentId)) &&
        (await logExiste(empresaId, "cobranca_chargeback_dispute", asaasPaymentId)) &&
        (await logExiste(empresaId, "cobranca_awaiting_chargeback_reversal", asaasPaymentId)) &&
        (await logExiste(empresaId, "cobranca_refund_in_progress", asaasPaymentId)) &&
        (await logExiste(empresaId, "cobranca_refund_denied", asaasPaymentId))
    );
  }

  console.log("\nISOLAMENTO — estorno de A não afeta cobrança de A quando o evento vem da conta de B");
  {
    const { empresaId: empA } = await criarEmpresa("Empresa A isolamento estorno");
    const { accountId: contaB } = await criarEmpresa("Empresa B isolamento estorno");
    const clienteId = await criarCliente(empA);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPaga(empA, clienteId, 25000);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: contaB }, // conta errada de propósito
      payment: paymentBase({ id: asaasPaymentId, value: 250, status: "REFUNDED", externalReference: cobrancaId }),
    };

    await processarEventoWebhook(evento);
    const cob = await buscarCobranca(cobrancaId);
    t("cobrança de A continua 'paga' (evento resolveu pra empresa B, não bateu)", cob.status === "paga");
  }

  console.log("\nRECONCILIAÇÃO DE COBRANÇA — sincronizarStatusCobranca (Fase 9, completa o que faltava)");
  {
    const { empresaId } = await criarEmpresa("Empresa reconciliação cobrança");
    const clienteId = await criarCliente(empresaId);
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_fase9");

    const consultorReceived: ConsultadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { id: "pay_x", customer: "cus_x", dateCreated: "2027-03-01", dueDate: "2027-03-05", value: 100, billingType: "PIX", status: "RECEIVED", paymentDate: "2027-03-02" } as any,
    });
    const { cobrancaId: cobPendenteId } = await criarCobrancaPendente(empresaId, clienteId);
    const rReceived = await sincronizarStatusCobranca(cobPendenteId, empresaId, consultorReceived);
    t("RECEIVED remoto + local pendente → reconcilia pra 'paga'", rReceived.ok && rReceived.dado.status === "paga");
    const cobDepoisReceived = await buscarCobranca(cobPendenteId);
    t("banco reflete 'paga' com valor e data", cobDepoisReceived.status === "paga" && cobDepoisReceived.valor_pago_centavos === 10000);

    // Paridade com o webhook: reconciliar uma cobrança com instrução Pix Automático vinculada também registra `pagamentos`.
    {
      const { cobrancaId: cobComInstrucaoId, asaasPaymentId: paymentComInstrucao } = await criarCobrancaPendente(empresaId, clienteId);
      const { data: recorrenciaAux, error: erroAuxRec } = await admin
        .from("recorrencias")
        .insert({
          empresa_id: empresaId,
          cliente_id: clienteId,
          descricao: "Recorrência auxiliar (pagamentos)",
          valor_centavos: 10000,
          periodicidade: "mensal",
          dia_vencimento: 5,
          inicia_em: "2027-01-01",
          status: "ativa",
        })
        .select("id")
        .single();
      if (erroAuxRec) throw new Error(erroAuxRec.message);
      const { data: autorizacaoAux, error: erroAuxAuth } = await admin
        .from("autorizacoes_pix")
        .insert({
          empresa_id: empresaId,
          recorrencia_id: recorrenciaAux.id,
          cliente_id: clienteId,
          asaas_authorization_id: `auth_mock_aux_${Math.random().toString(36).slice(2, 8)}`,
          status: "ACTIVE",
          finish_date: "2032-01-01",
          retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
        })
        .select("id")
        .single();
      if (erroAuxAuth) throw new Error(erroAuxAuth.message);
      await admin.from("instrucoes_pagamento").insert({
        empresa_id: empresaId,
        cobranca_id: cobComInstrucaoId,
        autorizacao_id: autorizacaoAux.id,
        asaas_payment_id: paymentComInstrucao,
        status: "SCHEDULED",
      });
      const consultorReceivedComNetValue: ConsultadorDeCobrancaAsaas = async () => ({
        ok: true,
        data: { id: paymentComInstrucao!, customer: "cus_x", dateCreated: "2027-03-01", dueDate: "2027-03-05", value: 100, netValue: 97, billingType: "PIX", status: "RECEIVED", paymentDate: "2027-03-02" } as any,
      });
      const rComInstrucao = await sincronizarStatusCobranca(cobComInstrucaoId, empresaId, consultorReceivedComNetValue);
      t("reconciliação com instrução vinculada também dá 'paga'", rComInstrucao.ok && rComInstrucao.dado.status === "paga");
      const { data: pagamento } = await admin.from("pagamentos").select("*").eq("asaas_payment_id", paymentComInstrucao!).maybeSingle();
      t("linha em 'pagamentos' foi criada pela reconciliação (paridade com o webhook)", !!pagamento && pagamento.valor_liquido_centavos === 9700 && pagamento.taxa_centavos === 300);
    }

    const consultorRefunded: ConsultadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { id: "pay_y", customer: "cus_x", dateCreated: "2027-03-01", dueDate: "2027-03-05", value: 250, billingType: "PIX", status: "REFUNDED", refunds: [{ value: 250 }] } as any,
    });
    const { cobrancaId: cobPagaId } = await criarCobrancaPaga(empresaId, clienteId, 25000);
    const rRefunded = await sincronizarStatusCobranca(cobPagaId, empresaId, consultorRefunded);
    t("REFUNDED remoto + local paga → reconcilia pra 'estornada'", rRefunded.ok && rRefunded.dado.status === "estornada");

    const consultorDeleted: ConsultadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { id: "pay_z", customer: "cus_x", dateCreated: "2027-03-01", dueDate: "2027-03-05", value: 100, billingType: "PIX", status: "PENDING", deleted: true } as any,
    });
    const { cobrancaId: cobPendente2Id } = await criarCobrancaPendente(empresaId, clienteId);
    const rDeleted = await sincronizarStatusCobranca(cobPendente2Id, empresaId, consultorDeleted);
    t("deleted remoto + local pendente → reconcilia pra 'cancelada'", rDeleted.ok && rDeleted.dado.status === "cancelada");

    // Já bate: sem mudança.
    const { cobrancaId: cobJaPagaId } = await criarCobrancaPaga(empresaId, clienteId, 10000);
    const rJaPaga = await sincronizarStatusCobranca(cobJaPagaId, empresaId, consultorReceived);
    t("já bate (RECEIVED remoto + local já paga) → no-op, sem erro", rJaPaga.ok && rJaPaga.dado.status === "paga");

    // Divergência que a reconciliação não corrige sozinha: não reverte às cegas.
    const consultorPendingInesperado: ConsultadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { id: "pay_w", customer: "cus_x", dateCreated: "2027-03-01", dueDate: "2027-03-05", value: 10000, billingType: "PIX", status: "PENDING" } as any,
    });
    const { cobrancaId: cobDivergenteId } = await criarCobrancaPaga(empresaId, clienteId, 10000);
    const rDivergente = await sincronizarStatusCobranca(cobDivergenteId, empresaId, consultorPendingInesperado);
    t("divergência não coberta (PENDING remoto, 'paga' local) NÃO reverte — fica como estava", rDivergente.ok && rDivergente.dado.status === "paga");
    const cobDivergente = await buscarCobranca(cobDivergenteId);
    t("banco continua 'paga' de verdade (não foi revertido às cegas)", cobDivergente.status === "paga");

    // Sem asaas_payment_id.
    const { cobrancaId: cobSemPayment } = await criarCobrancaPendente(empresaId, clienteId, false);
    const rSemPayment = await sincronizarStatusCobranca(cobSemPayment, empresaId, consultorReceived);
    t("cobrança sem asaas_payment_id falha com conflito", !rSemPayment.ok && rSemPayment.erro.tipo === "conflito");

    // Consultor falha.
    const consultorErro: ConsultadorDeCobrancaAsaas = async () => ({ ok: false, status: 500, erro: "erro simulado" });
    const rErro = await sincronizarStatusCobranca(cobPagaId, empresaId, consultorErro);
    t("falha do Asaas na consulta vira integracao_externa", !rErro.ok && rErro.erro.tipo === "integracao_externa");
  }

  console.log("\nRECONCILIAÇÃO — isolamento por empresa e sem credencial");
  {
    const { empresaId: empA } = await criarEmpresa("Empresa A reconc isolamento");
    const { empresaId: empB } = await criarEmpresa("Empresa B reconc isolamento");
    const clienteId = await criarCliente(empA);
    const { cobrancaId } = await criarCobrancaPaga(empA, clienteId, 10000);

    const rCruzado = await sincronizarStatusCobranca(cobrancaId, empB);
    t("reconciliar cobrança de A usando empresaId de B falha com nao_encontrado", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    const rSemCredencial = await sincronizarStatusCobranca(cobrancaId, empA);
    t("empresa sem credencial salva falha com integracao_externa", !rSemCredencial.ok && rSemCredencial.erro.tipo === "integracao_externa");
  }

  console.log("\nCAMADAS — Server Action expõe a reconciliação, não fala com o Asaas direto");
  {
    const conteudo = fs.readFileSync("app/(app)/app/cobrancas/acoes.ts", "utf8");
    t("acoes.ts importa sincronizarStatusCobranca", conteudo.includes("sincronizarStatusCobranca"));
    t("existe a ação sincronizarStatusCobrancaAcao", conteudo.includes("export async function sincronizarStatusCobrancaAcao"));

    const conteudoUI = fs.readFileSync("app/(app)/app/cobrancas/AcoesCobranca.tsx", "utf8");
    t("AcoesCobranca.tsx tem o botão 'Verificar status agora'", conteudoUI.includes("Verificar status agora"));

    const conteudoWebhook = fs.readFileSync("lib/asaas/webhook.ts", "utf8");
    t("webhook.ts trata PAYMENT_REFUNDED", conteudoWebhook.includes('"PAYMENT_REFUNDED"'));
    t("webhook.ts trata PAYMENT_PARTIALLY_REFUNDED", conteudoWebhook.includes('"PAYMENT_PARTIALLY_REFUNDED"'));
    t("webhook.ts trata os eventos de chargeback", conteudoWebhook.includes("PAYMENT_CHARGEBACK_REQUESTED"));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
  await admin.from("pagamentos").delete().in("empresa_id", empresas);
  await admin.from("instrucoes_pagamento").delete().in("empresa_id", empresas);
  await admin.from("autorizacoes_pix").delete().in("empresa_id", empresas);
  await admin.from("eventos_asaas").delete().in("empresa_id", empresas);
  await admin.from("cobrancas").delete().in("empresa_id", empresas);
  await admin.from("recorrencias").delete().in("empresa_id", empresas);
  await admin.from("clientes").delete().in("empresa_id", empresas);
  for (const id of usuarios) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  }
  const { count } = await admin.from("empresas").select("*", { count: "exact", head: true }).in("id", empresas);
  t("banco limpo ao final", (count ?? 0) === 0);

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
