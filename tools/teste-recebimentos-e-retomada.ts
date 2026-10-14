/**
 * Conta de recebimentos + retomada do pagamento das cobranças salvas sem link.
 *
 * Parte 1 (puro): estados da conta, avisos, causa real da falha, tutorial.
 * Parte 2 (banco real, provedor SIMULADO): retomada idempotente — nunca cria
 * dois pagamentos, nunca mexe em valor/vencimento/status, respeita o limite,
 * para cedo se o provedor recusa a conta, isola empresas e dispara sozinha
 * quando a aprovação é confirmada.
 *
 * Nenhuma chamada real ao Asaas: `fetch` é interceptado para o provedor.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});
// o teste usa chave de cifra própria e provedor sandbox simulado
process.env.ASAAS_CREDENTIALS_KEY = Buffer.alloc(32, 9).toString("base64");
process.env.ASAAS_ENV = "sandbox";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let passou = 0;
let falhou = 0;
const t = (nome: string, cond: boolean, detalhe = "") => {
  if (cond) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};

/* ------------------------- provedor simulado ------------------------- */
type Pagamento = { id: string; externalReference: string; customer: string };
const pagamentos: Pagamento[] = [];
let posts = 0;
let modoProvedor: "ok" | "recusa403" | "fora500" = "ok";
let aprovacaoDoProvedor: "PENDING" | "APPROVED" = "PENDING";
const fetchReal = globalThis.fetch;

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes("sandbox.asaas.com")) return fetchReal(url as never, init as never);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
  const caminho = u.replace("https://sandbox.asaas.com/api/v3", "");
  const metodo = (init?.method ?? "GET").toUpperCase();

  if (caminho.startsWith("/myAccount/status")) {
    return json({ id: "st_1", commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: aprovacaoDoProvedor });
  }
  if (caminho.startsWith("/myAccount/documents")) return json({ data: [] });

  if (caminho.startsWith("/payments") && metodo === "GET") {
    const ref = new URLSearchParams(caminho.split("?")[1] ?? "").get("externalReference");
    return json({ object: "list", hasMore: false, totalCount: 0, limit: 10, offset: 0, data: pagamentos.filter((p) => p.externalReference === ref) });
  }
  if (caminho.startsWith("/payments") && metodo === "POST") {
    posts += 1;
    if (modoProvedor === "recusa403") return json({ errors: [{ code: "forbidden", description: "Conta sem permissão." }] }, 403);
    if (modoProvedor === "fora500") return json({}, 500);
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { externalReference: string; customer: string };
    const p = { id: `pay_sim_${pagamentos.length + 1}_${Date.now()}`, externalReference: corpo.externalReference, customer: corpo.customer };
    pagamentos.push(p);
    return json({ id: p.id, status: "PENDING" });
  }
  return json({}, 404);
}) as typeof fetch;

/* ------------------------------ dados ------------------------------ */
const usuarios: string[] = [];
const empresas: string[] = [];

