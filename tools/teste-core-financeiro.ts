/**
 * Fase 1 do Core Financeiro — testes de fundação.
 *
 * Cobre exatamente o que a Fase 1 promete e nada além: unicidade de IDs
 * externos, uma autorização viva por recorrência, uma instrução viva por
 * cobrança, isolamento por tenant nas 4 tabelas novas, e as transições
 * de estado do domínio puro (lib/core/*). Nenhuma chamada ao Asaas —
 * tudo aqui é banco + tipos, como a fase pede.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  estaViva as autorizacaoEstaViva,
  transicaoValida as transicaoAutorizacao,
  autorizaCobranca,
  origemPermitida,
} from "../lib/core/autorizacao";
import {
  estaViva as instrucaoEstaViva,
  transicaoValida as transicaoInstrucao,
} from "../lib/core/instrucao-pagamento";
import { valorBrutoCentavos } from "../lib/core/pagamento";
import { erroDominio, ok, falha } from "../lib/core/erros";

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

console.log("\n=== CORE FINANCEIRO — FASE 1 (domínio puro) ===\n");

console.log("MÁQUINA DE ESTADOS — AUTORIZAÇÃO");
t("CREATED é viva", autorizacaoEstaViva("CREATED"));
t("ACTIVE é viva", autorizacaoEstaViva("ACTIVE"));
t("CANCELLED não é viva", !autorizacaoEstaViva("CANCELLED"));
t("REFUSED não é viva", !autorizacaoEstaViva("REFUSED"));
t("EXPIRED não é viva", !autorizacaoEstaViva("EXPIRED"));
t("só ACTIVE autoriza cobrança", autorizaCobranca("ACTIVE") && !autorizaCobranca("CREATED"));
t("CREATED→ACTIVE é válida", transicaoAutorizacao("CREATED", "ACTIVE"));
t("CREATED→REFUSED é válida", transicaoAutorizacao("CREATED", "REFUSED"));
t("ACTIVE→CANCELLED é válida", transicaoAutorizacao("ACTIVE", "CANCELLED"));
t("ACTIVE→EXPIRED é válida", transicaoAutorizacao("ACTIVE", "EXPIRED"));
t("CANCELLED→ACTIVE é INVÁLIDA (não reabre)", !transicaoAutorizacao("CANCELLED", "ACTIVE"));
t("EXPIRED→ACTIVE é INVÁLIDA (não reabre)", !transicaoAutorizacao("EXPIRED", "ACTIVE"));
t("REFUSED→ACTIVE é INVÁLIDA (não reabre)", !transicaoAutorizacao("REFUSED", "ACTIVE"));
t("ACTIVE→REFUSED é INVÁLIDA (não retrocede)", !transicaoAutorizacao("ACTIVE", "REFUSED"));
t("frontend não pode ativar (só webhook/reconciliação)", !origemPermitida("ACTIVE", "caso_de_uso"));
t("webhook pode ativar", origemPermitida("ACTIVE", "webhook"));
t("caso_de_uso pode criar (CREATED)", origemPermitida("CREATED", "caso_de_uso"));
t("webhook NÃO pode criar (CREATED só nasce do caso de uso)", !origemPermitida("CREATED", "webhook"));

console.log("\nMÁQUINA DE ESTADOS — INSTRUÇÃO DE PAGAMENTO");
/* Enum corrigido na Fase 7 para o real da API do Asaas
   (AWAITING_REQUEST|SCHEDULED|DONE|CANCELLED|REFUSED) — a tabela nunca
   teve linha gravada até então, então a correção não quebrou dado
   nenhum, só o teste que validava o enum errado da Fase 1. */
t("AWAITING_REQUEST é viva", instrucaoEstaViva("AWAITING_REQUEST"));
t("SCHEDULED é viva", instrucaoEstaViva("SCHEDULED"));
t("REFUSED não é viva", !instrucaoEstaViva("REFUSED"));
t("CANCELLED não é viva", !instrucaoEstaViva("CANCELLED"));
t("AWAITING_REQUEST→SCHEDULED é válida", transicaoInstrucao("AWAITING_REQUEST", "SCHEDULED"));
t("SCHEDULED→CANCELLED é válida", transicaoInstrucao("SCHEDULED", "CANCELLED"));
t("REFUSED→SCHEDULED é INVÁLIDA (estado terminal)", !transicaoInstrucao("REFUSED", "SCHEDULED"));

