/**
 * Fase 11 do Core Financeiro — dashboard financeiro de produção.
 *
 * Foco: `cobrancas.pago_via` — a coluna nova que fecha o requisito
 * explícito da fase ("nunca misturar pagamento confirmado com registro
 * manual"). Até aqui `status='paga'` era gravado do mesmo jeito pelo
 * webhook (confirmação real do Asaas) e por `marcarComoPaga()` (o
 * profissional declarando "recebi por fora") — sem nenhum sinal de
 * origem sobrevivendo depois da gravação. `pago_via` corrige isso:
 * 'asaas' (webhook ou reconciliação por consulta ativa) vs 'manual'
 * (declaração do profissional).
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

console.log("\n=== CORE FINANCEIRO — FASE 11 (dashboard financeiro de produção) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_dashboard_fase11_12345";

async function criarEmpresa(nome: string) {
  const email = `dash11_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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

  return { empresaId, accountId, email };
}

async function criarCliente(empresaId: string) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente teste", email: `cli${Date.now()}@zelo.test`, documento: "98765432100" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let contadorVencimento = 0;
async function criarCobrancaPendente(empresaId: string, clienteId: string, comPaymentId = true) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const asaasPaymentId = comPaymentId ? `pay_mock_${Math.random().toString(36).slice(2, 10)}` : null;
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Cobrança teste",
      valor_centavos: 10000,
      vence_em: `2027-05-${dia}`,
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

function paymentBase(overrides: Partial<NonNullable<AsaasWebhookPayload["payment"]>>): NonNullable<AsaasWebhookPayload["payment"]> {
  return {
    id: "pay_x",
    customer: "cus_x",
    dateCreated: "2027-05-01",
    dueDate: "2027-05-05",
    value: 100,
    billingType: "PIX",
    status: "RECEIVED",
    ...overrides,
  };
}

async function run() {
  console.log("\nWEBHOOK — PAYMENT_RECEIVED grava pago_via='asaas'");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa webhook recebido");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPendente(empresaId, clienteId);

    const evento: AsaasWebhookPayload = {
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_RECEIVED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId!, value: 100, status: "RECEIVED", externalReference: cobrancaId }),
    };
    const r = await processarEventoWebhook(evento);
    t("processado com sucesso", r.ok);

    const cob = await buscarCobranca(cobrancaId);
    t("status vira 'paga'", cob.status === "paga");
    t("pago_via = 'asaas'", cob.pago_via === "asaas");
  }

  console.log("\nWEBHOOK — PAYMENT_DELETED limpa pago_via junto com pago_em");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa webhook deletado");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaPendente(empresaId, clienteId);

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_RECEIVED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId!, value: 100, status: "RECEIVED", externalReference: cobrancaId }),
    });

    const r = await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_DELETED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId!, value: 100, status: "DELETED", externalReference: cobrancaId }),
    });
    t("processado com sucesso", r.ok);

    const cob = await buscarCobranca(cobrancaId);
    t("status volta pra 'cancelada'", cob.status === "cancelada");
    t("pago_via volta pra null", cob.pago_via === null);
  }

  console.log("\nRECONCILIAÇÃO — sincronizarStatusCobranca grava pago_via='asaas'");
  {
    const { empresaId } = await criarEmpresa("Empresa reconciliação pago_via");
    const clienteId = await criarCliente(empresaId);
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_fase11");
    const { cobrancaId } = await criarCobrancaPendente(empresaId, clienteId);

    const consultorReceived: ConsultadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { id: "pay_x", customer: "cus_x", dateCreated: "2027-05-01", dueDate: "2027-05-05", value: 100, billingType: "PIX", status: "RECEIVED", paymentDate: "2027-05-02" } as any,
    });
    const r = await sincronizarStatusCobranca(cobrancaId, empresaId, consultorReceived);
    t("reconcilia pra 'paga'", r.ok && r.dado.status === "paga");

    const cob = await buscarCobranca(cobrancaId);
    t("pago_via = 'asaas'", cob.pago_via === "asaas");
  }

  console.log("\nBANCO — constraint recusa 'paga' sem pago_via");
  {
    const { empresaId } = await criarEmpresa("Empresa constraint pago_via");
    const clienteId = await criarCliente(empresaId);
    const { error } = await admin.from("cobrancas").insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Inválida",
      valor_centavos: 1000,
      vence_em: "2027-05-05",
      status: "paga",
      pago_em: new Date().toISOString(),
      valor_pago_centavos: 1000,
      // pago_via ausente de propósito
    });
    t("insert recusado pela constraint (23514)", error?.code === "23514");
  }

  console.log("\nBANCO — constraint recusa pago_via fora do enum");
  {
    const { empresaId } = await criarEmpresa("Empresa constraint enum pago_via");
    const clienteId = await criarCliente(empresaId);
    const { error } = await admin.from("cobrancas").insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Inválida",
      valor_centavos: 1000,
      vence_em: "2027-05-05",
      status: "paga",
      pago_em: new Date().toISOString(),
      valor_pago_centavos: 1000,
      pago_via: "pix_direto_no_bolso",
    });
    t("insert recusado pela constraint de enum (23514)", error?.code === "23514");
  }

  console.log("\nSEGURANÇA — coluna pago_via é gravável só por caminho RLS legítimo (mesmo padrão das Fases 5-6)");
  {
    const { empresaId, email } = await criarEmpresa("Empresa grant pago_via");
    const clienteId = await criarCliente(empresaId);
    const { cobrancaId } = await criarCobrancaPendente(empresaId, clienteId, false);

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email, password: SENHA_TESTE });

    // Mesma transição que marcarComoPaga() faz — dono da empresa tem grant de coluna pra isso.
    const { error } = await sessao
      .from("cobrancas")
      .update({ status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 10000, pago_via: "manual" })
      .eq("id", cobrancaId)
      .in("status", ["pendente", "enviada"]);
    t("dono da empresa consegue marcar como paga manualmente (grant de coluna liberado)", !error);

    const cob = await buscarCobranca(cobrancaId);
    t("pago_via gravado como 'manual'", cob.pago_via === "manual");
  }

  console.log("\nCAMADAS — marcarComoPaga() distingue origem e audita; painel usa a distinção e não fala com o Asaas direto");
  {
    const conteudoAcoes = fs.readFileSync("app/(app)/app/cobrancas/acoes.ts", "utf8");
    t("marcarComoPaga() grava pago_via: 'manual'", conteudoAcoes.includes('pago_via: "manual"'));
    t("marcarComoPaga() registra auditoria", conteudoAcoes.includes("cobranca_marcada_paga_manualmente"));

    const conteudoPainel = fs.readFileSync("app/(app)/app/page.tsx", "utf8");
    t("painel separa recebido via Asaas de registrado manualmente", conteudoPainel.includes('"asaas"') && conteudoPainel.includes('"manual"'));
    // Fase 14: o estado de conexão real passou a vir de `obterJornadaOnboarding`
    // (que usa `obterContaFinanceira`/`prontaParaCobrar` internamente) —
    // o painel não chama mais essas duas direto, pra não duplicar a lógica
    // de "a conta está pronta?" em dois lugares. Ver `lib/core/jornada-onboarding.ts`.
    const conteudoJornada = fs.readFileSync("lib/core/jornada-onboarding.ts", "utf8");
    t("estado de conexão real vem de obterContaFinanceira (via a jornada, Fase 14)", conteudoJornada.includes("obterContaFinanceira"));
    t("estado de conexão usa prontaParaCobrar (mesma função das Fases 2-6, não duplica a regra)", conteudoJornada.includes("prontaParaCobrar"));
    t("painel não importa nada de lib/asaas diretamente", !conteudoPainel.includes('from "@/lib/asaas'));
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
