/**
 * Criar cobrança → enviar para o cliente: e-mail seguro, estados, mensagens por
 * campo e passos da ativação. Sem chamar o provedor de pagamentos nem o de e-mail.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { templateCobrancaCliente } from "../lib/email/templates/cobranca-cliente";
import { templateAutorizacaoCliente } from "../lib/email/templates/autorizacao-cliente";
import { enderecoDeEmailValido, estadoDoEmailDoCliente, mascararEmail } from "../lib/email/estado";
import { COBRANCA_VAZIA, validarCobranca } from "../lib/cobranca";
import { contaComoContato, ROTULO_ACAO_COBRANCA, ehTipoDeAcao } from "../lib/recuperacao";
import { obterJornadaOnboarding } from "../lib/core/jornada-onboarding";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
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

async function run() {
  console.log("\n=== CRIAR → ENVIAR PARA O CLIENTE ===\n");

  console.log("1. E-mail da cobrança para o cliente:");
  const LINK = "https://sandbox.asaas.com/i/abc123";
  const e1 = templateCobrancaCliente({ nomeCliente: "João", nomeEmpresa: "Studio Zelo", valor: "R$ 380,00", vencimento: "05/11", situacao: "a_vencer", link: LINK });
  t("o link de pagamento está no botão e no texto", e1.html.includes(`href="${LINK}"`) && e1.text.includes(LINK));
  t("assunto: empresa e valor", e1.subject === "Cobrança de Studio Zelo: R$ 380,00");
  t("texto: saudação, valor e prazo", e1.text.includes("Olá, João.") && e1.text.includes("R$ 380,00") && e1.text.includes("vence em 05/11"));
  t("rodapé fala do cliente final (não 'da sua conta')", e1.html.includes("a pedido de Studio Zelo") && !e1.html.includes("na sua conta"));
  const e2 = templateCobrancaCliente({ nomeCliente: "Ana", nomeEmpresa: "Studio", valor: "R$ 10,00", vencimento: "01/10", situacao: "vencida", link: LINK });
  t("vencida: 'venceu em' e tom de atenção", e2.text.includes("venceu em 01/10") && e2.html.includes("#96702A"));
  const e3 = templateCobrancaCliente({ nomeCliente: "Bia", nomeEmpresa: "Studio", valor: "R$ 10,00", vencimento: "06/10", situacao: "vence_hoje", link: LINK });
  t("vence hoje: 'vence hoje'", e3.text.includes("vence hoje"));
  const mau = templateCobrancaCliente({ nomeCliente: '<img src=x onerror=alert(1)>', nomeEmpresa: "Loja\r\nBcc: alguem@x.com", valor: "R$ 1,00", vencimento: "01/01", situacao: "a_vencer", link: LINK });
  t("HTML do nome do cliente é escapado (sem injeção)", !mau.html.includes("<img src=x") && mau.html.includes("&lt;img"));
  t("assunto sem quebra de linha (sem injeção de cabeçalho)", !/[\r\n]/.test(mau.subject));
  t("o e-mail não leva CPF/CNPJ nem identificador interno", !/\d{3}\.\d{3}\.\d{3}-\d{2}|\b\d{11}\b|uuid|asaas_/i.test(e1.html + e1.text));
  const sem = templateCobrancaCliente({ nomeCliente: "", nomeEmpresa: "", valor: "R$ 5,00", vencimento: "01/01", situacao: "a_vencer", link: LINK });
  t("sem nome e sem empresa: saudação neutra e remetente genérico", sem.text.includes("Olá.") && sem.subject.includes("Seu prestador"));

  console.log("\n2. E-mail de autorização da cobrança automática:");
  const a1 = templateAutorizacaoCliente({ nomeCliente: "Maria", nomeEmpresa: "Studio Zelo", valor: "R$ 380,00", diaVencimento: 5, link: "https://www.zelopay.com.br/autorizar/abc" });
  t("link, valor e dia no texto; botão de autorizar", a1.text.includes("https://www.zelopay.com.br/autorizar/abc") && a1.text.includes("R$ 380,00 por mês, todo dia 5") && a1.html.includes("Autorizar cobrança automática"));
  t("assunto limpo", a1.subject === "Studio Zelo: autorize sua cobrança automática");
  const a2 = templateAutorizacaoCliente({ nomeCliente: "<b>x</b>", nomeEmpresa: "E\r\nBcc: y@z.com", valor: "R$ 1,00", diaVencimento: 1, link: "https://www.zelopay.com.br/autorizar/abc" });
  t("autorização: nome escapado e assunto sem quebra de linha", !a2.html.includes("<b>x</b>") && !/[\r\n]/.test(a2.subject));

  console.log("\n3. Disponibilidade do e-mail:");
  t("endereços válidos e inválidos", enderecoDeEmailValido("a@b.co") && !enderecoDeEmailValido("a@b") && !enderecoDeEmailValido("") && !enderecoDeEmailValido(null) && !enderecoDeEmailValido("a b@c.com"));
  t("mascarar: j***@gmail.com", mascararEmail("joao.silva@gmail.com") === "j***@gmail.com");
  const antes = { k: process.env.RESEND_API_KEY, f: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = "";
  process.env.EMAIL_FROM = "";
  t("sem e-mail do cliente: sem_email (mesmo configurado ou não)", estadoDoEmailDoCliente("") === "sem_email");
  t("provedor de e-mail não configurado: nao_configurado", estadoDoEmailDoCliente("a@b.com") === "nao_configurado");
  process.env.RESEND_API_KEY = "chave_fake";
  process.env.EMAIL_FROM = "Zelo <ola@exemplo.com>";
  t("configurado: disponivel", estadoDoEmailDoCliente("a@b.com") === "disponivel");
  process.env.RESEND_API_KEY = antes.k;
  process.env.EMAIL_FROM = antes.f;

  console.log("\n4. Erro no próprio campo (mensagens):");
  const vazio = validarCobranca({ ...COBRANCA_VAZIA, vence_em: "" }, "2026-10-06");
  t("cliente: 'Selecione um cliente.'", vazio.cliente_id === "Selecione um cliente.");
  t("descrição: 'Informe o que está sendo cobrado.'", vazio.descricao === "Informe o que está sendo cobrado.");
  t("valor: 'Informe um valor válido.'", vazio.valor === "Informe um valor válido.");
  t("vencimento: 'Informe uma data válida.'", vazio.vence_em === "Informe uma data válida.");
  t("data impossível também cai em 'Informe uma data válida.'", validarCobranca({ ...COBRANCA_VAZIA, cliente_id: "x", descricao: "ok", valor: "10", vence_em: "2026-13-45" }, "2026-10-06").vence_em === "Informe uma data válida.");
  t("um campo por vez: corrigir o valor não apaga os outros erros", (() => {
    const e = validarCobranca({ ...COBRANCA_VAZIA, valor: "10,00", vence_em: "2026-12-01" }, "2026-10-06");
    return !e.valor && !!e.cliente_id && !!e.descricao;
  })());

  console.log("\n5. Ações e rótulos:");
  t("'email' é uma ação conhecida, conta como contato e tem rótulo", ehTipoDeAcao("email") && contaComoContato("email") && ROTULO_ACAO_COBRANCA.email === "E-mail enviado");

  console.log("\n6. Banco: ação de e-mail, status e isolamento:");
  const email = `fluxo_${Date.now()}@zelo.test`;
  const { data: u } = await admin.auth.admin.createUser({ email, password: "senha_teste_fluxo_12345", email_confirm: true, user_metadata: { nome: "Empresa Fluxo" } });
  const userId = u.user!.id;
  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId).single();
  const empresaId = m!.empresa_id as string;
  await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", empresaId);
  const sessao = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await sessao.auth.signInWithPassword({ email, password: "senha_teste_fluxo_12345" });

  try {
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente Fluxo" }).select("id").single();
    const { data: cob } = await sessao.from("cobrancas").insert({ empresa_id: empresaId, cliente_id: cli!.id, descricao: "Teste", valor_centavos: 10000, vence_em: "2099-01-01" }).select("id").single();

    const jornada0 = await obterJornadaOnboarding(empresaId);
    const [p1, p2, p3] = jornada0.ativacaoRapida.passos;
    t("ativação rápida: 'Criar sua primeira cobrança' → 'Enviar para o cliente' → 'Acompanhar o pagamento'", p1.titulo === "Criar sua primeira cobrança" && p2.titulo === "Enviar para o cliente" && p3.titulo === "Acompanhar o pagamento");
    t("com a cobrança criada: passo 1 concluído, 2 e 3 pendentes", p1.concluido && !p2.concluido && !p3.concluido);
    t("o passo 'Enviar' leva direto à cobrança em aberto", p2.href === `/app/cobrancas/${cob!.id}`);
    t("o primeiro passo leva ao formulário simplificado", p1.href === "/app/cobrancas/nova");
    t("ter só o LINK de pagamento (sem enviar) NÃO conta como enviada", (await (async () => {
      await admin.from("cobrancas").update({ asaas_payment_id: "pay_x", asaas_sync_status: "sincronizado" }).eq("id", cob!.id);
      const j = await obterJornadaOnboarding(empresaId);
      return !j.ativacaoRapida.passos[1].concluido;
    })()));

    const acao = await sessao.from("acoes_cobranca").insert({ empresa_id: empresaId, cobranca_id: cob!.id, tipo: "email", usuario_id: userId }).select("id").single();
    t("o banco aceita a ação 'email' (membro, RLS)", !acao.error, acao.error?.message);
    const jornada1 = await obterJornadaOnboarding(empresaId);
    t("depois de enviar (e-mail/WhatsApp/link), o passo 'Enviar' conclui", jornada1.ativacaoRapida.passos[1].concluido);

    const enviada = await sessao.from("cobrancas").update({ status: "enviada" }, { count: "exact" }).eq("id", cob!.id).eq("status", "pendente");
    t("o e-mail enviado leva a cobrança de pendente para enviada", !enviada.error && enviada.count === 1);
    const naoVoltaPaga = await sessao.from("cobrancas").update({ status: "enviada" }, { count: "exact" }).eq("id", cob!.id).eq("status", "pendente");
    t("idempotente: não repete a transição", !naoVoltaPaga.error && naoVoltaPaga.count === 0);

    await admin.from("cobrancas").update({ status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 10000, pago_via: "asaas" }).eq("id", cob!.id);
    const jornada2 = await obterJornadaOnboarding(empresaId);
    t("pago pelo parceiro: ativação rápida completa", jornada2.ativacaoRapida.completa);
  } finally {
    await admin.from("cobrancas").delete().eq("empresa_id", empresaId);
    await admin.from("clientes").delete().eq("empresa_id", empresaId);
    await admin.auth.admin.deleteUser(userId);
  }

  console.log(`\n=== ${ok} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e);
  process.exit(1);
});
