/**
 * Planos + checkout + pagamento da assinatura — tabela oficial, estados,
 * Pix, conferência "Já paguei" e a regra "escolher plano ≠ pagamento confirmado".
 *
 * O provedor de pagamentos é simulado (fetch do sandbox interceptado): nada vai
 * à rede, nada é cobrado.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  FRASE_DO_PLANO,
  PLANOS_DA_TELA,
  RECURSOS_DOS_PLANOS,
  TEXTO_DO_ESTADO,
  comparacaoDosPlanos,
  estadoDoPagamento,
  mascararDocumento,
} from "../lib/checkout";
import {
  LIMITE_DE_CLIENTES,
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  TEXTO_TAXA,
} from "../lib/plano";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
process.env.ASAAS_ENV = "sandbox";
process.env.ASAAS_API_KEY = "chave_fake_checkout";
process.env.ASAAS_PLATFORM_ACCOUNT_ID = "acc_plataforma_teste_checkout";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
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

/* ---- provedor simulado ---- */
type Cobranca = { id: string; status: string; value: number; dueDate: string; invoiceUrl?: string; bankSlipUrl?: string | null; customer: string; subscription: string };
let cobrancas: Cobranca[] = [];
let pixDisponivel = true;
const chamadas: string[] = [];
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes("sandbox.asaas.com")) return fetchReal(url as never, init as never);
  chamadas.push(`${init?.method ?? "GET"} ${u.replace("https://sandbox.asaas.com/api/v3", "")}`);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
  if (/\/subscriptions\/[^/]+\/payments/.test(u)) return json({ object: "list", hasMore: false, totalCount: cobrancas.length, limit: 10, offset: 0, data: cobrancas });
  if (/\/payments\/[^/]+\/pixQrCode/.test(u)) {
    return pixDisponivel ? json({ encodedImage: "iVBORw0KGgo=", payload: "00020126580014br.gov.bcb.pix0136teste", expirationDate: "2027-01-01 23:59:59" }) : json({ errors: [] }, 400);
  }
  return json({}, 404);
}) as typeof fetch;

