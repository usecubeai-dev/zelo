/**
 * Lançamento comercial — mensalidade do Zelo, taxa de R$ 1,99 por
 * recebimento e comissão de influenciador (primeira mensalidade).
 *
 * Rodar:  npx tsx tools/teste-lancamento-comercial.ts
 *
 * O que é REAL e o que é SIMULADO (o relatório separa os dois):
 *  - REAL, banco de produção/dev compartilhado (mesmo padrão de todo
 *    tools/teste-*.ts): tabelas, funções SQL, RLS, grants, triggers de
 *    limite — nada é mockado. Os dados criados têm e-mail `@zelo.test` e
 *    são removidos no fim.
 *  - REAL, Asaas SANDBOX: o checkout (`iniciarAssinaturaZelo`) cria
 *    customer + assinatura mensal de verdade no sandbox e confere valor,
 *    ciclo e link de pagamento. O teste ABORTA se a chave não for de
 *    sandbox. O webhook do sandbox é pausado durante a execução (ele aponta
 *    para a URL pública) e religado no fim, e os objetos criados lá são
 *    removidos.
 *  - SIMULADO: a CONFIRMAÇÃO do pagamento. Nenhum pagamento real acontece;
 *    os eventos PAYMENT_* entram por `processarEventoWebhook`, exatamente
 *    como o endpoint os entrega.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((l) => {
    const c = l.trim();
    if (c.startsWith("#") || !c.includes("=")) return;
    const i = c.indexOf("=");
    process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });

const CONTA_PLATAFORMA = "acc_plataforma_teste_lancamento";
process.env.ASAAS_PLATFORM_ACCOUNT_ID = CONTA_PLATAFORMA;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const RUN = `lc${Date.now().toString(36)}`;
let passou = 0;
let falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

const usuarios: string[] = [];
const empresas: string[] = [];
const influenciadoresCriados: string[] = [];
const SENHA = "senha_teste_lancamento_12345";

function cpfValido(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  const dv = (base: number[]) => {
    const soma = base.reduce((s, d, i) => s + d * (base.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join("");
}

async function novaConta(rotulo: string, emailFixo?: string) {
  const email = emailFixo ?? `lc_${RUN}_${rotulo}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome: `LC ${rotulo}` } }),
  });
  const j = await r.json();
  const userId = (j.id || j.user?.id) as string;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login: ${error.message}`);
  return { userId, empresaId, email, sessao };
}

/** empresa já com customer/subscription "da plataforma" (ids fictícios, só para roteamento do webhook) */
async function prepararAssinante(empresaId: string, plano: string, status = "pendente") {
  const customerId = `cus_${RUN}_${empresaId.slice(0, 8)}`;
  const subscriptionId = `sub_${RUN}_${empresaId.slice(0, 8)}`;
  await admin
    .from("empresas")
    .update({ plano, assinatura_status: status, asaas_customer_id: customerId, asaas_subscription_id: subscriptionId })
    .eq("id", empresaId);
  return { customerId, subscriptionId };
}

let seq = 0;
const eid = (p: string) => `${RUN}_${p}_${++seq}`;

function eventoMensalidade(
  evtId: string,
  event: string,
  c: { customerId: string; subscriptionId: string },
  paymentId: string,
  valor: number,
  extra: Record<string, unknown> = {}
) {
  return {
    id: evtId,
    event,
    dateCreated: new Date().toISOString(),
    account: { id: CONTA_PLATAFORMA },
    payment: {
      id: paymentId,
      customer: c.customerId,
      subscription: c.subscriptionId,
      dateCreated: "2027-01-01",
      dueDate: "2027-01-05",
      paymentDate: "2027-01-05",
      value: valor,
      netValue: valor,
      billingType: "PIX",
      status: "RECEIVED",
      ...extra,
    },
  };
}

