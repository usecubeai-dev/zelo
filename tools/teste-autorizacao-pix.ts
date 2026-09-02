/**
 * Fase 6 do Core Financeiro — autorização Pix Automático.
 *
 * Mesmo espírito das fases anteriores: sem credencial real, o caminho
 * "sem credencial"/"conta não apta" é testado de verdade, sem mock. Para
 * sucesso/erro/resposta-perdida/webhook — onde o Asaas precisa
 * "responder algo" — `criador`/`listador`/`consultor`/`cancelador`
 * injetados simulam a resposta, mesmo padrão de DI das Fases 2–5.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  criarAutorizacaoPix,
  cancelarAutorizacaoPix,
  CriadorDeAutorizacaoPix,
} from "../lib/core/autorizacao-pix";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";
import { transicaoValida } from "../lib/core/autorizacao";

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

console.log("\n=== CORE FINANCEIRO — FASE 6 (autorização Pix Automático) ===\n");

t(
  "domínio: ACTIVE→CREATED é transição impossível (regressão não é permitida)",
  !transicaoValida("ACTIVE", "CREATED")
);

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_autorizacao_pix_12345";

async function criarEmpresa(nome: string, apta = true) {
  const email = `pix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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

async function criarCliente(empresaId: string, nome: string, comCustomerId = true) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome, email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test`, documento: "98765432100" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (comCustomerId) {
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${data.id.slice(0, 8)}` }).eq("id", data.id);
  }
  return data.id as string;
}

async function criarRecorrencia(empresaId: string, clienteId: string, status = "ativa") {
  const { data, error } = await admin
    .from("recorrencias")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Mensalidade de teste",
      valor_centavos: 35000,
      periodicidade: "mensal",
      dia_vencimento: 5,
      inicia_em: "2027-01-05",
      status,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let chamadasCriador = 0;
const criadorSucesso: CriadorDeAutorizacaoPix = async (dados) => {
  chamadasCriador++;
  return {
    ok: true,
    data: {
      id: `auth_mock_${Math.random().toString(36).slice(2, 10)}`,
      status: "CREATED",
      customerId: dados.customerId,
      contractId: dados.contractId,
      frequency: dados.frequency,
      startDate: dados.startDate,
      finishDate: dados.finishDate,
      value: dados.valorCentavos / 100,
      paymentCreationMode: "MANUAL",
      retryPolicy: dados.retryPolicy,
      payload: "00020126580014BR.GOV.BCB.PIX_MOCK_PAYLOAD",
      encodedImage: "aGVsbG8=",
    } as any,
  };
};
const criador4xx: CriadorDeAutorizacaoPix = async () => ({ ok: false, status: 400, erro: "dados inválidos" });
const criadorTimeout: CriadorDeAutorizacaoPix = async () => ({ ok: false, status: 504, erro: "timeout simulado" });
const LISTA_VAZIA = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as any[] };
const listadorVazio = async () => ({ ok: true, data: { ...LISTA_VAZIA } });

async function run() {
  console.log("INTEGRAÇÃO REAL — sem credencial de subconta");
  {
    const { empresaId } = await criarEmpresa("Empresa sem conta financeira");
    const clienteId = await criarCliente(empresaId, "Cliente sem conta");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const r = await criarAutorizacaoPix(recorrenciaId, empresaId);
    t("sem credencial salva, falha com integracao_externa (não finge sucesso)", !r.ok && r.erro.tipo === "integracao_externa");
  }

  console.log("\nVALIDAÇÃO — conta não apta (sem aprovação completa)");
  {
    const { empresaId } = await criarEmpresa("Empresa não apta", false);
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente conta não apta");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    const r = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any);
    t("conta sem aprovação completa não solicita autorização", !r.ok && r.erro.tipo === "integracao_externa");
    t("criador não é chamado quando a conta não está apta", chamadasCriador === 0);
  }

  console.log("\nVALIDAÇÃO — recorrência inválida / cliente arquivado / autorização já existente");
  {
    const { empresaId } = await criarEmpresa("Empresa validação");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente validação");

    const rInexistente = await criarAutorizacaoPix("00000000-0000-0000-0000-000000000000", empresaId);
    t("recorrência inexistente devolve nao_encontrado", !rInexistente.ok && rInexistente.erro.tipo === "nao_encontrado");

    const recPausada = await criarRecorrencia(empresaId, clienteId, "pausada");
    const rPausada = await criarAutorizacaoPix(recPausada, empresaId);
    t("recorrência pausada não pode solicitar autorização", !rPausada.ok && rPausada.erro.tipo === "conflito");

    const clienteArquivado = await criarCliente(empresaId, "Cliente a arquivar", false);
    const recArquivada = await criarRecorrencia(empresaId, clienteArquivado);
    await admin.from("clientes").update({ status: "arquivado" }).eq("id", clienteArquivado);
    const rArquivado = await criarAutorizacaoPix(recArquivada, empresaId);
    t("cliente arquivado bloqueia a solicitação", !rArquivado.ok && rArquivado.erro.tipo === "conflito");

    const recComAutorizacao = await criarRecorrencia(empresaId, clienteId);
    const fakeAuthId = "00000000-0000-0000-0000-000000000001";
    await admin.from("autorizacoes_pix").insert({
      id: fakeAuthId,
      empresa_id: empresaId,
      recorrencia_id: recComAutorizacao,
      cliente_id: clienteId,
      status: "ACTIVE",
      finish_date: "2032-01-01",
      retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
    });
    await admin.from("recorrencias").update({ autorizacao_atual_id: fakeAuthId }).eq("id", recComAutorizacao);
    const rJaExiste = await criarAutorizacaoPix(recComAutorizacao, empresaId);
    t("recorrência com autorização viva não permite outra", !rJaExiste.ok && rJaExiste.erro.tipo === "conflito");
  }

  console.log("\nMOCK — caminho de sucesso (primeiro pagamento ≠ autorização ativa)");
  let empresaSucesso = "";
  let recorrenciaSucesso = "";
  let autorizacaoSucessoId = "";
  {
    const { empresaId } = await criarEmpresa("Empresa sucesso mock");
    empresaSucesso = empresaId;
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente sucesso");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);
    recorrenciaSucesso = recorrenciaId;

    chamadasCriador = 0;
    const r = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any);
    t("solicitação com sucesso devolve QR (payload + encodedImage)", r.ok && !!r.dado.payload && !!r.dado.encodedImage);
    t("status inicial é CREATED, NÃO ACTIVE — QR criado não é pagamento confirmado", r.ok && r.dado.status === "CREATED");
    if (r.ok) autorizacaoSucessoId = r.dado.autorizacaoId;

    const { data: linhaRec } = await admin.from("recorrencias").select("autorizacao_atual_id, autorizacao_solicitada_em").eq("id", recorrenciaId).single();
    t("recorrência aponta pra autorização e o lock foi liberado", linhaRec?.autorizacao_atual_id === autorizacaoSucessoId && !linhaRec.autorizacao_solicitada_em);

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("log de auditoria registra a criação", (log ?? []).some((l) => l.acao === "autorizacao_pix_criada"));

    console.log("\nIDEMPOTÊNCIA — chamar de novo não duplica");
    chamadasCriador = 0;
    const r2 = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any);
    t("segunda chamada é recusada (já existe autorização viva)", !r2.ok && r2.erro.tipo === "conflito");
    t("segunda chamada NÃO chama o Asaas de novo", chamadasCriador === 0);
  }

  console.log("\nASAAS — erro/timeout tratado como falha, sem travar a recorrência");
  for (const [nome, criadorErro] of [
    ["4xx", criador4xx],
    ["timeout (504)", criadorTimeout],
  ] as const) {
    const { empresaId } = await criarEmpresa(`Empresa erro ${nome}`);
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, `Cliente erro ${nome}`);
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    const r = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorErro, listadorVazio as any);
    t(`${nome}: devolve integracao_externa`, !r.ok && r.erro.tipo === "integracao_externa");

    const { data: linha } = await admin.from("recorrencias").select("autorizacao_atual_id, autorizacao_solicitada_em").eq("id", recorrenciaId).single();
    t(`${nome}: recorrência NÃO fica travada esperando o TTL`, !linha?.autorizacao_atual_id && !linha?.autorizacao_solicitada_em);

    const r2 = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any);
    t(`${nome}: retry consegue solicitar com sucesso`, r2.ok);
  }

  console.log("\nRESPOSTA PERDIDA — Asaas já tem a autorização (contractId bate), não duplica");
  {
    const { empresaId } = await criarEmpresa("Empresa resposta perdida");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente perdido");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    const contractIdEsperado = recorrenciaId.replace(/-/g, "");
    const listadorComAchado = async () => ({
      ok: true,
      data: {
        ...LISTA_VAZIA,
        data: [
          {
            id: "auth_recuperada_123",
            status: "CREATED",
            customerId: "cus_x",
            contractId: contractIdEsperado,
            frequency: "MONTHLY",
            startDate: "2027-01-01",
            finishDate: "2032-01-01",
            paymentCreationMode: "MANUAL",
            retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
          },
        ],
      },
    });

    chamadasCriador = 0;
    const r = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorComAchado as any);
    t("recupera a autorização existente em vez de criar outra", r.ok && r.dado.autorizacaoId !== "" && r.dado.jaExistia === true);
    t("NÃO chama o criador quando já encontrou por contractId", chamadasCriador === 0);

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("recuperação é auditada", (log ?? []).some((l) => l.acao === "autorizacao_pix_recuperada"));
  }

  console.log("\nCONCORRÊNCIA — duplo clique / duas solicitações simultâneas");
  {
    const { empresaId } = await criarEmpresa("Empresa concorrência");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente concorrente");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    chamadasCriador = 0;
    const [ra, rb] = await Promise.all([
      criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any),
      criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any),
    ]);
    // A perdedora do lock tem dois desfechos válidos, dependendo de quem
    // termina primeiro: "conflito" (a vencedora ainda não tinha
    // terminado quando ela releu o estado) OU `ok` idempotente com
    // `jaExistia: true` (a vencedora já tinha terminado). As duas provam
    // a mesma coisa — nenhuma duplicata — e só a contagem de chamadas ao
    // Asaas é o que realmente prova a exclusão mútua.
    const ambasResolvidasSemDuplicar =
      (ra.ok && rb.ok) || (ra.ok && !rb.ok && rb.erro.tipo === "conflito") || (!ra.ok && rb.ok && ra.erro.tipo === "conflito");
    t("as duas chamadas resolvem sem erro inesperado (conflito ou sucesso idempotente)", ambasResolvidasSemDuplicar);
    t("só UMA chegou a chamar o Asaas (exclusão mútua real)", chamadasCriador === 1);
  }

  console.log("\nWEBHOOK — CREATED / ACTIVATED / REFUSED / CANCELLED / EXPIRED / duplicado / fora de ordem / tenant desconhecido");
  {
    const { processarEventoWebhook } = await import("../lib/asaas/webhook");
    const { empresaId } = await criarEmpresa("Empresa webhook autorização");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente webhook");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    const { data: autorizacaoInserida } = await admin
      .from("autorizacoes_pix")
      .insert({
        empresa_id: empresaId,
        recorrencia_id: recorrenciaId,
        cliente_id: clienteId,
        asaas_authorization_id: "auth_webhook_teste",
        status: "CREATED",
        finish_date: "2032-01-01",
        retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
      })
      .select("id")
      .single();
    await admin.from("recorrencias").update({ autorizacao_atual_id: autorizacaoInserida!.id }).eq("id", recorrenciaId);

    const payloadBase = (event: string, overrides: Record<string, unknown> = {}) => ({
      id: `evt_${event}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event: event as any,
      dateCreated: new Date().toISOString(),
      authorization: {
        id: "auth_webhook_teste",
        status: "ACTIVE",
        customerId: "cus_x",
        contractId: recorrenciaId.replace(/-/g, ""),
        frequency: "MONTHLY",
        startDate: "2027-01-01",
        ...overrides,
      },
    });

    // tenant desconhecido: authorization.id que não existe em nenhuma linha
    const rDesconhecido = await processarEventoWebhook(payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED", { id: "auth_nunca_existiu" }) as any);
    t("evento com authorization.id desconhecido é recusado", !rDesconhecido.ok);

    // ACTIVATED: CREATED -> ACTIVE
    const evtAtivada = payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED");
    const rAtivada = await processarEventoWebhook(evtAtivada as any);
    t("ACTIVATED processado com sucesso", rAtivada.ok);
    const { data: linhaAtiva } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacaoInserida!.id).single();
    t("status local vira ACTIVE", linhaAtiva?.status === "ACTIVE");

    // duplicado: reenviar o MESMO evento (mesmo id) é idempotente
    const rDuplicado = await processarEventoWebhook(evtAtivada as any);
    t("reenviar o mesmo evento é idempotente", rDuplicado.ok && "idempotente" in rDuplicado && rDuplicado.idempotente === true);

    // fora de ordem: tentar voltar pra CREATED depois de ACTIVE deveria ser recusado (não existe esse evento real, mas simula reconciliação de payload malformado)
    const { data: linhaAntes } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacaoInserida!.id).single();
    const evtForaDeOrdem = payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED");
    await processarEventoWebhook(evtForaDeOrdem as any);
    const { data: linhaDepois } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacaoInserida!.id).single();
    t("evento fora de ordem (CREATED depois de ACTIVE) não regride o estado", linhaAntes?.status === linhaDepois?.status);

    // CANCELLED: libera a recorrência
    const evtCancelada = payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED", { status: "CANCELLED", cancellationReason: "Revogado pelo pagador" });
    const rCancelada = await processarEventoWebhook(evtCancelada as any);
    t("CANCELLED processado com sucesso", rCancelada.ok);
    const { data: linhaCancelada } = await admin.from("autorizacoes_pix").select("status, cancellation_reason").eq("id", autorizacaoInserida!.id).single();
    t("status local vira CANCELLED com motivo", linhaCancelada?.status === "CANCELLED" && linhaCancelada.cancellation_reason === "Revogado pelo pagador");
    const { data: recLiberada } = await admin.from("recorrencias").select("autorizacao_atual_id").eq("id", recorrenciaId).single();
    t("recorrência é liberada (autorizacao_atual_id volta a null)", recLiberada?.autorizacao_atual_id === null);

    // REFUSED e EXPIRED em outra autorização (CREATED, não pode ir de CANCELLED pra REFUSED)
    const { data: autorizacao2 } = await admin
      .from("autorizacoes_pix")
      .insert({
        empresa_id: empresaId,
        recorrencia_id: recorrenciaId,
        cliente_id: clienteId,
        asaas_authorization_id: "auth_webhook_teste_2",
        status: "CREATED",
        finish_date: "2032-01-01",
        retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
      })
      .select("id")
      .single();
    const evtRecusada = payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED", { id: "auth_webhook_teste_2", status: "REFUSED" });
    const rRecusada = await processarEventoWebhook(evtRecusada as any);
    t("REFUSED processado com sucesso", rRecusada.ok);
    const { data: linhaRecusada } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacao2!.id).single();
    t("status local vira REFUSED", linhaRecusada?.status === "REFUSED");

    const { data: autorizacao3 } = await admin
      .from("autorizacoes_pix")
      .insert({
        empresa_id: empresaId,
        recorrencia_id: recorrenciaId,
        cliente_id: clienteId,
        asaas_authorization_id: "auth_webhook_teste_3",
        status: "ACTIVE",
        finish_date: "2032-01-01",
        retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
      })
      .select("id")
      .single();
    const evtExpirada = payloadBase("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED", { id: "auth_webhook_teste_3", status: "EXPIRED" });
    const rExpirada = await processarEventoWebhook(evtExpirada as any);
    t("EXPIRED processado com sucesso", rExpirada.ok);
    const { data: linhaExpirada } = await admin.from("autorizacoes_pix").select("status").eq("id", autorizacao3!.id).single();
    t("status local vira EXPIRED", linhaExpirada?.status === "EXPIRED");
  }

  console.log("\nCANCELAMENTO — via caso de uso");
  {
    const { empresaId } = await criarEmpresa("Empresa cancelamento autorização");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_pix");
    const clienteId = await criarCliente(empresaId, "Cliente cancelamento");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId);

    const r = await criarAutorizacaoPix(recorrenciaId, empresaId, null, criadorSucesso, listadorVazio as any);
    if (!r.ok) throw new Error("setup falhou: " + r.erro.mensagem);

    const canceladorSucesso = async () => ({ ok: true, data: { id: "x", status: "CANCELLED" } as any });
    const rCancel = await cancelarAutorizacaoPix(r.dado.autorizacaoId, empresaId, null, "teste", canceladorSucesso as any);
    t("cancelamento via caso de uso funciona", rCancel.ok);

    const { data: linha } = await admin.from("autorizacoes_pix").select("status").eq("id", r.dado.autorizacaoId).single();
    t("status local vira CANCELLED", linha?.status === "CANCELLED");

    const { data: rec } = await admin.from("recorrencias").select("autorizacao_atual_id").eq("id", recorrenciaId).single();
    t("recorrência é liberada", rec?.autorizacao_atual_id === null);
  }

  console.log("\nSEGURANÇA — tenant isolation e grants restritos");
  {
    const a = await criarEmpresa("Tenant A autorização");
    const b = await criarEmpresa("Tenant B autorização");
    await salvarCredencialDaEmpresa(a.empresaId, "chave_fake_teste_pix");
    const clienteDeA = await criarCliente(a.empresaId, "Cliente do tenant A");
    const recorrenciaDeA = await criarRecorrencia(a.empresaId, clienteDeA);

    const rCruzado = await criarAutorizacaoPix(recorrenciaDeA, b.empresaId);
    t("solicitar autorização de recorrência de A usando empresaId de B falha", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    const rSucesso = await criarAutorizacaoPix(recorrenciaDeA, a.empresaId, null, criadorSucesso, listadorVazio as any);
    if (!rSucesso.ok) throw new Error("setup falhou: " + rSucesso.erro.mensagem);

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email: a.email, password: SENHA_TESTE });
    const { error: erroForja } = await sessao.from("autorizacoes_pix").update({ status: "ACTIVE" }).eq("id", rSucesso.dado.autorizacaoId);
    t("dono da recorrência NÃO consegue alterar status da autorização direto (grant de tabela revogado)", erroForja?.code === "42501");
  }

  console.log("\nCAMADAS — Server Action chama o caso de uso, não fala com o Asaas direto");
  {
    const conteudo = fs.readFileSync("app/(app)/app/recorrencias/acoes.ts", "utf8");
    t("acoes.ts importa lib/core/autorizacao-pix", conteudo.includes('from "@/lib/core/autorizacao-pix"'));
    t("existe ação de solicitar autorização", conteudo.includes("export async function solicitarAutorizacaoPixAcao"));
    t("existe ação de cancelar autorização", conteudo.includes("export async function cancelarAutorizacaoPixAcao"));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
  await admin.from("autorizacoes_pix").delete().in("empresa_id", empresas);
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
