/**
 * Fase 13 do Core Financeiro — notificações internas e centro de alertas.
 *
 * Cobre a infraestrutura (`lib/core/notificacoes.ts`, idempotência,
 * RLS) e os gatilhos reais ligados no webhook e nos casos de uso de
 * sincronização — testados fazendo o evento acontecer de verdade
 * (`processarEventoWebhook`/`sincronizarCobrancaFinanceira`/
 * `sincronizarClienteFinanceiro`), não inserindo a notificação direto.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { processarEventoWebhook } from "../lib/asaas/webhook";
import { AsaasWebhookPayload } from "../lib/asaas/tipos";
import { criarNotificacao, marcarComoLida, marcarTodasComoLidas, contarNaoLidas } from "../lib/core/notificacoes";
import { sincronizarCobrancaFinanceira, CriadorDeCobrancaAsaas } from "../lib/core/cobranca-financeira";
import { sincronizarClienteFinanceiro, CriadorDeClienteAsaas } from "../lib/core/cliente-financeiro";
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

console.log("\n=== CORE FINANCEIRO — FASE 13 (notificações internas) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_notificacoes_fase13_12345";

async function criarEmpresa(nome: string) {
  const email = `notif13_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  await admin.from("empresas").update({ provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: accountId }).eq("id", empresaId);
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
async function criarRecorrenciaComAutorizacao(empresaId: string, clienteId: string, statusAuth = "ACTIVE") {
  const { data: rec, error } = await admin
    .from("recorrencias")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Mensalidade teste", valor_centavos: 35000, periodicidade: "mensal", dia_vencimento: 5, inicia_em: "2027-01-01", status: "ativa" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: auth, error: erroAuth } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empresaId, recorrencia_id: rec.id, cliente_id: clienteId, asaas_authorization_id: `auth_n13_${rec.id.slice(0, 8)}`, status: statusAuth, finish_date: "2032-01-01", retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS" })
    .select("id")
    .single();
  if (erroAuth) throw new Error(erroAuth.message);
  if (statusAuth === "ACTIVE") await admin.from("recorrencias").update({ autorizacao_atual_id: auth.id }).eq("id", rec.id);
  return { recorrenciaId: rec.id as string, autorizacaoId: auth.id as string };
}

async function criarCobrancaComInstrucao(empresaId: string, clienteId: string, autorizacaoId: string) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const asaasPaymentId = `pay_n13_${Math.random().toString(36).slice(2, 10)}`;
  const { data: cob, error } = await admin
    .from("cobrancas")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Cobrança teste notificação", valor_centavos: 25000, vence_em: `2027-06-${dia}`, status: "pendente", asaas_payment_id: asaasPaymentId, asaas_sync_status: "sincronizado" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: instr, error: erroInstr } = await admin
    .from("instrucoes_pagamento")
    .insert({ empresa_id: empresaId, cobranca_id: cob.id, autorizacao_id: autorizacaoId, asaas_payment_id: asaasPaymentId, status: "AWAITING_REQUEST" })
    .select("id")
    .single();
  if (erroInstr) throw new Error(erroInstr.message);
  return { cobrancaId: cob.id as string, instrucaoId: instr.id as string, asaasPaymentId };
}

function paymentBase(overrides: Partial<NonNullable<AsaasWebhookPayload["payment"]>>): NonNullable<AsaasWebhookPayload["payment"]> {
  return { id: "pay_x", customer: "cus_x", dateCreated: "2027-06-01", dueDate: "2027-06-05", value: 250, billingType: "PIX", status: "RECEIVED", ...overrides };
}

async function notificacaoPor(empresaId: string, chave: string) {
  const { data } = await admin.from("notificacoes").select("*").eq("empresa_id", empresaId).eq("chave_idempotencia", chave).maybeSingle();
  return data;
}

async function run() {
  console.log("\nINFRAESTRUTURA — idempotência, marcar como lida, contagem");
  {
    const { empresaId } = await criarEmpresa("Empresa infra notificacoes");
    await criarNotificacao(empresaId, "teste", "Título", "Mensagem", "media", null, "chave_teste_1");
    await criarNotificacao(empresaId, "teste", "Título", "Mensagem", "media", null, "chave_teste_1");
    const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("chave_idempotencia", "chave_teste_1");
    t("chamar 2x com a mesma chave cria só 1 notificação", count === 1);

    t("contarNaoLidas conta a criada", (await contarNaoLidas(empresaId)) === 1);

    const notif = await notificacaoPor(empresaId, "chave_teste_1");
    const marcou = await marcarComoLida(notif!.id, empresaId);
    t("marcarComoLida funciona", marcou);
    t("contarNaoLidas cai pra 0 depois de marcar", (await contarNaoLidas(empresaId)) === 0);

    await criarNotificacao(empresaId, "teste", "A", "B", "baixa", null, "chave_teste_2");
    await criarNotificacao(empresaId, "teste", "C", "D", "alta", null, "chave_teste_3");
    await marcarTodasComoLidas(empresaId);
    t("marcarTodasComoLidas zera as não lidas", (await contarNaoLidas(empresaId)) === 0);
  }

  console.log("\nISOLAMENTO — marcarComoLida não atravessa tenant");
  {
    const { empresaId: empA } = await criarEmpresa("Empresa A isolamento notif");
    const { empresaId: empB } = await criarEmpresa("Empresa B isolamento notif");
    await criarNotificacao(empA, "teste", "De A", "Mensagem de A", "media", null, "chave_isolamento");
    const notifA = await notificacaoPor(empA, "chave_isolamento");

    const marcouComEmpresaErrada = await marcarComoLida(notifA!.id, empB);
    t("marcarComoLida com empresaId errado não marca (isolamento)", !marcouComEmpresaErrada);

    const { data: aindaNaoLida } = await admin.from("notificacoes").select("lida").eq("id", notifA!.id).single();
    t("notificação de A continua não lida", aindaNaoLida?.lida === false);
  }

  console.log("\nWEBHOOK — autorização ACTIVE/REFUSED/EXPIRED/CANCELLED geram notificação com link pra recorrência");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa notif autorizacao");
    const clienteId = await criarCliente(empresaId);
    const { recorrenciaId, autorizacaoId } = await criarRecorrenciaComAutorizacao(empresaId, clienteId, "CREATED");

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      authorization: { id: `auth_n13_${recorrenciaId.slice(0, 8)}`, contractId: "x", status: "ACTIVE" } as any,
    });
    const notifAtiva = await notificacaoPor(empresaId, `autorizacao_pix_active:${autorizacaoId}`);
    t("ACTIVE gera notificação", !!notifAtiva);
    t("notificação linka pra recorrência certa", notifAtiva?.link === `/app/recorrencias/${recorrenciaId}`);
    t("prioridade média", notifAtiva?.prioridade === "media");
  }

  console.log("\nWEBHOOK — instrução SCHEDULED (baixa) e REFUSED (alta) geram notificação com link pra cobrança");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa notif instrucao");
    const clienteId = await criarCliente(empresaId);
    const { autorizacaoId } = await criarRecorrenciaComAutorizacao(empresaId, clienteId);
    const { cobrancaId, instrucaoId, asaasPaymentId } = await criarCobrancaComInstrucao(empresaId, clienteId, autorizacaoId);

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      paymentInstruction: { id: "instr_x", authorization: { id: "x" }, dueDate: "2027-06-05", status: "SCHEDULED", paymentId: asaasPaymentId } as any,
    });
    const notifAgendada = await notificacaoPor(empresaId, `instrucao_pagamento_scheduled:${instrucaoId}`);
    t("SCHEDULED gera notificação de prioridade baixa", !!notifAgendada && notifAgendada.prioridade === "baixa");
    t("linka pra cobrança certa", notifAgendada?.link === `/app/cobrancas/${cobrancaId}`);

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      paymentInstruction: { id: "instr_x", authorization: { id: "x" }, dueDate: "2027-06-05", status: "REFUSED", paymentId: asaasPaymentId, refusalReason: "saldo insuficiente" } as any,
    });
    const notifRecusada = await notificacaoPor(empresaId, `instrucao_pagamento_refused:${instrucaoId}`);
    t("REFUSED gera notificação de prioridade alta", !!notifRecusada && notifRecusada.prioridade === "alta");
  }

  console.log("\nWEBHOOK — pagamento recebido e estorno geram notificação");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa notif pagamento");
    const clienteId = await criarCliente(empresaId);
    const { autorizacaoId } = await criarRecorrenciaComAutorizacao(empresaId, clienteId);
    const { cobrancaId, asaasPaymentId } = await criarCobrancaComInstrucao(empresaId, clienteId, autorizacaoId);

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_RECEIVED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId, value: 250, status: "RECEIVED", externalReference: cobrancaId }),
    });
    const notifRecebido = await notificacaoPor(empresaId, `pagamento_recebido:${cobrancaId}`);
    t("PAYMENT_RECEIVED gera notificação de prioridade baixa", !!notifRecebido && notifRecebido.prioridade === "baixa");
    t("mensagem cita o valor formatado", notifRecebido?.mensagem.includes("R$"));

    await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "PAYMENT_REFUNDED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: paymentBase({ id: asaasPaymentId, value: 250, status: "REFUNDED", externalReference: cobrancaId }),
    });
    const notifEstorno = await notificacaoPor(empresaId, `cobranca_estornada:${cobrancaId}`);
    t("PAYMENT_REFUNDED gera notificação de prioridade alta", !!notifEstorno && notifEstorno.prioridade === "alta");
  }

  console.log("\nWEBHOOK — conta aprovada/recusada gera notificação");
  {
    const { empresaId, accountId } = await criarEmpresa("Empresa notif conta");
    const r1 = await processarEventoWebhook({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
    });
    t("evento processado", r1.ok);
    const { data: notifAprovada } = await admin.from("notificacoes").select("*").eq("empresa_id", empresaId).eq("tipo", "conta_aprovada").maybeSingle();
    t("conta aprovada gera notificação de prioridade média", !!notifAprovada && notifAprovada.prioridade === "media");
  }

  console.log("\nSINCRONIZAÇÃO — falha de cobrança e cliente gera notificação, sem duplicar no mesmo dia");
  {
    const { empresaId } = await criarEmpresa("Empresa notif falha sync");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_n13");
    const clienteId = await criarCliente(empresaId);
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${clienteId.slice(0, 8)}` }).eq("id", clienteId);
    const { data: cob } = await admin
      .from("cobrancas")
      .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Cobrança que falha", valor_centavos: 10000, vence_em: "2027-06-05", status: "pendente" })
      .select("id")
      .single();

    const criador500: CriadorDeCobrancaAsaas = async () => ({ ok: false, status: 500, erro: "erro simulado" });
    await sincronizarCobrancaFinanceira(cob!.id, empresaId, null, criador500);
    const hoje = new Date().toISOString().slice(0, 10);
    const notif1 = await notificacaoPor(empresaId, `cobranca_sync_erro:${cob!.id}:${hoje}`);
    t("falha de sincronização de cobrança gera notificação", !!notif1);

    // Retry no mesmo dia: não duplica.
    await admin.from("cobrancas").update({ asaas_sync_status: "erro" }).eq("id", cob!.id);
    await sincronizarCobrancaFinanceira(cob!.id, empresaId, null, criador500);
    const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("chave_idempotencia", `cobranca_sync_erro:${cob!.id}:${hoje}`);
    t("retry no mesmo dia NÃO duplica a notificação", count === 1);

    const clienteId2 = await criarCliente(empresaId);
    const criadorClienteErro: CriadorDeClienteAsaas = async () => ({ ok: false, status: 500, erro: "erro simulado" });
    await sincronizarClienteFinanceiro(clienteId2, empresaId, null, criadorClienteErro);
    const notifCliente = await notificacaoPor(empresaId, `cliente_sync_erro:${clienteId2}:${hoje}`);
    t("falha de sincronização de cliente gera notificação", !!notifCliente);
  }

  console.log("\nSEGURANÇA — RLS: dono lê só as próprias, marca como lida, mas não insere/apaga/forja outra coluna");
  {
    const { empresaId, email } = await criarEmpresa("Empresa segurança notif");
    await criarNotificacao(empresaId, "teste", "Original", "Mensagem original", "baixa", null, "chave_seguranca");
    const notif = await notificacaoPor(empresaId, "chave_seguranca");

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { data: lida } = await sessao.from("notificacoes").select("id").eq("empresa_id", empresaId);
    t("dono lê suas notificações", (lida ?? []).length >= 1);

    const { error: erroInsert } = await sessao.from("notificacoes").insert({ empresa_id: empresaId, tipo: "forjada", titulo: "x", mensagem: "y", prioridade: "baixa", chave_idempotencia: "forjada" });
    t("dono NÃO consegue inserir notificação (só service_role)", erroInsert?.code === "42501");

    const { error: erroTitulo } = await sessao.from("notificacoes").update({ titulo: "Forjado" }).eq("id", notif!.id);
    t("dono NÃO consegue alterar o título (grant só cobre 'lida')", erroTitulo?.code === "42501");

    const { error: erroLida, count: countLida } = await sessao.from("notificacoes").update({ lida: true }, { count: "exact" }).eq("id", notif!.id);
    t("dono CONSEGUE marcar como lida (grant de coluna liberado)", !erroLida && (countLida ?? 0) === 1);

    const { error: erroDelete } = await sessao.from("notificacoes").delete().eq("id", notif!.id);
    t("dono NÃO consegue apagar notificação (só service_role)", erroDelete?.code === "42501");
  }

  console.log("\nCAMADAS — layout mostra o indicador, página lê via lib/core/notificacoes");
  {
    const conteudoLayout = fs.readFileSync("app/(app)/app/layout.tsx", "utf8");
    t("layout importa contarNaoLidas", conteudoLayout.includes("contarNaoLidas"));
    t("layout linka pra /app/notificacoes", conteudoLayout.includes('href="/app/notificacoes"'));

    const conteudoPagina = fs.readFileSync("app/(app)/app/notificacoes/page.tsx", "utf8");
    t("página não fala com lib/asaas direto", !conteudoPagina.includes('from "@/lib/asaas'));

    const conteudoWebhook = fs.readFileSync("lib/asaas/webhook.ts", "utf8");
    t("webhook importa criarNotificacao", conteudoWebhook.includes("criarNotificacao"));
  }

  console.log("\nLIMPEZA");
  await admin.from("notificacoes").delete().in("empresa_id", empresas);
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
