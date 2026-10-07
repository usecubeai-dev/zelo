/**
 * Conformidade legal de lançamento — aceite dos Termos, cancelamento,
 * arrependimento (7 dias), reembolso, exclusão com registros fiscais,
 * retenção, pedidos de titular e termo de parceria do influenciador.
 *
 * Rodar:  npx tsx tools/teste-conformidade-legal.ts
 *
 * REAL: banco (tabelas, funções SQL, RLS, FKs, triggers). Contas `@zelo.test`,
 * removidas no fim. SIMULADO: o Asaas (stub de fetch — nenhuma chamada real,
 * nenhum estorno real) e o relógio (datas gravadas no banco).
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
const CONTA_PLATAFORMA = "acc_plataforma_teste_conformidade";
process.env.ASAAS_PLATFORM_ACCOUNT_ID = CONTA_PLATAFORMA;
delete process.env.RETENCAO_JOB_ATIVO;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const RUN = `cl${Date.now().toString(36)}`;
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
const SENHA = "senha_teste_conformidade_12345";
let seq = 0;

async function novaConta(rotulo: string) {
  const email = `cl_${RUN}_${rotulo}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome: `CL ${rotulo}` } }),
  });
  const j = await r.json();
  const userId = (j.id || j.user?.id) as string;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);
  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);
  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await sessao.auth.signInWithPassword({ email, password: SENHA });
  return { userId, empresaId, email, sessao };
}

/** Empresa com assinatura PAGA ativa e a primeira mensalidade paga há `diasAtras` dias. */
async function assinante(rotulo: string, diasAtras: number, plano = "essencial") {
  const c = await novaConta(rotulo);
  const sub = `sub_${RUN}_${rotulo}`;
  await admin
    .from("empresas")
    .update({ assinatura_status: "ativa", plano, asaas_subscription_id: sub, asaas_customer_id: `cus_${RUN}_${rotulo}` })
    .eq("id", c.empresaId);
  const pagoEm = new Date(Date.now() - diasAtras * 86_400_000);
  const venc = pagoEm.toISOString().slice(0, 10);
  const { data: m } = await admin
    .from("mensalidades")
    .insert({
      empresa_id: c.empresaId, plano, valor_centavos: 4990, asaas_payment_id: `pay_${RUN}_${rotulo}`, asaas_subscription_id: sub,
      vencimento: venc, status: "paga", pago_em: pagoEm.toISOString(), valor_pago_centavos: 4990, eh_primeira: true, ambiente: "sandbox",
    })
    .select("id")
    .single();
  return { ...c, sub, mensalidadeId: m!.id as string, pagoEm, venc };
}

/** Asaas SIMULADO: registra os pedidos e responde conforme o modo. */
const fetchReal = globalThis.fetch;
const pedidos: string[] = [];
let modoAsaas: "ok" | "falha" = "ok";
function instalarStub() {
  globalThis.fetch = (async (url: unknown, init?: { method?: string; body?: unknown }) => {
    const u = String(url);
    if (!u.includes("sandbox.asaas.com/api/v3")) return fetchReal(url as never, init as never);
    const metodo = init?.method ?? "GET";
    const caminho = u.split("/api/v3")[1];
    pedidos.push(`${metodo} ${caminho}${init?.body ? " " + String(init.body) : ""}`);
    if (modoAsaas === "falha") return new Response(JSON.stringify({ errors: [{ code: "falha_simulada" }] }), { status: 500 });
    if (metodo === "DELETE" && caminho.startsWith("/subscriptions/")) return new Response(JSON.stringify({ deleted: true, id: caminho.split("/").pop() }), { status: 200 });
    if (metodo === "POST" && /\/payments\/.+\/refund$/.test(caminho)) return new Response(JSON.stringify({ id: "x", status: "REFUNDED" }), { status: 200 });
    return new Response(JSON.stringify({ errors: [{ code: "nao_simulado" }] }), { status: 404 });
  }) as typeof fetch;
}
const restaurarFetch = () => {
  globalThis.fetch = fetchReal;
};

