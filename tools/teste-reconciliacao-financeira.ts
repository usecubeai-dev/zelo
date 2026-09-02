/**
 * Fase 3 do Core Financeiro — onboarding completo, documentos, estados
 * de conta e reconciliação.
 *
 * Mesmo espírito do teste da Fase 2: sem `ASAAS_API_KEY` real no
 * ambiente, os caminhos que dependem de credencial de subconta
 * (`sincronizarStatusFinanceiro`) são testados pelo lado "Asaas
 * indisponível/sem credencial", que é honesto e real. Para reconciliação
 * — onde o cenário interessante é justamente "o Asaas responde algo" —
 * um `buscador` injetado simula a resposta de `GET /accounts?cpfCnpj=`,
 * o mesmo padrão de DI já usado em `iniciarOnboardingFinanceiro`.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { estadoConceitual, descricaoDoEstado, transicaoOnboardingValida } from "../lib/core/conta-financeira";
import {
  obterContaFinanceira,
  sincronizarStatusFinanceiro,
  reconciliarContaFinanceira,
  BuscadorDeSubconta,
} from "../lib/core/onboarding";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

console.log("\n=== CORE FINANCEIRO — FASE 3 (onboarding completo + reconciliação) ===\n");

console.log("DOMÍNIO PURO — estadoConceitual (8 estados, sem duplicar persistência)");
t("nao_iniciada → nao_iniciado", estadoConceitual("nao_iniciada", null) === "nao_iniciado");
t("criando → criando", estadoConceitual("criando", null) === "criando");
t("bloqueada → bloqueado (mesmo com situacao null)", estadoConceitual("bloqueada", null) === "bloqueado");
t("recusada → erro_temporario", estadoConceitual("recusada", null) === "erro_temporario");
t("criada sem situacao (ainda não sincronizou) → em_analise", estadoConceitual("criada", null) === "em_analise");
t(
  "criada + general REJECTED → recusado, mesmo com documentation aprovada",
  estadoConceitual("criada", {
    general: "REJECTED",
    documentation: "APPROVED",
    commercialInfo: "APPROVED",
    bankAccountInfo: "APPROVED",
  }) === "recusado"
);
t(
  "criada + documentation pendente (general ainda PENDING) → documentacao_pendente, não em_analise",
  estadoConceitual("criada", {
    general: "PENDING",
    documentation: "PENDING",
    commercialInfo: "APPROVED",
    bankAccountInfo: "APPROVED",
  }) === "documentacao_pendente"
);
t(
  "criada + documentation APPROVED + general APPROVED → aprovado",
  estadoConceitual("criada", {
    general: "APPROVED",
    documentation: "APPROVED",
    commercialInfo: "APPROVED",
    bankAccountInfo: "APPROVED",
  }) === "aprovado"
);
t(
  "criada + documentation APPROVED + general AWAITING_APPROVAL → em_analise (fila, não pendência)",
  estadoConceitual("criada", {
    general: "AWAITING_APPROVAL",
    documentation: "APPROVED",
    commercialInfo: "APPROVED",
    bankAccountInfo: "APPROVED",
  }) === "em_analise"
);

console.log("\nDOMÍNIO PURO — transições incluindo bloqueada");
t("criando→bloqueada é válida", transicaoOnboardingValida("criando", "bloqueada"));
t("recusada→bloqueada é válida (reconciliação pode achar bloqueio)", transicaoOnboardingValida("recusada", "bloqueada"));
t("bloqueada→qualquer coisa é INVÁLIDA (exige suporte manual)", !transicaoOnboardingValida("bloqueada", "criando"));

console.log("\nDOMÍNIO PURO — descricaoDoEstado cobre os novos estados sem JSON cru");
const dBloq = descricaoDoEstado({ estadoOnboarding: "bloqueada", statusAprovacao: null });
t("bloqueada tem tom erro e menciona suporte", dBloq.tom === "erro" && /suporte/i.test(dBloq.detalhe));
const dDocPend = descricaoDoEstado(
  { estadoOnboarding: "criada", statusAprovacao: null },
  { general: "PENDING", documentation: "PENDING", commercialInfo: "APPROVED", bankAccountInfo: "APPROVED" }
);
t(
  "documentação pendente tem texto próprio, distinto de 'em análise'",
  dDocPend.titulo.toLowerCase().includes("documenta")
);
t("nenhuma descrição vaza token técnico tipo 'PENDING'/'REJECTED' cru", ![dBloq, dDocPend].some((d) => /PENDING|REJECTED|APPROVED/.test(d.detalhe)));

// ---------- integração real + banco ----------
const usuarios: string[] = [];
const empresas: string[] = [];

async function criarEmpresa(nome: string, documento = "12345678901") {
  const email = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha_teste_reconciliacao_12345", email_confirm: true, user_metadata: { nome } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);
  await admin.from("empresas").update({ nome, documento }).eq("id", empresaId);
  return { empresaId, userId };
}

async function run() {
  console.log("\nSINCRONIZAÇÃO — sem credencial de subconta (Asaas indisponível)");
  {
    const { empresaId } = await criarEmpresa("Empresa nunca conectada");
    const r = await sincronizarStatusFinanceiro(empresaId);
    t("sem credencial salva, falha com nao_encontrado (não finge sucesso)", !r.ok && r.erro.tipo === "nao_encontrado");
  }

  console.log("\nRECONCILIAÇÃO — nada a fazer (conta já criada)");
  {
    const { empresaId } = await criarEmpresa("Empresa já criada");
    await admin.from("empresas").update({ provider_status: "ativa", asaas_account_id: "acc_ja_existe" }).eq("id", empresaId);
    const r = await reconciliarContaFinanceira(empresaId);
    t("reconciliar uma conta 'criada' é um no-op seguro", r.ok && r.dado.estadoOnboarding === "criada");
  }

  console.log("\nRECONCILIAÇÃO — classe A: accountId local existe, só o espelhamento falhou");
  {
    const { empresaId } = await criarEmpresa("Empresa presa em criando com accountId");
    await admin.from("empresas").update({ provider_status: "criando", asaas_account_id: "acc_resync_local" }).eq("id", empresaId);
    const r = await reconciliarContaFinanceira(empresaId);
    t("resync local: sai de 'criando' direto para 'criada', sem chamar o Asaas", r.ok && r.dado.estadoOnboarding === "criada");

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("reconciliação classe A é auditada", (log ?? []).some((l) => l.acao === "reconciliacao_resync_local"));
  }

  console.log("\nRECONCILIAÇÃO — classe B: sem accountId local, órfã NÃO encontrada no Asaas");
  {
    const { empresaId } = await criarEmpresa("Empresa presa em criando sem accountId");
    await admin.from("empresas").update({ provider_status: "criando" }).eq("id", empresaId);
    const buscadorVazio: BuscadorDeSubconta = async () => ({ ok: true, data: { data: [] } });
    const r = await reconciliarContaFinanceira(empresaId, null, buscadorVazio);
    t("não encontrada no Asaas: destrava para 'recusada', usuário pode tentar de novo", r.ok && r.dado.estadoOnboarding === "recusada");
  }

  console.log("\nRECONCILIAÇÃO — classe B: órfã ENCONTRADA no Asaas (credencial irrecuperável) → bloqueada");
  {
    const { empresaId } = await criarEmpresa("Empresa órfã de verdade");
    await admin.from("empresas").update({ provider_status: "criando" }).eq("id", empresaId);
    const buscadorComOrfa: BuscadorDeSubconta = async () => ({
      ok: true,
      data: { data: [{ id: "acc_orfao_123", walletId: "wallet_orfao_123", cpfCnpj: "12345678901", email: "x@x.com" }] },
    });
    const r = await reconciliarContaFinanceira(empresaId, null, buscadorComOrfa);
    t(
      "órfã encontrada: transiciona para 'bloqueada', nunca finge que está tudo bem",
      r.ok && r.dado.estadoOnboarding === "bloqueada" && r.dado.asaasAccountId === "acc_orfao_123"
    );

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("bloqueio por órfã é auditado", (log ?? []).some((l) => l.acao === "reconciliacao_orfa_bloqueada"));

    const r2 = await reconciliarContaFinanceira(empresaId, null, buscadorComOrfa);
    const conta = await obterContaFinanceira(empresaId);
    t("bloqueada não sai sozinha do estado — reconciliar de novo não muda nada", r2.ok && conta?.estadoOnboarding === "bloqueada");
  }

  console.log("\nRECONCILIAÇÃO — sem documento cadastrado, não dá pra buscar órfã");
  {
    const { empresaId } = await criarEmpresa("Empresa sem documento", "");
    await admin.from("empresas").update({ provider_status: "criando", documento: null }).eq("id", empresaId);
    const r = await reconciliarContaFinanceira(empresaId);
    t("sem documento, falha explicitamente em vez de adivinhar", !r.ok);
  }

  console.log("\nRECONCILIAÇÃO — empresa inexistente");
  {
    const r = await reconciliarContaFinanceira("00000000-0000-0000-0000-000000000000");
    t("empresa inexistente devolve nao_encontrado", !r.ok && r.erro.tipo === "nao_encontrado");
  }

  console.log("\nCONCORRÊNCIA — duas reconciliações simultâneas (classe A) não se pisam");
  {
    const { empresaId } = await criarEmpresa("Empresa reconciliação concorrente");
    await admin.from("empresas").update({ provider_status: "criando", asaas_account_id: "acc_concorrente" }).eq("id", empresaId);
    const [ra, rb] = await Promise.all([reconciliarContaFinanceira(empresaId), reconciliarContaFinanceira(empresaId)]);
    t(
      "ambas as chamadas terminam ok (uma faz o CAS, a outra já acha 'criada')",
      ra.ok && rb.ok && ra.dado.estadoOnboarding === "criada" && rb.dado.estadoOnboarding === "criada"
    );
    const { count } = await admin
      .from("log_acoes_financeiras")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("acao", "reconciliacao_resync_local");
    t("o resync real (CAS) só aconteceu uma vez, não duas", (count ?? 0) === 1);
  }

  console.log("\nSEGURANÇA — tenant isolation nas novas funções");
  {
    const a = await criarEmpresa("Tenant A reconciliação");
    const b = await criarEmpresa("Tenant B reconciliação");
    await admin.from("empresas").update({ provider_status: "criando", asaas_account_id: "acc_tenant_a" }).eq("id", a.empresaId);
    await reconciliarContaFinanceira(a.empresaId);
    const contaB = await obterContaFinanceira(b.empresaId);
    t("reconciliar a empresa A não toca a empresa B", contaB?.estadoOnboarding === "nao_iniciada");
  }

  console.log("\nWEBHOOK — eventos de conta reconhecidos disparam ressincronização sem quebrar");
  {
    const { processarEventoWebhook } = await import("../lib/asaas/webhook");
    const { empresaId } = await criarEmpresa("Empresa evento de conta");
    await admin.from("empresas").update({ provider_status: "ativa", asaas_account_id: "acc_webhook_conta" }).eq("id", empresaId);

    const eventoId = `evt_bank_account_${Date.now()}`;
    const payload = {
      id: eventoId,
      event: "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
      dateCreated: new Date().toISOString(),
      account: { id: "acc_webhook_conta" },
    } as Parameters<typeof processarEventoWebhook>[0];

    const resultado = await processarEventoWebhook(payload);
    t("evento de BANK_ACCOUNT_INFO não derruba o processamento (mesmo sem credencial de subconta)", resultado.ok);

    const { data: evt } = await admin.from("eventos_asaas").select("processado_em").eq("asaas_event_id", eventoId).maybeSingle();
    t("evento fica marcado como processado (idempotência)", !!evt?.processado_em);

    const resultado2 = await processarEventoWebhook(payload);
    t(
      "reenviar o mesmo evento é idempotente (não repete efeito)",
      resultado2.ok && "idempotente" in resultado2 && resultado2.idempotente === true
    );

    await admin.from("eventos_asaas").delete().eq("asaas_event_id", eventoId);
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
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
