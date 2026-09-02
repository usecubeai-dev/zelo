/**
 * Fase 14 do Core Financeiro — onboarding completo até o primeiro
 * recebimento.
 *
 * `obterJornadaOnboarding()` não tem nenhum flag persistido de "passo
 * atual" — cada passo é derivado do estado real do banco. Por isso os
 * testes não simulam uma "sessão de onboarding": eles alteram o estado
 * real (documento, conta, cliente, recorrência, autorização, cobrança,
 * pagamento) e conferem que a jornada reflete isso, na ordem que for.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { obterJornadaOnboarding } from "../lib/core/jornada-onboarding";

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

console.log("\n=== CORE FINANCEIRO — FASE 14 (jornada de onboarding) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_jornada_fase14_12345";

async function criarEmpresa(nome: string) {
  const email = `jornada14_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  return { empresaId, email };
}

function passo(jornada: Awaited<ReturnType<typeof obterJornadaOnboarding>>, id: string) {
  return jornada.passos.find((p) => p.id === id);
}

async function run() {
  console.log("\nESTADO INICIAL — empresa recém-criada, nada preenchido além da conta");
  {
    const { empresaId } = await criarEmpresa("Empresa jornada inicial");
    const j = await obterJornadaOnboarding(empresaId);

    t("conta_criada já está concluída (autenticado = tem conta)", passo(j, "conta_criada")?.concluido === true);
    t("negocio_configurado NÃO está concluído (sem documento)", passo(j, "negocio_configurado")?.concluido === false);
    t("nenhum outro passo está concluído", j.passos.filter((p) => p.concluido).length === 1);
    t("jornada não está completa", j.completa === false);
    t("próximo passo é negocio_configurado", j.proximoPasso?.id === "negocio_configurado");
  }

  console.log("\nPROGRESSÃO — cada passo concluído reflete no próximo, sem re-perguntar o que já foi feito");
  {
    const { empresaId } = await criarEmpresa("Empresa jornada progressao");
    await admin.from("empresas").update({ documento: "12345678000199" }).eq("id", empresaId);
    let j = await obterJornadaOnboarding(empresaId);
    t("negocio_configurado concluído após salvar documento", passo(j, "negocio_configurado")?.concluido === true);
    t("proximo passo avança pra conta_financeira_pronta", j.proximoPasso?.id === "conta_financeira_pronta");

    await admin.from("empresas").update({ provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: "acc_j14" }).eq("id", empresaId);
    j = await obterJornadaOnboarding(empresaId);
    t("conta_financeira_pronta concluído após aprovação", passo(j, "conta_financeira_pronta")?.concluido === true);
    t("proximo passo avança pra primeiro_cliente", j.proximoPasso?.id === "primeiro_cliente");

    const { data: cli } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente", email: "c@zelo.test", documento: "98765432100" }).select("id").single();
    j = await obterJornadaOnboarding(empresaId);
    t("primeiro_cliente concluído após cadastrar cliente", passo(j, "primeiro_cliente")?.concluido === true);
    t("proximo passo avança pra primeira_recorrencia", j.proximoPasso?.id === "primeira_recorrencia");

    const { data: rec } = await admin.from("recorrencias").insert({ empresa_id: empresaId, cliente_id: cli!.id, descricao: "Mensalidade", valor_centavos: 10000, periodicidade: "mensal", dia_vencimento: 5, inicia_em: "2027-01-01", status: "ativa" }).select("id").single();
    j = await obterJornadaOnboarding(empresaId);
    t("primeira_recorrencia concluído após criar recorrência", passo(j, "primeira_recorrencia")?.concluido === true);
    t("proximo passo avança pra autorizacao_pix", j.proximoPasso?.id === "autorizacao_pix");

    const { data: auth } = await admin.from("autorizacoes_pix").insert({ empresa_id: empresaId, recorrencia_id: rec!.id, cliente_id: cli!.id, asaas_authorization_id: "auth_j14", status: "ACTIVE", finish_date: "2032-01-01", retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS" }).select("id").single();
    j = await obterJornadaOnboarding(empresaId);
    t("autorizacao_pix concluído após autorização ACTIVE", passo(j, "autorizacao_pix")?.concluido === true);

    // primeira_cobranca já pode estar concluída (a recorrência gera o primeiro ciclo em uso real, mas aqui inserimos direto)
    await admin.from("cobrancas").insert({ empresa_id: empresaId, cliente_id: cli!.id, recorrencia_id: rec!.id, descricao: "Ciclo 1", valor_centavos: 10000, vence_em: "2027-02-05", status: "pendente" });
    j = await obterJornadaOnboarding(empresaId);
    t("primeira_cobranca concluído após gerar cobrança", passo(j, "primeira_cobranca")?.concluido === true);
    t("proximo passo avança pra primeiro_recebimento", j.proximoPasso?.id === "primeiro_recebimento");
    t("ainda não está completa (falta o recebimento)", j.completa === false);
  }

  console.log("\nRECEBIMENTO — só conta via Asaas, nunca via marcação manual (mesmo princípio da Fase 11)");
  {
    const { empresaId } = await criarEmpresa("Empresa jornada recebimento");
    await admin.from("empresas").update({ documento: "12345678000199", provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: "acc_j14b" }).eq("id", empresaId);
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente", email: "c2@zelo.test", documento: "98765432100" }).select("id").single();

    const { data: cobManual } = await admin
      .from("cobrancas")
      .insert({ empresa_id: empresaId, cliente_id: cli!.id, descricao: "Paga na mão", valor_centavos: 5000, vence_em: "2027-02-05", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 5000, pago_via: "manual" })
      .select("id")
      .single();
    let j = await obterJornadaOnboarding(empresaId);
    t("primeira_cobranca concluída (existe cobrança)", passo(j, "primeira_cobranca")?.concluido === true);
    t("primeiro_recebimento NÃO concluído — 'manual' não conta como confirmado pelo Asaas", passo(j, "primeiro_recebimento")?.concluido === false);
    t("jornada continua incompleta (falta recorrência/autorização/recebimento real)", j.completa === false);

    await admin.from("cobrancas").update({ pago_via: "asaas" }).eq("id", cobManual!.id);
    j = await obterJornadaOnboarding(empresaId);
    t("primeiro_recebimento concluído quando pago_via='asaas'", passo(j, "primeiro_recebimento")?.concluido === true);
  }

  console.log("\nORDEM NÃO É OBRIGATÓRIA — cobrança avulsa sem recorrência/autorização ainda conta como 'primeira cobrança'");
  {
    const { empresaId } = await criarEmpresa("Empresa jornada fora de ordem");
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente avulso", email: "c3@zelo.test", documento: "98765432100" }).select("id").single();
    await admin.from("cobrancas").insert({ empresa_id: empresaId, cliente_id: cli!.id, descricao: "Cobrança avulsa", valor_centavos: 5000, vence_em: "2027-02-05", status: "pendente" });

    const j = await obterJornadaOnboarding(empresaId);
    t("primeira_cobranca concluída mesmo sem recorrência", passo(j, "primeira_cobranca")?.concluido === true);
    t("primeira_recorrencia continua pendente (cada passo é independente)", passo(j, "primeira_recorrencia")?.concluido === false);
    t("autorizacao_pix continua pendente", passo(j, "autorizacao_pix")?.concluido === false);
  }

  console.log("\nCONTA RECUSADA — explica o bloqueio, não só diz 'incompleto'");
  {
    const { empresaId } = await criarEmpresa("Empresa jornada recusada");
    await admin.from("empresas").update({ documento: "12345678000199", provider_status: "ativa", provider_aprovacao: "REJECTED", asaas_account_id: "acc_j14c" }).eq("id", empresaId);

    const j = await obterJornadaOnboarding(empresaId);
    const p = passo(j, "conta_financeira_pronta");
    t("conta_financeira_pronta continua pendente", p?.concluido === false);
    t("detalhe explica o bloqueio (não é undefined nem genérico)", !!p?.detalhe && p.detalhe.length > 10);
  }

  console.log("\nISOLAMENTO — jornada de uma empresa não vê dados de outra");
  {
    const { empresaId: empA } = await criarEmpresa("Empresa A jornada isolamento");
    const { empresaId: empB } = await criarEmpresa("Empresa B jornada isolamento");
    await admin.from("clientes").insert({ empresa_id: empA, nome: "Cliente de A", email: "ca@zelo.test", documento: "98765432100" });

    const jA = await obterJornadaOnboarding(empA);
    const jB = await obterJornadaOnboarding(empB);
    t("empresa A vê seu próprio cliente", passo(jA, "primeiro_cliente")?.concluido === true);
    t("empresa B não vê cliente de A", passo(jB, "primeiro_cliente")?.concluido === false);
  }

  console.log("\nCAMADAS — painel usa a jornada, não duplica a lógica de conexão financeira");
  {
    const conteudoPainel = fs.readFileSync("app/(app)/app/page.tsx", "utf8");
    t("painel importa obterJornadaOnboarding", conteudoPainel.includes("obterJornadaOnboarding"));
    t("painel não chama obterContaFinanceira/prontaParaCobrar direto (a jornada já resolve isso)", !conteudoPainel.includes("obterContaFinanceira") && !conteudoPainel.includes("prontaParaCobrar"));

    const conteudoJornada = fs.readFileSync("lib/core/jornada-onboarding.ts", "utf8");
    t("jornada reaproveita descricaoDoEstado (Fase 3) em vez de inventar texto novo", conteudoJornada.includes("descricaoDoEstado"));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
  await admin.from("notificacoes").delete().in("empresa_id", empresas);
  await admin.from("pagamentos").delete().in("empresa_id", empresas);
  await admin.from("instrucoes_pagamento").delete().in("empresa_id", empresas);
  await admin.from("autorizacoes_pix").delete().in("empresa_id", empresas);
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