async function criarEmpresa(rotulo: string) {
  const email = `rec_${rotulo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha_teste_rec_12345", email_confirm: true, user_metadata: { nome: `REC ${rotulo}` } }),
  });
  const j = await r.json();
  const userId = (j.id || j.user?.id) as string;
  usuarios.push(userId);
  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);
  await admin.from("empresas").update({ assinatura_status: "ativa", plano: "escola" }).eq("id", empresaId);
  return { empresaId, userId };
}

async function conectar(empresaId: string, aprovacao: string | null) {
  const { salvarCredencialDaEmpresa } = await import("../lib/asaas/credenciais");
  await salvarCredencialDaEmpresa(empresaId, `$sim_chave_${empresaId.slice(0, 8)}`);
  await admin
    .from("empresas")
    .update({ provider_status: "ativa", provider_aprovacao: aprovacao, asaas_account_id: `acc_sim_${empresaId.slice(0, 8)}`, asaas_wallet_id: `w_${empresaId.slice(0, 8)}` })
    .eq("id", empresaId);
}

async function cliente(empresaId: string) {
  const { data } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente Rec", email: "c@zelo.test", documento: "98765432100" }).select("id").single();
  await admin.from("clientes").update({ asaas_customer_id: `cus_sim_${data!.id.slice(0, 8)}` }).eq("id", data!.id);
  return data!.id as string;
}

async function cobranca(empresaId: string, clienteId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("cobrancas")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Cobrança rec", valor_centavos: 12345, vence_em: "2027-02-10", ...extra })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function estado(id: string) {
  const { data } = await admin.from("cobrancas").select("status, valor_centavos, vence_em, asaas_payment_id, asaas_sync_status").eq("id", id).single();
  return data!;
}

async function main() {
  const { estadoDeRecebimentos, avisoDeRecebimentos, explicarPreparoDoPagamento } = await import("../lib/core/recebimentos");
  const { passosDoTutorial, passoAtual } = await import("../lib/core/tutorial-cobranca");
  const { retomarPagamentosPendentes, contarPendentesDeLink } = await import("../lib/core/retomada-pagamentos");
  const { sincronizarCobrancaFinanceira } = await import("../lib/core/cobranca-financeira");
  const { sincronizarStatusFinanceiro } = await import("../lib/core/onboarding");

  console.log("\n=== CONTA DE RECEBIMENTOS + RETOMADA DO PAGAMENTO ===\n");

  /* ---------------- parte 1: puro ---------------- */
  console.log("1. Estados da conta (a 'ativa' do banco NÃO é 'aprovada'):");
  const c = (estadoOnboarding: "nao_iniciada" | "criando" | "criada" | "recusada" | "bloqueada", statusAprovacao: "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | null) =>
    estadoDeRecebimentos({ estadoOnboarding, statusAprovacao });
  t("não conectada", c("nao_iniciada", null) === "nao_conectada");
  t("conectando", c("criando", null) === "conectando");
  t("conexão recusada", c("recusada", null) === "conexao_recusada");
  t("bloqueada (suporte)", c("bloqueada", null) === "bloqueada");
  t("criada e aprovação NUNCA conferida → 'não conferida' (não 'pronta', não 'em análise')", c("criada", null) === "nao_conferida");
  t("criada + PENDING → em análise", c("criada", "PENDING") === "em_analise" && c("criada", "AWAITING_APPROVAL") === "em_analise");
  t("criada + APPROVED → pronta", c("criada", "APPROVED") === "pronta");
  t("criada + REJECTED → recusada", c("criada", "REJECTED") === "recusada");
  t("sem conta lida → indisponível", estadoDeRecebimentos(null) === "indisponivel");
  const sit = (documentation: "PENDING" | "APPROVED", general: "PENDING" | "APPROVED" | "REJECTED") =>
    estadoDeRecebimentos({ estadoOnboarding: "criada", statusAprovacao: "PENDING" }, { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation, general });
  t("com a situação ao vivo: documentos pendentes → cadastro incompleto", sit("PENDING", "PENDING") === "cadastro_incompleto");
  t("com a situação ao vivo: tudo aprovado → pronta", sit("APPROVED", "APPROVED") === "pronta");

  console.log("\n2. Mensagens (português simples, a ação certa, sem termo técnico):");
  const todos = ["nao_conectada", "conectando", "conexao_recusada", "bloqueada", "cadastro_incompleto", "em_analise", "nao_conferida", "recusada", "pronta", "indisponivel"] as const;
  const textos = todos.map((e) => avisoDeRecebimentos(e));
  t("só a conta 'pronta' pode gerar link", textos.filter((a) => a.podeGerarLink).map((a) => a.estado).join() === "pronta");
  t("não conectada: título, texto e botão 'Conectar conta'", textos[0].titulo === "Conecte sua conta de recebimentos" && textos[0].texto.includes("gerar o link de pagamento e enviar a cobrança ao cliente") && textos[0].acao?.rotulo === "Conectar conta");
  t("em análise: título, texto e botão 'Ver status da conta'", textos[5].titulo === "Sua conta está em análise" && textos[5].texto.includes("O Asaas ainda precisa concluir a aprovação") && textos[5].acao?.rotulo === "Ver status da conta");
  t("estados diferentes não viram a mesma mensagem", new Set(textos.map((a) => a.titulo)).size === textos.length);
  t("nenhum texto expõe termo técnico, chave ou dado pessoal", !textos.some((a) => /api|token|webhook|json|stack|cpf|cnpj|customer|subscription/i.test(`${a.titulo} ${a.texto}`)));
  t("recusada/conexão recusada/bloqueada: nenhuma 'tentativa' (não adianta insistir)", !avisoDeRecebimentos("recusada").podeTentar && !avisoDeRecebimentos("conexao_recusada").podeTentar && !avisoDeRecebimentos("bloqueada").podeTentar);

  console.log("\n3. Causa real da falha ao preparar o pagamento:");
  t("sem credencial → conta não disponível, com ação", explicarPreparoDoPagamento({ codigo: "sem_credencial" }).causa === "sem_conta");
  t("já em andamento → atualizar em instantes", explicarPreparoDoPagamento({ codigo: "em_andamento" }).causa === "em_andamento");
  t("401 → sem acesso à conta", explicarPreparoDoPagamento({ statusProvedor: 401 }).causa === "sem_acesso");
  t("403 → conta ainda não liberada (aponta a aprovação)", explicarPreparoDoPagamento({ statusProvedor: 403 }).causa === "nao_liberada" && /aprovação/.test(explicarPreparoDoPagamento({ statusProvedor: 403 }).mensagem));
  const d400 = explicarPreparoDoPagamento({ statusProvedor: 400, detalheInterno: "O cliente 123.456.789-09 e a@b.com não é válido" });
  t("400 → dados recusados, SEM CPF nem e-mail na mensagem", d400.causa === "dados_recusados" && !/123\.456|a@b\.com/.test(d400.mensagem));
  t("5xx/504 → serviço fora do ar, sem culpar o usuário", explicarPreparoDoPagamento({ statusProvedor: 500 }).causa === "provedor_fora" && explicarPreparoDoPagamento({ statusProvedor: 504 }).causa === "provedor_fora");
  t("sem indício → falha temporária (não inventa motivo)", explicarPreparoDoPagamento({}).causa === "desconhecida");
  t("nenhuma mensagem diz só 'tente novamente' sem contexto quando há causa", !/^Não conseguimos preparar o pagamento\. Tente novamente\.$/.test(explicarPreparoDoPagamento({ statusProvedor: 403 }).mensagem));

  console.log("\n4. Tutorial adaptado ao estado:");
  const p1 = (estado: (typeof todos)[number], temClientes = false, temCobrancas = false) => passosDoTutorial({ estado, temClientes, temCobrancas });
  t("cinco passos, na ordem pedida", p1("pronta").map((p) => p.id).join() === "conta,cliente,cobranca,envio,acompanhar");
  t("não conectada: começa pela conexão", passoAtual(p1("nao_conectada")) === "conta" && p1("nao_conectada")[0].acao?.rotulo === "Conectar conta");
  t("em análise: explica que precisa aguardar", /aprova/i.test(p1("em_analise")[0].texto) && passoAtual(p1("em_analise")) === "conta");
  t("pronta: o passo da conta já está feito e o atual é o cliente", p1("pronta")[0].feito && passoAtual(p1("pronta")) === "cliente");
  t("pronta com cliente: o atual é criar a cobrança", passoAtual(p1("pronta", true)) === "cobranca");
  t("sem link possível, não promete envio: 'aparecem quando o link estiver pronto'", /quando o link de pagamento estiver pronto/.test(p1("em_analise")[3].texto));
  t("com a conta pronta, fala dos botões de envio", /WhatsApp, Copiar link ou E-mail/.test(p1("pronta")[3].texto));

  /* ---------------- parte 2: banco + provedor simulado ---------------- */
  const sincronizadorReal = (id: string, emp: string, usr: string | null) => sincronizarCobrancaFinanceira(id, emp, usr);

  console.log("\n5. Empresa sem credencial: nada é tentado e nada é gravado como erro");
  {
    const a = await criarEmpresa("semconta");
    const cli = await cliente(a.empresaId);
    const id = await cobranca(a.empresaId, cli);
    const antes = posts;
    const r = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    const e = await estado(id);
    t("semConta=true e nenhuma tentativa", r.semConta && r.tentadas === 0);
    t("nenhuma chamada ao provedor", posts === antes);
    t("a cobrança segue 'pendente/pendente', sem pagamento", e.status === "pendente" && e.asaas_sync_status === "pendente" && !e.asaas_payment_id);
  }

  console.log("\n6. Conta conectada: retoma só o que é elegível, sem duplicar");
  {
    const a = await criarEmpresa("retoma");
    const b = await criarEmpresa("outra");
    await conectar(a.empresaId, "APPROVED");
    await conectar(b.empresaId, "APPROVED");
    const cli = await cliente(a.empresaId);
    const cliB = await cliente(b.empresaId);

    const elegivel1 = await cobranca(a.empresaId, cli);
    const elegivel2 = await cobranca(a.empresaId, cli, { descricao: "Segunda", valor_centavos: 50000, vence_em: "2027-03-01" });
    const jaTem = await cobranca(a.empresaId, cli, { asaas_payment_id: "pay_ja_existente", asaas_sync_status: "sincronizado" });
    const paga = await cobranca(a.empresaId, cli, { status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 12345, pago_via: "manual" });
    const cancelada = await cobranca(a.empresaId, cli, { status: "cancelada" });
    const { data: rec } = await admin
      .from("recorrencias")
      .insert({ empresa_id: a.empresaId, cliente_id: cli, descricao: "Rec", valor_centavos: 9000, dia_vencimento: 5, inicia_em: "2027-01-05", status: "ativa" })
      .select("id")
      .single();
    const deRecorrencia = await cobranca(a.empresaId, cli, { recorrencia_id: rec!.id });
    const deOutra = await cobranca(b.empresaId, cliB);

    t("a lista de pendentes conta só as elegíveis (2)", (await contarPendentesDeLink(a.empresaId)) === 2);
    const antesE2 = await estado(elegivel2);

    const r = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("preparou as 2 elegíveis", r.preparadas === 2 && r.tentadas === 2 && r.falharam === 0, JSON.stringify(r));
    const e1 = await estado(elegivel1);
    const e2 = await estado(elegivel2);
    t("cada uma ficou com identificador real e 'sincronizado'", Boolean(e1.asaas_payment_id) && Boolean(e2.asaas_payment_id) && e1.asaas_sync_status === "sincronizado");
    t("o provedor tem EXATAMENTE um pagamento por cobrança", pagamentos.filter((p) => p.externalReference === elegivel1).length === 1 && pagamentos.filter((p) => p.externalReference === elegivel2).length === 1);
    t("valor, vencimento e status originais preservados", e2.valor_centavos === antesE2.valor_centavos && e2.vence_em === antesE2.vence_em && e2.status === "pendente");
    t("a que já tinha pagamento não foi tocada", (await estado(jaTem)).asaas_payment_id === "pay_ja_existente");
    t("paga e cancelada não foram tocadas", (await estado(paga)).status === "paga" && (await estado(cancelada)).status === "cancelada" && !(await estado(paga)).asaas_payment_id);
    t("a de recorrência NÃO é sincronizada por este caminho", !(await estado(deRecorrencia)).asaas_payment_id);
    t("isolamento: a cobrança de OUTRA empresa continua intacta", !(await estado(deOutra)).asaas_payment_id);

    const postsAntes = posts;
    const r2 = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("rodar de novo não tenta nada nem cria nada (idempotente)", r2.tentadas === 0 && posts === postsAntes);
    t("sem ninguém pendente, o contador é zero", (await contarPendentesDeLink(a.empresaId)) === 0);

    // duas execuções ao mesmo tempo (duas abas / clique duplo)
    const c1 = await cobranca(a.empresaId, cli, { descricao: "Concorrente" });
    await Promise.all([
      retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal }),
      retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal }),
      retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal }),
    ]);
    t("três execuções simultâneas criam UM único pagamento", pagamentos.filter((p) => p.externalReference === c1).length === 1 && Boolean((await estado(c1)).asaas_payment_id));

    // resposta perdida: o pagamento já existe no provedor, o Zelo não gravou o id
    const perdida = await cobranca(a.empresaId, cli, { descricao: "Resposta perdida" });
    pagamentos.push({ id: "pay_perdido_1", externalReference: perdida, customer: "cus_x" });
    const postsAntesPerdida = posts;
    const r3 = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("reaproveita o pagamento que já existia no provedor (não cria outro)", r3.jaExistiam === 1 && posts === postsAntesPerdida && (await estado(perdida)).asaas_payment_id === "pay_perdido_1", JSON.stringify(r3));
    t("continua existindo só um pagamento para ela", pagamentos.filter((p) => p.externalReference === perdida).length === 1);
  }

  console.log("\n7. Limites: no máximo 20 por vez e sem laço de fundo");
  {
    const a = await criarEmpresa("limite");
    await conectar(a.empresaId, "APPROVED");
    const cli = await cliente(a.empresaId);
    for (let i = 0; i < 5; i++) await cobranca(a.empresaId, cli, { descricao: `L${i}` });
    const r = await retomarPagamentosPendentes(a.empresaId, a.userId, { limite: 2, sincronizar: sincronizadorReal });
    t("com limite 2: tenta 2 e informa quantas ainda faltam (3)", r.tentadas === 2 && r.restantes === 3, JSON.stringify(r));
    const grande = await retomarPagamentosPendentes(a.empresaId, a.userId, { limite: 9999, sincronizar: sincronizadorReal });
    t("o limite nunca passa de 20 (aqui sobram 3, todas preparadas)", grande.tentadas === 3 && grande.restantes === 0, JSON.stringify(grande));
  }

  console.log("\n8. O provedor recusa a conta ou cai: causa real e parada antecipada");
  {
    const a = await criarEmpresa("recusa");
    await conectar(a.empresaId, "PENDING");
    const cli = await cliente(a.empresaId);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(await cobranca(a.empresaId, cli, { descricao: `R${i}` }));
    modoProvedor = "recusa403";
    const postsAntes = posts;
    const r = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("403 duas vezes seguidas → para (não insiste 4 vezes)", r.tentadas === 2 && posts - postsAntes === 2 && r.restantes >= 2, JSON.stringify(r));
    t("a causa apresentada é 'conta ainda não liberada', apontando a aprovação", r.primeiraFalha?.causa === "nao_liberada" && /aprovação/.test(r.primeiraFalha.mensagem));
    t("as tentadas ficam 'erro' (retentáveis); nada é marcado como paga/cancelada", (await estado(ids[0])).asaas_sync_status === "erro" && (await estado(ids[0])).status === "pendente");
    t("as não tentadas seguem 'pendente'", (await estado(ids[3])).asaas_sync_status === "pendente");

    modoProvedor = "fora500";
    const r500 = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("500 → 'serviço fora do ar' (não culpa o usuário) e segue tentando as demais", r500.primeiraFalha?.causa === "provedor_fora" && r500.tentadas === 4, JSON.stringify(r500));

    modoProvedor = "ok";
    const rOk = await retomarPagamentosPendentes(a.empresaId, a.userId, { sincronizar: sincronizadorReal });
    t("voltando ao normal, as 4 são preparadas (inclusive as que estavam em 'erro')", rOk.preparadas === 4 && rOk.falharam === 0, JSON.stringify(rOk));
    t("e continua um pagamento por cobrança", ids.every((id) => pagamentos.filter((p) => p.externalReference === id).length === 1));
  }

  console.log("\n9. A aprovação confirmada dispara a retomada sozinha (uma única vez)");
  {
    const a = await criarEmpresa("aprova");
    await conectar(a.empresaId, "PENDING");
    const cli = await cliente(a.empresaId);
    const antes = await cobranca(a.empresaId, cli, { descricao: "Criada antes da aprovação" });
    aprovacaoDoProvedor = "PENDING";
    const s1 = await sincronizarStatusFinanceiro(a.empresaId);
    t("ainda em análise: confere o status e NÃO retoma nada", s1.ok && !s1.dado.retomada && !(await estado(antes)).asaas_payment_id);
    aprovacaoDoProvedor = "APPROVED";
    const s2 = await sincronizarStatusFinanceiro(a.empresaId);
    t("aprovou: a cobrança que estava sem link ganha pagamento", s2.ok && s2.dado.retomada?.preparadas === 1 && Boolean((await estado(antes)).asaas_payment_id), JSON.stringify(s2.ok ? s2.dado.retomada : s2));
    const { data: emp } = await admin.from("empresas").select("provider_aprovacao, provider_sincronizado_em").eq("id", a.empresaId).single();
    t("aprovação e data da sincronização gravadas", emp?.provider_aprovacao === "APPROVED" && Boolean(emp?.provider_sincronizado_em));
    const postsAntes = posts;
    const s3 = await sincronizarStatusFinanceiro(a.empresaId);
    t("conferir de novo (já aprovada) não retoma outra vez", s3.ok && !s3.dado.retomada && posts === postsAntes);
    t("um único pagamento para a cobrança", pagamentos.filter((p) => p.externalReference === antes).length === 1);
  }

  /* limpeza */
  for (const id of empresas) {
    await admin.from("log_acoes_financeiras").delete().eq("empresa_id", id);
    await admin.from("cobrancas").delete().eq("empresa_id", id);
    await admin.from("recorrencias").delete().eq("empresa_id", id);
    await admin.from("clientes").delete().eq("empresa_id", id);
    await admin.from("asaas_credenciais").delete().eq("empresa_id", id);
    await admin.from("notificacoes").delete().eq("empresa_id", id);
  }
  for (const id of usuarios) {
    await fetchReal(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  }

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  for (const id of empresas) {
    await admin.from("cobrancas").delete().eq("empresa_id", id);
    await admin.from("recorrencias").delete().eq("empresa_id", id);
    await admin.from("clientes").delete().eq("empresa_id", id);
    await admin.from("asaas_credenciais").delete().eq("empresa_id", id);
  }
  for (const id of usuarios) {
    await fetchReal(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  }
  process.exit(1);
});