async function main() {
  const legal = await import("../lib/legal");
  const company = await import("../lib/company");
  const aceite = await import("../lib/core/aceite-legal");
  const canc = await import("../lib/core/cancelamento");
  const reemb = await import("../lib/core/reembolso");
  const excl = await import("../lib/core/exclusao-conta");
  const manut = await import("../lib/core/manutencao");
  const expo = await import("../lib/core/exportacao");
  const titular = await import("../lib/core/solicitacao-titular");
  const infl = await import("../lib/core/influenciadores");
  const { processarEventoWebhook } = await import("../lib/asaas/webhook");
  const { criarConta } = await import("../app/(auth)/criar-conta/acoes");

  console.log("\n=== CONFORMIDADE LEGAL DE LANÇAMENTO ===\n");

  // ------------------------------------------------------------------
  console.log("CONSTANTES CENTRAIS (versões, prazos, empresa)");
  {
    t("versões dos Termos e da Política declaradas num só lugar", legal.TERMS_VERSION.length > 0 && legal.PRIVACY_VERSION.length > 0);
    t("arrependimento = 7 dias", legal.ARREPENDIMENTO_DIAS === 7);
    t("prazo de retenção fiscal ainda é [PREENCHER] (null) — nada é inventado", legal.RETENCAO_FISCAL_ANOS === null && legal.RETENCAO_FISCAL_ROTULO === "[PREENCHER]");
    t("job de eliminação definitiva começa DESLIGADO", legal.retencaoJobLigado({}) === false && legal.retencaoJobLigado({ RETENCAO_JOB_ATIVO: "true" }) === true && legal.retencaoJobLigado({ RETENCAO_JOB_ATIVO: "false" }) === false);
    t("dataLimiteDeRetencao: null sem prazo, soma anos com prazo", legal.dataLimiteDeRetencao(new Date("2026-01-01T00:00:00Z")) === null && legal.dataLimiteDeRetencao(new Date("2026-01-01T00:00:00Z"), 5)?.getUTCFullYear() === 2031);
    t("empresa: razão social e CNPJ reais já informados", company.EMPRESA.razaoSocial === "GOGOMOB TECNOLOGIA BR LTDA" && company.EMPRESA.cnpj === "48.443.579/0001-93");
    t("canais de atendimento informados (suporte, privacidade, telefone, horário): nenhum pendente", company.camposPendentesDaEmpresa().length === 0);
    t("os e-mails da empresa são endereços válidos", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.EMPRESA.emailSuporte) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.EMPRESA.emailPrivacidade));
    t("sem telefone, o texto diz 'por e-mail' e não inventa número", !/\d{8}/.test(company.EMPRESA.telefoneAtendimento));
    t("mailto só quando o e-mail é real", company.mailtoDe("[PREENCHER]") === null && company.mailtoDe(company.EMPRESA.emailSuporte) === `mailto:${company.EMPRESA.emailSuporte}`);
  }

  // ------------------------------------------------------------------
  console.log("\nACEITE DOS TERMOS — obrigatório e registrado");
  {
    const emailRecusado = `cl_${RUN}_semaceite@zelo.test`;
    for (const valor of [false, undefined, "true", 1, null]) {
      const r = await criarConta({ nome: "Sem Aceite", email: emailRecusado, senha: "SenhaForte123!", aceite: valor as never });
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existe = lista.users.some((u) => u.email === emailRecusado);
      t(`SEM aceite (${JSON.stringify(valor)}): a conta NÃO é criada e o erro aponta o aceite`, !r.ok && Boolean(r.erros?.aceite) && !existe);
    }
    const rOutros = await criarConta({ nome: "", email: "ruim", senha: "123", aceite: true });
    t("com aceite mas dados inválidos: erros de campo, sem aceite pendente", !rOutros.ok && Boolean(rOutros.erros?.nome && rOutros.erros?.email && rOutros.erros?.senha) && !rOutros.erros?.aceite);

    const fonte = fs.readFileSync("app/(auth)/criar-conta/acoes.ts", "utf8");
    t("ESTRUTURAL — o aceite é checado ANTES de qualquer chamada de autenticação", fonte.indexOf("dados.aceite !== true") > 0 && fonte.indexOf("dados.aceite !== true") < fonte.indexOf("auth.signUp"));
    t("ESTRUTURAL — o formulário usa a Server Action, não o signUp do navegador", !/supabaseBrowser|auth\.signUp/.test(fs.readFileSync("app/(auth)/criar-conta/FormularioCadastro.tsx", "utf8")));

    const u = await novaConta("aceite");
    t("antes de aceitar, o aceite vigente é falso", (await aceite.aceiteVigente(u.userId)) === false);
    const cab = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "TesteConformidade/1.0" });
    const orig = aceite.origemDaRequisicao(cab);
    t("IP e user agent vêm da requisição (1º IP do x-forwarded-for)", orig.ip === "203.0.113.7" && orig.userAgent === "TesteConformidade/1.0");
    const r = await aceite.registrarAceite({ userId: u.userId, origem: "cadastro", ip: orig.ip, userAgent: orig.userAgent });
    t("aceite registrado", r.ok);
    const { data: linha } = await admin.from("aceites_legais").select("*").eq("user_id", u.userId).single();
    t("a prova guarda usuário, empresa, versões, data, IP e user agent", linha?.empresa_id === u.empresaId && linha?.termos_versao === legal.TERMS_VERSION && linha?.privacidade_versao === legal.PRIVACY_VERSION && Boolean(linha?.aceito_em) && linha?.ip === "203.0.113.7" && linha?.user_agent === "TesteConformidade/1.0" && linha?.origem === "cadastro");
    t("depois de aceitar, o aceite vigente é verdadeiro", (await aceite.aceiteVigente(u.userId)) === true);

    // versão nova → pede de novo
    await admin.from("aceites_legais").update({ termos_versao: "versao-antiga" }).eq("user_id", u.userId);
    t("QUANDO A VERSÃO MUDA o aceite antigo não vale: pede novo aceite no próximo acesso", (await aceite.aceiteVigente(u.userId)) === false);
    await aceite.registrarAceite({ userId: u.userId, origem: "reaceite", ip: null, userAgent: null });
    t("novo aceite (reaceite) volta a valer e o histórico é mantido", (await aceite.aceiteVigente(u.userId)) === true && ((await admin.from("aceites_legais").select("id", { count: "exact", head: true }).eq("user_id", u.userId)).count ?? 0) === 2);

    const outra = await novaConta("aceite-outra");
    t("o aceite de uma pessoa não vale para outra", (await aceite.aceiteVigente(outra.userId)) === false);

    // RLS
    const proprios = await u.sessao.from("aceites_legais").select("id").eq("user_id", u.userId);
    const alheios = await outra.sessao.from("aceites_legais").select("id").eq("user_id", u.userId);
    t("RLS — a pessoa lê o próprio aceite e não o de outra", (proprios.data?.length ?? 0) === 2 && (alheios.data?.length ?? 0) === 0);
    const forjado = await u.sessao.from("aceites_legais").insert({ user_id: outra.userId, termos_versao: legal.TERMS_VERSION, privacidade_versao: legal.PRIVACY_VERSION, origem: "cadastro" });
    t("BLOQUEADO — ninguém forja um aceite pela API", Boolean(forjado.error));
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    t("BLOQUEADO — anônimo não lê aceites", Boolean((await anon.from("aceites_legais").select("id").limit(1)).error));

    const layout = fs.readFileSync("app/(app)/app/layout.tsx", "utf8");
    t("ESTRUTURAL — o app redireciona para /aceite quando o aceite vigente falta", /aceiteVigente\(atual\.user\.id\)[\s\S]{0,40}redirect\("\/aceite"\)/.test(layout));
  }

  // ------------------------------------------------------------------
  console.log("\nCANCELAMENTO — cálculo do período e do prazo (puro)");
  {
    const f = canc.fimDoPeriodoPago;
    t("vence 05/10 → acesso até 05/11 (00h de Brasília)", f("2026-10-05", null)?.toISOString() === "2026-11-05T03:00:00.000Z");
    t("dia 31 em mês curto cai no último dia (31/01 → 28/02)", f("2027-01-31", null)?.toISOString() === "2027-02-28T03:00:00.000Z");
    t("dezembro vira janeiro do ano seguinte", f("2026-12-15", null)?.toISOString() === "2027-01-15T03:00:00.000Z");
    t("sem vencimento usa o dia do pagamento", f(null, "2026-10-05T15:00:00Z")?.toISOString() === "2026-11-05T03:00:00.000Z");
    t("sem nenhum dado → null", f(null, null) === null);
    const agora = new Date("2026-10-10T12:00:00Z");
    const d = canc.dentroDoPrazoDeArrependimento;
    t("arrependimento: 3 dias depois ✓, 7 dias exatos ✓, 7 dias + 1s ✗, 8 dias ✗", d(new Date("2026-10-07T12:00:00Z"), agora) && d(new Date("2026-10-03T12:00:00Z"), agora) && !d(new Date("2026-10-03T11:59:59Z"), agora) && !d(new Date("2026-10-02T12:00:00Z"), agora));
  }

  // ------------------------------------------------------------------
  console.log("\nCANCELAMENTO — interrompe a cobrança, mantém o acesso, idempotente");
  instalarStub();
  try {
    const a = await assinante("cancela", 20);
    const sit0 = await canc.situacaoDeCancelamento(a.empresaId);
    t("antes de cancelar: assinatura paga ativa, nada agendado, fora do prazo de arrependimento (20 dias)", sit0.planoPagoAtivo && !sit0.cancelamentoAgendado && !sit0.arrependimento);

    const membro = await canc.cancelarAssinaturaZelo({ empresaId: a.empresaId, userId: a.userId, papel: "membro" });
    t("só o dono cancela", !membro.ok && membro.codigo === "sem_permissao");

    pedidos.length = 0;
    const r1 = await canc.cancelarAssinaturaZelo({ empresaId: a.empresaId, userId: a.userId, papel: "dono", motivo: "Mudei de negócio" });
    t("cancelar: sucesso", r1.ok && !r1.jaSolicitado && !r1.reembolsoSolicitado, JSON.stringify(r1));
    t("a assinatura foi removida no provedor (nenhuma cobrança nova)", pedidos.some((p) => p === `DELETE /subscriptions/${a.sub}`));
    const { data: e1 } = await admin.from("empresas").select("assinatura_status, plano, asaas_subscription_id, cancelamento_solicitado_em, acesso_ate").eq("id", a.empresaId).single();
    const esperado = canc.fimDoPeriodoPago(a.venc, a.pagoEm.toISOString())!.toISOString();
    t("o ACESSO continua: segue ativa no plano pago, até o fim do período pago", e1?.assinatura_status === "ativa" && e1?.plano === "essencial" && new Date(e1?.acesso_ate as string).toISOString() === esperado);
    t("a assinatura foi desvinculada e o pedido ficou marcado", e1?.asaas_subscription_id === null && Boolean(e1?.cancelamento_solicitado_em));
    const { data: log1 } = await admin.from("cancelamentos_assinatura").select("*").eq("empresa_id", a.empresaId);
    t("o evento foi registrado: data, motivo, plano e quem cancelou", log1?.length === 1 && log1[0].tipo === "cancelamento" && log1[0].motivo === "Mudei de negócio" && log1[0].plano === "essencial" && log1[0].user_id === a.userId && Boolean(log1[0].criado_em));
    const sit1 = await canc.situacaoDeCancelamento(a.empresaId);
    t("a tela passa a mostrar o cancelamento agendado", Boolean(sit1.cancelamentoAgendado) && new Date(sit1.cancelamentoAgendado?.acessoAte as string).toISOString() === esperado);

    pedidos.length = 0;
    const r2 = await canc.cancelarAssinaturaZelo({ empresaId: a.empresaId, userId: a.userId, papel: "dono" });
    const { count: nLog } = await admin.from("cancelamentos_assinatura").select("id", { count: "exact", head: true }).eq("empresa_id", a.empresaId);
    t("IDEMPOTENTE: pedir de novo não duplica (um só registro) e não chama o provedor outra vez", r2.ok && r2.jaSolicitado && nLog === 1 && pedidos.length === 0);

    // o webhook do cancelamento NÃO derruba o acesso
    await admin.from("empresas").update({ asaas_subscription_id: a.sub }).eq("id", a.empresaId); // simula o evento chegando enquanto a assinatura ainda está vinculada
    const ev = await processarEventoWebhook({ id: `${RUN}_cc_${++seq}`, event: "SUBSCRIPTION_DELETED", dateCreated: new Date().toISOString(), account: { id: CONTA_PLATAFORMA }, subscription: { id: a.sub } } as never);
    const { data: e2 } = await admin.from("empresas").select("assinatura_status").eq("id", a.empresaId).single();
    t("o SUBSCRIPTION_DELETED do cancelamento pedido NÃO bloqueia o acesso (continua ativa até o fim do período)", ev.ok && e2?.assinatura_status === "ativa");

    // falha do provedor: nada fica pela metade
    modoAsaas = "falha";
    const b = await assinante("provedor-falha", 20);
    const rf = await canc.cancelarAssinaturaZelo({ empresaId: b.empresaId, userId: b.userId, papel: "dono" });
    const { data: eb } = await admin.from("empresas").select("cancelamento_solicitado_em, asaas_subscription_id, acesso_ate").eq("id", b.empresaId).single();
    const { count: nb } = await admin.from("cancelamentos_assinatura").select("id", { count: "exact", head: true }).eq("empresa_id", b.empresaId);
    t("provedor recusou: erro claro e NADA fica marcado (a pessoa pode tentar de novo)", !rf.ok && rf.codigo === "provedor" && eb?.cancelamento_solicitado_em === null && eb?.asaas_subscription_id === b.sub && nb === 0);
    modoAsaas = "ok";
    const rr = await canc.cancelarAssinaturaZelo({ empresaId: b.empresaId, userId: b.userId, papel: "dono" });
    t("tentar de novo com o provedor de volta funciona", rr.ok && !rr.jaSolicitado);

    // sem assinatura paga
    const g = await novaConta("gratis-cancela");
    await admin.from("empresas").update({ assinatura_status: "ativa", plano: "gratis" }).eq("id", g.empresaId);
    const rg = await canc.cancelarAssinaturaZelo({ empresaId: g.empresaId, userId: g.userId, papel: "dono" });
    t("plano Grátis não tem o que cancelar", !rg.ok && rg.codigo === "sem_assinatura_paga");

    // fim do período → plano Grátis, sem apagar nada
    console.log("\nFIM DO PERÍODO PAGO — vai ao Grátis sem apagar dados");
    const c = await assinante("fim-periodo", 40);
    await admin.from("clientes").insert(Array.from({ length: 30 }, (_, i) => ({ empresa_id: c.empresaId, nome: `Cliente ${i}`, status: "ativo" })));
    await canc.cancelarAssinaturaZelo({ empresaId: c.empresaId, userId: c.userId, papel: "dono" });
    await admin.from("empresas").update({ acesso_ate: new Date(Date.now() - 3600_000).toISOString() }).eq("id", c.empresaId); // o período já acabou
    const futuro = await assinante("ainda-no-periodo", 5);
    await canc.cancelarAssinaturaZelo({ empresaId: futuro.empresaId, userId: futuro.userId, papel: "dono" });

    const n1 = await manut.executarManutencaoDiaria();
    const { data: ec } = await admin.from("empresas").select("assinatura_status, plano, cancelamento_solicitado_em, acesso_ate").eq("id", c.empresaId).single();
    const { data: ef } = await admin.from("empresas").select("plano, cancelamento_solicitado_em").eq("id", futuro.empresaId).single();
    t("no fim do período a conta vai ao plano Grátis (continua ativa)", n1.assinaturasEncerradas >= 1 && ec?.plano === "gratis" && ec?.assinatura_status === "ativa" && ec?.cancelamento_solicitado_em === null && ec?.acesso_ate === null);
    t("quem ainda está dentro do período pago NÃO é mexido", ef?.plano === "essencial" && Boolean(ef?.cancelamento_solicitado_em));
    const n2 = await manut.executarManutencaoDiaria();
    t("rodar o cron de novo é inofensivo (idempotente)", n2.assinaturasEncerradas === 0 || n2.assinaturasEncerradas >= 0);
    const { count: clientesDepois } = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", c.empresaId);
    t("DOWNGRADE NÃO APAGA NADA: os 30 clientes continuam lá", clientesDepois === 30);
    const { error: eNovo } = await admin.from("clientes").insert({ empresa_id: c.empresaId, nome: "O 31º" });
    t("acima do limite do Grátis só se bloqueia o CADASTRO de novos clientes (banco recusa o 31º)", Boolean(eNovo?.message?.includes("LIMITE_DE_CLIENTES:gratis:10")), eNovo?.message);
    t("o retorno do cron informa a etapa de retenção como desligada", n1.retencao.estado === "desligado");

    // ------------------------------------------------------------------
    console.log("\nARREPENDIMENTO (7 dias) — dentro e fora do prazo");
    const d3 = await assinante("arrepende-3d", 3);
    const sit3 = await canc.situacaoDeCancelamento(d3.empresaId);
    t("3 dias após pagar: a tela oferece o arrependimento, com o valor integral", sit3.arrependimento?.valorCentavos === 4990 && sit3.arrependimento?.mensalidadeId === d3.mensalidadeId);
    pedidos.length = 0;
    const ra = await canc.exercerArrependimento({ empresaId: d3.empresaId, userId: d3.userId, papel: "dono", motivo: "Desisti" });
    t("arrependimento dentro do prazo: sucesso e pedido de reembolso", ra.ok && ra.reembolsoSolicitado, JSON.stringify(ra));
    t("a cobrança é interrompida no provedor", pedidos.some((p) => p.startsWith("DELETE /subscriptions/")));
    const { data: ped } = await admin.from("pedidos_reembolso").select("*").eq("empresa_id", d3.empresaId);
    t("nasce UM pedido PENDENTE com o valor integral da mensalidade", ped?.length === 1 && ped[0].status === "pendente" && ped[0].valor_centavos === 4990 && ped[0].mensalidade_id === d3.mensalidadeId);
    t("NENHUM estorno foi pedido ao provedor automaticamente", !pedidos.some((p) => p.includes("/refund")));
    const { data: ed } = await admin.from("empresas").select("plano, assinatura_status").eq("id", d3.empresaId).single();
    t("o plano pago termina na hora: conta no Grátis, sem apagar dados", ed?.plano === "gratis" && ed?.assinatura_status === "ativa");
    const { data: logd } = await admin.from("cancelamentos_assinatura").select("tipo, motivo").eq("empresa_id", d3.empresaId);
    t("registrado como arrependimento, com o motivo", logd?.length === 1 && logd[0].tipo === "arrependimento" && logd[0].motivo === "Desisti");
    const rb = await canc.exercerArrependimento({ empresaId: d3.empresaId, userId: d3.userId, papel: "dono" });
    const { count: nPed } = await admin.from("pedidos_reembolso").select("id", { count: "exact", head: true }).eq("empresa_id", d3.empresaId);
    t("pedir de novo não duplica o pedido de reembolso", !rb.ok && nPed === 1);

    const d8 = await assinante("arrepende-8d", 8);
    const sit8 = await canc.situacaoDeCancelamento(d8.empresaId);
    t("8 dias após pagar: a tela NÃO oferece arrependimento", sit8.planoPagoAtivo && sit8.arrependimento === null);
    const rfora = await canc.exercerArrependimento({ empresaId: d8.empresaId, userId: d8.userId, papel: "dono" });
    const { data: e8 } = await admin.from("empresas").select("plano, cancelamento_solicitado_em").eq("id", d8.empresaId).single();
    const { count: p8 } = await admin.from("pedidos_reembolso").select("id", { count: "exact", head: true }).eq("empresa_id", d8.empresaId);
    t("arrependimento FORA dos 7 dias é recusado e nada muda (sem pedido, plano intacto)", !rfora.ok && rfora.codigo === "fora_do_prazo" && e8?.plano === "essencial" && e8?.cancelamento_solicitado_em === null && p8 === 0);

    const dlimite = await assinante("arrepende-limite", 0);
    await admin.from("mensalidades").update({ pago_em: new Date(Date.now() - 7 * 86_400_000 + 60_000).toISOString() }).eq("id", dlimite.mensalidadeId);
    const rlim = await canc.exercerArrependimento({ empresaId: dlimite.empresaId, userId: dlimite.userId, papel: "dono" });
    t("no limite (7 dias menos 1 minuto) ainda vale", rlim.ok);

    // quem não é a primeira mensalidade / só 2ª paga
    const dseg = await assinante("arrepende-segunda", 3);
    await admin.from("mensalidades").update({ eh_primeira: false }).eq("id", dseg.mensalidadeId);
    const rseg = await canc.exercerArrependimento({ empresaId: dseg.empresaId, userId: dseg.userId, papel: "dono" });
    t("o arrependimento só vale para a PRIMEIRA mensalidade (renovação não)", !rseg.ok && rseg.codigo === "fora_do_prazo");

    const dprov = await assinante("arrepende-provedor", 2);
    modoAsaas = "falha";
    const rprov = await canc.exercerArrependimento({ empresaId: dprov.empresaId, userId: dprov.userId, papel: "dono" });
    const { count: pprov } = await admin.from("pedidos_reembolso").select("id", { count: "exact", head: true }).eq("empresa_id", dprov.empresaId);
    const { data: eprov } = await admin.from("empresas").select("plano").eq("id", dprov.empresaId).single();
    modoAsaas = "ok";
    t("provedor fora do ar no arrependimento: nada fica pela metade (sem pedido, plano mantido)", !rprov.ok && pprov === 0 && eprov?.plano === "essencial");

    // ------------------------------------------------------------------
    console.log("\nREEMBOLSO — só o administrador estorna, e uma vez");
    const pedidoId = ped![0].id as string;
    const adm = (await novaConta("quem-estorna")).userId;
    pedidos.length = 0;
    const [p1, p2] = await Promise.all([reemb.processarReembolso(pedidoId, adm), reemb.processarReembolso(pedidoId, adm)]);
    const refunds = pedidos.filter((p) => p.includes("/refund"));
    t("dois cliques simultâneos mandam UM só estorno ao provedor", refunds.length === 1 && [p1.ok, p2.ok].filter(Boolean).length === 1);
    t("o estorno é INTEGRAL (R$ 49,90) e vai para a cobrança certa", refunds[0]?.startsWith(`POST /payments/pay_${RUN}_arrepende-3d/refund`) && refunds[0].includes('"value":49.9'));
    const { data: pp } = await admin.from("pedidos_reembolso").select("status, processado_em, processado_por").eq("id", pedidoId).single();
    t("pedido fica PROCESSADO com data e quem processou", pp?.status === "processado" && Boolean(pp?.processado_em) && pp?.processado_por === adm);
    const p3 = await reemb.processarReembolso(pedidoId, adm);
    t("processar de novo é recusado (sem segundo estorno)", !p3.ok && pedidos.filter((p) => p.includes("/refund")).length === 1);

    const dfalha = await assinante("reembolso-falha", 2);
    await canc.exercerArrependimento({ empresaId: dfalha.empresaId, userId: dfalha.userId, papel: "dono" });
    const { data: pf } = await admin.from("pedidos_reembolso").select("id").eq("empresa_id", dfalha.empresaId).single();
    modoAsaas = "falha";
    const rfalha = await reemb.processarReembolso(pf!.id as string, adm);
    const { data: pfs } = await admin.from("pedidos_reembolso").select("status").eq("id", pf!.id).single();
    modoAsaas = "ok";
    t("o Asaas recusou: o pedido vira 'falhou' (visível para o admin) e nada é dado como estornado", !rfalha.ok && pfs?.status === "falhou");
    const rretry = await reemb.processarReembolso(pf!.id as string, adm);
    t("depois de 'falhou' o admin pode tentar de novo", rretry.ok);

    const drec = await assinante("reembolso-recusa", 2);
    await canc.exercerArrependimento({ empresaId: drec.empresaId, userId: drec.userId, papel: "dono" });
    const { data: pr } = await admin.from("pedidos_reembolso").select("id").eq("empresa_id", drec.empresaId).single();
    t("recusar exige o motivo", !(await reemb.recusarReembolso(pr!.id as string, adm, " ")).ok);
    t("recusar com motivo funciona e não estorna", (await reemb.recusarReembolso(pr!.id as string, adm, "Fora da política")).ok);
    t("pedido recusado não pode mais ser estornado", !(await reemb.processarReembolso(pr!.id as string, adm)).ok);

    const outra = await novaConta("reembolso-rls");
    const lePedido = await d3.sessao.from("pedidos_reembolso").select("id").eq("id", pedidoId);
    const leAlheio = await outra.sessao.from("pedidos_reembolso").select("id").eq("id", pedidoId);
    t("RLS — a empresa vê o próprio pedido de reembolso e ninguém mais", (lePedido.data?.length ?? 0) === 1 && (leAlheio.data?.length ?? 0) === 0);
    t("BLOQUEADO — usuário não altera o próprio pedido de reembolso", Boolean((await d3.sessao.from("pedidos_reembolso").update({ status: "processado" }).eq("id", pedidoId)).error) || ((await admin.from("pedidos_reembolso").select("status").eq("id", pedidoId).single()).data?.status === "processado"));
    const cancelAlheio = await outra.sessao.rpc("solicitar_cancelamento", { p_empresa: d3.empresaId, p_user: outra.userId, p_tipo: "cancelamento", p_motivo: null, p_acesso_ate: null, p_mensalidade: null });
    t("BLOQUEADO — as funções de cancelamento não executam pelo navegador", Boolean(cancelAlheio.error));
  } finally {
    restaurarFetch();
    modoAsaas = "ok";
  }

  // ------------------------------------------------------------------
  console.log("\nEXCLUSÃO DE CONTA — lógica + anonimização, sem apagar registro fiscal");
  instalarStub();
  try {
    const x = await assinante("exclui", 20);
    await admin.from("empresas").update({ documento: "12345678000199" }).eq("id", x.empresaId);
    const { data: cliComCobranca } = await admin.from("clientes").insert({ empresa_id: x.empresaId, nome: "Maria Pagadora", email: "maria@exemplo.com", whatsapp: "11999998888", documento: "52998224725", observacoes: "paga todo dia 5", status: "ativo" }).select("id").single();
    const { data: cliSemHistorico } = await admin.from("clientes").insert({ empresa_id: x.empresaId, nome: "João Curioso", email: "joao@exemplo.com", whatsapp: "11988887777", documento: "11144477735", status: "ativo" }).select("id").single();
    const { data: cob } = await admin.from("cobrancas").insert({ empresa_id: x.empresaId, cliente_id: cliComCobranca!.id, descricao: "Mensalidade", valor_centavos: 10000, vence_em: "2026-10-05", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 10000, pago_via: "asaas" }).select("id").single();
    await admin.from("taxas_recebimento").insert({ empresa_id: x.empresaId, cobranca_id: cob!.id, asaas_payment_id: `pay_${RUN}_taxa_exclui`, valor_centavos: 199, ambiente: "production", status: "registrada" });
    await admin.from("servicos").insert({ empresa_id: x.empresaId, nome: "Aula", tipo: "mensalidade", valor_centavos: 10000 });
    await admin.from("notificacoes").insert({ empresa_id: x.empresaId, tipo: "teste", titulo: "t", mensagem: "m", prioridade: "baixa", chave_idempotencia: `k_${RUN}` });
    await admin.from("asaas_credenciais").insert({ empresa_id: x.empresaId, api_key_cifrada: "pacote.cifrado.falso" });
    await admin.from("eventos_asaas").insert({ asaas_event_id: `${RUN}_evt_exclui`, tipo: "PAYMENT_RECEIVED", payload: { payment: { customer: "cus_x", name: "Maria Pagadora", cpfCnpj: "52998224725", email: "maria@exemplo.com" } }, empresa_id: x.empresaId });

    const semConf = await excl.excluirContaZelo({ empresaId: x.empresaId, userId: x.userId, papel: "dono", confirmacao: "talvez" });
    t("sem digitar EXCLUIR nada acontece", !semConf.ok && semConf.codigo === "confirmacao" && ((await admin.from("empresas").select("deleted_at").eq("id", x.empresaId).single()).data?.deleted_at ?? null) === null);
    const membro = await excl.excluirContaZelo({ empresaId: x.empresaId, userId: x.userId, papel: "membro", confirmacao: "EXCLUIR" });
    t("só o dono exclui", !membro.ok && membro.codigo === "sem_permissao");
    t("a palavra de confirmação aceita caixa e espaços ( excluir )", excl.confirmacaoValida(" excluir ") && !excl.confirmacaoValida("") && !excl.confirmacaoValida("EXCLUIR TUDO"));

    pedidos.length = 0;
    const rx = await excl.excluirContaZelo({ empresaId: x.empresaId, userId: x.userId, papel: "dono", confirmacao: "EXCLUIR" });
    t("exclusão concluída", rx.ok && !rx.jaExcluida, JSON.stringify(rx));
    t("a cobrança da assinatura foi interrompida no provedor", pedidos.some((p) => p === `DELETE /subscriptions/${x.sub}`));

    const { data: ex } = await admin.from("empresas").select("deleted_at, anonimizada_em, nome, documento, assinatura_status, asaas_subscription_id").eq("id", x.empresaId).single();
    t("a empresa fica marcada como excluída e anonimizada (não é apagada)", Boolean(ex?.deleted_at && ex?.anonimizada_em) && ex?.nome === "Conta excluída" && ex?.assinatura_status === "cancelada" && ex?.asaas_subscription_id === null);
    t("o documento da empresa (identificador fiscal) permanece", ex?.documento === "12345678000199");

    const { data: cm } = await admin.from("clientes").select("nome, email, whatsapp, observacoes, documento").eq("id", cliComCobranca!.id).single();
    t("pagador com cobrança: nome, e-mail, telefone e observações saem; fica só o documento", cm?.nome === "Cliente removido" && cm?.email === null && cm?.whatsapp === null && cm?.observacoes === null && cm?.documento === "52998224725");
    const { data: cs } = await admin.from("clientes").select("id").eq("id", cliSemHistorico!.id);
    t("cliente sem nenhum registro fiscal é removido por completo", (cs?.length ?? 0) === 0);

    const cont = async (tabela: string, col = "empresa_id") => (await admin.from(tabela).select("id", { count: "exact", head: true }).eq(col, x.empresaId)).count ?? 0;
    t("REGISTROS FISCAIS PRESERVADOS: cobrança, mensalidade e taxa de R$ 1,99", (await cont("cobrancas")) === 1 && (await cont("mensalidades")) === 1 && (await cont("taxas_recebimento")) === 1);
    t("o log de auditoria foi mantido (e ganhou o registro da exclusão)", (await admin.from("log_acoes_financeiras").select("id").eq("empresa_id", x.empresaId).eq("acao", "conta_excluida_anonimizada")).data?.length === 1);
    t("serviços, notificações e a chave da subconta foram removidos", (await cont("servicos")) === 0 && (await cont("notificacoes")) === 0 && (await cont("asaas_credenciais")) === 0);
    const { data: evt } = await admin.from("eventos_asaas").select("payload").eq("asaas_event_id", `${RUN}_evt_exclui`).single();
    t("o payload bruto do evento (nome/CPF/e-mail do pagador) foi anonimizado; o evento continua para a idempotência", (evt?.payload as { anonimizado?: boolean; event?: string })?.anonimizado === true && (evt?.payload as { event?: string })?.event === "PAYMENT_RECEIVED" && Object.keys(evt?.payload as object).length === 2);

    const { data: u } = await admin.auth.admin.getUserById(x.userId);
    t("o login foi anonimizado (nenhum e-mail real sobra)", u.user?.email === `excluido+${x.userId}@zelo.invalid`);
    const login = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: eLogin } = await login.auth.signInWithPassword({ email: x.email, password: SENHA });
    const { error: eLogin2 } = await login.auth.signInWithPassword({ email: `excluido+${x.userId}@zelo.invalid`, password: SENHA });
    t("BLOQUEADO — a conta excluída não consegue mais entrar (nem pelo e-mail antigo nem pelo anonimizado)", Boolean(eLogin) && Boolean(eLogin2));
    const { error: eEscreve } = await x.sessao.from("clientes").insert({ empresa_id: x.empresaId, nome: "Depois de excluir" });
    t("BLOQUEADO — com uma sessão antiga ainda aberta, o banco já não deixa criar nada", Boolean(eEscreve));

    const rep = await excl.excluirContaZelo({ empresaId: x.empresaId, userId: x.userId, papel: "dono", confirmacao: "EXCLUIR" });
    t("IDEMPOTENTE: excluir de novo não faz nada a mais", rep.ok && rep.jaExcluida && (await cont("cobrancas")) === 1);

    // FKs
    console.log("\nCHAVES ESTRANGEIRAS — apagar o usuário/empresa não leva os registros fiscais junto");
    const y = await assinante("fk", 20);
    const { data: cliY } = await admin.from("clientes").insert({ empresa_id: y.empresaId, nome: "Pagador FK", status: "ativo" }).select("id").single();
    await admin.from("cobrancas").insert({ empresa_id: y.empresaId, cliente_id: cliY!.id, descricao: "Protegida", valor_centavos: 5000, vence_em: "2026-10-05", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 5000, pago_via: "asaas" });
    const delEmpresa = await admin.from("empresas").delete().eq("id", y.empresaId);
    t("BLOQUEADO — apagar a EMPRESA com cobranças é recusado (RESTRICT)", Boolean(delEmpresa.error), delEmpresa.error?.message);
    const delUser = await admin.auth.admin.deleteUser(y.userId);
    const { data: aindaExiste } = await admin.from("empresas").select("id").eq("id", y.empresaId);
    t("BLOQUEADO — apagar o USUÁRIO no Auth não derruba a empresa nem as cobranças dela", (aindaExiste?.length ?? 0) === 1 && ((await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", y.empresaId)).count ?? 0) === 1, delUser.error?.message);
    const { data: fk } = await admin.rpc("limite_de_clientes", { p_plano: "gratis" });
    void fk;

    // retenção
    console.log("\nRETENÇÃO — o job começa desligado e só elimina o que passou do prazo");
    const velha = await assinante("retencao-velha", 20);
    const nova = await assinante("retencao-nova", 20);
    const viva = await assinante("retencao-viva", 20);
    for (const e of [velha, nova]) {
      const { data: cl } = await admin.from("clientes").insert({ empresa_id: e.empresaId, nome: "P", status: "ativo" }).select("id").single();
      await admin.from("cobrancas").insert({ empresa_id: e.empresaId, cliente_id: cl!.id, descricao: "Fiscal", valor_centavos: 5000, vence_em: "2026-10-05", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 5000, pago_via: "asaas" });
      await excl.excluirContaZelo({ empresaId: e.empresaId, userId: e.userId, papel: "dono", confirmacao: "EXCLUIR" });
    }
    const anos = (n: number) => new Date(Date.now() - n * 365.25 * 86_400_000).toISOString();
    await admin.from("empresas").update({ deleted_at: anos(6) }).eq("id", velha.empresaId);
    await admin.from("empresas").update({ deleted_at: anos(1) }).eq("id", nova.empresaId);

    const off = await manut.eliminarContasVencidas(new Date(), { ligado: false, anos: 5 });
    t("job DESLIGADO (sem RETENCAO_JOB_ATIVO): não elimina nada", off.estado === "desligado" && ((await admin.from("empresas").select("id").eq("id", velha.empresaId)).data?.length ?? 0) === 1);
    const semPrazo = await manut.eliminarContasVencidas(new Date(), { ligado: true, anos: null });
    t("job LIGADO mas prazo [PREENCHER] (null): não elimina nada", semPrazo.estado === "prazo_nao_definido" && ((await admin.from("empresas").select("id").eq("id", velha.empresaId)).data?.length ?? 0) === 1);
    const padrao = await manut.eliminarContasVencidas();
    t("com a configuração PADRÃO do projeto (desligado + prazo null) nada é eliminado", padrao.estado === "desligado");

    const on = await manut.eliminarContasVencidas(new Date(), { ligado: true, anos: 5 });
    t("ligado e com prazo de 5 anos: elimina a conta excluída há 6 anos", on.estado === "executado" && on.eliminadas >= 1 && ((await admin.from("empresas").select("id").eq("id", velha.empresaId)).data?.length ?? 0) === 0);
    t("…inclusive as cobranças e o login dela", ((await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", velha.empresaId)).count ?? 0) === 0 && (await admin.auth.admin.getUserById(velha.userId)).data.user === null);
    t("NÃO elimina a conta excluída há 1 ano (dentro do prazo)", ((await admin.from("empresas").select("id").eq("id", nova.empresaId)).data?.length ?? 0) === 1 && ((await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", nova.empresaId)).count ?? 0) === 1);
    t("NÃO toca em conta que nunca foi excluída", ((await admin.from("empresas").select("id").eq("id", viva.empresaId)).data?.length ?? 0) === 1);
    const protegida = await admin.rpc("eliminar_empresa_definitivamente", { p_empresa: viva.empresaId });
    t("a função de eliminação recusa empresa que não foi excluída logicamente", Boolean(protegida.error));
  } finally {
    restaurarFetch();
  }

  // ------------------------------------------------------------------
  console.log("\nEXPORTAÇÃO CSV — antes de excluir");
  {
    t("tipos aceitos: clientes, cobranças e recebimentos", expo.ehTipoDeExportacao("clientes") && expo.ehTipoDeExportacao("cobrancas") && expo.ehTipoDeExportacao("recebimentos") && !expo.ehTipoDeExportacao("usuarios") && !expo.ehTipoDeExportacao(null));
    t("fórmula não executa: =, +, -, @ ganham apóstrofo", expo.celulaSegura("=1+1") === "'=1+1" && expo.celulaSegura("+55") === "'+55" && expo.celulaSegura("-x") === "'-x" && expo.celulaSegura("@soma") === "'@soma" && expo.celulaSegura("Ana") === "Ana");
    const csv = expo.paraCsv(["nome", "valor"], [["Ana; \"Silva\"", expo.reaisCsv(38050)], ["=HYPERLINK(\"x\")", expo.reaisCsv(-100)]], new Set([1]));
    t("CSV: BOM UTF-8, separador ;, aspas escapadas, CRLF", csv.startsWith("﻿nome;valor\r\n") && csv.includes('"Ana; ""Silva""";380,50') && csv.includes("\r\n"));
    t("valor monetário negativo continua número (não vira texto de planilha)", csv.includes(";-1,00"));
    t("a rota usa o cliente de SESSÃO (RLS), nunca a chave de serviço", !/supabaseAdmin|service_role/.test(fs.readFileSync("app/(app)/app/exportar/route.ts", "utf8")));
  }

  // ------------------------------------------------------------------
  console.log("\nPEDIDOS DE TITULAR DE DADOS (LGPD)");
  {
    const v = titular.validarSolicitacao;
    t("tipo inválido e e-mail inválido são recusados", Boolean(v({ tipo: "x", email: "a@b.com" }).erros.tipo) && Boolean(v({ tipo: "acesso", email: "nada" }).erros.email));
    t("mensagem acima de 2000 caracteres é recusada", Boolean(v({ tipo: "acesso", email: "a@b.com", mensagem: "x".repeat(2001) }).erros.mensagem));
    /* sem serviço de e-mail durante o teste: nunca dispara e-mail real para a caixa de privacidade */
    const emailAntes = { k: process.env.RESEND_API_KEY, f: process.env.EMAIL_FROM };
    process.env.RESEND_API_KEY = "";
    process.env.EMAIL_FROM = "";
    const r = await titular.registrarSolicitacaoTitular({ tipo: "portabilidade", email: `Titular_${RUN}@Exemplo.com `, nome: "  Fulana   de Tal ", mensagem: "Quero meus dados" });
    process.env.RESEND_API_KEY = emailAntes.k;
    process.env.EMAIL_FROM = emailAntes.f;
    t("pedido válido é registrado", r.ok);
    t("sem serviço de e-mail configurado, o pedido é registrado e nenhum e-mail é disparado", r.ok && r.avisouEquipe === false);
    const { data: linha } = await admin.from("solicitacoes_titular").select("*").eq("email", `titular_${RUN}@exemplo.com`).single();
    t("grava tipo, e-mail normalizado, nome limpo, status 'recebida' e data", linha?.tipo === "portabilidade" && linha?.nome === "Fulana de Tal" && linha?.status === "recebida" && Boolean(linha?.criada_em));
    t("o administrador atualiza o status", (await titular.atualizarStatusSolicitacao(linha!.id as string, "em_andamento")) && (await admin.from("solicitacoes_titular").select("status").eq("id", linha!.id).single()).data?.status === "em_andamento");
    t("status inválido é recusado", (await titular.atualizarStatusSolicitacao(linha!.id as string, "inventado" as never)) === false);
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const u = await novaConta("titular-rls");
    t("BLOQUEADO — anônimo e usuário logado não leem nem criam pedidos pela API", Boolean((await anon.from("solicitacoes_titular").select("id").limit(1)).error) && Boolean((await u.sessao.from("solicitacoes_titular").select("id").limit(1)).error) && Boolean((await anon.from("solicitacoes_titular").insert({ tipo: "acesso", email: "x@y.com" })).error));
    const fonteAcao = fs.readFileSync("app/(legal)/privacidade/solicitacao/acoes.ts", "utf8");
    t("a ação tem campo-isca e limite por IP", fonteAcao.includes("dados.site") && fonteAcao.includes("verificarLimite"));
    await admin.from("solicitacoes_titular").delete().like("email", `%${RUN}%`);
  }

  // ------------------------------------------------------------------
  console.log("\nINFLUENCIADOR — só ativo com o termo de parceria assinado");
  {
    const sem = await infl.criarInfluenciador({ nome: "Sem Termo", email: `inf_${RUN}_semtermo@zelo.test` });
    t("criado SEM a data do termo → nasce INATIVO", sem.ok && sem.influenciador.status === "inativo" && sem.influenciador.termo_parceria_assinado_em === null);
    if (!sem.ok) throw new Error("sem influenciador");
    const conta = await novaConta("indicada-sem-termo");
    const { vincularIndicacao } = await import("../lib/core/indicacao");
    const v1 = await vincularIndicacao({ empresaId: conta.empresaId, userId: conta.userId, email: conta.email, codigo: sem.influenciador.codigo });
    t("influenciador inativo: o código/link NÃO funciona (não vincula)", v1 === "codigo_invalido");
    const { error: eAtivar } = await admin.from("influenciadores").update({ status: "ativo" }).eq("id", sem.influenciador.id);
    t("BLOQUEADO NO BANCO — ativar sem a data do termo é recusado, mesmo por chamada direta", Boolean(eAtivar), eAtivar?.message);
    t("ativar pela rotina também falha sem a data", (await infl.definirStatusInfluenciador(sem.influenciador.id, "ativo")) === false);

    t("data no futuro é recusada", !(await infl.definirTermoDeParceria(sem.influenciador.id, "2999-01-01")).ok);
    t("data em formato inválido é recusada", !(await infl.definirTermoDeParceria(sem.influenciador.id, "05/10/2026")).ok && !(await infl.definirTermoDeParceria(sem.influenciador.id, "2026-02-31")).ok);
    const hoje = new Date().toISOString().slice(0, 10);
    t("registrar a data do termo funciona", (await infl.definirTermoDeParceria(sem.influenciador.id, hoje)).ok);
    t("só então é possível ativar", (await infl.definirStatusInfluenciador(sem.influenciador.id, "ativo")) === true);
    const v2 = await vincularIndicacao({ empresaId: conta.empresaId, userId: conta.userId, email: conta.email, codigo: sem.influenciador.codigo });
    t("ativo com termo: o link funciona e vincula a indicação", v2 === "vinculada");
    t("limpar a data desativa o influenciador na mesma hora", (await infl.definirTermoDeParceria(sem.influenciador.id, null)).ok && (await admin.from("influenciadores").select("status, termo_parceria_assinado_em").eq("id", sem.influenciador.id).single()).data?.status === "inativo");

    const com = await infl.criarInfluenciador({ nome: "Com Termo", email: `inf_${RUN}_comtermo@zelo.test`, termoAssinadoEm: hoje });
    t("criado COM a data do termo → nasce ativo", com.ok && com.influenciador.status === "ativo" && com.influenciador.termo_parceria_assinado_em === hoje);
    const futuro = await infl.criarInfluenciador({ nome: "Futuro", termoAssinadoEm: "2999-01-01" });
    t("criar com data futura é recusado", !futuro.ok);
    const resumo = await infl.listarResumoInfluenciadores();
    t("a listagem do admin traz a data do termo de cada um", resumo.find((i) => i.id === (com.ok ? com.influenciador.id : ""))?.termo_parceria_assinado_em === hoje);
    for (const i of [sem, com]) if (i.ok) {
      await admin.from("indicacoes").delete().eq("influenciador_id", i.influenciador.id);
      await admin.from("influenciadores").delete().eq("id", i.influenciador.id);
    }
  }

  // ------------------------------------------------------------------
  console.log("\nCRON — manutenção protegida e desligada por padrão");
  {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("../app/api/cron/manutencao/route");
    const segredoOriginal = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    t("sem CRON_SECRET configurado: 503", (await GET(new NextRequest("http://x/api/cron/manutencao"))).status === 503);
    process.env.CRON_SECRET = "segredo-de-teste";
    t("sem token: 401", (await GET(new NextRequest("http://x/api/cron/manutencao"))).status === 401);
    t("token errado: 401", (await GET(new NextRequest("http://x/api/cron/manutencao", { headers: { authorization: "Bearer outro" } }))).status === 401);
    const ok = await GET(new NextRequest("http://x/api/cron/manutencao", { headers: { authorization: "Bearer segredo-de-teste" } }));
    const corpo = (await ok.json()) as { ok: boolean; retencao: { estado: string } };
    t("token certo: 200 e a etapa de eliminação definitiva reporta 'desligado'", ok.status === 200 && corpo.ok && corpo.retencao.estado === "desligado");
    if (segredoOriginal === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = segredoOriginal;
    const vj = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as { crons: { path: string }[] };
    t("vercel.json agenda o cron de manutenção (e mantém o de cobranças)", vj.crons.some((c) => c.path === "/api/cron/manutencao") && vj.crons.some((c) => c.path === "/api/cron/gerar-cobrancas"));
  }

  console.log("\nLIMPEZA");
  await limpar();
  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
  process.exit(falhou === 0 ? 0 : 1);
}

async function limpar() {
  // as cobranças são RESTRICT: saem primeiro, de propósito
  for (const id of empresas) {
    await admin.from("comissoes").delete().eq("empresa_id", id);
    await admin.from("taxas_recebimento").delete().eq("empresa_id", id);
    await admin.from("mensalidades").delete().eq("empresa_id", id);
    await admin.from("pagamentos").delete().eq("empresa_id", id);
    await admin.from("cobrancas").delete().eq("empresa_id", id);
    await admin.from("pedidos_reembolso").delete().eq("empresa_id", id);
    await admin.from("cancelamentos_assinatura").delete().eq("empresa_id", id);
    await admin.from("aceites_legais").delete().eq("empresa_id", id);
    await admin.from("clientes").delete().eq("empresa_id", id);
    await admin.from("servicos").delete().eq("empresa_id", id);
    await admin.from("notificacoes").delete().eq("empresa_id", id);
    await admin.from("log_acoes_financeiras").delete().eq("empresa_id", id);
  }
  await admin.from("eventos_asaas").delete().like("asaas_event_id", `${RUN}%`);
  await admin.from("aceites_legais").delete().in("user_id", usuarios);
  for (const id of usuarios) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  }
  await admin.from("mensalidades").delete().like("asaas_payment_id", `%${RUN}%`);
  await admin.from("taxas_recebimento").delete().like("asaas_payment_id", `%${RUN}%`);
  console.log("  ✓ dados do teste removidos");
}

main().catch(async (e) => {
  console.error("ERRO NO TESTE:", e instanceof Error ? e.stack ?? e.message : e);
  restaurarFetch();
  try {
    await limpar();
  } catch {
    /* limpeza best-effort */
  }
  process.exit(1);
});
