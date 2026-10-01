/**
 * Fase 7 do Core Financeiro — instruções de pagamento Pix Automático
 * (ciclo real: cobrança → payment com `pixAutomaticAuthorizationId` →
 * instrução descoberta).
 *
 * Mesmo espírito das fases anteriores: sem credencial real, o caminho
 * "sem credencial"/"conta não apta" é testado de verdade, sem mock. Pra
 * sucesso/erro/webhook — onde o Asaas precisa "responder algo" —
 * `criadorCobranca`/`buscadorCobranca`/`listadorInstrucao`/`consultor`
 * injetados simulam a resposta, mesmo padrão de DI das Fases 2–6.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  prepararCicloPixAutomatico,
  sincronizarStatusInstrucao,
  ListadorDeInstrucoesAsaas,
  ConsultadorDeInstrucaoAsaas,
} from "../lib/core/instrucao-pagamento-pix";
import { diasUteisAte, janelaDeEnvio, transicaoValida, estaViva } from "../lib/core/instrucao-pagamento";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";
import { CriadorDeCobrancaAsaas, BuscadorDeCobrancaAsaas } from "../lib/core/cobranca-financeira";
import { calcularPrimeiroVencimento } from "../lib/recorrencia";
import { hojeISO } from "../lib/cobranca";

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

console.log("\n=== CORE FINANCEIRO — FASE 7 (instruções Pix Automático) ===\n");

console.log("JANELA OPERACIONAL — dias úteis (função pura)");
t("segunda + 2 dias úteis = quarta (2, limite de baixo)", diasUteisAte("2027-03-01", "2027-03-03") === 2); // seg->ter->qua
t("sexta + 1 dia útil = segunda (fim de semana não conta)", diasUteisAte("2027-03-05", "2027-03-08") === 1); // sex->[sab,dom pulados]->seg
t("dentro da janela com exatamente 2 dias úteis", janelaDeEnvio("2027-03-01", "2027-03-03").dentro === true);
t("dentro da janela com exatamente 10 dias úteis", janelaDeEnvio("2027-03-01", "2027-03-15").dentro === true); // 2 semanas = 10 dias úteis
{
  const r = janelaDeEnvio("2027-03-01", "2027-03-02"); // 1 dia útil, cedo demais pro limite de baixo... na verdade é "tarde demais" (menos que 2)
  t("fora da janela: só 1 dia útil (tarde demais, motivo correto)", !r.dentro && r.motivo === "tarde_demais");
}
{
  const r = janelaDeEnvio("2027-03-01", "2027-03-20"); // bem mais que 10 dias úteis
  t("fora da janela: mais de 10 dias úteis (cedo demais)", !r.dentro && r.motivo === "cedo_demais");
}
t("vencimento hoje ou no passado: 0 dias úteis", diasUteisAte("2027-03-10", "2027-03-10") === 0 && diasUteisAte("2027-03-10", "2027-03-05") === 0);

console.log("\nDOMÍNIO — máquina de estados da instrução (regressão)");
t("AWAITING_REQUEST→SCHEDULED válida", transicaoValida("AWAITING_REQUEST", "SCHEDULED"));
t("SCHEDULED→DONE válida", transicaoValida("SCHEDULED", "DONE"));
t("DONE→qualquer coisa é INVÁLIDA (terminal)", !transicaoValida("DONE", "SCHEDULED"));
t("AWAITING_REQUEST→DONE é INVÁLIDA (pula etapa)", !transicaoValida("AWAITING_REQUEST", "DONE"));
t("SCHEDULED é viva, DONE não é", estaViva("SCHEDULED") && !estaViva("DONE"));

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_instrucao_pix_12345";

async function criarEmpresa(nome: string, apta = true) {
  const email = `instr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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

  if (apta) {
    await admin
      .from("empresas")
      .update({ provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: `acc_mock_${empresaId.slice(0, 8)}` })
      .eq("id", empresaId);
  }
  return { empresaId, userId, email };
}

async function criarCliente(empresaId: string, nome: string) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome, email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test`, documento: "98765432100" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${data.id.slice(0, 8)}` }).eq("id", data.id);
  return data.id as string;
}

/** Cria a recorrência já com autorização ACTIVE vinculada — atalho pra não repetir a Fase 6 em cada teste. */
/**
 * Calcula um `dia_vencimento`/`inicia_em` cujo PRIMEIRO ciclo (calculado
 * pela MESMA função da produção, `calcularPrimeiroVencimento`) cai numa
 * distância em dias úteis desejada a partir de hoje. Robusto contra o
 * dia real em que os testes rodam — nada de assumir uma data fixa.
 * `dentro`: procura um vencimento com `diasUteisAte` entre 3 e 9 (dentro
 * da janela 2–10, com margem). `fora`: procura um com mais de 10.
 */