async function run() {
  console.log("\n=== PLANOS + CHECKOUT + PAGAMENTO ===\n");

  console.log("1. Tabela oficial (não alterada):");
  const nomes = PLANOS_DA_TELA.map((p) => NOME_DO_PLANO[p]);
  t("a vitrine tem EXATAMENTE três planos, na ordem: Essencial, Negócio, Escola", nomes.join(",") === "Essencial,Negócio,Escola");
  t("o Grátis NÃO está na vitrine (continua existindo no backend, para as contas que já estão nele)", !(PLANOS_DA_TELA as readonly string[]).includes("gratis") && PRECO_POR_PLANO_CENTAVOS.gratis === 0);
  t("preços: R$ 0 / 49,90 / 99,90 / 199,90", PRECO_POR_PLANO_CENTAVOS.gratis === 0 && PRECO_POR_PLANO_CENTAVOS.essencial === 4990 && PRECO_POR_PLANO_CENTAVOS.negocio === 9990 && PRECO_POR_PLANO_CENTAVOS.escola === 19990);
  t("limites: 10 / 50 / 200 / ilimitado", LIMITE_DE_CLIENTES.gratis === 10 && LIMITE_DE_CLIENTES.essencial === 50 && LIMITE_DE_CLIENTES.negocio === 200 && LIMITE_DE_CLIENTES.escola === null);
  t("taxa de R$ 1,99 por Pix recebido em todos", TAXA_DE_RECEBIMENTO_CENTAVOS === 199 && TEXTO_TAXA === "+ R$ 1,99 por Pix recebido");
  t("o Negócio é o destaque", PLANO_EM_DESTAQUE === "negocio");
  t("o plano de teste NÃO aparece nos planos da tela", !(PLANOS_DA_TELA as readonly string[]).includes("teste"));
  const textos = [...Object.values(FRASE_DO_PLANO), ...RECURSOS_DOS_PLANOS, ...nomes].join(" ");
  t("nenhum nome ou preço antigo, nenhum trial", !/profissional|premium|24,90|trial|30 dias|teste grátis/i.test(textos));

  console.log("\n2. Comparação curta e verdadeira:");
  const linhas = comparacaoDosPlanos();
  const clientes = linhas.find((l) => l.rotulo === "Clientes");
  t("a linha de clientes bate com os limites oficiais", JSON.stringify(clientes?.valores) === JSON.stringify(["Até 50", "Até 200", "Ilimitados"]));
  t("os recursos são iguais em todos os planos (não se promete diferença que não existe)", linhas.filter((l) => l.rotulo !== "Clientes").every((l) => l.valores.every((v) => v === true)));
  t("só recursos que existem hoje", linhas.map((l) => l.rotulo).join("|") === "Clientes|Recorrências|Recebimentos|WhatsApp em 1 clique|Recursos de gestão");

  console.log("\n3. Estados do pagamento (a regra de ouro):");
  t("PENDING sem confirmação do banco: aguardando", estadoDoPagamento({ statusProvedor: "PENDING", confirmadoNoBanco: false }) === "aguardando");
  t("RECEIVED mas o banco ainda NÃO confirmou: processando (nunca 'pago')", estadoDoPagamento({ statusProvedor: "RECEIVED", confirmadoNoBanco: false }) === "processando");
  t("CONFIRMED sem confirmação do banco: processando", estadoDoPagamento({ statusProvedor: "CONFIRMED", confirmadoNoBanco: false }) === "processando");
  t("em análise: processando", estadoDoPagamento({ statusProvedor: "AWAITING_RISK_ANALYSIS", confirmadoNoBanco: false }) === "processando");
  t("só 'pago' quando o BANCO confirmou", estadoDoPagamento({ statusProvedor: "RECEIVED", confirmadoNoBanco: true }) === "pago");
  t("o banco confirmou, o provedor diz outra coisa: o banco manda (pago)", estadoDoPagamento({ statusProvedor: "PENDING", confirmadoNoBanco: true }) === "pago");
  t("vencido: expirado; removido/estornado: cancelado; chargeback: falhou", estadoDoPagamento({ statusProvedor: "OVERDUE", confirmadoNoBanco: false }) === "expirado" && estadoDoPagamento({ statusProvedor: "DELETED", confirmadoNoBanco: false }) === "cancelado" && estadoDoPagamento({ statusProvedor: "REFUNDED", confirmadoNoBanco: false }) === "cancelado" && estadoDoPagamento({ statusProvedor: "CHARGEBACK_REQUESTED", confirmadoNoBanco: false }) === "falhou");
  t("status desconhecido/ausente cai em aguardando (nunca em pago)", estadoDoPagamento({ statusProvedor: undefined, confirmadoNoBanco: false }) === "aguardando" && estadoDoPagamento({ statusProvedor: "XYZ", confirmadoNoBanco: false }) === "aguardando");
  t("textos dos seis estados existem", (["aguardando", "processando", "pago", "falhou", "cancelado", "expirado"] as const).every((e) => TEXTO_DO_ESTADO[e].titulo.length > 5));
  t("'pago' diz 'Tudo certo!'; 'processando' NÃO diz 'confirmado'", TEXTO_DO_ESTADO.pago.titulo.startsWith("Tudo certo!") && !/pagamento confirmado/i.test(TEXTO_DO_ESTADO.processando.titulo + TEXTO_DO_ESTADO.processando.descricao));
  t("o texto de aguardar não diz que está pago", !/pago|confirmado!/i.test(TEXTO_DO_ESTADO.aguardando.titulo));

  console.log("\n4. Máscara do documento:");
  t("CPF progressivo", mascararDocumento("12345678909") === "123.456.789-09" && mascararDocumento("1234") === "123.4");
  t("CNPJ progressivo", mascararDocumento("11222333000181") === "11.222.333/0001-81");

  console.log("\n5. Pagamento da assinatura (provedor simulado):");
  const { obterPagamentoDaAssinatura, conferirPagamentoDaAssinatura } = await import("../lib/core/pagamento-assinatura");

  const email = `checkout_${Date.now()}@zelo.test`;
  const { data: u } = await admin.auth.admin.createUser({ email, password: "senha_teste_checkout_12345", email_confirm: true, user_metadata: { nome: "Empresa Checkout" } });
  const userId = u.user!.id;
  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId).single();
  const empresaId = m!.empresa_id as string;
  const SUB = `sub_checkout_${Date.now()}`;
  const CUS = `cus_checkout_${Date.now()}`;
  const PAY = `pay_checkout_${Date.now()}`;

  // outra empresa, para provar o isolamento
  const { data: u2 } = await admin.auth.admin.createUser({ email: `checkout2_${Date.now()}@zelo.test`, password: "senha_teste_checkout_12345", email_confirm: true });
  const { data: m2 } = await admin.from("membros").select("empresa_id").eq("user_id", u2.user!.id).single();
  const outraEmpresa = m2!.empresa_id as string;

  try {
    const sem = await obterPagamentoDaAssinatura(empresaId);
    t("sem assinatura: nenhum pagamento (e nada é consultado no provedor)", sem.ok && sem.pagamento === null && chamadas.length === 0);
    const semConf = await conferirPagamentoDaAssinatura(empresaId);
    t("sem assinatura: a conferência diz 'sem pagamento'", semConf.ok && semConf.estado === "sem_pagamento");

    await admin.from("empresas").update({ asaas_customer_id: CUS, asaas_subscription_id: SUB, plano_escolhido: "negocio", assinatura_status: "pendente" }).eq("id", empresaId);
    cobrancas = [{ id: PAY, status: "PENDING", value: 99.9, dueDate: "2026-10-06", invoiceUrl: "https://sandbox.asaas.com/i/abc123", bankSlipUrl: "https://sandbox.asaas.com/b/xyz789", customer: CUS, subscription: SUB }];

    const r1 = await obterPagamentoDaAssinatura(empresaId);
    const p1 = r1.ok ? r1.pagamento : null;
    t("pagamento em aberto: plano Negócio, R$ 99,90 (valor do PROVEDOR em centavos), aguardando", !!p1 && p1.plano === "negocio" && p1.valorCentavos === 9990 && p1.estado === "aguardando");
    t("Pix: QR Code (imagem) e 'copia e cola'", !!p1?.pix && p1.pix.payload.startsWith("00020126") && p1.pix.imagem === "iVBORw0KGgo=");
    t("link seguro e boleto só se forem do parceiro (https, asaas.com)", p1?.linkSeguro === "https://sandbox.asaas.com/i/abc123" && p1?.linkBoleto === "https://sandbox.asaas.com/b/xyz789");

    cobrancas[0].invoiceUrl = "https://evil.example.com/i/abc";
    cobrancas[0].bankSlipUrl = "http://sandbox.asaas.com/b/inseguro";
    const r1b = await obterPagamentoDaAssinatura(empresaId);
    t("link de outro domínio ou sem https vira null (nunca repassado)", r1b.ok && r1b.pagamento?.linkSeguro === null && r1b.pagamento?.linkBoleto === null);
    cobrancas[0].invoiceUrl = "https://sandbox.asaas.com/i/abc123";
    cobrancas[0].bankSlipUrl = null;

    pixDisponivel = false;
    const r1c = await obterPagamentoDaAssinatura(empresaId);
    t("sem Pix disponível: a tela recebe pix=null (e não inventa QR)", r1c.ok && r1c.pagamento?.pix === null && r1c.pagamento?.estado === "aguardando");
    pixDisponivel = true;

    t("o isolamento: outra empresa não vê esta assinatura", await (async () => {
      const r = await obterPagamentoDaAssinatura(outraEmpresa);
      return r.ok && r.pagamento === null;
    })());

    console.log("\n6. 'Já paguei — atualizar' NÃO ativa nada sozinho:");
    const antes = chamadas.length;
    const c1 = await conferirPagamentoDaAssinatura(empresaId);
    const { data: e1 } = await admin.from("empresas").select("assinatura_status, plano").eq("id", empresaId).single();
    t("provedor ainda PENDING: estado aguardando", c1.ok && c1.estado === "aguardando");
    t("e a conta CONTINUA pendente (clicar não ativa)", e1?.assinatura_status === "pendente");
    t("a conferência só PERGUNTA ao provedor (leitura)", chamadas.slice(antes).every((c) => c.startsWith("GET ")));

    // o provedor passa a dizer RECEBIDO, mas o webhook ainda não chegou
    cobrancas[0].status = "RECEIVED";
    const lido = await obterPagamentoDaAssinatura(empresaId);
    t("provedor RECEIVED sem conferência: a leitura mostra 'processando', não 'pago'", lido.ok && lido.pagamento?.estado === "processando");
    const { data: e2 } = await admin.from("empresas").select("assinatura_status").eq("id", empresaId).single();
    t("ler não ativa a conta", e2?.assinatura_status === "pendente");

    const c2 = await conferirPagamentoDaAssinatura(empresaId);
    const { data: e3 } = await admin.from("empresas").select("assinatura_status, plano").eq("id", empresaId).single();
    const { data: mensal } = await admin.from("mensalidades").select("status, valor_centavos, plano").eq("empresa_id", empresaId).eq("asaas_payment_id", PAY);
    t("conferência: o servidor confirma pelo MESMO caminho do webhook e ativa a conta", c2.ok && c2.estado === "pago" && e3?.assinatura_status === "ativa");
    t("a mensalidade foi paga UMA vez, no valor do provedor", (mensal ?? []).length === 1 && mensal![0].status === "paga" && mensal![0].valor_centavos === 9990);
    t("o plano passou a ser o escolhido (Negócio) só agora", e3?.plano === "negocio");

    const c3 = await conferirPagamentoDaAssinatura(empresaId);
    const { data: mensal2 } = await admin.from("mensalidades").select("id").eq("empresa_id", empresaId).eq("asaas_payment_id", PAY);
    t("idempotência: conferir de novo não duplica nada", c3.ok && c3.estado === "pago" && (mensal2 ?? []).length === 1);

    // o webhook REAL chega depois da conferência
    const { processarEventoWebhook } = await import("../lib/asaas/webhook");
    const real = await processarEventoWebhook({
      id: `evt_real_${Date.now()}`,
      event: "PAYMENT_RECEIVED",
      dateCreated: new Date().toISOString(),
      account: { id: "acc_plataforma_teste_checkout" },
      payment: cobrancas[0] as never,
    });
    const { data: mensal3 } = await admin.from("mensalidades").select("id").eq("empresa_id", empresaId).eq("asaas_payment_id", PAY);
    t("webhook real depois da conferência: aceito e sem duplicar a mensalidade", real.ok && (mensal3 ?? []).length === 1);

    console.log("\n7. Outros estados vindos do provedor:");
    await admin.from("empresas").update({ assinatura_status: "pendente" }).eq("id", empresaId);
    await admin.from("mensalidades").delete().eq("empresa_id", empresaId);
    for (const [status, esperado] of [["OVERDUE", "expirado"], ["DELETED", "cancelado"], ["REFUNDED", "cancelado"], ["PENDING", "aguardando"]] as const) {
      cobrancas[0].status = status;
      const r = await obterPagamentoDaAssinatura(empresaId);
      t(`provedor ${status} → ${esperado}`, r.ok && r.pagamento?.estado === esperado);
    }
    cobrancas[0].status = "DELETED";
    const cd = await conferirPagamentoDaAssinatura(empresaId);
    const { data: e4 } = await admin.from("empresas").select("assinatura_status").eq("id", empresaId).single();
    t("conferir com pagamento removido não ativa nada", cd.ok && cd.estado === "cancelado" && e4?.assinatura_status === "pendente");

    console.log("\n8. Falha do provedor: mensagem humana, nunca técnica:");
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("sandbox.asaas.com")) return new Response("boom", { status: 500 });
      return fetchReal(url as never, init as never);
    }) as typeof fetch;
    const falha = await obterPagamentoDaAssinatura(empresaId);
    t("provedor fora do ar: mensagem amigável, sem código nem JSON", !falha.ok && /Não conseguimos preparar o pagamento agora/.test(falha.mensagem) && !/500|json|asaas|boom/i.test(falha.mensagem));
  } finally {
    await admin.from("eventos_asaas").delete().eq("asaas_account_id", "acc_plataforma_teste_checkout");
    await admin.from("mensalidades").delete().in("empresa_id", [empresaId, outraEmpresa]);
    await admin.from("log_acoes_financeiras").delete().in("empresa_id", [empresaId, outraEmpresa]);
    await admin.from("notificacoes").delete().in("empresa_id", [empresaId, outraEmpresa]);
    await admin.auth.admin.deleteUser(userId);
    await admin.auth.admin.deleteUser(u2.user!.id);
  }

  console.log(`\n=== ${ok} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e);
  process.exit(1);
});
