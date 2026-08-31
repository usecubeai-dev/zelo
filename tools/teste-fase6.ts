/**
 * Bateria de Testes da Fase 6 — Subcontas, tenant no webhook e token.
 *
 * O teste que importa é o de isolamento: um evento da empresa A carregando
 * o `externalReference` de uma cobrança da empresa B **não pode** alterar
 * nada de B. Era exatamente isso que a versão anterior do webhook fazia.
 *
 * Roda contra o banco real com service_role e limpa tudo ao final.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((line) => {
  const clean = line.trim();
  if (clean.startsWith("#") || !clean.includes("=")) return;
  const idx = clean.indexOf("=");
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERRO: variáveis do Supabase ausentes em .env.local");
  process.exit(1);
}

const TOKEN = "token_de_teste_fase6_nao_use_em_producao";
process.env.ASAAS_WEBHOOK_TOKEN = TOKEN;
process.env.ASAAS_PLATFORM_ACCOUNT_ID = "acc_plataforma_zelo_teste";
process.env.ASAAS_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passou = 0;
let falhou = 0;
function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

const ACC_A = "acc_teste_fase6_empresa_A";
const ACC_B = "acc_teste_fase6_empresa_B";
const criados = { empresas: [] as string[], eventos: [] as string[] };

async function criarEmpresa(nome: string, accountId: string) {
  const { data, error } = await db
    .from("empresas")
    .insert({
      nome,
      asaas_account_id: accountId,
      asaas_status: "ativa",
      trial_termina_em: new Date(Date.now() + 14 * 864e5).toISOString(),
      assinatura_status: "trial",
    })
    .select("id")
    .single();
  if (error) throw new Error(`empresa: ${error.message}`);
  criados.empresas.push(data.id);
  return data.id as string;
}

async function criarCobranca(empresaId: string, descricao: string) {
  const { data: cli, error: e1 } = await db
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: `Cliente ${descricao}` })
    .select("id")
    .single();
  if (e1) throw new Error(`cliente: ${e1.message}`);

  const { data, error } = await db
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: cli.id,
      descricao,
      valor_centavos: 35000,
      vence_em: new Date().toISOString().slice(0, 10),
      status: "pendente",
    })
    .select("id")
    .single();
  if (error) throw new Error(`cobranca: ${error.message}`);
  return data.id as string;
}

function evento(id: string, accountId: string | null, cobrancaId: string) {
  const base: Record<string, unknown> = {
    id,
    event: "PAYMENT_RECEIVED",
    dateCreated: new Date().toISOString(),
    payment: {
      id: `pay_${id}`,
      customer: "cus_teste",
      dateCreated: new Date().toISOString(),
      dueDate: new Date().toISOString().slice(0, 10),
      value: 350,
      billingType: "PIX",
      status: "RECEIVED",
      paymentDate: new Date().toISOString().slice(0, 10),
      externalReference: cobrancaId,
    },
  };
  if (accountId) base.account = { id: accountId, ownerId: "acc_plataforma_zelo_teste" };
  return base;
}

async function statusDa(id: string) {
  const { data } = await db.from("cobrancas").select("status").eq("id", id).maybeSingle();
  return data?.status ?? null;
}

async function run() {
  const { processarEventoWebhook, validarTokenWebhook, webhookConfigurado } = await import(
    "../lib/asaas/webhook"
  );

  console.log("\n=== FASE 6 — SUBCONTAS, TENANT E TOKEN ===\n");

  // ---------- Token ----------
  console.log("TOKEN DO WEBHOOK");
  ok("Caso 7 — token correto é aceito", validarTokenWebhook(TOKEN));
  ok("Caso 6 — token inválido é recusado", !validarTokenWebhook("token_errado_qualquer"));
  ok("token nulo é recusado", !validarTokenWebhook(null));
  ok("webhookConfigurado() é true com token", webhookConfigurado());

  const guardado = process.env.ASAAS_WEBHOOK_TOKEN;
  process.env.ASAAS_API_KEY = "chave_de_api_financeira_secreta";
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  ok("Caso 5 — sem ASAAS_WEBHOOK_TOKEN nada é aceito", !validarTokenWebhook(TOKEN));
  ok(
    "FALLBACK REMOVIDO — a ASAAS_API_KEY NÃO é aceita como token",
    !validarTokenWebhook("chave_de_api_financeira_secreta")
  );
  ok("webhookConfigurado() é false sem token", !webhookConfigurado());
  process.env.ASAAS_WEBHOOK_TOKEN = guardado;
  delete process.env.ASAAS_API_KEY;

  // ---------- Cenário ----------
  console.log("\nISOLAMENTO DE TENANT");
  const empresaA = await criarEmpresa("Empresa A — teste fase 6", ACC_A);
  const empresaB = await criarEmpresa("Empresa B — teste fase 6", ACC_B);
  const cobA = await criarCobranca(empresaA, "Cobrança de A");
  const cobB = await criarCobranca(empresaB, "Cobrança de B");

  // Caso 1
  const ev1 = `evt_teste_f6_A_${Date.now()}`;
  criados.eventos.push(ev1);
  const r1 = await processarEventoWebhook(evento(ev1, ACC_A, cobA) as never);
  ok("Caso 1 — evento da conta A é aceito", r1.ok);
  ok("Caso 1 — cobrança de A ficou paga", (await statusDa(cobA)) === "paga");
  ok("Caso 1 — cobrança de B NÃO foi tocada", (await statusDa(cobB)) === "pendente");

  // Caso 2
  const ev2 = `evt_teste_f6_B_${Date.now()}`;
  criados.eventos.push(ev2);
  const r2 = await processarEventoWebhook(evento(ev2, ACC_B, cobB) as never);
  ok("Caso 2 — evento da conta B é aceito", r2.ok);
  ok("Caso 2 — cobrança de B ficou paga", (await statusDa(cobB)) === "paga");

  /* O TESTE QUE IMPORTA: evento de A apontando para cobrança de B.
     `pago_em: null` junto do status não é detalhe: a constraint
     `cobrancas_pagamento_coerente` exige status='paga' ⟺ pago_em não nulo.
     Sem limpar os dois, o reset é rejeitado e o teste passa a medir nada. */
  const { error: eReset } = await db
    .from("cobrancas")
    .update({ status: "pendente", pago_em: null, valor_pago_centavos: null })
    .eq("id", cobB);
  ok("reset de B para pendente funcionou", !eReset, eReset?.message);
  const ev3 = `evt_teste_f6_cruzado_${Date.now()}`;
  criados.eventos.push(ev3);
  await processarEventoWebhook(evento(ev3, ACC_A, cobB) as never);
  ok(
    "CRUZADO — evento da conta A com externalReference de B NÃO altera B",
    (await statusDa(cobB)) === "pendente"
  );

  /* Regressão do bug de coerência financeira.
     `cobrancas_pagamento_coerente` exige status='paga' ⟺ pago_em não nulo.
     Antes, cancelar ou restaurar uma cobrança PAGA gravava só o status: a
     constraint recusava, o retorno não era conferido, e a cobrança
     continuava "paga" sem nenhum sinal. Estes casos partem sempre de uma
     cobrança já paga — que é a única condição em que o defeito aparecia. */
  console.log("\nCOERÊNCIA FINANCEIRA (regressão)");

  async function linhaDa(id: string) {
    const { data } = await db
      .from("cobrancas")
      .select("status, pago_em, valor_pago_centavos")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  ok("pré-condição: cobrança de A está paga", (await statusDa(cobA)) === "paga");

  const evDel = `evt_teste_f6_deleted_${Date.now()}`;
  criados.eventos.push(evDel);
  const payloadDel = evento(evDel, ACC_A, cobA) as Record<string, unknown>;
  payloadDel.event = "PAYMENT_DELETED";
  await processarEventoWebhook(payloadDel as never);

  const aposDelete = await linhaDa(cobA);
  ok("PAYMENT_DELETED sobre cobrança paga cancela de verdade", aposDelete?.status === "cancelada");
  ok("PAYMENT_DELETED limpa pago_em", aposDelete?.pago_em === null);
  ok("PAYMENT_DELETED limpa valor_pago_centavos", aposDelete?.valor_pago_centavos === null);

  // Repaga para exercitar o RESTORED a partir do mesmo estado inicial.
  await db
    .from("cobrancas")
    .update({
      status: "paga",
      pago_em: new Date().toISOString(),
      valor_pago_centavos: 35000,
    })
    .eq("id", cobA);

  const evRest = `evt_teste_f6_restored_${Date.now()}`;
  criados.eventos.push(evRest);
  const payloadRest = evento(evRest, ACC_A, cobA) as Record<string, unknown>;
  payloadRest.event = "PAYMENT_RESTORED";
  await processarEventoWebhook(payloadRest as never);

  const aposRestore = await linhaDa(cobA);
  ok("PAYMENT_RESTORED sobre cobrança paga volta a pendente", aposRestore?.status === "pendente");
  ok("PAYMENT_RESTORED limpa pago_em", aposRestore?.pago_em === null);
  ok("PAYMENT_RESTORED limpa valor_pago_centavos", aposRestore?.valor_pago_centavos === null);

  // Caso 3
  console.log("\nCONTA DESCONHECIDA E AUSENTE");
  const ev4 = `evt_teste_f6_desconhecida_${Date.now()}`;
  const r4 = await processarEventoWebhook(evento(ev4, "acc_que_nao_existe", cobA) as never);
  ok("Caso 3 — account.id desconhecido é rejeitado", !r4.ok);
  ok("Caso 3 — status HTTP é 422", !r4.ok && r4.statusHttp === 422);
  const { count: c4 } = await db
    .from("eventos_asaas")
    .select("*", { count: "exact", head: true })
    .eq("asaas_event_id", ev4);
  ok("Caso 3 — evento rejeitado NÃO foi gravado", (c4 ?? 0) === 0);

  const ev5 = `evt_teste_f6_sem_conta_${Date.now()}`;
  const r5 = await processarEventoWebhook(evento(ev5, null, cobA) as never);
  ok("payload sem account é rejeitado", !r5.ok);
  ok("payload sem account devolve 400", !r5.ok && r5.statusHttp === 400);

  // Caso 4
  console.log("\nIDEMPOTÊNCIA");
  const ev6 = `evt_teste_f6_idem_${Date.now()}`;
  criados.eventos.push(ev6);
  const p1 = await processarEventoWebhook(evento(ev6, ACC_A, cobA) as never);
  const p2 = await processarEventoWebhook(evento(ev6, ACC_A, cobA) as never);
  ok("Caso 4 — 1ª entrega processa", p1.ok && !("idempotente" in p1 && p1.idempotente));
  ok("Caso 4 — 2ª entrega é idempotente", p2.ok && "idempotente" in p2 && p2.idempotente === true);

  const { count: c6 } = await db
    .from("eventos_asaas")
    .select("*", { count: "exact", head: true })
    .eq("asaas_event_id", ev6);
  ok("Caso 4 — só uma linha em eventos_asaas", c6 === 1);

  // Vínculo tenant no log
  console.log("\nRASTREIO");
  const { data: logA } = await db
    .from("eventos_asaas")
    .select("empresa_id, asaas_account_id")
    .eq("asaas_event_id", ev1)
    .maybeSingle();
  ok("evento gravado com empresa_id correto", logA?.empresa_id === empresaA);
  ok("evento gravado com asaas_account_id", logA?.asaas_account_id === ACC_A);

  // Credenciais fora do alcance do tenant
  console.log("\nCREDENCIAIS");
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: dAnon, error: eAnon } = await anon.from("asaas_credenciais").select("*");
  ok(
    "asaas_credenciais é invisível para anon",
    (dAnon === null || dAnon.length === 0) || Boolean(eAnon)
  );

  const { cifrar, decifrar } = await import("../lib/asaas/credenciais");
  const segredo = "$aact_chave_de_subconta_ficticia_123";
  const pacote = cifrar(segredo);
  ok("cifra não contém o texto em claro", !pacote.includes("aact_chave"));
  ok("decifra devolve o original", decifrar(pacote) === segredo);

  // ---------- Limpeza ----------
  console.log("\nLIMPEZA");
  for (const id of criados.eventos) {
    await db.from("eventos_asaas").delete().eq("asaas_event_id", id);
  }
  for (const id of criados.empresas) {
    await db.from("cobrancas").delete().eq("empresa_id", id);
    await db.from("clientes").delete().eq("empresa_id", id);
    await db.from("empresas").delete().eq("id", id);
  }
  const { count: sobra } = await db
    .from("empresas")
    .select("*", { count: "exact", head: true })
    .in("asaas_account_id", [ACC_A, ACC_B]);
  ok("banco limpo ao final", (sobra ?? 0) === 0);

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