function cicloComDistancia(tipo: "dentro" | "fora"): { diaVencimento: number; iniciaEm: string; vencimento: string } {
  const hoje = hojeISO();
  const hojeDate = new Date(`${hoje}T00:00:00Z`);
  const faixa = tipo === "dentro" ? [3, 25] : [15, 27];
  for (let offset = faixa[0]; offset <= faixa[1]; offset++) {
    // Corrigido (bug de fim de mês): deriva `iniciaEm`/`diaVencimento` da
    // data-alvo (hoje + offset em dias corridos), nunca do mês corrente
    // fixo — perto do fim do mês, um `diaVencimento` pequeno combinado
    // com `iniciaEm` sempre no mês de hoje produzia uma data JÁ PASSADA,
    // porque `calcularPrimeiroVencimento` (função real de produção,
    // inalterada) só avança de mês quando `diaInicio > diaVencimento`, e
    // aqui `diaInicio` é sempre 1. Somando o offset em dias corridos, o
    // mês certo (corrente ou seguinte) sai correto para qualquer dia do
    // mês em que o teste rodar.
    const alvo = new Date(hojeDate.getTime());
    alvo.setUTCDate(alvo.getUTCDate() + offset);
    const diaVencimento = Math.min(alvo.getUTCDate(), 28);
    const iniciaEm = `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const vencimento = calcularPrimeiroVencimento(iniciaEm, diaVencimento);
    const dias = diasUteisAte(hoje, vencimento);
    if (tipo === "dentro" && dias >= 3 && dias <= 9) return { diaVencimento, iniciaEm, vencimento };
    if (tipo === "fora" && dias > 10) return { diaVencimento, iniciaEm, vencimento };
  }
  throw new Error(`não encontrei um ciclo "${tipo} da janela" a partir de ${hoje} — ajustar a faixa de busca`);
}

async function criarRecorrenciaComAutorizacaoAtiva(
  empresaId: string,
  clienteId: string,
  diaVencimento: number,
  iniciaEm = "2027-01-01"
) {
  const { data: rec, error } = await admin
    .from("recorrencias")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Mensalidade Pix Automático",
      valor_centavos: 35000,
      periodicidade: "mensal",
      dia_vencimento: diaVencimento,
      inicia_em: iniciaEm,
      status: "ativa",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: auth, error: erroAuth } = await admin
    .from("autorizacoes_pix")
    .insert({
      empresa_id: empresaId,
      recorrencia_id: rec.id,
      cliente_id: clienteId,
      asaas_authorization_id: `auth_mock_${rec.id.slice(0, 8)}`,
      status: "ACTIVE",
      finish_date: "2032-01-01",
      retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
    })
    .select("id")
    .single();
  if (erroAuth) throw new Error(erroAuth.message);

  await admin.from("recorrencias").update({ autorizacao_atual_id: auth.id }).eq("id", rec.id);
  return { recorrenciaId: rec.id as string, autorizacaoId: auth.id as string };
}

let chamadasCriador = 0;
let ultimoPayloadCriador: any = null;
const criadorSucesso: CriadorDeCobrancaAsaas = async (dados) => {
  chamadasCriador++;
  ultimoPayloadCriador = dados;
  return { ok: true, data: { id: `pay_mock_${Math.random().toString(36).slice(2, 8)}`, customer: dados.customer } as any };
};
const criadorErro: CriadorDeCobrancaAsaas = async () => ({ ok: false, status: 500, erro: "erro simulado" });
const LISTA_VAZIA_COB = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as any[] };
const buscadorCobrancaVazio: BuscadorDeCobrancaAsaas = async () => ({ ok: true, data: { ...LISTA_VAZIA_COB } });

const LISTA_VAZIA_INSTR = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as any[] };
const listadorInstrucaoVazio: ListadorDeInstrucoesAsaas = async () => ({ ok: true, data: { ...LISTA_VAZIA_INSTR } });
function listadorInstrucaoComAchado(status: string, dueDate: string): ListadorDeInstrucoesAsaas {
  return async (filtro) => ({
    ok: true,
    data: {
      ...LISTA_VAZIA_INSTR,
      data: [
        {
          id: `instr_mock_${Math.random().toString(36).slice(2, 8)}`,
          status: status as any,
          dueDate,
          paymentId: filtro.paymentId ?? null,
          authorization: { id: "auth_x" },
        } as any,
      ],
    },
  });
}

async function ultimaCobranca(recorrenciaId: string) {
  const { data } = await admin.from("cobrancas").select("*").eq("recorrencia_id", recorrenciaId).order("vence_em", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function run() {
  console.log("\nINTEGRAÇÃO REAL — sem credencial de subconta");
  {
    const { empresaId } = await criarEmpresa("Empresa sem conta financeira");
    const clienteId = await criarCliente(empresaId, "Cliente sem conta");
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);
    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId);
    t("sem credencial salva, falha com integracao_externa", !r.ok && r.erro.tipo === "integracao_externa");
  }

  console.log("\nVALIDAÇÃO — recorrência sem autorização / autorização não ativa");
  {
    const { empresaId } = await criarEmpresa("Empresa validação");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente validação");

    const { data: recSemAuth } = await admin
      .from("recorrencias")
      .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Sem auth", valor_centavos: 10000, periodicidade: "mensal", dia_vencimento: 5, inicia_em: "2027-01-01", status: "ativa" })
      .select("id")
      .single();
    const rSemAuth = await prepararCicloPixAutomatico(recSemAuth!.id, empresaId);
    t("recorrência sem autorização é recusada", !rSemAuth.ok && rSemAuth.erro.tipo === "conflito");

    const { recorrenciaId: recComAuthCreated } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, 5);
    await admin.from("autorizacoes_pix").update({ status: "CREATED" }).eq("recorrencia_id", recComAuthCreated);
    const rNaoAtiva = await prepararCicloPixAutomatico(recComAuthCreated, empresaId);
    t("autorização ainda CREATED (não ACTIVE) é recusada", !rNaoAtiva.ok && rNaoAtiva.erro.tipo === "conflito");
  }

  console.log("\nNORMAL — autorização ativa, criação de cobrança, payment ID, instrução encontrada");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa ciclo normal");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente ciclo normal");
    const { recorrenciaId, autorizacaoId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    chamadasCriador = 0;
    const listador = listadorInstrucaoComAchado("AWAITING_REQUEST", "2027-06-05");
    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listador);

    if (!r.ok || r.dado.status !== "ciclo_preparado") {
      t("ciclo preparado com sucesso (dentro da janela)", false, !r.ok ? r.erro.mensagem : `status inesperado: ${(r.dado as any).status}`);
    } else {
      t("ciclo preparado com sucesso (dentro da janela)", true);
      t("cobrança recebeu payment ID", !!r.dado.asaasPaymentId);
      t("instrução foi encontrada e persistida", !!r.dado.instrucaoId);
      t("payload enviado ao Asaas inclui pixAutomaticAuthorizationId da autorização", ultimoPayloadCriador?.pixAutomaticAuthorizationId?.startsWith("auth_mock_"));

      const { data: instr } = await admin.from("instrucoes_pagamento").select("*").eq("id", r.dado.instrucaoId).single();
      t("instrução vinculada à cobrança e à autorização corretas", instr?.cobranca_id === r.dado.cobrancaId && instr?.autorizacao_id === autorizacaoId);
      t("status da instrução é AWAITING_REQUEST (o que o mock devolveu)", instr?.status === "AWAITING_REQUEST");

      const { data: cob } = await admin.from("cobrancas").select("status").eq("id", r.dado.cobrancaId).single();
      t("status COMERCIAL da cobrança não foi tocado (continua pendente)", cob?.status === "pendente");
    }

    console.log("\nIDEMPOTÊNCIA — chamar de novo não recria o ciclo já enviado");
    // O ciclo já foi enviado (tem asaas_payment_id) — uma nova chamada
    // não encontra mais nenhuma cobrança "pendente" pra retomar, então
    // calcula o PRÓXIMO ciclo (mês seguinte), que hoje está fora da
    // janela. É o comportamento correto: nunca recria o ciclo que já
    // foi enviado, nunca chama o Asaas de novo pra ele.
    chamadasCriador = 0;
    const r2 = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listador);
    t("segunda chamada não recria o ciclo já enviado (avança ou aguarda, nunca duplica)", r2.ok);
    t("segunda chamada NÃO chama o Asaas de novo pro mesmo ciclo", chamadasCriador === 0);
  }

  console.log("\nNORMAL — instrução ainda não encontrada no Asaas (placeholder AWAITING_REQUEST sem id externo)");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa instrução pendente");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente instrução pendente");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r.ok || r.dado.status !== "ciclo_preparado") throw new Error("setup falhou");
    const { data: instr } = await admin.from("instrucoes_pagamento").select("status, asaas_instruction_id").eq("id", r.dado.instrucaoId!).single();
    t("placeholder criado com status AWAITING_REQUEST mesmo sem achar no Asaas ainda", instr?.status === "AWAITING_REQUEST" && !instr.asaas_instruction_id);
  }

  console.log("\nJANELA — recorrência fora da janela não envia nada ao Asaas");
  {
    const { empresaId } = await criarEmpresa("Empresa fora da janela");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente fora da janela");
    // dia_vencimento muito longe (mais de 10 dias úteis), calculado de verdade, não hardcoded
    const { diaVencimento: diaLonge, iniciaEm: iniciaEmLonge } = cicloComDistancia("fora");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaLonge, iniciaEmLonge);

    chamadasCriador = 0;
    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    t("fora da janela devolve 'aguardando_janela', não erro", r.ok && r.dado.status === "aguardando_janela");
    t("nenhuma chamada ao Asaas quando fora da janela", chamadasCriador === 0);
    const cob = await ultimaCobranca(recorrenciaId);
    t("nenhuma cobrança foi criada fora da janela", !cob);
  }

  console.log("\nERRO/RETRY — Asaas recusa a criação da cobrança");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa erro criação");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente erro criação");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorErro, buscadorCobrancaVazio, listadorInstrucaoVazio);
    t("erro do Asaas propaga como integracao_externa", !r.ok && r.erro.tipo === "integracao_externa");

    const cobFalha = await ultimaCobranca(recorrenciaId);
    t("a cobrança local FOI criada (existe, mesmo com erro no envio)", !!cobFalha);
    t("mas ficou com asaas_sync_status='erro', sem payment_id", cobFalha?.asaas_sync_status === "erro" && !cobFalha?.asaas_payment_id);

    const r2 = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    t("retry reaproveita a MESMA cobrança e consegue enviar", r2.ok && r2.dado.status === "ciclo_preparado");
    const { count } = await admin.from("cobrancas").select("*", { count: "exact", head: true }).eq("recorrencia_id", recorrenciaId);
    t("só existe UMA cobrança pro ciclo, não duas", count === 1);
  }

  console.log("\nRESPOSTA PERDIDA — payment já existia no Asaas (externalReference bate), não duplica");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa resposta perdida");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente resposta perdida");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    // Primeiro, prepara pra descobrir o cobrancaId real (sem sucesso no Asaas ainda).
    const rInicial = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorErro, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (rInicial.ok) throw new Error("setup inesperado");
    const cobLocal = await ultimaCobranca(recorrenciaId);

    const buscadorComAchado: BuscadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { ...LISTA_VAZIA_COB, data: [{ id: "pay_recuperado_instr", externalReference: cobLocal!.id } as any] },
    });

    chamadasCriador = 0;
    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorComAchado, listadorInstrucaoVazio);
    t("recupera o payment existente em vez de criar outro", r.ok && r.dado.status === "ciclo_preparado" && (r.dado as any).asaasPaymentId === "pay_recuperado_instr");
    t("NÃO chama o criador quando já encontrou por externalReference", chamadasCriador === 0);
  }

  console.log("\nCONCORRÊNCIA — duas preparações simultâneas do mesmo ciclo");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa concorrência instrução");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente concorrência instrução");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    chamadasCriador = 0;
    const [ra, rb] = await Promise.all([
      prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio),
      prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio),
    ]);
    // Mesmo padrão já confirmado nas Fases 5–7 pro CAS de
    // `sincronizarCobrancaFinanceira`: a perdedora pode ver "conflito"
    // (releu antes da vencedora terminar) ou `ok` idempotente (a
    // vencedora já tinha terminado) — as duas provam que não duplicou.
    const semDuplicarCiclo = (ra.ok && rb.ok) || (ra.ok && !rb.ok && rb.erro.tipo === "conflito") || (!ra.ok && rb.ok && ra.erro.tipo === "conflito");
    t("as duas chamadas resolvem sem duplicar (conflito ou sucesso idempotente)", semDuplicarCiclo);
    t("só UMA chegou a chamar o Asaas (chave única de ciclo no banco)", chamadasCriador === 1);
    const { count } = await admin.from("cobrancas").select("*", { count: "exact", head: true }).eq("recorrencia_id", recorrenciaId);
    t("só existe UMA cobrança pro ciclo", count === 1);
  }

  console.log("\nWEBHOOK — CREATED / SCHEDULED / REFUSED / CANCELLED / duplicado / fora de ordem / tenant desconhecido / instrução inexistente");
  {
    const { processarEventoWebhook } = await import("../lib/asaas/webhook");
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa webhook instrução");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente webhook instrução");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r.ok || r.dado.status !== "ciclo_preparado") throw new Error("setup falhou: " + JSON.stringify(r));
    const cobrancaId = r.dado.cobrancaId;
    const asaasPaymentId = r.dado.asaasPaymentId;
    const instrucaoId = r.dado.instrucaoId!;

    const payloadBase = (event: string, overrides: Record<string, unknown> = {}) => ({
      id: `evt_${event}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event: event as any,
      dateCreated: new Date().toISOString(),
      paymentInstruction: {
        id: "instr_webhook_teste",
        status: "SCHEDULED",
        dueDate: "2027-06-05",
        paymentId: asaasPaymentId,
        authorization: { id: "auth_x" },
        ...overrides,
      },
    });

    // instrução inexistente: paymentId que não bate com nenhuma linha local
    const rInexistente = await processarEventoWebhook(payloadBase("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED", { paymentId: "pay_nunca_existiu" }) as any);
    t("evento com paymentId desconhecido é recusado", !rInexistente.ok);

    // CREATED (idempotente com o AWAITING_REQUEST local — só faz backfill do asaas_instruction_id)
    const evtCreated = payloadBase("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED", { status: "AWAITING_REQUEST" });
    const rCreated = await processarEventoWebhook(evtCreated as any);
    t("CREATED processado com sucesso", rCreated.ok);
    const { data: linhaBackfill } = await admin.from("instrucoes_pagamento").select("asaas_instruction_id").eq("id", instrucaoId).single();
    t("asaas_instruction_id foi preenchido pelo webhook (descoberta síncrona não tinha achado)", linhaBackfill?.asaas_instruction_id === "instr_webhook_teste");

    // SCHEDULED
    const evtScheduled = payloadBase("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED");
    const rScheduled = await processarEventoWebhook(evtScheduled as any);
    t("SCHEDULED processado com sucesso", rScheduled.ok);
    const { data: linhaSched } = await admin.from("instrucoes_pagamento").select("status, due_date").eq("id", instrucaoId).single();
    t("status local vira SCHEDULED com due_date atualizada", linhaSched?.status === "SCHEDULED" && linhaSched.due_date === "2027-06-05");

    // duplicado: reenviar o MESMO evento (mesmo id) é idempotente
    const rDuplicado = await processarEventoWebhook(evtScheduled as any);
    t("reenviar o mesmo evento é idempotente", rDuplicado.ok && "idempotente" in rDuplicado && rDuplicado.idempotente === true);

    // fora de ordem: CREATED (AWAITING_REQUEST) chegando DEPOIS de SCHEDULED não regride
    const evtForaDeOrdem = payloadBase("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED", { status: "AWAITING_REQUEST", id: `evt_fora_ordem_${Date.now()}` });
    await processarEventoWebhook(evtForaDeOrdem as any);
    const { data: linhaPosOrdem } = await admin.from("instrucoes_pagamento").select("status").eq("id", instrucaoId).single();
    t("evento fora de ordem (CREATED depois de SCHEDULED) não regride o estado", linhaPosOrdem?.status === "SCHEDULED");

    // REFUSED em outra instrução (não pode ir de SCHEDULED->CANCELLED->REFUSED nessa mesma)
    const ciclo2 = cicloComDistancia("dentro");
    const { recorrenciaId: rec2 } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, ciclo2.diaVencimento, ciclo2.iniciaEm);
    const r2 = await prepararCicloPixAutomatico(rec2, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r2.ok || r2.dado.status !== "ciclo_preparado") throw new Error("setup 2 falhou");
    const evtRefused = {
      id: `evt_refused_${Date.now()}`,
      event: "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED" as any,
      dateCreated: new Date().toISOString(),
      paymentInstruction: {
        id: "instr_refused_teste",
        status: "REFUSED",
        dueDate: "2027-06-06",
        paymentId: r2.dado.asaasPaymentId,
        authorization: { id: "auth_x" },
        refusalReason: "Saldo insuficiente na conta do pagador",
      },
    };
    const rRefused = await processarEventoWebhook(evtRefused as any);
    t("REFUSED processado com sucesso", rRefused.ok);
    const { data: linhaRefused } = await admin.from("instrucoes_pagamento").select("status, refusal_reason").eq("id", r2.dado.instrucaoId!).single();
    t("status vira REFUSED com o motivo persistido", linhaRefused?.status === "REFUSED" && linhaRefused.refusal_reason === "Saldo insuficiente na conta do pagador");

    // CANCELLED em uma terceira instrução
    const ciclo3 = cicloComDistancia("dentro");
    const { recorrenciaId: rec3 } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, ciclo3.diaVencimento, ciclo3.iniciaEm);
    const r3 = await prepararCicloPixAutomatico(rec3, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r3.ok || r3.dado.status !== "ciclo_preparado") throw new Error("setup 3 falhou");
    const evtCancelled = {
      id: `evt_cancelled_${Date.now()}`,
      event: "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED" as any,
      dateCreated: new Date().toISOString(),
      paymentInstruction: {
        id: "instr_cancelled_teste",
        status: "CANCELLED",
        dueDate: "2027-06-07",
        paymentId: r3.dado.asaasPaymentId,
        authorization: { id: "auth_x" },
      },
    };
    const rCancelled = await processarEventoWebhook(evtCancelled as any);
    t("CANCELLED processado com sucesso", rCancelled.ok);
    const { data: linhaCancelled } = await admin.from("instrucoes_pagamento").select("status").eq("id", r3.dado.instrucaoId!).single();
    t("status vira CANCELLED", linhaCancelled?.status === "CANCELLED");
  }

  console.log("\nPAGAMENTO — separado de instrução, criado só quando há vínculo real");
  {
    const { processarEventoWebhook } = await import("../lib/asaas/webhook");
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa pagamento");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente pagamento");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r.ok || r.dado.status !== "ciclo_preparado") throw new Error("setup falhou");

    const evtPago = {
      id: `evt_pago_${Date.now()}`,
      event: "PAYMENT_RECEIVED" as any,
      dateCreated: new Date().toISOString(),
      account: { id: `acc_mock_${empresaId.slice(0, 8)}` },
      payment: {
        id: r.dado.asaasPaymentId,
        customer: "cus_x",
        dateCreated: new Date().toISOString(),
        dueDate: "2027-06-05",
        value: 350,
        netValue: 346.5,
        billingType: "PIX",
        status: "RECEIVED",
        paymentDate: new Date().toISOString(),
        externalReference: r.dado.cobrancaId,
      },
    };
    const rPago = await processarEventoWebhook(evtPago as any);
    t("PAYMENT_RECEIVED processado com sucesso", rPago.ok);

    const { data: cobPaga } = await admin.from("cobrancas").select("status").eq("id", r.dado.cobrancaId).single();
    t("cobrança marcada como paga (webhook de pagamento já existente da Fase 5)", cobPaga?.status === "paga");

    const { data: pagamento } = await admin.from("pagamentos").select("*").eq("asaas_payment_id", r.dado.asaasPaymentId).maybeSingle();
    t("linha de pagamento foi criada, vinculada à instrução", !!pagamento && pagamento.instrucao_id === r.dado.instrucaoId);
    t("valor líquido e taxa calculados a partir do netValue do Asaas", pagamento?.valor_liquido_centavos === 34650 && pagamento?.taxa_centavos === 350);

    const { data: instrDepois } = await admin.from("instrucoes_pagamento").select("status").eq("id", r.dado.instrucaoId!).single();
    t("status da INSTRUÇÃO não foi tocado pelo evento de pagamento (entidades separadas)", instrDepois?.status === "AWAITING_REQUEST");

    // reenvio do mesmo evento de pagamento não duplica a linha em `pagamentos`
    const rPago2 = await processarEventoWebhook({ ...evtPago, id: `evt_pago_2_${Date.now()}` } as any);
    t("reenvio (evento diferente, mesmo payment) não duplica a linha de pagamento", rPago2.ok);
    const { count } = await admin.from("pagamentos").select("*", { count: "exact", head: true }).eq("asaas_payment_id", r.dado.asaasPaymentId);
    t("só existe UMA linha de pagamento pro mesmo asaas_payment_id (índice único)", count === 1);
  }

  console.log("\nRECONCILIAÇÃO — consulta ativa (pull) complementa o webhook");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa reconciliação instrução");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_instrucao");
    const clienteId = await criarCliente(empresaId, "Cliente reconciliação instrução");
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    const r = await prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!r.ok || r.dado.status !== "ciclo_preparado") throw new Error("setup falhou");
    const asaasPaymentId = r.dado.asaasPaymentId;
    const instrucaoId = r.dado.instrucaoId!;

    // Sem asaas_instruction_id ainda (descoberta síncrona não achou) — reconciliação usa o listador por paymentId.
    const consultorNuncaChamado: ConsultadorDeInstrucaoAsaas = async () => {
      throw new Error("não deveria consultar por id — ainda não tínhamos asaas_instruction_id");
    };

    // Transição impossível (AWAITING_REQUEST→DONE direto): a reconciliação recusa, não aplica às cegas.
    const listadorPulaEtapa: ListadorDeInstrucoesAsaas = async () => ({
      ok: true,
      data: { ...LISTA_VAZIA_INSTR, data: [{ id: "instr_reconciliada", status: "DONE" as any, dueDate: "2027-06-05", paymentId: asaasPaymentId, authorization: { id: "auth_x" } } as any] },
    });
    const rSyncInvalida = await sincronizarStatusInstrucao(instrucaoId, empresaId, consultorNuncaChamado, listadorPulaEtapa);
    t("transição impossível na reconciliação é recusada, não aplicada às cegas", !rSyncInvalida.ok && rSyncInvalida.erro.tipo === "conflito");
    const { data: linhaAposInvalida } = await admin.from("instrucoes_pagamento").select("status").eq("id", instrucaoId).single();
    t("estado local não foi corrompido pela tentativa de reconciliação inválida", linhaAposInvalida?.status === "AWAITING_REQUEST");

    // Transição válida (AWAITING_REQUEST→SCHEDULED): reconciliação aplica e persiste o asaas_instruction_id descoberto.
    const listadorValido: ListadorDeInstrucoesAsaas = async () => ({
      ok: true,
      data: { ...LISTA_VAZIA_INSTR, data: [{ id: "instr_reconciliada_valida", status: "SCHEDULED" as any, dueDate: "2027-06-05", paymentId: asaasPaymentId, authorization: { id: "auth_x" } } as any] },
    });
    const rSyncValida = await sincronizarStatusInstrucao(instrucaoId, empresaId, consultorNuncaChamado, listadorValido);
    t("transição válida na reconciliação é aplicada", rSyncValida.ok && rSyncValida.dado.status === "SCHEDULED");
    const { data: linhaAposValida } = await admin.from("instrucoes_pagamento").select("status, asaas_instruction_id").eq("id", instrucaoId).single();
    t("estado e id externo persistidos pela reconciliação", linhaAposValida?.status === "SCHEDULED" && linhaAposValida.asaas_instruction_id === "instr_reconciliada_valida");
  }

  console.log("\nSEGURANÇA — tenant isolation e grants restritos");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const a = await criarEmpresa("Tenant A instrução");
    const b = await criarEmpresa("Tenant B instrução");
    await salvarCredencialDaEmpresa(a.empresaId, "chave_fake_teste_instrucao");
    const clienteDeA = await criarCliente(a.empresaId, "Cliente do tenant A");
    const { recorrenciaId: recDeA } = await criarRecorrenciaComAutorizacaoAtiva(a.empresaId, clienteDeA, diaVencimento, iniciaEm);

    const rCruzado = await prepararCicloPixAutomatico(recDeA, b.empresaId);
    t("preparar ciclo de A usando empresaId de B falha", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    const rSucesso = await prepararCicloPixAutomatico(recDeA, a.empresaId, null, criadorSucesso, buscadorCobrancaVazio, listadorInstrucaoVazio);
    if (!rSucesso.ok || rSucesso.dado.status !== "ciclo_preparado") throw new Error("setup falhou");

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email: a.email, password: SENHA_TESTE });

    const { error: erroInstr } = await sessao.from("instrucoes_pagamento").update({ status: "DONE" }).eq("id", rSucesso.dado.instrucaoId!);
    t("dono da recorrência NÃO consegue alterar status da instrução direto", erroInstr?.code === "42501");

    const { error: erroPag } = await sessao.from("pagamentos").insert({
      empresa_id: a.empresaId,
      instrucao_id: rSucesso.dado.instrucaoId!,
      asaas_payment_id: "pay_forjado",
      valor_liquido_centavos: 1000,
      taxa_centavos: 0,
      liquidado_em: new Date().toISOString(),
    });
    t("dono da recorrência NÃO consegue forjar um pagamento direto", erroPag?.code === "42501");
  }

  console.log("\nCAMADAS — Server Action chama o caso de uso, não fala com o Asaas direto");
  {
    const conteudo = fs.readFileSync("app/(app)/app/recorrencias/acoes.ts", "utf8");
    t("acoes.ts importa lib/core/instrucao-pagamento-pix", conteudo.includes('from "@/lib/core/instrucao-pagamento-pix"'));
    t("gerarProximoCiclo() delega pro caso de uso quando há autorização", conteudo.includes("await prepararCicloPixAutomatico("));
    t("existe ação de sincronizar instrução", conteudo.includes("export async function sincronizarInstrucaoAcao"));
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

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
