/**
 * Fase 8 do Core Financeiro — recorrência financeira real.
 *
 * Foco desta fase: as transições que o motor de recorrência precisa
 * fazer direito quando o relacionamento comercial muda — encerrar (que
 * tinha o gap identificado nas Fases 6–7: não cancelava a autorização
 * Pix Automático nem as cobranças em aberto), o valor travado pela
 * autorização, e o "vínculo correto" depois que uma autorização morre.
 *
 * Mesmo espírito das fases anteriores: sem credencial real, o caminho
 * "sem credencial" é testado de verdade, sem mock. Onde o Asaas precisa
 * "responder algo" (cancelamento de cobrança/autorização), os
 * `cancelador`/`cancelarAutorizacao` injetados simulam a resposta —
 * mesmo padrão de DI das Fases 2–7.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  encerrarRecorrenciaFinanceira,
  jaTeveAutorizacaoPix,
  valorBloqueadoPelaAutorizacao,
  CanceladorDeCobrancaEmAberto,
  CanceladorDeAutorizacaoDaRecorrencia,
} from "../lib/core/recorrencia-financeira";
import { ok, falha } from "../lib/core/erros";

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
  falhouTotal = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhouTotal++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

console.log("\n=== CORE FINANCEIRO — FASE 8 (recorrência financeira real) ===\n");

console.log("DOMÍNIO — valor travado pela autorização (função pura)");
t("sem autorização ativa: valor pode mudar livremente", !valorBloqueadoPelaAutorizacao(false, 10000, 20000));
t("com autorização ativa e valor igual: não bloqueia", !valorBloqueadoPelaAutorizacao(true, 10000, 10000));
t("com autorização ativa e valor diferente: bloqueia", valorBloqueadoPelaAutorizacao(true, 10000, 20000));

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_recorrencia_fin_12345";

async function criarEmpresa(nome: string) {
  const email = `recfin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  return { empresaId, userId, email };
}

async function criarCliente(empresaId: string, nome: string) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome, email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test`, documento: "98765432100" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function criarRecorrencia(empresaId: string, clienteId: string, status = "ativa") {
  const { data, error } = await admin
    .from("recorrencias")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Mensalidade",
      valor_centavos: 35000,
      periodicidade: "mensal",
      dia_vencimento: 5,
      inicia_em: "2027-01-01",
      status,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function criarAutorizacao(empresaId: string, recorrenciaId: string, clienteId: string, status: string) {
  const { data, error } = await admin
    .from("autorizacoes_pix")
    .insert({
      empresa_id: empresaId,
      recorrencia_id: recorrenciaId,
      cliente_id: clienteId,
      asaas_authorization_id: `auth_mock_${recorrenciaId.slice(0, 8)}`,
      status,
      finish_date: "2032-01-01",
      retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let contadorVencimento = 0;
async function criarCobranca(empresaId: string, clienteId: string, recorrenciaId: string, status = "pendente", comPaymentId = false) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      recorrencia_id: recorrenciaId,
      descricao: "Mensalidade",
      valor_centavos: 35000,
      vence_em: `2027-02-${dia}`,
      status,
      pago_em: status === "paga" ? new Date().toISOString() : null,
      pago_via: status === "paga" ? "asaas" : null,
      asaas_payment_id: comPaymentId ? `pay_mock_${Math.random().toString(36).slice(2, 8)}` : null,
      asaas_sync_status: comPaymentId ? "sincronizado" : "pendente",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

const cancelarCobrancaSucesso: CanceladorDeCobrancaEmAberto = async (cobrancaId) => {
  await admin.from("cobrancas").update({ status: "cancelada" }).eq("id", cobrancaId).in("status", ["pendente", "enviada"]);
  return ok({ cobrancaId });
};
const cancelarCobrancaFalha: CanceladorDeCobrancaEmAberto = async () => falha("integracao_externa", "Asaas fora do ar (simulado)");

const cancelarAutorizacaoSucesso: CanceladorDeAutorizacaoDaRecorrencia = async (autorizacaoId) => {
  await admin
    .from("autorizacoes_pix")
    .update({ status: "CANCELLED", cancellation_date: new Date().toISOString(), cancellation_reason: "teste" })
    .eq("id", autorizacaoId);
  await admin.from("recorrencias").update({ autorizacao_atual_id: null }).eq("autorizacao_atual_id", autorizacaoId);
  return ok({ autorizacaoId });
};
let chamadasCancelarAutorizacao = 0;
const cancelarAutorizacaoContaChamadas: CanceladorDeAutorizacaoDaRecorrencia = async (autorizacaoId) => {
  chamadasCancelarAutorizacao++;
  return cancelarAutorizacaoSucesso(autorizacaoId, "", null, "");
};
const cancelarAutorizacaoFalha: CanceladorDeAutorizacaoDaRecorrencia = async () =>
  falha("integracao_externa", "Asaas fora do ar (simulado)");

async function run() {
  console.log("\nENCERRAR — recorrência simples, sem autorização e sem cobranças em aberto");
  {
    const { empresaId } = await criarEmpresa("Empresa encerramento simples");
    const clienteId = await criarCliente(empresaId, "Cliente simples");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    const r = await encerrarRecorrenciaFinanceira(recorrenciaId, empresaId);
    t("encerra com sucesso", r.ok);

    const { data: rec } = await admin.from("recorrencias").select("status").eq("id", recorrenciaId).single();
    t("status vira 'encerrada'", rec?.status === "encerrada");

    const { data: log } = await admin
      .from("log_acoes_financeiras")
      .select("acao")
      .eq("empresa_id", empresaId)
      .eq("acao", "recorrencia_encerrada")
      .maybeSingle();
    t("auditoria registrada", !!log);
  }

  console.log("\nENCERRAR — cancela cobranças em aberto antes de encerrar");
  {
    const { empresaId } = await criarEmpresa("Empresa cobranças abertas");
    const clienteId = await criarCliente(empresaId, "Cliente cobranças");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const cob1 = await criarCobranca(empresaId, clienteId, recorrenciaId, "pendente", true);
    const cob2 = await criarCobranca(empresaId, clienteId, recorrenciaId, "enviada", true);
    // Cobrança já paga não deve ser tocada.
    const cobPaga = await criarCobranca(empresaId, clienteId, recorrenciaId, "paga", true);

    const r = await encerrarRecorrenciaFinanceira(recorrenciaId, empresaId, null, cancelarCobrancaSucesso);
    t("encerra com sucesso", r.ok);

    const { data: c1 } = await admin.from("cobrancas").select("status").eq("id", cob1).single();
    const { data: c2 } = await admin.from("cobrancas").select("status").eq("id", cob2).single();
    const { data: cPaga } = await admin.from("cobrancas").select("status").eq("id", cobPaga).single();
    t("cobrança pendente foi cancelada", c1?.status === "cancelada");
    t("cobrança enviada foi cancelada", c2?.status === "cancelada");
    t("cobrança já paga não foi tocada", cPaga?.status === "paga");
  }

  console.log("\nENCERRAR — cancela a autorização Pix Automático viva e desfaz o vínculo");
  {
    const { empresaId } = await criarEmpresa("Empresa autorização viva");
    const clienteId = await criarCliente(empresaId, "Cliente autorização");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const autorizacaoId = await criarAutorizacao(empresaId, recorrenciaId, clienteId, "ACTIVE");
    await admin.from("recorrencias").update({ autorizacao_atual_id: autorizacaoId }).eq("id", recorrenciaId);

    chamadasCancelarAutorizacao = 0;
    const r = await encerrarRecorrenciaFinanceira(
      recorrenciaId,
      empresaId,
      null,
      cancelarCobrancaSucesso,
      cancelarAutorizacaoContaChamadas
    );
    t("encerra com sucesso", r.ok);
    t("cancelamento da autorização foi chamado exatamente uma vez", chamadasCancelarAutorizacao === 1);

    const { data: rec } = await admin.from("recorrencias").select("status, autorizacao_atual_id").eq("id", recorrenciaId).single();
    t("recorrência encerrada", rec?.status === "encerrada");
    t("vínculo com a autorização foi desfeito", rec?.autorizacao_atual_id === null);

    const { data: auth } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacaoId).single();
    t("autorização marcada CANCELLED", auth?.status === "CANCELLED");
  }

  console.log("\nENCERRAR — autorização já morta (CANCELLED) não é cancelada de novo");
  {
    const { empresaId } = await criarEmpresa("Empresa autorização já morta");
    const clienteId = await criarCliente(empresaId, "Cliente autorização morta");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    // Simula a corrida: autorizacao_atual_id ainda aponta pra ela, mas o
    // webhook já marcou CANCELLED entre a leitura e a chamada.
    const autorizacaoId = await criarAutorizacao(empresaId, recorrenciaId, clienteId, "CANCELLED");
    await admin.from("recorrencias").update({ autorizacao_atual_id: autorizacaoId }).eq("id", recorrenciaId);

    chamadasCancelarAutorizacao = 0;
    const r = await encerrarRecorrenciaFinanceira(recorrenciaId, empresaId, null, cancelarCobrancaSucesso, cancelarAutorizacaoContaChamadas);
    t("encerra com sucesso mesmo assim (nada pra cancelar)", r.ok);
    t("cancelamento da autorização NÃO foi chamado (já estava morta)", chamadasCancelarAutorizacao === 0);
  }

  console.log("\nENCERRAR — falha ao cancelar cobrança bloqueia o encerramento");
  {
    const { empresaId } = await criarEmpresa("Empresa falha cobrança");
    const clienteId = await criarCliente(empresaId, "Cliente falha cobrança");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    await criarCobranca(empresaId, clienteId, recorrenciaId, "pendente", true);

    const r = await encerrarRecorrenciaFinanceira(recorrenciaId, empresaId, null, cancelarCobrancaFalha);
    t("não encerra quando o cancelamento da cobrança falha", !r.ok);

    const { data: rec } = await admin.from("recorrencias").select("status").eq("id", recorrenciaId).single();
    t("recorrência continua ativa (não fingiu sucesso)", rec?.status === "ativa");
  }

  console.log("\nENCERRAR — falha ao cancelar autorização bloqueia o encerramento");
  {
    const { empresaId } = await criarEmpresa("Empresa falha autorização");
    const clienteId = await criarCliente(empresaId, "Cliente falha autorização");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const autorizacaoId = await criarAutorizacao(empresaId, recorrenciaId, clienteId, "ACTIVE");
    await admin.from("recorrencias").update({ autorizacao_atual_id: autorizacaoId }).eq("id", recorrenciaId);

    const r = await encerrarRecorrenciaFinanceira(recorrenciaId, empresaId, null, cancelarCobrancaSucesso, cancelarAutorizacaoFalha);
    t("não encerra quando o cancelamento da autorização falha", !r.ok);

    const { data: rec } = await admin.from("recorrencias").select("status, autorizacao_atual_id").eq("id", recorrenciaId).single();
    t("recorrência continua ativa", rec?.status === "ativa");
    t("vínculo com a autorização continua intacto", rec?.autorizacao_atual_id === autorizacaoId);
  }

  console.log("\nENCERRAR — idempotência e isolamento");
  {
    const { empresaId: empA } = await criarEmpresa("Empresa A encerrar");
    const { empresaId: empB } = await criarEmpresa("Empresa B encerrar");
    const clienteId = await criarCliente(empA, "Cliente A");
    const recorrenciaId = await criarRecorrencia(empA, clienteId, "encerrada");

    const rJaEncerrada = await encerrarRecorrenciaFinanceira(recorrenciaId, empA);
    t("encerrar uma recorrência já encerrada falha com conflito", !rJaEncerrada.ok && rJaEncerrada.erro.tipo === "conflito");

    const recorrenciaAtiva = await criarRecorrencia(empA, clienteId, "ativa");
    const rCruzado = await encerrarRecorrenciaFinanceira(recorrenciaAtiva, empB);
    t("encerrar recorrência de A usando empresaId de B falha com nao_encontrado", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    const rInexistente = await encerrarRecorrenciaFinanceira("00000000-0000-0000-0000-000000000000", empA);
    t("recorrência inexistente falha com nao_encontrado", !rInexistente.ok && rInexistente.erro.tipo === "nao_encontrado");
  }

  console.log("\nVÍNCULO CORRETO — jaTeveAutorizacaoPix distingue 'nunca usou' de 'usou e morreu'");
  {
    const { empresaId } = await criarEmpresa("Empresa vínculo");
    const clienteId = await criarCliente(empresaId, "Cliente vínculo");

    const recSemAuth = await criarRecorrencia(empresaId, clienteId);
    t("recorrência que nunca teve autorização: false", !(await jaTeveAutorizacaoPix(recSemAuth, empresaId)));

    const recComAuthMorta = await criarRecorrencia(empresaId, clienteId);
    await criarAutorizacao(empresaId, recComAuthMorta, clienteId, "CANCELLED");
    // autorizacao_atual_id já foi zerado (como o webhook faria) — só a linha histórica continua existindo.
    t("recorrência que já teve autorização (morta): true", await jaTeveAutorizacaoPix(recComAuthMorta, empresaId));
  }

  console.log("\nSEGURANÇA — DELETE direto em clientes/cobranças/recorrências não é mais permitido (Fase 8)");
  {
    const { empresaId, email } = await criarEmpresa("Empresa segurança delete");
    const clienteId = await criarCliente(empresaId, "Cliente segurança");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const cobrancaId = await criarCobranca(empresaId, clienteId, recorrenciaId, "pendente", false);

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { error: erroDelCob } = await sessao.from("cobrancas").delete({ count: "exact" }).eq("id", cobrancaId);
    t("dono da empresa NÃO consegue apagar uma cobrança direto (42501)", erroDelCob?.code === "42501");

    const { error: erroDelRec } = await sessao.from("recorrencias").delete({ count: "exact" }).eq("id", recorrenciaId);
    t("dono da empresa NÃO consegue apagar uma recorrência direto (42501)", erroDelRec?.code === "42501");

    // Cliente é diferente dos dois acima desde 11/09/2026: existe policy de
    // DELETE (`membro exclui clientes`) porque a UI tem um botão "Excluir"
    // real para cliente sem histórico. Este cliente TEM cobrança e
    // recorrência vinculadas — quem barra agora não é mais a ausência de
    // permissão (RLS/grant), é a FK `on delete restrict` de
    // `cobrancas`/`recorrencias` apontando pra ele. Continua impossível
    // apagar, só o código do erro mudou de 42501 (insufficient_privilege)
    // para 23503 (foreign_key_violation) — o mais correto dos dois, porque
    // a causa real sempre foi "tem dado dependente", não "sem permissão".
    const { error: erroDelCli } = await sessao.from("clientes").delete({ count: "exact" }).eq("id", clienteId);
    t("dono da empresa NÃO consegue apagar um cliente com histórico (23503, bloqueado pela FK)", erroDelCli?.code === "23503");

    const { data: cobAindaExiste } = await admin.from("cobrancas").select("id").eq("id", cobrancaId).maybeSingle();
    t("cobrança continua existindo depois da tentativa", !!cobAindaExiste);
  }

  console.log("\nCAMADAS — Server Action delega pro caso de uso, não tem lógica de negócio inline");
  {
    const conteudo = fs.readFileSync("app/(app)/app/recorrencias/acoes.ts", "utf8");
    t("acoes.ts importa lib/core/recorrencia-financeira", conteudo.includes('from "@/lib/core/recorrencia-financeira"'));
    t("encerrarRecorrencia() delega pro caso de uso", conteudo.includes("await encerrarRecorrenciaFinanceira("));
    t("atualizarRecorrencia() usa valorBloqueadoPelaAutorizacao", conteudo.includes("valorBloqueadoPelaAutorizacao("));
    t("gerarProximoCiclo() usa jaTeveAutorizacaoPix", conteudo.includes("await jaTeveAutorizacaoPix("));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
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

  console.log(`\n=== ${passou} passaram, ${falhouTotal} falharam ===\n`);
  process.exit(falhouTotal > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
