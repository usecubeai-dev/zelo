/**
 * Cobrança + pagamento + recuperação — regras, banco, RLS, payload do Asaas e webhook.
 *
 * Cobre: forma de pagamento, multa, juros, valor atualizado, atraso, estados
 * de recuperação, lembretes, ações (WhatsApp/copiar link/negociada), resumo do
 * cliente, preferências da empresa, limites e isolamento (RLS), idempotência
 * e a regra "taxa do Zelo só em Pix recebido". Não chama o Asaas de verdade.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  DIAS_PROXIMA,
  LEMBRETES_DESLIGADOS,
  PREFERENCIAS_PADRAO,
  REGRAS_DE_LEMBRETE,
  abaixoDoMinimoDoAsaas,
  acaoRecomendada,
  contaComoContato,
  diasDeAtraso,
  encargosDoTexto,
  estadoDeRecuperacao,
  lembreteDaVez,
  lerPercentual,
  percentualParaCampo,
  planoDePagamento,
  preferenciasDaEmpresa,
  resumirFinanceiro,
  somarDias,
  textoEncargos,
  validarEncargos,
  validarForma,
  valorAtualizado,
} from "../lib/recuperacao";
import { COBRANCA_VAZIA, cobrancaParaBanco, validarCobranca } from "../lib/cobranca";
import { criarCobrancaAsaas } from "../lib/asaas/cobranca";
import { sincronizarCobrancaFinanceira, CriadorDeCobrancaAsaas } from "../lib/core/cobranca-financeira";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";
import { processarEventoWebhook } from "../lib/asaas/webhook";
import type { AsaasWebhookPayload } from "../lib/asaas/tipos";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!process.env.ASAAS_CREDENTIALS_KEY) process.env.ASAAS_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.ASAAS_WEBHOOK_TOKEN = "token_teste_recuperacao_123";

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = 0;
let falhou = 0;
const t = (nome: string, cond: boolean, detalhe = "") => {
  if (cond) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ FALHA: ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA = "senha_teste_recuperacao_12345";

async function criarConta(rotulo: string) {
  const email = `rec_${rotulo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { nome: `Empresa ${rotulo}` } });
  if (error) throw new Error(error.message);
  const userId = data.user!.id;
  usuarios.push(userId);
  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId).single();
  const empresaId = m!.empresa_id as string;
  empresas.push(empresaId);
  await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", empresaId);
  const sessao = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: eLogin } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (eLogin) throw new Error(`login: ${eLogin.message}`);
  return { userId, empresaId, email, sessao };
}

async function cliente(empresaId: string, nome = "Cliente") {
  const { data, error } = await admin.from("clientes").insert({ empresa_id: empresaId, nome, whatsapp: "11999990000" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function run() {
  console.log("\n=== COBRANÇA + PAGAMENTO + RECUPERAÇÃO ===\n");

  /* ---------------- 1. números e texto ---------------- */
  console.log("1. Percentuais, encargos e validação:");
  t('lerPercentual("2") = 2', lerPercentual("2") === 2);
  t('lerPercentual("2,5") = 2.5', lerPercentual("2,5") === 2.5);
  t('lerPercentual("0,033") recusa 3 casas (NaN)', Number.isNaN(lerPercentual("0,033")));
  t('lerPercentual("") = null (sem encargo)', lerPercentual("") === null && lerPercentual(null) === null);
  t('lerPercentual("abc") = NaN', Number.isNaN(lerPercentual("abc")));
  t('lerPercentual("-1") = NaN', Number.isNaN(lerPercentual("-1")));
  t("percentualParaCampo(0.5) = '0,5'; 0 e null = ''", percentualParaCampo(0.5) === "0,5" && percentualParaCampo(0) === "" && percentualParaCampo(null) === "");
  t("percentualParaCampo aceita NUMERIC string do banco ('2.00' → '2')", percentualParaCampo("2.00") === "2");

  t("multa 10 é aceita, 10,01 não", !validarEncargos("10", "").multa && !!validarEncargos("10,01", "").multa);
  t("juros 11 é aceito (limite do Asaas), 12 não", !validarEncargos("", "11").juros && !!validarEncargos("", "12").juros);
  t("campo vazio é válido (sem encargo)", Object.keys(validarEncargos("", "")).length === 0);
  t("texto inválido gera erro de campo", !!validarEncargos("x", "").multa && !!validarEncargos("", "y").juros);
  t("encargosDoTexto limpa 0 e vazio para null", JSON.stringify(encargosDoTexto("0", "")) === JSON.stringify({ multaPct: null, jurosPctMes: null }));
  t("encargosDoTexto('2','1')", encargosDoTexto("2", "1").multaPct === 2 && encargosDoTexto("2", "1").jurosPctMes === 1);
  t("textoEncargos descreve multa + juros", textoEncargos({ multaPct: 2, jurosPctMes: 1 }) === "multa de 2% + juros de 1% ao mês");

  /* ---------------- 2. forma de pagamento ---------------- */
  console.log("\n2. Forma de pagamento (seleção, mínimo, Pix):");
  t("planoDePagamento: cliente escolhe ≥ R$ 5 → UNDEFINED com encargos", (() => {
    const p = planoDePagamento("cliente_escolhe", { multaPct: 2, jurosPctMes: 1 }, 1000);
    return p.billingType === "UNDEFINED" && p.encargos.multaPct === 2;
  })());
  t("planoDePagamento: só Pix → PIX e NUNCA leva encargos", (() => {
    const p = planoDePagamento("pix", { multaPct: 2, jurosPctMes: 1 }, 10000);
    return p.billingType === "PIX" && p.encargos.multaPct === null && p.encargos.jurosPctMes === null;
  })());
  t("planoDePagamento: cliente escolhe abaixo de R$ 5 cai em PIX sem encargos (defesa)", planoDePagamento("cliente_escolhe", { multaPct: 2, jurosPctMes: 1 }, 499).billingType === "PIX");
  t("validarForma: cliente escolhe com R$ 4,99 é recusado", !!validarForma("cliente_escolhe", 499).forma);
  t("validarForma: cliente escolhe com R$ 5,00 é aceito; Pix sempre", !validarForma("cliente_escolhe", 500).forma && !validarForma("pix", 100).forma);
  t("abaixoDoMinimoDoAsaas: 499 sim, 500 não, 0/null não", abaixoDoMinimoDoAsaas(499) && !abaixoDoMinimoDoAsaas(500) && !abaixoDoMinimoDoAsaas(null) && !abaixoDoMinimoDoAsaas(0));

  const base = { ...COBRANCA_VAZIA, cliente_id: "x", descricao: "Aula", valor: "100,00", vence_em: "2099-01-01" };
  t("cobrança padrão (só Pix) é válida", Object.keys(validarCobranca(base, "2026-01-01")).length === 0);
  t("cliente escolhe + multa/juros válidos passa", Object.keys(validarCobranca({ ...base, forma_pagamento: "cliente_escolhe", multa: "2", juros: "1" }, "2026-01-01")).length === 0);
  t("cliente escolhe com valor R$ 3,00 é recusado", !!validarCobranca({ ...base, valor: "3,00", forma_pagamento: "cliente_escolhe" }, "2026-01-01").forma_pagamento);
  t("cliente escolhe com multa 11% é recusado", !!validarCobranca({ ...base, forma_pagamento: "cliente_escolhe", multa: "11" }, "2026-01-01").multa);
  t("só Pix IGNORA encargos digitados (não bloqueia)", Object.keys(validarCobranca({ ...base, multa: "99", juros: "99" }, "2026-01-01")).length === 0);
  t("forma desconhecida é recusada", !!validarCobranca({ ...base, forma_pagamento: "cartao" as never }, "2026-01-01").forma_pagamento);
  t("cobrancaParaBanco (só Pix) zera encargos", (() => {
    const b = cobrancaParaBanco({ ...base, multa: "2", juros: "1" });
    return b.forma_pagamento === "pix" && b.multa_pct === null && b.juros_pct_mes === null;
  })());
  t("cobrancaParaBanco (cliente escolhe) grava os encargos", (() => {
    const b = cobrancaParaBanco({ ...base, forma_pagamento: "cliente_escolhe", multa: "2", juros: "0,5" });
    return b.forma_pagamento === "cliente_escolhe" && b.multa_pct === 2 && b.juros_pct_mes === 0.5;
  })());
  t("cobrancaParaBanco ignora forma inválida vinda do navegador (vira pix)", cobrancaParaBanco({ ...base, forma_pagamento: "x" as never }).forma_pagamento === "pix");
  t("o preço nunca vem do navegador: valor sai do texto, em centavos", cobrancaParaBanco(base).valor_centavos === 10000);

  /* ---------------- 3. atraso e valor atualizado ---------------- */
  console.log("\n3. Atraso e valor atualizado (estimativa):");
  t("diasDeAtraso: vence amanhã = 0; vence hoje = 0; ontem = 1; 8 dias = 8", diasDeAtraso("2026-10-07", "2026-10-06") === 0 && diasDeAtraso("2026-10-06", "2026-10-06") === 0 && diasDeAtraso("2026-10-05", "2026-10-06") === 1 && diasDeAtraso("2026-09-28", "2026-10-06") === 8);
  const enc = { multaPct: 2, jurosPctMes: 1 };
  const v10 = valorAtualizado({ valorCentavos: 10000, venceEm: "2026-09-26", hoje: "2026-10-06", encargos: enc });
  t("R$ 100 com 10 dias, multa 2% + juros 1%/mês: multa 200, juros 33, total 10233", v10.diasAtraso === 10 && v10.multaCentavos === 200 && v10.jurosCentavos === 33 && v10.totalCentavos === 10233, JSON.stringify(v10));
  t("sem atraso: valor original e aplicou=false", (() => {
    const v = valorAtualizado({ valorCentavos: 10000, venceEm: "2026-10-06", hoje: "2026-10-06", encargos: enc });
    return v.totalCentavos === 10000 && !v.aplicou;
  })());
  t("sem encargos configurados: valor original mesmo atrasado", valorAtualizado({ valorCentavos: 10000, venceEm: "2026-09-01", hoje: "2026-10-06", encargos: { multaPct: null, jurosPctMes: null } }).totalCentavos === 10000);
  t("só multa: não cresce com os dias", valorAtualizado({ valorCentavos: 10000, venceEm: "2026-09-01", hoje: "2026-10-06", encargos: { multaPct: 2, jurosPctMes: null } }).totalCentavos === 10200);
  t("juros crescem com os dias (30 dias = 1 mês cheio)", valorAtualizado({ valorCentavos: 10000, venceEm: "2026-09-06", hoje: "2026-10-06", encargos: { multaPct: null, jurosPctMes: 1 } }).jurosCentavos === 100);
  t("valores sempre inteiros (centavos)", Number.isInteger(valorAtualizado({ valorCentavos: 3333, venceEm: "2026-09-26", hoje: "2026-10-06", encargos: enc }).totalCentavos));
  t("exemplo do pedido: 2% de multa e 0,033%/dia ≈ 1%/mês", valorAtualizado({ valorCentavos: 38000, venceEm: "2026-09-28", hoje: "2026-10-06", encargos: { multaPct: 2, jurosPctMes: 1 } }).totalCentavos === 38000 + 760 + 101);

  /* ---------------- 4. estados de recuperação ---------------- */
  console.log("\n4. Estados de recuperação:");
  const H = "2026-10-06";
  const est = (status: string, vence: string, neg: string | null = null, contato = false) => estadoDeRecuperacao({ status, vence_em: vence, negociada_em: neg }, contato, H);
  t(`vence em > ${DIAS_PROXIMA} dias: a_vencer`, est("pendente", "2026-10-20") === "a_vencer");
  t("vence em 3 dias: próxima do vencimento", est("pendente", "2026-10-09") === "proxima_do_vencimento");
  t("vence hoje", est("enviada", "2026-10-06") === "vence_hoje");
  t("vencida sem contato: vencida", est("pendente", "2026-10-01") === "vencida");
  t("vencida com contato: em recuperação", est("pendente", "2026-10-01", null, true) === "em_recuperacao");
  t("vencida e negociada: negociada (mesmo com contato)", est("pendente", "2026-10-01", "2026-10-02T10:00:00Z", true) === "negociada");
  t("paga: paga (mesmo vencida)", est("paga", "2026-09-01") === "paga");
  t("cancelada/estornada: encerrada", est("cancelada", "2026-09-01") === "encerrada" && est("estornada", "2026-09-01") === "encerrada");
  t("ações de contato contam; negociada/reaberta não", contaComoContato("whatsapp") && contaComoContato("link_copiado") && contaComoContato("lembrete_whatsapp") && !contaComoContato("negociada") && !contaComoContato("reaberta"));
  t("ação recomendada por tempo de atraso", acaoRecomendada(2) === "Enviar lembrete" && acaoRecomendada(8) === "Cobrar de novo pelo WhatsApp" && acaoRecomendada(30) === "Recuperar cobrança");

  /* ---------------- 5. lembretes ---------------- */
  console.log("\n5. Lembretes:");
  const todas = { "3d_antes": true, no_dia: true, "1d_depois": true, "3d_depois": true, "7d_depois": true };
  const l = (venceEm: string, hoje: string, config = todas, ult: string | null = null) => lembreteDaVez({ venceEm, hoje, config, ultimoContatoEm: ult });
  t("3 dias antes: na vez", l("2026-10-09", "2026-10-06") === "3d_antes");
  t("no dia do vencimento", l("2026-10-06", "2026-10-06") === "no_dia");
  t("1 dia depois", l("2026-10-05", "2026-10-06") === "1d_depois");
  t("3 dias depois", l("2026-10-03", "2026-10-06") === "3d_depois");
  t("7 dias depois", l("2026-09-29", "2026-10-06") === "7d_depois");
  t("dia sem regra: nenhum lembrete (4 dias antes)", l("2026-10-10", "2026-10-06") === null);
  t("a regra continua na vez no dia seguinte (janela de 2 dias)", l("2026-10-09", "2026-10-07") === "3d_antes");
  t("e some depois da janela", l("2026-10-09", "2026-10-08", { ...LEMBRETES_DESLIGADOS, "3d_antes": true }) === null);
  t("regra desligada nunca aparece", l("2026-10-09", "2026-10-06", { ...LEMBRETES_DESLIGADOS }) === null);
  t("contato feito no dia da regra tira da lista", l("2026-10-09", "2026-10-06", todas, "2026-10-06") === null);
  t("contato ANTES da regra não tira", l("2026-10-09", "2026-10-06", todas, "2026-10-05") === "3d_antes");
  t("somarDias atravessa o mês", somarDias("2026-10-30", 3) === "2026-11-02" && somarDias("2026-10-01", -1) === "2026-09-30");
  t("cinco regras oficiais", REGRAS_DE_LEMBRETE.length === 5);

  /* ---------------- 6. resumos e preferências ---------------- */
  console.log("\n6. Resumo do cliente e preferências:");
  const r = resumirFinanceiro(
    [
      { status: "paga", vence_em: "2026-09-01", valor_centavos: 10000, valor_pago_centavos: 10500 },
      { status: "pendente", vence_em: "2026-09-20", valor_centavos: 38000, valor_pago_centavos: null },
      { status: "enviada", vence_em: "2026-10-20", valor_centavos: 5000, valor_pago_centavos: null },
      { status: "cancelada", vence_em: "2026-09-10", valor_centavos: 99999, valor_pago_centavos: null },
    ],
    H
  );
  t("contratado exclui cancelada", r.contratadoCentavos === 53000);
  t("recebido usa o valor realmente pago", r.recebidoCentavos === 10500);
  t("em aberto = atrasado + a vencer", r.emAbertoCentavos === 43000 && r.atrasadoCentavos === 38000 && r.qtdAtrasadas === 1);
  t("próxima cobrança é a mais perto, a vencer", r.proxima?.venceEm === "2026-10-20" && r.proxima?.valorCentavos === 5000);
  t("cliente com atraso NÃO está em dia", r.emDia === false);
  t("cliente sem atraso está em dia", resumirFinanceiro([{ status: "pendente", vence_em: "2026-10-20", valor_centavos: 100, valor_pago_centavos: null }], H).emDia === true);
  t("preferências padrão: só Pix, sem encargos, lembretes desligados", PREFERENCIAS_PADRAO.forma === "pix" && !PREFERENCIAS_PADRAO.encargos.multaPct && Object.values(PREFERENCIAS_PADRAO.lembretes).every((v) => !v));
  t("preferenciasDaEmpresa lê as colunas do banco", (() => {
    const p = preferenciasDaEmpresa({ cobranca_forma_padrao: "cliente_escolhe", multa_padrao_pct: "2.00", juros_padrao_pct_mes: "1.00", lembrete_no_dia: true, canal_preferencial: "link" });
    return p.forma === "cliente_escolhe" && p.encargos.multaPct === 2 && p.encargos.jurosPctMes === 1 && p.lembretes.no_dia === true && p.lembretes["3d_antes"] === false && p.canal === "link";
  })());
  t("valor desconhecido cai no padrão seguro", preferenciasDaEmpresa({ cobranca_forma_padrao: "x", canal_preferencial: "y" }).forma === "pix");

  /* ---------------- 7. payload do Asaas ---------------- */
  console.log("\n7. Payload enviado ao Asaas:");
  const fetchReal = globalThis.fetch;
  let corpoCapturado: Record<string, unknown> | null = null;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes("/payments") && init?.method === "POST") {
      corpoCapturado = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "pay_x", status: "PENDING" }), { status: 200 });
    }
    return fetchReal(url as never, init as never);
  }) as typeof fetch;
  const cred = { apiKey: "chave_fake", baseUrl: "https://sandbox.asaas.com/api/v3", origem: "plataforma" as const };
  await criarCobrancaAsaas({ customer: "cus_1", billingType: "UNDEFINED", valorCentavos: 10000, dueDate: "2027-01-01", description: "x", multaPct: 2, jurosPctMes: 1 }, cred);
  const c1 = corpoCapturado as unknown as Record<string, unknown>;
  t("UNDEFINED leva billingType, value em reais, fine e interest", c1.billingType === "UNDEFINED" && c1.value === 100 && JSON.stringify(c1.fine) === '{"value":2,"type":"PERCENTAGE"}' && JSON.stringify(c1.interest) === '{"value":1}');
  await criarCobrancaAsaas({ customer: "cus_1", billingType: "PIX", valorCentavos: 10000, dueDate: "2027-01-01", description: "x" }, cred);
  const c2 = corpoCapturado as unknown as Record<string, unknown>;
  t("Pix sem encargos: não envia fine nem interest", c2.billingType === "PIX" && c2.fine === undefined && c2.interest === undefined);
  await criarCobrancaAsaas({ customer: "cus_1", valorCentavos: 10000, dueDate: "2027-01-01", description: "x", multaPct: 0, jurosPctMes: null }, cred);
  const c3 = corpoCapturado as unknown as Record<string, unknown>;
  t("encargo 0 ou null não vai no payload", c3.fine === undefined && c3.interest === undefined);
  globalThis.fetch = fetchReal;

  /* ---------------- 8. banco: limites e RLS ---------------- */
  console.log("\n8. Banco, limites e isolamento (RLS):");
  const A = await criarConta("A");
  const B = await criarConta("B");
  const cliA = await cliente(A.empresaId, "Ana");
  const cliB = await cliente(B.empresaId, "Beto");

  const inserirA = (extra: Record<string, unknown>) =>
    A.sessao.from("cobrancas").insert({ empresa_id: A.empresaId, cliente_id: cliA, descricao: "Teste", valor_centavos: 10000, vence_em: "2099-01-01", ...extra }).select("id").single();

  const padrao = await inserirA({});
  t("cobrança criada pelo membro nasce 'pix', sem encargos", !padrao.error && !!padrao.data);
  const { data: linhaPadrao } = await admin.from("cobrancas").select("forma_pagamento, multa_pct, juros_pct_mes, negociada_em").eq("id", padrao.data!.id).single();
  t("padrão do banco: pix, sem multa/juros, não negociada", linhaPadrao?.forma_pagamento === "pix" && linhaPadrao?.multa_pct === null && linhaPadrao?.juros_pct_mes === null && linhaPadrao?.negociada_em === null);

  const escolhe = await inserirA({ forma_pagamento: "cliente_escolhe", multa_pct: 2, juros_pct_mes: 1 });
  t("cliente escolhe + encargos: aceito", !escolhe.error);
  t("cliente escolhe com R$ 4,99: o BANCO recusa", !!(await inserirA({ forma_pagamento: "cliente_escolhe", valor_centavos: 499 })).error);
  t("só Pix com multa: o BANCO recusa (encargos só com boleto)", !!(await inserirA({ forma_pagamento: "pix", multa_pct: 2 })).error);
  t("multa acima de 10%: o BANCO recusa", !!(await inserirA({ forma_pagamento: "cliente_escolhe", multa_pct: 10.5 })).error);
  t("juros acima de 11%: o BANCO recusa", !!(await inserirA({ forma_pagamento: "cliente_escolhe", juros_pct_mes: 11.5 })).error);
  t("forma desconhecida: o BANCO recusa", !!(await inserirA({ forma_pagamento: "cartao" })).error);
  t("multa negativa: o BANCO recusa", !!(await inserirA({ forma_pagamento: "cliente_escolhe", multa_pct: -1 })).error);

  // negociar / reabrir (membro, via RLS)
  const neg = await A.sessao.from("cobrancas").update({ negociada_em: new Date().toISOString() }, { count: "exact" }).eq("id", padrao.data!.id).eq("empresa_id", A.empresaId);
  t("membro marca como negociada (coluna liberada)", !neg.error && neg.count === 1);
  const negB = await B.sessao.from("cobrancas").update({ negociada_em: new Date().toISOString() }, { count: "exact" }).eq("id", padrao.data!.id);
  t("OUTRA empresa não consegue negociar a cobrança alheia", negB.count === 0 || !!negB.error);

  // ações de recuperação
  const insAcao = (sessao: typeof A.sessao, empresaId: string, cobrancaId: string, userId: string, tipo = "whatsapp", regra: string | null = null) =>
    sessao.from("acoes_cobranca").insert({ empresa_id: empresaId, cobranca_id: cobrancaId, tipo, regra, usuario_id: userId }).select("id").single();
  const a1 = await insAcao(A.sessao, A.empresaId, padrao.data!.id, A.userId);
  t("membro registra 'WhatsApp aberto'", !a1.error);
  t("registra 'link copiado' e lembrete com regra", !(await insAcao(A.sessao, A.empresaId, padrao.data!.id, A.userId, "link_copiado")).error && !(await insAcao(A.sessao, A.empresaId, padrao.data!.id, A.userId, "lembrete_whatsapp", "no_dia")).error);
  t("tipo inválido é recusado", !!(await insAcao(A.sessao, A.empresaId, padrao.data!.id, A.userId, "enviou_sozinho")).error);
  t("regra inválida é recusada", !!(await insAcao(A.sessao, A.empresaId, padrao.data!.id, A.userId, "lembrete_whatsapp", "10d_depois")).error);
  t("OUTRA empresa não registra ação na cobrança de A (RLS/FK composta)", !!(await insAcao(B.sessao, B.empresaId, padrao.data!.id, B.userId)).error);
  t("nem declarando a empresa de A", !!(await insAcao(B.sessao, A.empresaId, padrao.data!.id, B.userId)).error);
  t("não dá para registrar em nome de outro usuário", !!(await insAcao(A.sessao, A.empresaId, padrao.data!.id, B.userId)).error);
  const veA = await A.sessao.from("acoes_cobranca").select("id").eq("cobranca_id", padrao.data!.id);
  const veB = await B.sessao.from("acoes_cobranca").select("id").eq("cobranca_id", padrao.data!.id);
  t("A vê as próprias ações; B não vê nenhuma de A", (veA.data ?? []).length === 3 && (veB.data ?? []).length === 0);
  const upd = await A.sessao.from("acoes_cobranca").update({ tipo: "negociada" }).eq("id", a1.data!.id).select("id");
  const del = await A.sessao.from("acoes_cobranca").delete().eq("id", a1.data!.id).select("id");
  t("registro é imutável: ninguém edita nem apaga pela API", (upd.data ?? []).length === 0 && (del.data ?? []).length === 0);
  const { count: aindaLa } = await admin.from("acoes_cobranca").select("*", { count: "exact", head: true }).eq("id", a1.data!.id);
  t("a ação continua lá depois da tentativa", aindaLa === 1);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const veAnon = await anon.from("acoes_cobranca").select("id").limit(5);
  t("sem login (anon) não lê nenhuma ação", (veAnon.data ?? []).length === 0);

  // preferências da empresa (dono)
  const pref = await A.sessao.from("empresas").update({ cobranca_forma_padrao: "cliente_escolhe", multa_padrao_pct: 2, juros_padrao_pct_mes: 1, lembrete_no_dia: true, canal_preferencial: "link" }, { count: "exact" }).eq("id", A.empresaId);
  t("dono salva as preferências da empresa", !pref.error && pref.count === 1);
  t("multa padrão 11%: o BANCO recusa", !!(await A.sessao.from("empresas").update({ multa_padrao_pct: 11 }).eq("id", A.empresaId)).error);
  t("juros padrão 12%: o BANCO recusa", !!(await A.sessao.from("empresas").update({ juros_padrao_pct_mes: 12 }).eq("id", A.empresaId)).error);
  t("forma padrão inválida: o BANCO recusa", !!(await A.sessao.from("empresas").update({ cobranca_forma_padrao: "boleto" }).eq("id", A.empresaId)).error);
  t("canal inválido: o BANCO recusa", !!(await A.sessao.from("empresas").update({ canal_preferencial: "sms" }).eq("id", A.empresaId)).error);
  const prefB = await B.sessao.from("empresas").update({ multa_padrao_pct: 5 }, { count: "exact" }).eq("id", A.empresaId);
  t("OUTRA empresa não altera as preferências de A", prefB.count === 0 || !!prefB.error);
  const lida = await A.sessao.from("empresas").select("cobranca_forma_padrao, multa_padrao_pct, lembrete_no_dia, canal_preferencial").eq("id", A.empresaId).single();
  t("as preferências voltam do banco como foram salvas", lida.data?.cobranca_forma_padrao === "cliente_escolhe" && Number(lida.data?.multa_padrao_pct) === 2 && lida.data?.lembrete_no_dia === true && lida.data?.canal_preferencial === "link");
  const lidaB = await B.sessao.from("empresas").select("cobranca_forma_padrao, multa_padrao_pct").eq("id", B.empresaId).single();
  t("a preferência de A não vaza para B (B segue no padrão)", lidaB.data?.cobranca_forma_padrao === "pix" && lidaB.data?.multa_padrao_pct === null);

  // mudar o padrão NÃO altera cobrança existente
  const { data: cobExistente } = await admin.from("cobrancas").select("forma_pagamento, multa_pct").eq("id", padrao.data!.id).single();
  t("mudar o padrão da empresa NÃO muda a cobrança que já existia", cobExistente?.forma_pagamento === "pix" && cobExistente?.multa_pct === null);

  /* ---------------- 9. sincronização com o Asaas (forma/encargos vêm do BANCO) ---------------- */
  console.log("\n9. Sincronização: forma e encargos vêm do banco:");
  await salvarCredencialDaEmpresa(A.empresaId, "chave_fake_teste_recuperacao");
  await admin.from("clientes").update({ asaas_customer_id: "cus_mock_a" }).eq("id", cliA);
  const vazio = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as never[] };
  const buscadorVazio = async () => ({ ok: true as const, data: { ...vazio } });

  let recebido: Parameters<CriadorDeCobrancaAsaas>[0] | null = null;
  const espiao: CriadorDeCobrancaAsaas = async (dados) => {
    recebido = dados;
    return { ok: true, data: { id: `pay_${Math.random().toString(36).slice(2, 8)}`, customer: dados.customer } as never };
  };

  const sEscolhe = await sincronizarCobrancaFinanceira(escolhe.data!.id, A.empresaId, null, espiao, buscadorVazio);
  const r1 = recebido as unknown as Parameters<CriadorDeCobrancaAsaas>[0];
  t("cliente escolhe: o Asaas recebe UNDEFINED com multa 2 e juros 1", sEscolhe.ok && r1.billingType === "UNDEFINED" && r1.multaPct === 2 && r1.jurosPctMes === 1);
  t("o valor enviado é o do banco, em centavos", r1.valorCentavos === 10000);

  const pix = await inserirA({ descricao: "So Pix" });
  const sPix = await sincronizarCobrancaFinanceira(pix.data!.id, A.empresaId, null, espiao, buscadorVazio);
  const r2 = recebido as unknown as Parameters<CriadorDeCobrancaAsaas>[0];
  t("só Pix: o Asaas recebe PIX sem encargos", sPix.ok && r2.billingType === "PIX" && !r2.multaPct && !r2.jurosPctMes);

  const escolhe2 = await inserirA({ descricao: "Ciclo automatico", forma_pagamento: "cliente_escolhe", multa_pct: 2, juros_pct_mes: 1 });
  const sAuto = await sincronizarCobrancaFinanceira(escolhe2.data!.id, A.empresaId, null, espiao, buscadorVazio, { pixAutomaticAuthorizationId: "auth_1" });
  const r3 = recebido as unknown as Parameters<CriadorDeCobrancaAsaas>[0];
  t("Pix Automático é SEMPRE Pix, mesmo que a linha diga o contrário", sAuto.ok && r3.billingType === "PIX" && !r3.multaPct && !r3.jurosPctMes);

  const antes = (recebido as unknown) as object;
  const sRepetida = await sincronizarCobrancaFinanceira(escolhe.data!.id, A.empresaId, null, espiao, buscadorVazio);
  t("idempotência: sincronizar de novo não cria outro payment", sRepetida.ok && sRepetida.dado.jaExistia === true && (recebido as unknown) === antes);

  // trava no banco: depois de enviada ao Asaas, forma/encargos não mudam (nem pela API)
  const mudaForma = await A.sessao.from("cobrancas").update({ forma_pagamento: "pix", multa_pct: null, juros_pct_mes: null }).eq("id", escolhe.data!.id).select("id");
  t("cobrança JÁ enviada ao Asaas: o BANCO recusa mudar forma/encargos", !!mudaForma.error);
  const mudaMulta = await A.sessao.from("cobrancas").update({ multa_pct: 5 }).eq("id", escolhe.data!.id).select("id");
  t("nem só a multa", !!mudaMulta.error);
  const editaTexto = await A.sessao.from("cobrancas").update({ descricao: "Descrição ajustada" }, { count: "exact" }).eq("id", escolhe.data!.id);
  t("mas a descrição continua editável", !editaTexto.error && editaTexto.count === 1);
  const negociaSincronizada = await A.sessao.from("cobrancas").update({ negociada_em: new Date().toISOString() }, { count: "exact" }).eq("id", escolhe.data!.id);
  t("e marcar como negociada continua possível", !negociaSincronizada.error && negociaSincronizada.count === 1);
  const novaSemEnvio = await inserirA({ descricao: "Ainda não enviada", forma_pagamento: "cliente_escolhe", multa_pct: 2 });
  const trocaAntes = await A.sessao.from("cobrancas").update({ forma_pagamento: "pix", multa_pct: null }, { count: "exact" }).eq("id", novaSemEnvio.data!.id);
  t("antes de enviar ao Asaas, forma e encargos ainda podem mudar", !trocaAntes.error && trocaAntes.count === 1);

  /* ---------------- 10. webhook: taxa do Zelo só em Pix ---------------- */
  console.log("\n10. Webhook: confirmação e taxa de R$ 1,99 só em Pix:");
  const conta = `acc_rec_${Date.now()}`;
  await admin.from("empresas").update({ asaas_account_id: conta, asaas_status: "ativa" }).eq("id", A.empresaId);

  const novaPaga = async (descricao: string) => {
    const c = await inserirA({ descricao, forma_pagamento: "cliente_escolhe" });
    return c.data!.id as string;
  };
  const evento = (cobId: string, pagoVia: "PIX" | "BOLETO" | "CREDIT_CARD" | undefined, id: string, valor = 100): AsaasWebhookPayload => ({
    id,
    event: "PAYMENT_RECEIVED",
    dateCreated: new Date().toISOString(),
    account: { id: conta },
    payment: {
      id: `pay_${id}`,
      customer: "cus_x",
      dateCreated: "2026-10-01",
      dueDate: "2026-10-01",
      value: valor,
      billingType: pagoVia as never,
      status: "RECEIVED",
      paymentDate: "2026-10-06T10:00:00Z",
      externalReference: cobId,
    },
  });
  const taxas = async (cobId: string) => (await admin.from("taxas_recebimento").select("id, status").eq("cobranca_id", cobId)).data ?? [];

  const cPix = await novaPaga("Pago por Pix");
  const rw1 = await processarEventoWebhook(evento(cPix, "PIX", `evt_pix_${Date.now()}`));
  const { data: lPix } = await admin.from("cobrancas").select("status, valor_pago_centavos, pago_via").eq("id", cPix).single();
  t("pago por Pix: cobrança fica paga (webhook é a fonte)", rw1.ok && lPix?.status === "paga" && lPix?.valor_pago_centavos === 10000 && lPix?.pago_via === "asaas");
  t("pago por Pix: nasce UMA taxa de R$ 1,99", (await taxas(cPix)).length === 1);

  const cBoleto = await novaPaga("Pago por boleto");
  const rw2 = await processarEventoWebhook(evento(cBoleto, "BOLETO", `evt_bol_${Date.now()}`, 102.33));
  const { data: lBol } = await admin.from("cobrancas").select("status, valor_pago_centavos").eq("id", cBoleto).single();
  t("pago por boleto (com encargos): fica paga com o valor REALMENTE pago", rw2.ok && lBol?.status === "paga" && lBol?.valor_pago_centavos === 10233);
  t("pago por boleto: NÃO há taxa do Zelo (a taxa é por Pix recebido)", (await taxas(cBoleto)).length === 0);

  const cCartao = await novaPaga("Pago por cartao");
  await processarEventoWebhook(evento(cCartao, "CREDIT_CARD", `evt_car_${Date.now()}`));
  t("pago por cartão: paga, sem taxa do Zelo", (await taxas(cCartao)).length === 0 && (await admin.from("cobrancas").select("status").eq("id", cCartao).single()).data?.status === "paga");

  const cLegado = await novaPaga("Payload antigo sem billingType");
  await processarEventoWebhook(evento(cLegado, undefined, `evt_leg_${Date.now()}`));
  t("payload sem billingType segue o comportamento de sempre (Pix): taxa registrada", (await taxas(cLegado)).length === 1);

  const evRepetido = evento(cPix, "PIX", `evt_pix_rep_${Date.now()}`);
  await processarEventoWebhook(evRepetido);
  await processarEventoWebhook(evRepetido);
  t("idempotência do webhook: reenvio não duplica a taxa", (await taxas(cPix)).length === 1);

  /* ---------------- limpeza ---------------- */
  console.log("\nLIMPEZA");
  await admin.from("taxas_recebimento").delete().in("empresa_id", empresas);
  await admin.from("webhook_eventos").delete().eq("account_id", conta).then(() => null, () => null);
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
  await admin.from("notificacoes").delete().in("empresa_id", empresas);
  await admin.from("cobrancas").delete().in("empresa_id", empresas);
  await admin.from("clientes").delete().in("empresa_id", empresas);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
  const { count } = await admin.from("empresas").select("*", { count: "exact", head: true }).in("id", empresas);
  t("banco limpo ao final", (count ?? 0) === 0);

  console.log(`\n=== ${ok} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error("\nERRO FATAL:", e);
  try {
    await admin.from("taxas_recebimento").delete().in("empresa_id", empresas);
    await admin.from("cobrancas").delete().in("empresa_id", empresas);
    await admin.from("clientes").delete().in("empresa_id", empresas);
    for (const id of usuarios) await admin.auth.admin.deleteUser(id);
  } catch {
    /* melhor esforço */
  }
  process.exit(1);
});