async function main() {
  const { PRECO_POR_PLANO_CENTAVOS, LIMITE_DE_CLIENTES, TAXA_DE_RECEBIMENTO_CENTAVOS, NOME_DO_PLANO, PLANO_EM_DESTAQUE, PLANOS_EM_ORDEM, precoDoPlano, planoPago, normalizarPlano, descricaoDoLimite, ehPlano } =
    await import("../lib/plano");
  const { processarEventoWebhook } = await import("../lib/asaas/webhook");
  const { criarInfluenciador, listarResumoInfluenciadores, listarComissoes, moverComissao, ehAdministradorZelo } =
    await import("../lib/core/influenciadores");
  const { vincularIndicacaoDoUsuario, vincularIndicacao, normalizarCodigo, linkDeIndicacao } = await import("../lib/core/indicacao");
  const { iniciarAssinaturaZelo, hojeEmSaoPaulo } = await import("../lib/core/assinatura-zelo");
  const { eventoMensalidadeDoWebhook, registrarMensalidade } = await import("../lib/core/mensalidade");
  const { taxaPorRecebimentoCentavos } = await import("../lib/core/taxa-recebimento");

  console.log("\n=== LANÇAMENTO COMERCIAL — mensalidade, taxa R$1,99, indicação e comissão ===\n");

  // ------------------------------------------------------------------
  console.log("PLANOS — preço e limites (fonte única, servidor)");
  {
    t("Grátis = 0 centavos / 10 clientes", PRECO_POR_PLANO_CENTAVOS.gratis === 0 && LIMITE_DE_CLIENTES.gratis === 10);
    t("Essencial = 4990 centavos / 50 clientes", PRECO_POR_PLANO_CENTAVOS.essencial === 4990 && LIMITE_DE_CLIENTES.essencial === 50);
    t("Negócio = 9990 centavos / 200 clientes", PRECO_POR_PLANO_CENTAVOS.negocio === 9990 && LIMITE_DE_CLIENTES.negocio === 200);
    t("Escola = 19990 centavos / ILIMITADO (null, sem número artificial)", PRECO_POR_PLANO_CENTAVOS.escola === 19990 && LIMITE_DE_CLIENTES.escola === null);
    t("precoDoPlano() lê do mesmo mapa", precoDoPlano("negocio") === 9990 && precoDoPlano("escola") === 19990);
    t("ordem de exibição: Grátis, Essencial, Negócio, Escola", PLANOS_EM_ORDEM.join(",") === "gratis,essencial,negocio,escola");
    t("exatamente quatro planos", PLANOS_EM_ORDEM.length === 4 && Object.keys(PRECO_POR_PLANO_CENTAVOS).length === 4);
    t("nomes oficiais", NOME_DO_PLANO.gratis === "Grátis" && NOME_DO_PLANO.essencial === "Essencial" && NOME_DO_PLANO.negocio === "Negócio" && NOME_DO_PLANO.escola === "Escola");
    t("Negócio é o 'Mais escolhido'", PLANO_EM_DESTAQUE === "negocio");
    t("só o Grátis não tem mensalidade", !planoPago("gratis") && planoPago("essencial") && planoPago("negocio") && planoPago("escola"));
    t("descrição do limite: 'Clientes ilimitados' só na Escola, sem número", descricaoDoLimite("escola") === "Clientes ilimitados" && descricaoDoLimite("gratis") === "Até 10 clientes" && descricaoDoLimite("negocio") === "Até 200 clientes");
    t("taxa = 199 centavos por Pix recebido, igual em todos os planos (não é mensalidade)", TAXA_DE_RECEBIMENTO_CENTAVOS === 199 && taxaPorRecebimentoCentavos() === 199);
    t("identificadores antigos: ehPlano recusa (não são escolhíveis), normalizarPlano traduz", !ehPlano("profissional") && !ehPlano("premium") && normalizarPlano("profissional") === "negocio" && normalizarPlano("premium") === "escola" && normalizarPlano("lixo") === null);

    // o banco IMPÕE os limites — precisam bater com o TS
    for (const plano of PLANOS_EM_ORDEM) {
      const a = await admin.rpc("limite_de_clientes", { p_plano: plano });
      t(`banco impõe ${plano}: ${LIMITE_DE_CLIENTES[plano] ?? "ilimitado (NULL)"}`, a.data === LIMITE_DE_CLIENTES[plano]);
    }
  }

  // ------------------------------------------------------------------
  console.log("\nEVENTOS — o que muda mensalidade e o que não muda");
  {
    t("PAYMENT_CONFIRMED/RECEIVED → paga", eventoMensalidadeDoWebhook("PAYMENT_CONFIRMED") === "paga" && eventoMensalidadeDoWebhook("PAYMENT_RECEIVED") === "paga");
    t("PAYMENT_OVERDUE → vencida", eventoMensalidadeDoWebhook("PAYMENT_OVERDUE") === "vencida");
    t("PAYMENT_DELETED → cancelada, PAYMENT_REFUNDED → estornada", eventoMensalidadeDoWebhook("PAYMENT_DELETED") === "cancelada" && eventoMensalidadeDoWebhook("PAYMENT_REFUNDED") === "estornada");
    t("evento irrelevante é ignorado (null)", eventoMensalidadeDoWebhook("PAYMENT_UPDATED") === null);
    t("código de indicação: normaliza e rejeita lixo", normalizarCodigo(" ab12cd ") === "AB12CD" && normalizarCodigo("a b") === null && normalizarCodigo("<script>") === null && normalizarCodigo("AB1") === null && normalizarCodigo(undefined) === null);
    t("link de indicação aponta para /criar-conta?ref=", linkDeIndicacao("ABCD1234", "https://x.test").endsWith("/criar-conta?ref=ABCD1234"));
  }

  // ------------------------------------------------------------------
  console.log("\nCHECKOUT — validações antes de qualquer chamada ao Asaas");
  {
    const dono = await novaConta("checkout-valid");
    const base = { empresaId: dono.empresaId, userId: dono.userId, papel: "dono", email: dono.email, documento: cpfValido() };

    const r1 = await iniciarAssinaturaZelo({ ...base, plano: "plano_inexistente" });
    t("plano inválido é recusado (o preço nunca vem do cliente)", !r1.ok && r1.codigo === "plano_invalido");
    const r2 = await iniciarAssinaturaZelo({ ...base, plano: "essencial", papel: "membro" });
    t("quem não é o dono da conta não assina", !r2.ok && r2.codigo === "sem_permissao");
    const r3 = await iniciarAssinaturaZelo({ ...base, plano: "essencial", documento: "123" });
    t("CPF/CNPJ inválido é recusado", !r3.ok && r3.codigo === "documento_invalido");

    await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", dono.empresaId);
    const r4 = await iniciarAssinaturaZelo({ ...base, plano: "essencial" });
    t("assinatura já ativa não gera segunda cobrança", !r4.ok && r4.codigo === "ja_ativa");
    const { data: nada } = await admin.from("empresas").select("asaas_subscription_id").eq("id", dono.empresaId).single();
    t("nada foi criado no provedor nesses casos", nada?.asaas_subscription_id === null);
    t("data de vencimento usa o dia de São Paulo (YYYY-MM-DD)", /^\d{4}-\d{2}-\d{2}$/.test(hojeEmSaoPaulo()));
  }

  // ------------------------------------------------------------------
  console.log("\nCHECKOUT REAL — Asaas SANDBOX (customer + assinatura mensal)");
  const chave = process.env.ASAAS_API_KEY ?? "";
  const ehSandbox = process.env.ASAAS_ENV === "sandbox" && chave.includes("_hmlg_");
  t("guarda: ambiente é SANDBOX (senão o teste não chama o Asaas)", ehSandbox);
  if (ehSandbox) {
    const H = { access_token: chave, "Content-Type": "application/json", UserAgent: "Zelo/1.0" };
    const SB = "https://sandbox.asaas.com/api/v3";
    const listaW = (await (await fetch(`${SB}/webhooks`, { headers: H })).json()) as { data?: { id: string; enabled: boolean }[] };
    const webhooksAtivos = (listaW.data ?? []).filter((w) => w.enabled);
    const mudarWebhooks = async (enabled: boolean) => {
      for (const w of webhooksAtivos) {
        await fetch(`${SB}/webhooks/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ enabled }) });
      }
    };
    await mudarWebhooks(false);
    let subId: string | null = null;
    let cusId: string | null = null;
    try {
      const dono = await novaConta("checkout-real");
      const cpf = cpfValido();
      const antes = await admin.from("empresas").select("assinatura_status").eq("id", dono.empresaId).single();

      const r = await iniciarAssinaturaZelo({
        empresaId: dono.empresaId,
        userId: dono.userId,
        papel: "dono",
        email: dono.email,
        plano: "negocio",
        documento: cpf,
      });
      t("checkout devolve sucesso", r.ok, r.ok ? "" : `${r.codigo}: ${r.mensagem}`);

      if (r.ok) {
        t("valor cobrado = preço do servidor (R$ 99,90)", r.valorCentavos === 9990);
        t("link de pagamento do Asaas devolvido", typeof r.linkPagamento === "string" && r.linkPagamento.startsWith("https://"), String(r.linkPagamento));

        const { data: e } = await admin
          .from("empresas")
          .select("plano, plano_escolhido, assinatura_status, asaas_customer_id, asaas_subscription_id, documento")
          .eq("id", dono.empresaId)
          .single();
        subId = e?.asaas_subscription_id ?? null;
        cusId = e?.asaas_customer_id ?? null;
        t("plano ESCOLHIDO gravado = negocio, mas o plano VIGENTE não mudou (só muda com pagamento confirmado)", e?.plano_escolhido === "negocio" && e?.plano !== "negocio");
        t("customer e assinatura vinculados à empresa", Boolean(e?.asaas_customer_id && e?.asaas_subscription_id));
        t("NÃO virou 'ativa' só por ter escolhido plano (continua como estava)", e?.assinatura_status === antes.data?.assinatura_status && e?.assinatura_status !== "ativa");
        t("documento salvo só com dígitos", e?.documento === cpf);

        if (subId) {
          const sub = (await (await fetch(`${SB}/subscriptions/${subId}`, { headers: H })).json()) as { value: number; cycle: string; billingType: string; status: string; externalReference: string };
          t("no Asaas: valor 99.9, ciclo MONTHLY, ACTIVE", sub.value === 99.9 && sub.cycle === "MONTHLY" && sub.status === "ACTIVE", JSON.stringify({ v: sub.value, c: sub.cycle, s: sub.status }));
          t("no Asaas: quem paga escolhe a forma (UNDEFINED) e externalReference = empresa", sub.billingType === "UNDEFINED" && sub.externalReference === dono.empresaId);
        }

        const { data: mens } = await admin.from("mensalidades").select("status, valor_centavos, plano, ambiente, eh_primeira").eq("empresa_id", dono.empresaId);
        t("1ª cobrança registrada como PENDENTE de R$ 99,90 (ambiente sandbox)", mens?.length === 1 && mens[0].status === "pendente" && mens[0].valor_centavos === 9990 && mens[0].ambiente === "sandbox" && mens[0].eh_primeira === false);

        // mesma escolha de novo: reaproveita, não cria segunda assinatura
        const r2 = await iniciarAssinaturaZelo({ empresaId: dono.empresaId, userId: dono.userId, papel: "dono", email: dono.email, plano: "negocio", documento: cpf });
        const { data: e2 } = await admin.from("empresas").select("asaas_subscription_id").eq("id", dono.empresaId).single();
        t("repetir o mesmo plano reaproveita a assinatura (sem cobrança duplicada)", r2.ok && r2.jaExistia && e2?.asaas_subscription_id === subId);

        // O pagamento: SIMULADO (nenhum dinheiro real). Evento com os ids REAIS do sandbox.
        const { data: m1 } = await admin.from("mensalidades").select("asaas_payment_id").eq("empresa_id", dono.empresaId).single();
        const ev = eventoMensalidade(eid("co"), "PAYMENT_CONFIRMED", { customerId: cusId!, subscriptionId: subId! }, m1!.asaas_payment_id, 99.9);
        const w = await processarEventoWebhook(ev as never);
        t("webhook de confirmação (simulado, ids reais) é aceito", w.ok);
        const { data: depois } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido").eq("id", dono.empresaId).single();
        t("SÓ AGORA a assinatura vira 'ativa' (confirmação de pagamento)", depois?.assinatura_status === "ativa");
        t("…e SÓ AGORA o plano escolhido passa a valer (Negócio, 200 clientes)", depois?.plano === "negocio" && depois?.plano_escolhido === null);

        // trocar de plano com cobrança em aberto: nova assinatura e a antiga é removida
      }

      const { data: empresaTroca } = await admin.from("empresas").select("id").eq("id", dono.empresaId).single();
      void empresaTroca;
    } finally {
      if (subId) await fetch(`${SB}/subscriptions/${subId}`, { method: "DELETE", headers: H });
      if (cusId) await fetch(`${SB}/customers/${cusId}`, { method: "DELETE", headers: H });
      await mudarWebhooks(true);
    }

    // troca de plano antes de pagar — outra conta, sandbox real
    await mudarWebhooks(false);
    let subA: string | null = null;
    let subB: string | null = null;
    let cus2: string | null = null;
    try {
      const dono = await novaConta("troca-plano");
      const cpf = cpfValido();
      const a = await iniciarAssinaturaZelo({ empresaId: dono.empresaId, userId: dono.userId, papel: "dono", email: dono.email, plano: "essencial", documento: cpf });
      const { data: ea } = await admin.from("empresas").select("asaas_subscription_id, asaas_customer_id").eq("id", dono.empresaId).single();
      subA = ea?.asaas_subscription_id ?? null;
      cus2 = ea?.asaas_customer_id ?? null;
      const b = await iniciarAssinaturaZelo({ empresaId: dono.empresaId, userId: dono.userId, papel: "dono", email: dono.email, plano: "escola", documento: cpf });
      const { data: eb } = await admin.from("empresas").select("asaas_subscription_id, plano, plano_escolhido").eq("id", dono.empresaId).single();
      subB = eb?.asaas_subscription_id ?? null;
      t("trocar de plano antes de pagar cria nova assinatura (escolhido = escola, vigente intacto)", a.ok && b.ok && subA !== subB && eb?.plano_escolhido === "escola" && eb?.plano !== "escola");
      t("nova cobrança de Escola = R$ 199,90", b.ok && b.valorCentavos === 19990);
      if (subA) {
        const velha = await fetch(`${SB}/subscriptions/${subA}`, { headers: H });
        const jv = (await velha.json()) as { deleted?: boolean; status?: string };
        t("assinatura anterior removida no Asaas (sem cobrança dupla)", velha.status === 404 || jv.deleted === true || jv.status === "INACTIVE", String(velha.status));
      }
    } finally {
      if (subB) await fetch(`${SB}/subscriptions/${subB}`, { method: "DELETE", headers: H });
      if (cus2) await fetch(`${SB}/customers/${cus2}`, { method: "DELETE", headers: H });
      await mudarWebhooks(true);
    }
  }

  // ------------------------------------------------------------------
  console.log("\nINDICAÇÃO — rastreio, vínculo e proteções");
  // o termo de parceria assinado é o que ativa o influenciador (sem a data ele nasce inativo)
  const TERMO = new Date().toISOString().slice(0, 10);
  const infA = await criarInfluenciador({ nome: "Influenciador A", email: `inf_${RUN}_a@zelo.test`, termoAssinadoEm: TERMO });
  t("influenciador criado com código único", infA.ok && /^[A-Z0-9]{8}$/.test(infA.influenciador.codigo));
  if (!infA.ok) throw new Error("sem influenciador");
  influenciadoresCriados.push(infA.influenciador.id);
  const CODIGO = infA.influenciador.codigo;

  {
    const dup = await criarInfluenciador({ nome: "Outro", codigo: CODIGO });
    t("código duplicado é recusado", !dup.ok);
    const ruim = await criarInfluenciador({ nome: "Outro", codigo: "a b!" });
    t("código com caractere inválido é recusado", !ruim.ok);
    const semNome = await criarInfluenciador({ nome: " " });
    t("nome vazio é recusado", !semNome.ok);

    const vazio = (await listarResumoInfluenciadores()).find((i) => i.id === infA.influenciador.id);
    t("influenciador sem cliente: 0 indicações, 0 convertidos, R$ 0 em comissão", vazio?.indicacoes === 0 && vazio?.convertidos === 0 && vazio?.pendenteCentavos === 0 && vazio?.disponivelCentavos === 0 && vazio?.pagoCentavos === 0);

    const contaA = await novaConta("indicada-A");
    const v1 = await vincularIndicacaoDoUsuario({ userId: contaA.userId, email: contaA.email, metadataRef: CODIGO, cookieRef: undefined });
    t("cadastro com ref no metadata vincula a empresa ao influenciador", v1 === "vinculada");
    const v2 = await vincularIndicacaoDoUsuario({ userId: contaA.userId, email: contaA.email, metadataRef: undefined, cookieRef: CODIGO });
    t("vincular de novo é idempotente (ja_vinculada)", v2 === "ja_vinculada");
    const { count: nInd } = await admin.from("indicacoes").select("id", { count: "exact", head: true }).eq("empresa_id", contaA.empresaId);
    t("uma única indicação gravada para a empresa", nInd === 1);

    const contaCookie = await novaConta("indicada-cookie");
    const v3 = await vincularIndicacaoDoUsuario({ userId: contaCookie.userId, email: contaCookie.email, metadataRef: undefined, cookieRef: CODIGO });
    t("só o cookie (sem metadata) também vincula", v3 === "vinculada");

    const contaRuim = await novaConta("codigo-invalido");
    const v4 = await vincularIndicacaoDoUsuario({ userId: contaRuim.userId, email: contaRuim.email, metadataRef: "NAOEXISTE9", cookieRef: undefined });
    t("código inexistente não vincula (e não quebra o cadastro)", v4 === "codigo_invalido");
    const v5 = await vincularIndicacaoDoUsuario({ userId: contaRuim.userId, email: contaRuim.email, metadataRef: undefined, cookieRef: undefined });
    t("sem código nenhum: nada a fazer", v5 === "sem_codigo");

    // influenciador não indica a própria conta
    const emailProprio = `inf_${RUN}_proprio@zelo.test`;
    const contaProp = await novaConta("auto", emailProprio);
    const infProp = await criarInfluenciador({ nome: "Influenciador Próprio", email: emailProprio, termoAssinadoEm: TERMO });
    if (infProp.ok) influenciadoresCriados.push(infProp.influenciador.id);
    const v6 = infProp.ok
      ? await vincularIndicacaoDoUsuario({ userId: contaProp.userId, email: contaProp.email, metadataRef: infProp.influenciador.codigo, cookieRef: undefined })
      : "erro";
    t("BLOQUEADO — influenciador não indica a própria conta", v6 === "autoindicacao");

    // inativo não recebe indicação nova
    const infInativo = await criarInfluenciador({ nome: "Influenciador Inativo", termoAssinadoEm: TERMO });
    if (infInativo.ok) {
      influenciadoresCriados.push(infInativo.influenciador.id);
      await admin.from("influenciadores").update({ status: "inativo" }).eq("id", infInativo.influenciador.id);
      const contaI = await novaConta("para-inativo");
      const v7 = await vincularIndicacaoDoUsuario({ userId: contaI.userId, email: contaI.email, metadataRef: infInativo.influenciador.codigo, cookieRef: undefined });
      t("influenciador inativo não recebe novas indicações", v7 === "codigo_invalido");
    }
  }

  // ------------------------------------------------------------------
  console.log("\nMENSALIDADE + COMISSÃO — fluxo completo da conta indicada (webhook)");
  const contaPaga = await novaConta("indicada-paga");
  await vincularIndicacao({ empresaId: contaPaga.empresaId, userId: contaPaga.userId, email: contaPaga.email, codigo: CODIGO });
  const idsPaga = await prepararAssinante(contaPaga.empresaId, "negocio", "pendente");
  const pay1 = `pay_${RUN}_p1`;
  const pay2 = `pay_${RUN}_p2`;
  {
    const lerEmpresa = async () => (await admin.from("empresas").select("assinatura_status").eq("id", contaPaga.empresaId).single()).data;
    const comissoes = async () => (await admin.from("comissoes").select("*").eq("empresa_id", contaPaga.empresaId)).data ?? [];
    const mensalidades = async () => (await admin.from("mensalidades").select("*").eq("empresa_id", contaPaga.empresaId).order("criada_em")).data ?? [];

    // pendente: não pode criar cliente
    const { error: eBloq } = await contaPaga.sessao.from("clientes").insert({ empresa_id: contaPaga.empresaId, nome: "Antes de pagar" });
    t("BLOQUEADO — conta pendente não cria cliente (pagante só depois de pagar)", Boolean(eBloq));

    const rCriada = await processarEventoWebhook(eventoMensalidade(eid("pg"), "PAYMENT_CREATED", idsPaga, pay1, 99.9, { status: "PENDING" }) as never);
    t("PAYMENT_CREATED registra a cobrança como pendente", rCriada.ok && (await mensalidades())[0]?.status === "pendente");
    t("cobrança criada NÃO ativa a assinatura nem gera comissão", (await lerEmpresa())?.assinatura_status === "pendente" && (await comissoes()).length === 0);

    const evConf = eventoMensalidade(eid("pg"), "PAYMENT_CONFIRMED", idsPaga, pay1, 99.9);
    const rConf = await processarEventoWebhook(evConf as never);
    t("PAYMENT_CONFIRMED aceito", rConf.ok);
    t("assinatura vira 'ativa' com o pagamento confirmado", (await lerEmpresa())?.assinatura_status === "ativa");

    const m1 = (await mensalidades())[0];
    t("mensalidade marcada paga, R$ 99,90, primeira", m1?.status === "paga" && m1?.valor_pago_centavos === 9990 && m1?.eh_primeira === true);
    const c1 = await comissoes();
    t("comissão criada = 100% da primeira mensalidade (R$ 99,90)", c1.length === 1 && c1[0].valor_centavos === 9990);
    t("comissão nasce PENDENTE, ligada ao influenciador, plano e mensalidade", c1[0]?.status === "pendente" && c1[0]?.influenciador_id === infA.influenciador.id && c1[0]?.plano === "negocio" && c1[0]?.mensalidade_id === m1?.id);
    const { data: ind } = await admin.from("indicacoes").select("convertida_em").eq("empresa_id", contaPaga.empresaId).single();
    t("indicação marcada como convertida", Boolean(ind?.convertida_em));

    const { data: logC } = await admin.from("log_acoes_financeiras").select("id").eq("empresa_id", contaPaga.empresaId).eq("acao", "comissao_influenciador_criada");
    t("auditoria da comissão registrada", (logC?.length ?? 0) === 1);

    // agora liberada: consegue criar cliente
    const { error: eLib } = await contaPaga.sessao.from("clientes").insert({ empresa_id: contaPaga.empresaId, nome: "Depois de pagar" });
    t("depois do pagamento confirmado a conta cria cliente (liberada)", !eLib, eLib?.message);

    // webhooks repetidos
    const rDup = await processarEventoWebhook(evConf as never);
    t("reenvio do MESMO evento é idempotente", rDup.ok && (rDup as { idempotente?: boolean }).idempotente === true);
    const rRec = await processarEventoWebhook(eventoMensalidade(eid("pg"), "PAYMENT_RECEIVED", idsPaga, pay1, 99.9) as never);
    t("PAYMENT_RECEIVED do mesmo pagamento (outro evento) é aceito", rRec.ok);
    t("…e NÃO duplica mensalidade nem comissão", (await mensalidades()).length === 1 && (await comissoes()).length === 1);

    // segundo mês
    await processarEventoWebhook(eventoMensalidade(eid("pg"), "PAYMENT_CREATED", idsPaga, pay2, 99.9, { status: "PENDING" }) as never);
    const rSeg = await processarEventoWebhook(eventoMensalidade(eid("pg"), "PAYMENT_CONFIRMED", idsPaga, pay2, 99.9) as never);
    const ms = await mensalidades();
    t("segunda mensalidade registrada como paga", rSeg.ok && ms.length === 2 && ms[1].status === "paga");
    t("segunda mensalidade NÃO é 'primeira' e NÃO gera nova comissão", ms[1].eh_primeira === false && (await comissoes()).length === 1);

    // resumo do influenciador: sandbox não entra na soma devida
    const resumo = (await listarResumoInfluenciadores()).find((i) => i.id === infA.influenciador.id);
    t("resumo: 2 indicações do código A (uma convertida)", (resumo?.indicacoes ?? 0) >= 2 && resumo?.convertidos === 1);
    t("resumo: comissão de TESTE (sandbox) não entra no total pendente real", resumo?.pendenteCentavos === 0);
    const lista = await listarComissoes();
    const linha = lista.find((l) => l.id === c1[0].id);
    t("lista de comissões traz influenciador, cliente e ambiente 'sandbox'", linha?.influenciadorNome === "Influenciador A" && linha?.ambiente === "sandbox" && Boolean(linha?.empresaNome));

    // estorno da primeira antes de pagar o influenciador
    await processarEventoWebhook(eventoMensalidade(eid("pg"), "PAYMENT_REFUNDED", idsPaga, pay1, 99.9, { status: "REFUNDED" }) as never);
    const apos = await comissoes();
    t("pagamento estornado: mensalidade vira 'estornada'", (await mensalidades())[0].status === "estornada");
    t("pagamento estornado antes de pagar o influenciador: comissão CANCELADA (histórico mantido)", apos.length === 1 && apos[0].status === "cancelada" && Boolean(apos[0].cancelada_em));
  }

  // ------------------------------------------------------------------
  console.log("\nCOMISSÃO — administração (liberar → paga, nunca apaga)");
  {
    const c = await novaConta("comissao-admin");
    await vincularIndicacao({ empresaId: c.empresaId, userId: c.userId, email: c.email, codigo: CODIGO });
    const ids = await prepararAssinante(c.empresaId, "essencial", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("ad"), "PAYMENT_CONFIRMED", ids, `pay_${RUN}_ad1`, 49.9) as never);
    const { data: com } = await admin.from("comissoes").select("*").eq("empresa_id", c.empresaId).single();
    t("Essencial: comissão = R$ 49,90", com?.valor_centavos === 4990);

    const adm = (await novaConta("quem-paga")).userId;
    const pagarCedo = await moverComissao(com!.id, "pagar", adm, "tentativa");
    t("BLOQUEADO — não paga comissão que ainda não foi liberada", !pagarCedo.ok);
    const liberar = await moverComissao(com!.id, "liberar", adm);
    t("pendente → disponível", liberar.ok);
    const liberarDeNovo = await moverComissao(com!.id, "liberar", adm);
    t("BLOQUEADO — liberar duas vezes", !liberarDeNovo.ok);
    const pagar = await moverComissao(com!.id, "pagar", adm, "Pix manual feito pelo financeiro");
    t("disponível → paga", pagar.ok);
    const { data: paga } = await admin.from("comissoes").select("*").eq("id", com!.id).single();
    t("paga: registra data, quem pagou, valor e observação", paga?.status === "paga" && Boolean(paga?.paga_em) && paga?.paga_por === adm && paga?.valor_centavos === 4990 && paga?.observacao === "Pix manual feito pelo financeiro");
    const cancelarPaga = await moverComissao(com!.id, "cancelar", adm);
    t("BLOQUEADO — comissão paga não pode ser cancelada (histórico imutável)", !cancelarPaga.ok);

    // estorno DEPOIS de já ter pago o influenciador: não some, fica sinalizado
    await processarEventoWebhook(eventoMensalidade(eid("ad"), "PAYMENT_REFUNDED", ids, `pay_${RUN}_ad1`, 49.9, { status: "REFUNDED" }) as never);
    const { data: aposEstorno } = await admin.from("comissoes").select("status, estorno_apos_pagamento").eq("id", com!.id).single();
    t("estorno após pagar o influenciador: continua 'paga', mas sinalizada para o admin", aposEstorno?.status === "paga" && aposEstorno?.estorno_apos_pagamento === true);

    const acaoRuim = await moverComissao(com!.id, "inventada" as never, adm);
    t("ação inventada é recusada", !acaoRuim.ok);

    // cancelar pendente
    const c2 = await novaConta("comissao-cancel");
    await vincularIndicacao({ empresaId: c2.empresaId, userId: c2.userId, email: c2.email, codigo: CODIGO });
    const ids2 = await prepararAssinante(c2.empresaId, "escola", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("ad"), "PAYMENT_CONFIRMED", ids2, `pay_${RUN}_ad2`, 199.9) as never);
    const { data: com2 } = await admin.from("comissoes").select("id, valor_centavos").eq("empresa_id", c2.empresaId).single();
    t("Escola: comissão = R$ 199,90", com2?.valor_centavos === 19990);
    const canc = await moverComissao(com2!.id, "cancelar", adm, "fraude suspeita");
    const { data: com2b } = await admin.from("comissoes").select("status, observacao").eq("id", com2!.id).single();
    t("pendente → cancelada (com motivo), registro mantido", canc.ok && com2b?.status === "cancelada" && com2b?.observacao === "fraude suspeita");
  }

  // ------------------------------------------------------------------
  console.log("\nSEM INDICAÇÃO / CANCELAMENTO / CONCORRÊNCIA");
  {
    const semInd = await novaConta("sem-indicacao");
    const ids = await prepararAssinante(semInd.empresaId, "essencial", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("si"), "PAYMENT_CONFIRMED", ids, `pay_${RUN}_si1`, 49.9) as never);
    const { data: st } = await admin.from("empresas").select("assinatura_status").eq("id", semInd.empresaId).single();
    const { count: nCom } = await admin.from("comissoes").select("id", { count: "exact", head: true }).eq("empresa_id", semInd.empresaId);
    t("cliente SEM indicação paga e fica ativo", st?.assinatura_status === "ativa");
    t("cliente SEM indicação NÃO gera comissão", nCom === 0);
    const vTarde = await vincularIndicacao({ empresaId: semInd.empresaId, userId: semInd.userId, email: semInd.email, codigo: CODIGO });
    t("BLOQUEADO — indicação depois do primeiro pagamento não vale (sem comissão retroativa)", vTarde === "empresa_ja_paga");

    // cancelamento antes de pagar
    const canc = await novaConta("cancela-antes");
    await vincularIndicacao({ empresaId: canc.empresaId, userId: canc.userId, email: canc.email, codigo: CODIGO });
    const idc = await prepararAssinante(canc.empresaId, "negocio", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("cc"), "PAYMENT_CREATED", idc, `pay_${RUN}_cc1`, 99.9, { status: "PENDING" }) as never);
    await processarEventoWebhook(eventoMensalidade(eid("cc"), "PAYMENT_DELETED", idc, `pay_${RUN}_cc1`, 99.9, { status: "DELETED", deleted: true }) as never);
    const rSub = await processarEventoWebhook({ id: eid("cc"), event: "SUBSCRIPTION_DELETED", dateCreated: new Date().toISOString(), account: { id: CONTA_PLATAFORMA }, subscription: { id: idc.subscriptionId } } as never);
    const { data: stc } = await admin.from("empresas").select("assinatura_status").eq("id", canc.empresaId).single();
    const { data: mc } = await admin.from("mensalidades").select("status").eq("empresa_id", canc.empresaId);
    const { count: nComc } = await admin.from("comissoes").select("id", { count: "exact", head: true }).eq("empresa_id", canc.empresaId);
    t("cancelar antes de pagar: assinatura 'cancelada'", rSub.ok && stc?.assinatura_status === "cancelada");
    t("cancelar antes de pagar: mensalidade 'cancelada'", mc?.length === 1 && mc[0].status === "cancelada");
    t("cancelar antes de pagar NÃO gera comissão", nComc === 0);

    // primeira cobrança vencida sem nunca ter pago não vira inadimplente nem comissão
    const venc = await novaConta("vencida-sem-pagar");
    await vincularIndicacao({ empresaId: venc.empresaId, userId: venc.userId, email: venc.email, codigo: CODIGO });
    const idv = await prepararAssinante(venc.empresaId, "essencial", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("vv"), "PAYMENT_OVERDUE", idv, `pay_${RUN}_vv1`, 49.9, { status: "OVERDUE" }) as never);
    const { data: stv } = await admin.from("empresas").select("assinatura_status").eq("id", venc.empresaId).single();
    const { data: mv } = await admin.from("mensalidades").select("status").eq("empresa_id", venc.empresaId);
    t("vencida sem nunca pagar: continua pendente (não é pagante nem inadimplente)", stv?.assinatura_status === "pendente" && mv?.[0]?.status === "vencida");

    // concorrência: dois pagamentos "primeiros" ao mesmo tempo → UMA primeira, UMA comissão
    const conc = await novaConta("concorrencia");
    await vincularIndicacao({ empresaId: conc.empresaId, userId: conc.userId, email: conc.email, codigo: CODIGO });
    const idk = await prepararAssinante(conc.empresaId, "negocio", "pendente");
    await Promise.all([
      processarEventoWebhook(eventoMensalidade(eid("cn"), "PAYMENT_CONFIRMED", idk, `pay_${RUN}_cn1`, 99.9) as never),
      processarEventoWebhook(eventoMensalidade(eid("cn"), "PAYMENT_CONFIRMED", idk, `pay_${RUN}_cn2`, 99.9) as never),
      processarEventoWebhook(eventoMensalidade(eid("cn"), "PAYMENT_RECEIVED", idk, `pay_${RUN}_cn1`, 99.9) as never),
    ]);
    const { data: mk } = await admin.from("mensalidades").select("eh_primeira, status").eq("empresa_id", conc.empresaId);
    const { count: nComk } = await admin.from("comissoes").select("id", { count: "exact", head: true }).eq("empresa_id", conc.empresaId);
    t("3 eventos simultâneos: exatamente UMA 'primeira' mensalidade", (mk ?? []).filter((m) => m.eh_primeira).length === 1 && (mk ?? []).length === 2);
    t("3 eventos simultâneos: exatamente UMA comissão", nComk === 1);

    // registrarMensalidade direto também é idempotente
    const dupDireto = await registrarMensalidade({ empresaId: conc.empresaId, paymentId: `pay_${RUN}_cn1`, valorCentavos: 9990, evento: "paga" });
    t("registrar a mesma mensalidade paga de novo não altera nada", dupDireto.jaProcessada && !dupDireto.comissaoId);
  }

  // ------------------------------------------------------------------
  console.log("\nTAXA DE R$ 1,99 — só em recebimento efetivo, uma vez por cobrança");
  {
    const prof = await novaConta("taxa");
    const accountId = `acc_${RUN}_taxa`;
    await admin.from("empresas").update({ asaas_account_id: accountId, assinatura_status: "ativa" }).eq("id", prof.empresaId);
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: prof.empresaId, nome: "Cliente do profissional", status: "ativo" }).select("id").single();
    const novaCobranca = async (descricao: string, status = "pendente") => {
      const { data } = await admin
        .from("cobrancas")
        .insert({ empresa_id: prof.empresaId, cliente_id: cli!.id, descricao, valor_centavos: 10000, vence_em: "2027-02-10", status, asaas_payment_id: `pay_${RUN}_${descricao}` })
        .select("id, asaas_payment_id")
        .single();
      return data!;
    };
    const evSub = (event: string, c: { id: string; asaas_payment_id: string }, extra: Record<string, unknown> = {}) => ({
      id: eid("tx"),
      event,
      dateCreated: new Date().toISOString(),
      account: { id: accountId },
      payment: { id: c.asaas_payment_id, customer: "cus_cliente_final", externalReference: c.id, dateCreated: "2027-02-01", dueDate: "2027-02-10", paymentDate: "2027-02-10", value: 100, netValue: 99, billingType: "PIX", status: "RECEIVED", ...extra },
    });
    const taxas = async (cobrancaId: string) => (await admin.from("taxas_recebimento").select("*").eq("cobranca_id", cobrancaId)).data ?? [];

    const c1 = await novaCobranca("pago");
    await processarEventoWebhook(evSub("PAYMENT_CREATED", c1, { status: "PENDING" }) as never);
    t("cobrança CRIADA não gera taxa", (await taxas(c1.id)).length === 0);

    const rOv = await processarEventoWebhook(evSub("PAYMENT_OVERDUE", c1, { status: "OVERDUE" }) as never);
    t("cobrança VENCIDA sem pagamento não gera taxa", rOv.ok && (await taxas(c1.id)).length === 0);

    const cPend = await novaCobranca("pendente-eterna");
    t("cobrança PENDENTE (nunca paga) não gera taxa", (await taxas(cPend.id)).length === 0);

    const cCanc = await novaCobranca("cancelada");
    await processarEventoWebhook(evSub("PAYMENT_DELETED", cCanc, { status: "DELETED", deleted: true }) as never);
    t("cobrança CANCELADA não gera taxa", (await taxas(cCanc.id)).length === 0);

    const rPago = await processarEventoWebhook(evSub("PAYMENT_CONFIRMED", c1) as never);
    const t1 = await taxas(c1.id);
    t("recebimento confirmado: cobrança 'paga'", rPago.ok && (await admin.from("cobrancas").select("status").eq("id", c1.id).single()).data?.status === "paga");
    t("recebimento confirmado: UMA taxa de R$ 1,99 registrada", t1.length === 1 && t1[0].valor_centavos === 199 && t1[0].status === "registrada" && t1[0].empresa_id === prof.empresaId);
    t("taxa de TESTE fica marcada como sandbox (não entra na soma devida)", t1[0]?.ambiente === "sandbox");

    await processarEventoWebhook(evSub("PAYMENT_RECEIVED", c1) as never);
    const idem = evSub("PAYMENT_RECEIVED", c1);
    await processarEventoWebhook(idem as never);
    await processarEventoWebhook(idem as never);
    t("PAYMENT_RECEIVED + CONFIRMED + reenvios: continua UMA taxa", (await taxas(c1.id)).length === 1);

    // a taxa NÃO é a comissão nem a mensalidade
    const { count: nMens } = await admin.from("mensalidades").select("id", { count: "exact", head: true }).eq("empresa_id", prof.empresaId);
    const { count: nComis } = await admin.from("comissoes").select("id", { count: "exact", head: true }).eq("empresa_id", prof.empresaId);
    t("recebimento de cliente final NÃO vira mensalidade nem comissão (fluxos separados)", nMens === 0 && nComis === 0);

    // estorno total cancela a taxa; restaurar + pagar de novo reativa a MESMA linha
    await processarEventoWebhook(evSub("PAYMENT_REFUNDED", c1, { status: "REFUNDED", refunds: [{ value: 100 }] }) as never);
    t("estorno total: taxa CANCELADA (linha mantida)", (await taxas(c1.id))[0]?.status === "cancelada");
    await processarEventoWebhook(evSub("PAYMENT_RESTORED", c1, { status: "PENDING" }) as never);
    await processarEventoWebhook(evSub("PAYMENT_CONFIRMED", c1) as never);
    const t2 = await taxas(c1.id);
    t("pago de novo após restaurar: mesma linha volta a 'registrada' (sem duplicar)", t2.length === 1 && t2[0].status === "registrada");

    // cobrança removida depois de paga
    const c3 = await novaCobranca("paga-e-removida");
    await processarEventoWebhook(evSub("PAYMENT_CONFIRMED", c3) as never);
    await processarEventoWebhook(evSub("PAYMENT_DELETED", c3, { status: "DELETED", deleted: true }) as never);
    t("cobrança removida depois de paga: taxa CANCELADA", (await taxas(c3.id))[0]?.status === "cancelada");

    // isolamento: evento de OUTRA empresa com o id da cobrança desta não gera taxa
    const outra = await novaConta("taxa-outra");
    const accOutra = `acc_${RUN}_outra`;
    await admin.from("empresas").update({ asaas_account_id: accOutra }).eq("id", outra.empresaId);
    const c4 = await novaCobranca("alvo-isolamento");
    const evAtaque = { ...evSub("PAYMENT_CONFIRMED", c4), account: { id: accOutra } };
    await processarEventoWebhook(evAtaque as never);
    t("ISOLAMENTO — evento de outra empresa não paga nem taxa a cobrança alheia", (await taxas(c4.id)).length === 0 && (await admin.from("cobrancas").select("status").eq("id", c4.id).single()).data?.status === "pendente");

    // estrutural: a taxa só nasce no webhook
    const usos = ["lib", "app"].flatMap((dir) => varrer(dir)).filter((f) => fs.readFileSync(f, "utf8").includes("registrarTaxaDeRecebimento"));
    t("ESTRUTURAL — registrarTaxaDeRecebimento só é chamada pelo webhook", usos.every((f) => /webhook\.ts$|taxa-recebimento\.ts$/.test(f.replace(/\\/g, "/"))), usos.join(", "));
  }

  // ------------------------------------------------------------------
  console.log("\nSEGURANÇA — nada financeiro novo é acessível pelo navegador");
  {
    const a = await novaConta("seg-a");
    const b = await novaConta("seg-b");
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    for (const tabela of ["influenciadores", "indicacoes", "comissoes", "taxas_recebimento", "administradores_zelo"]) {
      const r1 = await a.sessao.from(tabela).select("*").limit(1);
      const r2 = await anon.from(tabela).select("*").limit(1);
      t(`BLOQUEADO — ${tabela}: usuário logado e anônimo não leem`, Boolean(r1.error) && Boolean(r2.error));
    }
    const ins = await a.sessao.from("comissoes").insert({ influenciador_id: infA.influenciador.id, plano: "essencial", valor_centavos: 1, ambiente: "production" });
    t("BLOQUEADO — usuário não cria comissão para si", Boolean(ins.error));
    const insAdm = await a.sessao.from("administradores_zelo").insert({ user_id: a.userId });
    t("BLOQUEADO — usuário não se torna administrador", Boolean(insAdm.error));

    for (const [fn, args] of [
      ["registrar_mensalidade", { p_empresa: a.empresaId, p_payment_id: "x", p_subscription_id: null, p_valor_centavos: 1, p_vencimento: null, p_evento: "paga", p_pago_em: null, p_ambiente: "production" }],
      ["mover_comissao", { p_comissao: a.empresaId, p_acao: "pagar", p_admin: a.userId, p_observacao: null }],
      ["vincular_indicacao", { p_empresa: a.empresaId, p_codigo: CODIGO, p_user: a.userId, p_email: a.email }],
      ["registrar_taxa_recebimento", { p_empresa: a.empresaId, p_cobranca: a.empresaId, p_payment_id: "x", p_valor_centavos: 199, p_ambiente: "production" }],
    ] as const) {
      const r = await a.sessao.rpc(fn, args as never);
      const an = await anon.rpc(fn, args as never);
      t(`BLOQUEADO — RPC ${fn} não executa para usuário logado nem anônimo`, Boolean(r.error) && Boolean(an.error));
    }

    // mensalidades: o dono lê as SUAS, nunca as de outra empresa; não escreve
    const idsA = await prepararAssinante(a.empresaId, "essencial", "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("sg"), "PAYMENT_CREATED", idsA, `pay_${RUN}_sg1`, 49.9, { status: "PENDING" }) as never);
    const lidaA = await a.sessao.from("mensalidades").select("id").eq("empresa_id", a.empresaId);
    const lidaB = await b.sessao.from("mensalidades").select("id").eq("empresa_id", a.empresaId);
    t("o dono lê as próprias mensalidades", !lidaA.error && (lidaA.data?.length ?? 0) === 1);
    t("ISOLAMENTO — outra empresa não lê as mensalidades de A", !lidaB.error && (lidaB.data?.length ?? 0) === 0);
    const alt = await a.sessao.from("mensalidades").update({ status: "paga" }).eq("empresa_id", a.empresaId);
    const { data: continua } = await admin.from("mensalidades").select("status").eq("empresa_id", a.empresaId).single();
    t("BLOQUEADO — usuário não marca a própria mensalidade como paga", Boolean(alt.error) || continua?.status !== "paga");

    // administrador: só linha na tabela
    t("usuário comum NÃO é administrador", (await ehAdministradorZelo(a.userId)) === false);
    await admin.from("administradores_zelo").insert({ user_id: b.userId });
    t("quem está em administradores_zelo é administrador", (await ehAdministradorZelo(b.userId)) === true);
    await admin.from("administradores_zelo").delete().eq("user_id", b.userId);
    t("ser dono de empresa não dá acesso admin", (await ehAdministradorZelo(a.userId)) === false);
    t("sem usuário, não é administrador", (await ehAdministradorZelo(null)) === false);

    // a conta pendente continua sem poder se auto-ativar
    const auto = await a.sessao.from("empresas").update({ assinatura_status: "ativa" }).eq("id", a.empresaId);
    const { data: ainda } = await admin.from("empresas").select("assinatura_status").eq("id", a.empresaId).single();
    t("BLOQUEADO — usuário não se auto-ativa", Boolean(auto.error) && ainda?.assinatura_status === "pendente");
  }

  // ------------------------------------------------------------------
  console.log("\nWEBHOOK — resolução da conta da plataforma");
  {
    const p = await novaConta("plataforma");
    const ids = await prepararAssinante(p.empresaId, "essencial", "pendente");
    const conta = (id: string) => ({ ...eventoMensalidade(eid("pl"), "PAYMENT_CONFIRMED", ids, `pay_${RUN}_pl_${id}`, 49.9), account: { id: `acc_desconhecida_${id}` } });

    // com a variável definida e diferente: recusa, como antes
    const estrito = await processarEventoWebhook(conta("a") as never);
    t("com ASAAS_PLATFORM_ACCOUNT_ID definido, conta diferente é RECUSADA (422)", !estrito.ok && estrito.statusHttp === 422);

    // Sem a variável: duas provas, ambas obrigatórias — (1) posse do customer
    // gravado pelo checkout e (2) o pagamento existe na NOSSA conta (consulta
    // ao Asaas com a chave da plataforma). A consulta é simulada aqui por um
    // stub de fetch, que registra o que foi chamado: nenhuma chamada real.
    delete process.env.ASAAS_PLATFORM_ACCOUNT_ID;
    const fetchReal = globalThis.fetch;
    const chamadas: string[] = [];
    let modo: "existe" | "nao_existe" | "customer_diferente" | "indisponivel" = "existe";
    let customerDoStub = ids.customerId;
    globalThis.fetch = (async (url: unknown, init?: unknown) => {
      const u = String(url);
      if (u.includes("sandbox.asaas.com/api/v3/payments/") || u.includes("sandbox.asaas.com/api/v3/subscriptions/")) {
        chamadas.push(u.split("/api/v3")[1]);
        if (modo === "nao_existe") return new Response(JSON.stringify({ errors: [{ code: "invalid_object" }] }), { status: 404 });
        if (modo === "indisponivel") return new Response("erro", { status: 500 });
        const cus = modo === "customer_diferente" ? "cus_de_outra_conta" : customerDoStub;
        return new Response(JSON.stringify({ id: u.split("/").pop(), customer: cus, value: 49.9 }), { status: 200 });
      }
      return fetchReal(url as never, init as never);
    }) as typeof fetch;

    try {
      modo = "existe";
      const semVar = await processarEventoWebhook(conta("b") as never);
      const { data: ativa } = await admin.from("empresas").select("assinatura_status").eq("id", p.empresaId).single();
      t("sem a variável: pagamento verificado (posse + existe na conta do Zelo) é processado", semVar.ok && ativa?.assinatura_status === "ativa");
      t("a verificação consultou o pagamento na conta da plataforma", chamadas.some((c) => c.startsWith("/payments/")));

      chamadas.length = 0;
      const intruso = {
        ...eventoMensalidade(eid("pl"), "PAYMENT_CONFIRMED", { customerId: "cus_nao_existe_xyz", subscriptionId: "sub_nao_existe_xyz" }, `pay_${RUN}_pl_x`, 49.9),
        account: { id: "acc_desconhecida_x" },
      };
      const rIntruso = await processarEventoWebhook(intruso as never);
      t("customer DESCONHECIDO é recusado (422) sem nem consultar o Asaas", !rIntruso.ok && rIntruso.statusHttp === 422 && chamadas.length === 0);

      modo = "nao_existe";
      const rOutraConta = await processarEventoWebhook(conta("c") as never);
      t("evento de OUTRA conta citando um customer nosso: não existe na conta do Zelo → recusado (422)", !rOutraConta.ok && rOutraConta.statusHttp === 422);

      modo = "customer_diferente";
      const rMismatch = await processarEventoWebhook(conta("d") as never);
      t("customer do Asaas diferente do evento → recusado (422)", !rMismatch.ok && rMismatch.statusHttp === 422);

      modo = "indisponivel";
      const rIndisp = await processarEventoWebhook(conta("e") as never);
      t("Asaas indisponível na verificação → 503 (o Asaas reenvia; nada é gravado)", !rIndisp.ok && rIndisp.statusHttp === 503);
      const { count: gravou } = await admin.from("eventos_asaas").select("id", { count: "exact", head: true }).like("asaas_event_id", `${RUN}_pl_%`).eq("tipo", "PAYMENT_CONFIRMED").eq("asaas_account_id", "acc_desconhecida_e");
      t("evento recusado/indisponível não ocupa linha de idempotência", gravou === 0);

      // cruzamento entre empresas: o customer de B nunca atribui pagamento a A
      const q = await novaConta("plataforma-B");
      const idsQ = await prepararAssinante(q.empresaId, "essencial", "pendente");
      modo = "existe";
      customerDoStub = idsQ.customerId;
      const cruzado = {
        ...eventoMensalidade(eid("pl"), "PAYMENT_CONFIRMED", idsQ, `pay_${RUN}_pl_cruz`, 49.9),
        account: { id: "acc_desconhecida_f" },
      };
      await processarEventoWebhook(cruzado as never);
      const { data: mensA } = await admin.from("mensalidades").select("id").eq("empresa_id", p.empresaId).eq("asaas_payment_id", `pay_${RUN}_pl_cruz`);
      const { data: mensQ } = await admin.from("mensalidades").select("id").eq("empresa_id", q.empresaId).eq("asaas_payment_id", `pay_${RUN}_pl_cruz`);
      t("ISOLAMENTO — pagamento do customer de B é registrado só em B, nunca em A", (mensA?.length ?? 0) === 0 && (mensQ?.length ?? 0) === 1);

      // assinatura removida (evento só com subscription): posse pela linha que o checkout gravou
      modo = "nao_existe";
      const evSub = { id: eid("pl"), event: "SUBSCRIPTION_DELETED", dateCreated: new Date().toISOString(), account: { id: "acc_desconhecida_g" }, subscription: { id: idsQ.subscriptionId } };
      const rSub = await processarEventoWebhook(evSub as never);
      const { data: stQ } = await admin.from("empresas").select("assinatura_status").eq("id", q.empresaId).single();
      t("SUBSCRIPTION_DELETED sem a variável: assinatura nossa (posse) é aceita", rSub.ok && stQ?.assinatura_status === "cancelada");
      const evSubFalsa = { ...evSub, id: eid("pl"), subscription: { id: "sub_que_nao_e_nossa" } };
      const rSubFalsa = await processarEventoWebhook(evSubFalsa as never);
      t("SUBSCRIPTION_DELETED de assinatura desconhecida é recusado (422)", !rSubFalsa.ok && rSubFalsa.statusHttp === 422);
    } finally {
      globalThis.fetch = fetchReal;
    }

    const semAccount = await processarEventoWebhook({ id: eid("pl"), event: "PAYMENT_CONFIRMED", dateCreated: new Date().toISOString(), payment: { id: "p", customer: ids.customerId, value: 1 } } as never);
    t("evento sem account.id continua recusado (400)", !semAccount.ok && semAccount.statusHttp === 400);
    process.env.ASAAS_PLATFORM_ACCOUNT_ID = CONTA_PLATAFORMA;
  }

  // ------------------------------------------------------------------
  console.log("\nTAXA — infraestrutura de cobrança posterior (quanto é devido, sem contar duas vezes)");
  {
    const { listarTaxasACobrar, marcarTaxasFaturadas } = await import("../lib/core/taxa-recebimento");
    const prof = await novaConta("taxa-a-cobrar");
    const cli = (await admin.from("clientes").insert({ empresa_id: prof.empresaId, nome: "Cliente X", status: "ativo" }).select("id").single()).data!;
    const mk = async (n: string) =>
      (await admin.from("cobrancas").insert({ empresa_id: prof.empresaId, cliente_id: cli.id, descricao: n, valor_centavos: 5000, vence_em: "2027-03-10", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 5000, pago_via: "asaas" }).select("id").single()).data!.id as string;
    const idsC = [await mk("t1"), await mk("t2"), await mk("t3"), await mk("t4")];
    // 2 reais (production), 1 de teste (sandbox), 1 cancelada (production)
    await admin.from("taxas_recebimento").insert([
      { empresa_id: prof.empresaId, cobranca_id: idsC[0], asaas_payment_id: `pay_${RUN}_tx1`, valor_centavos: 199, ambiente: "production", status: "registrada" },
      { empresa_id: prof.empresaId, cobranca_id: idsC[1], asaas_payment_id: `pay_${RUN}_tx2`, valor_centavos: 199, ambiente: "production", status: "registrada" },
      { empresa_id: prof.empresaId, cobranca_id: idsC[2], asaas_payment_id: `pay_${RUN}_tx3`, valor_centavos: 199, ambiente: "sandbox", status: "registrada" },
      { empresa_id: prof.empresaId, cobranca_id: idsC[3], asaas_payment_id: `pay_${RUN}_tx4`, valor_centavos: 199, ambiente: "production", status: "cancelada" },
    ]);

    const a1 = (await listarTaxasACobrar()).find((x) => x.empresaId === prof.empresaId);
    t("a cobrar: só recebimentos REAIS e válidos (2 × R$ 1,99 = R$ 3,98); teste e cancelada ficam de fora", a1?.quantidade === 2 && a1?.totalCentavos === 398);

    const [m1, m2] = await Promise.all([marcarTaxasFaturadas(prof.empresaId, `ref-${RUN}-1`), marcarTaxasFaturadas(prof.empresaId, `ref-${RUN}-2`)]);
    t("duas marcações simultâneas contam cada taxa UMA vez (total R$ 3,98, não R$ 7,96)", m1.totalCentavos + m2.totalCentavos === 398 && m1.quantidade + m2.quantidade === 2);
    const a2 = (await listarTaxasACobrar()).find((x) => x.empresaId === prof.empresaId);
    t("depois de marcadas, não aparecem mais como pendentes", a2 === undefined);
    const { data: marcadas } = await admin.from("taxas_recebimento").select("faturada_em, fatura_referencia, ambiente, status").eq("empresa_id", prof.empresaId);
    t("a taxa de teste e a cancelada NÃO foram marcadas como cobradas", (marcadas ?? []).filter((x) => x.faturada_em).length === 2 && (marcadas ?? []).every((x) => !x.faturada_em || (x.ambiente === "production" && x.status === "registrada")));
    const ref3 = await marcarTaxasFaturadas(prof.empresaId, `ref-${RUN}-3`);
    t("marcar de novo não encontra nada a cobrar", ref3.quantidade === 0 && ref3.totalCentavos === 0);

    let semRef = false;
    try {
      await marcarTaxasFaturadas(prof.empresaId, "  ");
    } catch {
      semRef = true;
    }
    t("referência vazia é recusada", semRef);

    const r1 = await prof.sessao.rpc("taxas_a_cobrar");
    const r2 = await prof.sessao.rpc("marcar_taxas_faturadas", { p_empresa: prof.empresaId, p_referencia: "x" });
    t("BLOQUEADO — o profissional não consulta nem marca as próprias taxas", Boolean(r1.error) && Boolean(r2.error));
  }

  // ------------------------------------------------------------------
  console.log("\nPLANO GRÁTIS — permanente, sem mensalidade, não é trial");
  {
    /** Asaas SIMULADO (stub de fetch): nenhuma chamada real; registra o que foi pedido. */
    const fetchReal = globalThis.fetch;
    const pedidos: string[] = [];
    const comAsaasSimulado = async <T,>(ids: { cus: string; sub: string; pay: string }, fn: () => Promise<T>): Promise<T> => {
      globalThis.fetch = (async (url: unknown, init?: { method?: string }) => {
        const u = String(url);
        if (!u.includes("sandbox.asaas.com/api/v3")) return fetchReal(url as never, init as never);
        const metodo = init?.method ?? "GET";
        const caminho = u.split("/api/v3")[1];
        pedidos.push(`${metodo} ${caminho}`);
        const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
        if (metodo === "GET" && caminho.startsWith("/customers")) return json({ data: [], totalCount: 0, hasMore: false });
        if (metodo === "POST" && caminho === "/customers") return json({ id: ids.cus });
        if (metodo === "POST" && caminho === "/subscriptions") return json({ id: ids.sub });
        if (metodo === "GET" && caminho.endsWith("/payments"))
          return json({ data: [{ id: ids.pay, status: "PENDING", value: 99.9, dueDate: "2027-01-05", invoiceUrl: "https://sandbox.asaas.com/i/stub", customer: ids.cus }], totalCount: 1, hasMore: false });
        if (metodo === "DELETE") return json({ deleted: true, id: "x" });
        return json({ errors: [{ code: "nao_simulado" }] }, 404);
      }) as typeof fetch;
      try {
        return await fn();
      } finally {
        globalThis.fetch = fetchReal;
      }
    };

    // --- escolher o Grátis numa conta nova ---
    const g = await novaConta("gratis");
    const baseG = { empresaId: g.empresaId, userId: g.userId, papel: "dono", email: g.email, documento: "" };
    const rM = await iniciarAssinaturaZelo({ ...baseG, plano: "gratis", papel: "membro" });
    t("só o dono escolhe o plano", !rM.ok && rM.codigo === "sem_permissao");

    const r1 = await iniciarAssinaturaZelo({ ...baseG, plano: "gratis" });
    t("Grátis: ativado sem pagamento, R$ 0, sem link de pagamento, sem pedir CPF/CNPJ", r1.ok && r1.ativado && r1.valorCentavos === 0 && r1.linkPagamento === null);
    const { data: eg } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido, asaas_subscription_id, trial_termina_em").eq("id", g.empresaId).single();
    t("Grátis: conta ATIVA no plano 'gratis' (permanente)", eg?.assinatura_status === "ativa" && eg?.plano === "gratis" && eg?.plano_escolhido === null);
    t("Grátis NÃO é trial: nenhum prazo, nenhuma assinatura no provedor", new Date(eg?.trial_termina_em as string).getTime() <= Date.now() + 60_000 && eg?.asaas_subscription_id === null);
    const { count: mG } = await admin.from("mensalidades").select("id", { count: "exact", head: true }).eq("empresa_id", g.empresaId);
    t("Grátis: nenhuma mensalidade criada", mG === 0);

    const inserirG = async (n: number) => {
      const lote = Array.from({ length: n }, (_, i) => ({ empresa_id: g.empresaId, nome: `Cli ${i + 1}` }));
      return g.sessao.from("clientes").insert(lote);
    };
    const { error: eLib } = await inserirG(10);
    t("Grátis libera a conta: o usuário cria 10 clientes pela API", !eLib, eLib?.message);
    const { error: e11 } = await g.sessao.from("clientes").insert({ empresa_id: g.empresaId, nome: "O 11º" });
    t("Grátis: o 11º cliente é recusado pelo banco (limite 10)", Boolean(e11?.message?.includes("LIMITE_DE_CLIENTES:gratis:10")), e11?.message);

    const r2 = await iniciarAssinaturaZelo({ ...baseG, plano: "gratis" });
    t("escolher o Grátis de novo é idempotente", r2.ok && r2.jaExistia && r2.ativado);

    // paga e ativa NÃO "cai" para o Grátis
    const paga = await novaConta("paga-tenta-gratis");
    await admin.from("empresas").update({ assinatura_status: "ativa", plano: "negocio" }).eq("id", paga.empresaId);
    const rP = await iniciarAssinaturaZelo({ empresaId: paga.empresaId, userId: paga.userId, papel: "dono", email: paga.email, documento: "", plano: "gratis" });
    const { data: ep } = await admin.from("empresas").select("plano, assinatura_status").eq("id", paga.empresaId).single();
    t("assinatura paga ativa não é rebaixada ao Grátis por aqui", !rP.ok && ep?.plano === "negocio" && ep?.assinatura_status === "ativa");

    const inad = await novaConta("inadimplente-tenta-gratis");
    await admin.from("empresas").update({ assinatura_status: "inadimplente", plano: "essencial" }).eq("id", inad.empresaId);
    const rI = await iniciarAssinaturaZelo({ empresaId: inad.empresaId, userId: inad.userId, papel: "dono", email: inad.email, documento: "", plano: "gratis" });
    t("inadimplente não escapa para o Grátis (tem de regularizar)", !rI.ok);

    // cancelada recomeça: cancelada → pendente → ativa(gratis), as duas pernas validadas
    const canc = await novaConta("cancelada-vai-gratis");
    await admin.from("empresas").update({ assinatura_status: "cancelada", plano: "essencial" }).eq("id", canc.empresaId);
    const rC = await iniciarAssinaturaZelo({ empresaId: canc.empresaId, userId: canc.userId, papel: "dono", email: canc.email, documento: "", plano: "gratis" });
    const { data: ec } = await admin.from("empresas").select("plano, assinatura_status").eq("id", canc.empresaId).single();
    t("conta cancelada pode voltar pelo plano Grátis", rC.ok && ec?.assinatura_status === "ativa" && ec?.plano === "gratis");

    // Grátis não gera comissão (comissão é da primeira MENSALIDADE paga)
    const indG = await novaConta("indicada-gratis");
    await vincularIndicacao({ empresaId: indG.empresaId, userId: indG.userId, email: indG.email, codigo: CODIGO });
    await iniciarAssinaturaZelo({ empresaId: indG.empresaId, userId: indG.userId, papel: "dono", email: indG.email, documento: "", plano: "gratis" });
    const { count: cG } = await admin.from("comissoes").select("id", { count: "exact", head: true }).eq("empresa_id", indG.empresaId);
    t("cliente indicado que escolhe o Grátis NÃO gera comissão (não pagou mensalidade)", cG === 0);

    // --- upgrade Grátis → plano pago, com o Asaas simulado ---
    const ids = { cus: `cus_${RUN}_up`, sub: `sub_${RUN}_up`, pay: `pay_${RUN}_up1` };
    const cpf = cpfValido();
    const rUp = await comAsaasSimulado(ids, () => iniciarAssinaturaZelo({ empresaId: indG.empresaId, userId: indG.userId, papel: "dono", email: indG.email, documento: cpf, plano: "negocio" }));
    t("conta ativa no Grátis pode contratar um plano pago (Negócio R$ 99,90)", rUp.ok && !rUp.ativado && rUp.valorCentavos === 9990 && rUp.linkPagamento !== null);
    t("o checkout falou com o provedor (customer + assinatura + cobrança), tudo simulado", pedidos.some((p) => p === "POST /customers") && pedidos.some((p) => p === "POST /subscriptions"));
    const { data: eu } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido").eq("id", indG.empresaId).single();
    t("upgrade pendente: continua ATIVA no Grátis (10 clientes), Negócio só ESCOLHIDO — não vale ainda", eu?.assinatura_status === "ativa" && eu?.plano === "gratis" && eu?.plano_escolhido === "negocio");
    const { error: eFura } = await indG.sessao.from("clientes").insert(Array.from({ length: 11 }, (_, i) => ({ empresa_id: indG.empresaId, nome: `Fura ${i}` })));
    t("escolher o Negócio sem pagar NÃO libera 200 clientes (banco ainda impõe 10)", Boolean(eFura?.message?.includes("LIMITE_DE_CLIENTES:gratis:10")), eFura?.message);

    const clienteUp = { customerId: ids.cus, subscriptionId: ids.sub };
    await processarEventoWebhook(eventoMensalidade(eid("up"), "PAYMENT_OVERDUE", clienteUp, ids.pay, 99.9, { status: "OVERDUE" }) as never);
    const { data: ev1 } = await admin.from("empresas").select("assinatura_status, plano").eq("id", indG.empresaId).single();
    t("upgrade vencido sem pagar NÃO bloqueia a conta Grátis", ev1?.assinatura_status === "ativa" && ev1?.plano === "gratis");

    await processarEventoWebhook(eventoMensalidade(eid("up"), "PAYMENT_CONFIRMED", clienteUp, ids.pay, 99.9) as never);
    const { data: ev2 } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido").eq("id", indG.empresaId).single();
    t("pagamento confirmado: o Negócio passa a valer (limite 200) e o escolhido é limpo", ev2?.assinatura_status === "ativa" && ev2?.plano === "negocio" && ev2?.plano_escolhido === null);
    const { error: eOk } = await indG.sessao.from("clientes").insert(Array.from({ length: 30 }, (_, i) => ({ empresa_id: indG.empresaId, nome: `Pago ${i}` })));
    t("agora o banco libera além de 10 clientes", !eOk, eOk?.message);
    const { data: mU } = await admin.from("mensalidades").select("plano, valor_pago_centavos, eh_primeira").eq("empresa_id", indG.empresaId).single();
    t("mensalidade registrada no plano Negócio, R$ 99,90, primeira", mU?.plano === "negocio" && mU?.valor_pago_centavos === 9990 && mU?.eh_primeira === true);
    const { data: cU } = await admin.from("comissoes").select("valor_centavos, plano").eq("empresa_id", indG.empresaId);
    t("a indicação rende comissão no PRIMEIRO pagamento (R$ 99,90), mesmo vindo do Grátis", cU?.length === 1 && cU[0].valor_centavos === 9990 && cU[0].plano === "negocio");

    // cancelar uma tentativa de upgrade não derruba quem é Grátis
    const tent = await novaConta("tentativa-upgrade");
    await iniciarAssinaturaZelo({ empresaId: tent.empresaId, userId: tent.userId, papel: "dono", email: tent.email, documento: "", plano: "gratis" });
    const idsT = { cus: `cus_${RUN}_tt`, sub: `sub_${RUN}_tt`, pay: `pay_${RUN}_tt1` };
    await comAsaasSimulado(idsT, () => iniciarAssinaturaZelo({ empresaId: tent.empresaId, userId: tent.userId, papel: "dono", email: tent.email, documento: cpfValido(), plano: "escola" }));
    const rDel = await processarEventoWebhook({ id: eid("tt"), event: "SUBSCRIPTION_DELETED", dateCreated: new Date().toISOString(), account: { id: CONTA_PLATAFORMA }, subscription: { id: idsT.sub } } as never);
    const { data: et } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido").eq("id", tent.empresaId).single();
    t("cancelar a tentativa de upgrade mantém a conta no Grátis, ativa", rDel.ok && et?.assinatura_status === "ativa" && et?.plano === "gratis" && et?.plano_escolhido === null);

    // escolher o Grátis com uma cobrança paga em aberto: cancela a assinatura e o evento dela não derruba a conta
    const aberto = await novaConta("troca-por-gratis");
    const idsA = await prepararAssinante(aberto.empresaId, "essencial", "pendente");
    const antes = pedidos.length;
    const rA = await comAsaasSimulado({ cus: "x", sub: "y", pay: "z" }, () => iniciarAssinaturaZelo({ empresaId: aberto.empresaId, userId: aberto.userId, papel: "dono", email: aberto.email, documento: "", plano: "gratis" }));
    const { data: ea } = await admin.from("empresas").select("assinatura_status, plano, asaas_subscription_id").eq("id", aberto.empresaId).single();
    t("Grátis no lugar de uma assinatura paga em aberto: a assinatura é removida no provedor e desvinculada", rA.ok && ea?.plano === "gratis" && ea?.asaas_subscription_id === null && pedidos.slice(antes).some((p) => p.startsWith("DELETE /subscriptions/")));
    await processarEventoWebhook({ id: eid("tt"), event: "SUBSCRIPTION_DELETED", dateCreated: new Date().toISOString(), account: { id: CONTA_PLATAFORMA }, subscription: { id: idsA.subscriptionId } } as never);
    const { data: ea2 } = await admin.from("empresas").select("assinatura_status").eq("id", aberto.empresaId).single();
    t("…e o SUBSCRIPTION_DELETED atrasado dela não derruba a conta Grátis", ea2?.assinatura_status === "ativa");
  }

  // ------------------------------------------------------------------
  console.log("\nFIM DO TRIAL — conta nova (criada pelo trigger de cadastro, sem tocar em nada)");
  {
    const nova = await novaConta("fim-do-trial");
    const { data: e } = await admin.from("empresas").select("assinatura_status, trial_termina_em, plano").eq("id", nova.empresaId).single();
    t("conta nova nasce 'pendente' (não 'trial')", e?.assinatura_status === "pendente");
    t("nenhum prazo de teste concedido (trial_termina_em não está no futuro)", new Date(e?.trial_termina_em as string).getTime() <= Date.now() + 60_000);
    const { error: eCria } = await nova.sessao.from("clientes").insert({ empresa_id: nova.empresaId, nome: "Sem pagar" });
    t("conta nova não cria cliente antes do pagamento confirmado", Boolean(eCria));
    const { count: nMens } = await admin.from("mensalidades").select("id", { count: "exact", head: true }).eq("empresa_id", nova.empresaId);
    t("conta nova não tem mensalidade paga nem comissão", nMens === 0);

    // escolher plano (sem Asaas: o servidor grava o plano e a cobrança fica pendente) não ativa
    const ids = await prepararAssinante(nova.empresaId, "negocio", "pendente");
    const { data: depois } = await admin.from("empresas").select("assinatura_status").eq("id", nova.empresaId).single();
    t("escolher plano / gerar assinatura NÃO ativa a conta", depois?.assinatura_status === "pendente");
    await processarEventoWebhook(eventoMensalidade(eid("ft"), "PAYMENT_CONFIRMED", ids, `pay_${RUN}_ft1`, 99.9) as never);
    const { data: ativa } = await admin.from("empresas").select("assinatura_status").eq("id", nova.empresaId).single();
    t("SÓ o pagamento confirmado ativa a conta", ativa?.assinatura_status === "ativa");
  }

  // ------------------------------------------------------------------
  console.log("\nTEXTO COMERCIAL — nada de mês grátis e nada de preço antigo");
  {
    const arquivos = ["app", "components", "lib"].flatMap((d) => varrer(d));
    const ruins: string[] = [];
    for (const f of arquivos) {
      const txt = fs.readFileSync(f, "utf8");
      if (/30 dias (de teste )?gr[aá]tis|30 dias de teste gratuito|teste gr[aá]tis|teste gratuito|trial gratuito|primeiro m[eê]s gr[aá]tis|1 m[eê]s gr[aá]tis/i.test(txt)) ruins.push(f.replace(/\\/g, "/"));
      if (/\b(1990|3990|7990|2490)\b/.test(txt) && /plano|preco|PRECO/i.test(txt)) ruins.push(`${f.replace(/\\/g, "/")} (preço antigo)`);
      if (/24,90|19,90|39,90|79,90|Zelo Pro\b|[Pp]lano Profissional|cobranças\/mês/.test(txt)) ruins.push(`${f.replace(/\\/g, "/")} (nome/preço/limite antigo)`);
    }
    t("nenhum texto (Termos e Privacidade inclusive) promete período grátis nem usa preço antigo", ruins.length === 0, ruins.join(" | "));
  }

  // ------------------------------------------------------------------
  console.log("\nLIMPEZA");
  await limpar();
  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
  process.exit(falhou === 0 ? 0 : 1);
}

function varrer(dir: string): string[] {
  const out: string[] = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = `${dir}/${nome}`;
    if (nome === "node_modules" || nome === ".next") continue;
    const s = fs.statSync(p);
    if (s.isDirectory()) out.push(...varrer(p));
    else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

async function limpar() {
  for (const id of empresas) {
    await admin.from("comissoes").delete().eq("empresa_id", id);
    await admin.from("indicacoes").delete().eq("empresa_id", id);
    await admin.from("taxas_recebimento").delete().eq("empresa_id", id);
    await admin.from("mensalidades").delete().eq("empresa_id", id);
    await admin.from("cobrancas").delete().eq("empresa_id", id);
    await admin.from("clientes").delete().eq("empresa_id", id);
    await admin.from("notificacoes").delete().eq("empresa_id", id);
    await admin.from("log_acoes_financeiras").delete().eq("empresa_id", id);
  }
  await admin.from("eventos_asaas").delete().like("asaas_event_id", `${RUN}%`);
  for (const id of influenciadoresCriados) {
    await admin.from("comissoes").delete().eq("influenciador_id", id);
    await admin.from("indicacoes").delete().eq("influenciador_id", id);
    await admin.from("influenciadores").delete().eq("id", id);
  }
  for (const id of usuarios) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  }
  // sobras de mensalidades sem empresa (empresa removida antes) deste run
  await admin.from("mensalidades").delete().like("asaas_payment_id", `%${RUN}%`);
  await admin.from("taxas_recebimento").delete().like("asaas_payment_id", `%${RUN}%`);
  console.log("  ✓ dados do teste removidos");
}

main().catch(async (e) => {
  console.error("ERRO NO TESTE:", e instanceof Error ? e.message : e);
  try {
    await limpar();
  } catch {
    /* limpeza best-effort */
  }
  process.exit(1);
});