console.log("\nPAGAMENTO");
t(
  "valor bruto = líquido + taxa",
  valorBrutoCentavos({ valor_liquido_centavos: 29000, taxa_centavos: 199 }) === 29199
);

console.log("\nERROS DE DOMÍNIO");
const r1 = ok(42);
t("ok() produz resultado de sucesso", r1.ok === true && r1.dado === 42);
const r2 = falha("validacao", "campo obrigatório");
t("falha() produz resultado tipado", r2.ok === false && r2.erro.tipo === "validacao");
const e = erroDominio("infraestrutura", undefined, "detalhe interno sensível");
t("mensagem padrão não vaza detalhe interno", !e.mensagem.includes("detalhe interno sensível"));

// ---------- banco: unicidade, tenant, RLS ----------
const empresas: string[] = [];
const usuarios: string[] = [];

async function criarEmpresa(nome: string) {
  const email = `core_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha_teste_core_12345", email_confirm: true, user_metadata: { nome } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);
  return empresaId;
}

async function criarCliente(empresaId: string, nome: string) {
  const { data, error } = await admin.from("clientes").insert({ empresa_id: empresaId, nome }).select("id").single();
  if (error) throw new Error(`cliente: ${error.message}`);
  return data.id as string;
}

async function criarRecorrencia(empresaId: string, clienteId: string) {
  const { data, error } = await admin
    .from("recorrencias")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Teste core financeiro",
      valor_centavos: 35000,
      dia_vencimento: 5,
      inicia_em: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(`recorrencia: ${error.message}`);
  return data.id as string;
}

async function criarCobranca(empresaId: string, clienteId: string) {
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Ciclo de teste",
      valor_centavos: 35000,
      vence_em: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(`cobranca: ${error.message}`);
  return data.id as string;
}

async function run() {
  console.log("\nBANCO — UNICIDADE E INTEGRIDADE");

  const empA = await criarEmpresa("Empresa A — core financeiro");
  const empB = await criarEmpresa("Empresa B — core financeiro");
  const cliA = await criarCliente(empA, "Cliente A");
  const cliB = await criarCliente(empB, "Cliente B");
  const recA = await criarRecorrencia(empA, cliA);
  const cobA = await criarCobranca(empA, cliA);

  // Autorização básica
  const finishDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const { data: auth1, error: eAuth1 } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA, cliente_id: cliA, finish_date: finishDate })
    .select("id")
    .single();
  t("cria autorização válida", !eAuth1 && !!auth1?.id, eAuth1?.message);

  // Uma autorização viva por recorrência
  const { error: eAuth2 } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA, cliente_id: cliA, finish_date: finishDate });
  t("BLOQUEADO — segunda autorização viva na mesma recorrência", Boolean(eAuth2), eAuth2 ? "" : "inseriu sem erro");

  // Cancela a primeira, agora uma nova pode nascer
  await admin.from("autorizacoes_pix").update({ status: "CANCELLED" }).eq("id", auth1!.id);
  const { error: eAuth3 } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA, cliente_id: cliA, finish_date: finishDate });
  t("nova autorização OK depois que a anterior não está mais viva", !eAuth3, eAuth3?.message);

  // Cliente/recorrência de OUTRA empresa não pode ser referenciado
  const { error: eCruzado } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA, cliente_id: cliB, finish_date: finishDate });
  t("BLOQUEADO — cliente de outra empresa na autorização", Boolean(eCruzado));

  // asaas_authorization_id único
  const { data: authComId } = await admin
    .from("autorizacoes_pix")
    .select("id")
    .eq("recorrencia_id", recA)
    .eq("status", "CREATED")
    .limit(1)
    .single();
  await admin.from("autorizacoes_pix").update({ asaas_authorization_id: "auth_dup_teste" }).eq("id", authComId!.id);

  const recA2 = await criarRecorrencia(empA, cliA);
  const { data: auth2 } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA2, cliente_id: cliA, finish_date: finishDate })
    .select("id")
    .single();
  const { error: eIdDup } = await admin
    .from("autorizacoes_pix")
    .update({ asaas_authorization_id: "auth_dup_teste" })
    .eq("id", auth2!.id);
  t("BLOQUEADO — asaas_authorization_id duplicado entre autorizações", Boolean(eIdDup));

  // Instrução de pagamento
  const { data: instr1, error: eInstr1 } = await admin
    .from("instrucoes_pagamento")
    .insert({ empresa_id: empA, cobranca_id: cobA, autorizacao_id: authComId!.id })
    .select("id")
    .single();
  t("cria instrução válida", !eInstr1 && !!instr1?.id, eInstr1?.message);

  const { error: eInstr2 } = await admin
    .from("instrucoes_pagamento")
    .insert({ empresa_id: empA, cobranca_id: cobA, autorizacao_id: authComId!.id });
  t("BLOQUEADO — segunda instrução viva na mesma cobrança", Boolean(eInstr2));

  // cobranca de outra empresa não pode ser referenciada
  const cobB = await criarCobranca(empB, cliB);
  const { error: eInstrCruzada } = await admin
    .from("instrucoes_pagamento")
    .insert({ empresa_id: empA, cobranca_id: cobB, autorizacao_id: authComId!.id });
  t("BLOQUEADO — instrução referenciando cobrança de outra empresa", Boolean(eInstrCruzada));

  // Pagamento — idempotência do efeito financeiro
  await admin.from("instrucoes_pagamento").update({ status: "SCHEDULED" }).eq("id", instr1!.id);
  const { error: ePag1 } = await admin.from("pagamentos").insert({
    empresa_id: empA,
    instrucao_id: instr1!.id,
    asaas_payment_id: "pay_teste_dup",
    valor_liquido_centavos: 34801,
    taxa_centavos: 199,
    liquidado_em: new Date().toISOString(),
  });
  t("cria pagamento válido", !ePag1, ePag1?.message);

  const { error: ePag2 } = await admin.from("pagamentos").insert({
    empresa_id: empA,
    instrucao_id: instr1!.id,
    asaas_payment_id: "pay_teste_dup",
    valor_liquido_centavos: 34801,
    taxa_centavos: 199,
    liquidado_em: new Date().toISOString(),
  });
  t("BLOQUEADO — mesmo asaas_payment_id duas vezes (idempotência do efeito)", Boolean(ePag2));

  console.log("\nISOLAMENTO DE TENANT (RLS, por chamada direta à API)");

  const senha = "senha_teste_core_12345";
  const { data: userA } = await admin.auth.admin.listUsers();
  const usuarioA = userA.users.find((u) => u.id === usuarios[0]);
  const sessaoA = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  if (usuarioA?.email) {
    await sessaoA.auth.signInWithPassword({ email: usuarioA.email, password: senha });
  }

  const { data: leituraA } = await sessaoA.from("autorizacoes_pix").select("id, empresa_id");
  t(
    "usuário só enxerga autorizações da própria empresa",
    Array.isArray(leituraA) && leituraA.every((r) => r.empresa_id === empA)
  );

  const { error: eInsertA } = await sessaoA
    .from("autorizacoes_pix")
    .insert({ empresa_id: empA, recorrencia_id: recA2, cliente_id: cliA, finish_date: finishDate });
  t("usuário logado NÃO consegue INSERT em autorizacoes_pix (só service_role)", Boolean(eInsertA));

  const { data: leituraInstrA } = await sessaoA.from("instrucoes_pagamento").select("id");
  t("usuário enxerga instruções da própria empresa", (leituraInstrA?.length ?? 0) >= 1);

  const { data: leituraPagA } = await sessaoA.from("pagamentos").select("id");
  t("usuário enxerga pagamentos da própria empresa", (leituraPagA?.length ?? 0) >= 1);

  const { data: leituraLog } = await sessaoA.from("log_acoes_financeiras").select("id");
  t("log_acoes_financeiras acessível (vazio, sem erro) para o membro", Array.isArray(leituraLog));

  const { error: eInsertLog } = await sessaoA
    .from("log_acoes_financeiras")
    .insert({ empresa_id: empA, usuario_id: usuarios[0], acao: "teste_forjado" });
  t("usuário NÃO consegue forjar o próprio log de auditoria", Boolean(eInsertLog));

  console.log("\nCOMPATIBILIDADE — produto atual continua intacto");
  const { error: eCobrancaAntiga } = await sessaoA
    .from("cobrancas")
    .update({ descricao: "ainda funciona" })
    .eq("id", cobA)
    .eq("empresa_id", empA);
  t("update em cobrancas (fluxo antigo) continua funcionando", !eCobrancaAntiga, eCobrancaAntiga?.message);

  console.log("\nLIMPEZA");
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
