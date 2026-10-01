/**
 * Fase 10 do Core Financeiro — confiabilidade, retries e consistência.
 *
 * Fase de AUDITORIA — nenhuma funcionalidade de negócio nova. Duas
 * classes de achado corrigidas aqui:
 *
 * 1. TTL do lock 'sincronizando' (cliente/cobrança): `asaasRequisicao()`
 *    nunca lança exceção (todo erro de rede/timeout já virava
 *    `{ok:false}`), então o único jeito de uma linha ficar presa em
 *    'sincronizando' pra sempre era o PROCESSO cair no meio do caminho
 *    (deploy, crash, OOM) — sem isso, `asaas_sync_status='erro'` sempre
 *    desbloqueava. Mesmo gap que `autorizacao_solicitada_em` (Fase 6) já
 *    resolvia para autorização; agora cliente/cobrança reaproveitam
 *    `atualizado_em` (já existe, já atualizado por trigger) com o mesmo
 *    TTL de 2min.
 *
 * 2. `sincronizarClienteFinanceiro`: resposta perdida buscava por
 *    CPF/CNPJ + filtrava por `externalReference` na memória — trocado
 *    pra buscar direto por `externalReference` (confirmado que é filtro
 *    de servidor independente), mais robusto e sem depender do cliente
 *    ter documento.
 *
 * 3. `cancelarAutorizacaoPix`: o UPDATE final que marca CANCELLED não
 *    checava quantas linhas mudou — duas chamadas concorrentes (duplo
 *    clique, ou `encerrarRecorrenciaFinanceira` chamado 2x) que ambas
 *    liam a autorização como viva ANTES de qualquer trava (inofensivo:
 *    DELETE é idempotente no Asaas) ambas registrariam auditoria e
 *    reatualizariam `recorrencias`, mesmo a que perdeu a corrida do CAS
 *    local. Corrigido com `count` no UPDATE: quem não mudou nada não
 *    duplica o efeito colateral.
 *
 * Este arquivo cobre o que os arquivos de fase anteriores NÃO cobriam:
 * o TTL de recuperação em si, e um stress real de concorrência (não
 * só 2 chamadas simultâneas — várias) nos fluxos mais críticos, pra
 * validar empiricamente que o CAS aguenta, não só por revisão de
 * código.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { sincronizarClienteFinanceiro, CriadorDeClienteAsaas } from "../lib/core/cliente-financeiro";
import { sincronizarCobrancaFinanceira, CriadorDeCobrancaAsaas } from "../lib/core/cobranca-financeira";
import { encerrarRecorrenciaFinanceira, CanceladorDeAutorizacaoDaRecorrencia } from "../lib/core/recorrencia-financeira";
import { cancelarAutorizacaoPix, CanceladorDeAutorizacaoPix } from "../lib/core/autorizacao-pix";
import { prepararCicloPixAutomatico } from "../lib/core/instrucao-pagamento-pix";
import { diasUteisAte } from "../lib/core/instrucao-pagamento";
import { calcularPrimeiroVencimento } from "../lib/recorrencia";
import { hojeISO } from "../lib/cobranca";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";
import { ok } from "../lib/core/erros";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

console.log("\n=== CORE FINANCEIRO — FASE 10 (confiabilidade, retries, consistência) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_confiabilidade_fase10_12345";

async function criarEmpresa(nome: string) {
  const email = `conf10_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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

  const accountId = `acc_mock_${empresaId.slice(0, 8)}`;
  await admin
    .from("empresas")
    .update({ provider_status: "ativa", provider_aprovacao: "APPROVED", asaas_account_id: accountId })
    .eq("id", empresaId);

  return { empresaId, accountId };
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

async function criarCobranca(empresaId: string, clienteId: string, venceEm: string) {
  const { data, error } = await admin
    .from("cobrancas")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Cobrança teste", valor_centavos: 10000, vence_em: venceEm, status: "pendente" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

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

async function criarRecorrenciaComAutorizacaoAtiva(empresaId: string, clienteId: string, diaVencimento: number, iniciaEm: string) {
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

async function run() {
  console.log("\nTTL DO LOCK — cliente: linha travada há mais que o TTL é destravada (processo interrompido)");
  {
    const { empresaId } = await criarEmpresa("Empresa TTL cliente travado");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_ttl");
    const clienteId = await criarCliente(empresaId, "Cliente travado");

    // Simula o crash: uma "tentativa anterior" travou em 'sincronizando' e nunca desbloqueou.
    await admin.from("clientes").update({ asaas_sync_status: "sincronizando" }).eq("id", clienteId);
    // Margem generosa (não só a TTL em si): o relógio do processo Node local
    // e o do Postgres do Supabase não são o mesmo relógio — observado neste
    // ambiente um desvio de centenas de ms entre `atualizado_em` (gravado
    // pelo trigger com o `now()` do Postgres) e `Date.now()` local. 800ms de
    // espera + 200ms de TTL cobre isso com folga; em produção o TTL real é
    // 2min, ordens de magnitude maior que qualquer desvio de relógio real.
    await new Promise((r) => setTimeout(r, 800));

    let chamadas = 0;
    const criadorSucesso: CriadorDeClienteAsaas = async () => {
      chamadas++;
      return { ok: true, data: { id: `cus_recuperado_${Date.now()}` } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio, 200);
    t("destrava e sincroniza com sucesso", r.ok);
    t("chegou a chamar o Asaas (a trava velha não bloqueou pra sempre)", chamadas === 1);
  }

  console.log("\nTTL DO LOCK — cliente: trava RECENTE (dentro do TTL) continua bloqueando");
  {
    const { empresaId } = await criarEmpresa("Empresa TTL cliente recente");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_ttl");
    const clienteId = await criarCliente(empresaId, "Cliente trava recente");

    await admin.from("clientes").update({ asaas_sync_status: "sincronizando" }).eq("id", clienteId);

    let chamadas = 0;
    const criadorSucesso: CriadorDeClienteAsaas = async () => {
      chamadas++;
      return { ok: true, data: { id: "cus_x" } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    // TTL de 2 minutos (padrão real): a trava de agora mesmo não expirou.
    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio);
    t("continua bloqueado (conflito, não força)", !r.ok && r.erro.tipo === "conflito");
    t("NÃO chegou a chamar o Asaas", chamadas === 0);
  }

  console.log("\nTTL DO LOCK — cobrança: mesmo padrão (destrava só depois do TTL, nunca antes)");
  {
    const { empresaId } = await criarEmpresa("Empresa TTL cobranca");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_ttl");
    const clienteId = await criarCliente(empresaId, "Cliente TTL cobranca");
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${clienteId.slice(0, 8)}` }).eq("id", clienteId);
    const cobrancaId = await criarCobranca(empresaId, clienteId, "2027-06-05");

    await admin.from("cobrancas").update({ asaas_sync_status: "sincronizando" }).eq("id", cobrancaId);
    // Mesma margem generosa do teste de cliente acima (desvio de relógio entre Node local e o Postgres do Supabase).
    await new Promise((r) => setTimeout(r, 800));

    let chamadas = 0;
    const criadorSucesso: CriadorDeCobrancaAsaas = async (dados) => {
      chamadas++;
      return { ok: true, data: { id: `pay_recuperado_${Date.now()}`, customer: dados.customer } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio, { ttlTravaMs: 200 });
    t("destrava e sincroniza com sucesso", r.ok);
    t("chegou a chamar o Asaas", chamadas === 1);
  }

  console.log("\nFALHA DO ASAAS NÃO DEIXA LOCK PRESO — 4xx/5xx sempre desbloqueia pra 'erro', nunca fica 'sincronizando'");
  {
    const { empresaId } = await criarEmpresa("Empresa falha desbloqueia");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_falha");
    const clienteId = await criarCliente(empresaId, "Cliente falha desbloqueia");
    await admin.from("clientes").update({ asaas_customer_id: null }).eq("id", clienteId);

    const criador500: CriadorDeClienteAsaas = async () => ({ ok: false, status: 500, erro: "erro simulado" });
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criador500, buscadorVazio);
    t("chamada falha graciosamente", !r.ok);

    const { data: cli } = await admin.from("clientes").select("asaas_sync_status").eq("id", clienteId).single();
    t("estado final é 'erro', não 'sincronizando' — retry pode acontecer na hora", cli?.asaas_sync_status === "erro");
  }

  console.log("\nCONCORRÊNCIA REAL — 8 chamadas simultâneas de sincronizarCobrancaFinanceira na MESMA cobrança");
  {
    const { empresaId } = await criarEmpresa("Empresa stress cobranca");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_stress");
    const clienteId = await criarCliente(empresaId, "Cliente stress");
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${clienteId.slice(0, 8)}` }).eq("id", clienteId);
    const cobrancaId = await criarCobranca(empresaId, clienteId, "2027-07-05");

    let chamadasCriador = 0;
    const criadorSucesso: CriadorDeCobrancaAsaas = async (dados) => {
      chamadasCriador++;
      await new Promise((r) => setTimeout(r, 15)); // simula latência real, amplia a janela de corrida
      return { ok: true, data: { id: "pay_stress_unico", customer: dados.customer } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const N = 8;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio))
    );

    // A vencedora do CAS resolve `ok(jaExistia:false)`. Quem perde a corrida
    // pode receber `conflito` OU, se checar depois da vencedora já ter
    // terminado, `ok(jaExistia:true)` — ambos corretos, mesma ambiguidade
    // já documentada e aceita nas Fases 5–8. Nunca um erro de outro tipo.
    t(
      "todas as 8 chamadas resolvem sem erro inesperado (sucesso ou conflito, nunca outro tipo de erro)",
      resultados.every((r) => r.ok || (!r.ok && r.erro.tipo === "conflito"))
    );
    t(
      "quem teve sucesso concorda no mesmo asaas_payment_id (nenhuma duplicata)",
      resultados.every((r) => !r.ok || r.dado.asaasPaymentId === "pay_stress_unico")
    );
    t("o Asaas foi chamado UMA única vez, mesmo com 8 tentativas simultâneas", chamadasCriador === 1);

    const { count } = await admin.from("log_acoes_financeiras").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("acao", "cobranca_sincronizacao_concluida");
    t("só uma auditoria de conclusão (não 8)", count === 1);
  }

  console.log("\nCONCORRÊNCIA REAL — 8 chamadas simultâneas de sincronizarClienteFinanceiro no MESMO cliente");
  {
    const { empresaId } = await criarEmpresa("Empresa stress cliente");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_stress");
    const clienteId = await criarCliente(empresaId, "Cliente stress");

    let chamadasCriador = 0;
    const criadorSucesso: CriadorDeClienteAsaas = async () => {
      chamadasCriador++;
      await new Promise((r) => setTimeout(r, 15));
      return { ok: true, data: { id: "cus_stress_unico" } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const N = 8;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio))
    );

    t(
      "todas as 8 chamadas resolvem sem erro inesperado (sucesso ou conflito, nunca outro tipo de erro)",
      resultados.every((r) => r.ok || (!r.ok && r.erro.tipo === "conflito"))
    );
    t(
      "quem teve sucesso concorda no mesmo asaas_customer_id",
      resultados.every((r) => !r.ok || r.dado.asaasCustomerId === "cus_stress_unico")
    );
    t("o Asaas foi chamado UMA única vez", chamadasCriador === 1);
  }

  console.log("\nCONCORRÊNCIA REAL — 8 chamadas simultâneas de prepararCicloPixAutomatico na MESMA recorrência");
  {
    const { diaVencimento, iniciaEm } = cicloComDistancia("dentro");
    const { empresaId } = await criarEmpresa("Empresa stress ciclo pix");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_stress");
    const clienteId = await criarCliente(empresaId, "Cliente stress ciclo");
    // Pré-sincronizado: senão `sincronizarClienteFinanceiro` (chamado
    // internamente, sem fake injetado) faria uma chamada HTTP real ao
    // Asaas com credencial fake, confundindo o resultado deste teste
    // (que é sobre a concorrência do CICLO, não do cliente — essa já
    // tem teste próprio acima).
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${clienteId.slice(0, 8)}` }).eq("id", clienteId);
    const { recorrenciaId } = await criarRecorrenciaComAutorizacaoAtiva(empresaId, clienteId, diaVencimento, iniciaEm);

    let chamadasCriador = 0;
    const criadorSucesso: CriadorDeCobrancaAsaas = async (dados) => {
      chamadasCriador++;
      await new Promise((r) => setTimeout(r, 15));
      return { ok: true, data: { id: "pay_ciclo_stress_unico", customer: dados.customer } as any };
    };
    const buscadorVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });
    const listadorInstrucaoVazio = async () => ({ ok: true as const, data: { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] } });

    const N = 8;
    const resultados = await Promise.all(
      Array.from({ length: N }, () =>
        prepararCicloPixAutomatico(recorrenciaId, empresaId, null, criadorSucesso, buscadorVazio, listadorInstrucaoVazio)
      )
    );

    const semErroInesperado = resultados.every((r) => r.ok || (!r.ok && r.erro.tipo === "conflito"));
    t("nenhuma chamada quebra com erro inesperado (só sucesso ou conflito)", semErroInesperado);
    t("o Asaas só criou UM payment mesmo com 8 tentativas simultâneas", chamadasCriador === 1);

    const { count: countCobrancas } = await admin
      .from("cobrancas")
      .select("*", { count: "exact", head: true })
      .eq("recorrencia_id", recorrenciaId);
    t("só UMA cobrança foi criada pra este ciclo (índice único no banco segurou)", countCobrancas === 1);
  }

  console.log("\nCONCORRÊNCIA REAL — 8 chamadas simultâneas de encerrarRecorrenciaFinanceira na MESMA recorrência");
  {
    const { empresaId } = await criarEmpresa("Empresa stress encerrar");
    const clienteId = await criarCliente(empresaId, "Cliente stress encerrar");
    const { data: rec, error } = await admin
      .from("recorrencias")
      .insert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        descricao: "Mensalidade stress encerrar",
        valor_centavos: 35000,
        periodicidade: "mensal",
        dia_vencimento: 5,
        inicia_em: "2027-01-01",
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
        asaas_authorization_id: `auth_stress_${rec.id.slice(0, 8)}`,
        status: "ACTIVE",
        finish_date: "2032-01-01",
        retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
      })
      .select("id")
      .single();
    if (erroAuth) throw new Error(erroAuth.message);
    await admin.from("recorrencias").update({ autorizacao_atual_id: auth.id }).eq("id", rec.id);

    // Achado real desta fase: `encerrarRecorrenciaFinanceira` decide "a
    // autorização está viva?" ANTES de qualquer trava — 8 chamadas
    // concorrentes podem todas ler "viva" e todas chamarem o cancelamento.
    // Inofensivo (DELETE é idempotente no Asaas, 404 já é tratado como
    // sucesso), mas sem contagem no UPDATE final de `cancelarAutorizacaoPix`
    // cada uma duplicaria auditoria e reatualização de `recorrencias` — é
    // exatamente isso que o teste de concorrência de `cancelarAutorizacaoPix`
    // abaixo verifica direto na função real (aqui o `cancelador` injetado
    // substitui a função inteira, não só a chamada Asaas, então não
    // exercita esse detalhe — só o resultado final da recorrência).
    let chamadasCancelamento = 0;
    const cancelarAutorizacaoContaChamadas: CanceladorDeAutorizacaoDaRecorrencia = async (autorizacaoId) => {
      chamadasCancelamento++;
      await new Promise((r) => setTimeout(r, 15));
      await admin
        .from("autorizacoes_pix")
        .update({ status: "CANCELLED", cancellation_date: new Date().toISOString(), cancellation_reason: "teste stress" })
        .eq("id", autorizacaoId);
      await admin.from("recorrencias").update({ autorizacao_atual_id: null }).eq("autorizacao_atual_id", autorizacaoId);
      return ok({ autorizacaoId });
    };

    const N = 8;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => encerrarRecorrenciaFinanceira(rec.id, empresaId, null, undefined, cancelarAutorizacaoContaChamadas))
    );

    const sucessos = resultados.filter((r) => r.ok);
    t("exatamente UMA das 8 chamadas conclui o encerramento", sucessos.length === 1);
    t("as outras 7 recebem conflito (recorrência já encerrada), não erro genérico", resultados.filter((r) => !r.ok).every((r) => !r.ok && r.erro.tipo === "conflito"));
    console.log(`  · info: cancelamento invocado ${chamadasCancelamento}x nas 8 tentativas (esperado ≥1 — risco residual documentado, harmless)`);

    const { data: recFinal } = await admin.from("recorrencias").select("status, autorizacao_atual_id").eq("id", rec.id).single();
    t("recorrência termina 'encerrada' com o vínculo desfeito", recFinal?.status === "encerrada" && recFinal?.autorizacao_atual_id === null);
  }

  console.log("\nCONCORRÊNCIA REAL — 8 chamadas simultâneas de cancelarAutorizacaoPix (função real) na MESMA autorização");
  {
    const { empresaId } = await criarEmpresa("Empresa stress cancelar autorizacao");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_stress");
    const clienteId = await criarCliente(empresaId, "Cliente stress cancelar auth");
    const { data: rec, error } = await admin
      .from("recorrencias")
      .insert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        descricao: "Mensalidade stress cancelar auth",
        valor_centavos: 35000,
        periodicidade: "mensal",
        dia_vencimento: 5,
        inicia_em: "2027-01-01",
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
        asaas_authorization_id: `auth_stress2_${rec.id.slice(0, 8)}`,
        status: "ACTIVE",
        finish_date: "2032-01-01",
        retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS",
      })
      .select("id")
      .single();
    if (erroAuth) throw new Error(erroAuth.message);
    await admin.from("recorrencias").update({ autorizacao_atual_id: auth.id }).eq("id", rec.id);

    let chamadasAsaas = 0;
    // Fake só no nível do Asaas — deixa a função real (`cancelarAutorizacaoPix`,
    // com o `count` do Fase 10) rodar de verdade, CAS local incluído.
    const canceladorAsaas: CanceladorDeAutorizacaoPix = async (id) => {
      chamadasAsaas++;
      await new Promise((r) => setTimeout(r, 15));
      return { ok: true, data: { id, status: "CANCELLED" } as any };
    };

    const N = 8;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => cancelarAutorizacaoPix(auth.id, empresaId, null, "teste stress", canceladorAsaas))
    );

    t("nenhuma chamada quebra com erro inesperado (só sucesso ou conflito)", resultados.every((r) => r.ok || (!r.ok && r.erro.tipo === "conflito")));

    const { data: authFinal } = await admin.from("autorizacoes_pix").select("status").eq("id", auth.id).single();
    t("autorização termina CANCELLED (estado final correto, sem corrupção)", authFinal?.status === "CANCELLED");

    const { count: countAuditoria } = await admin
      .from("log_acoes_financeiras")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("acao", "autorizacao_pix_cancelada")
      .eq("entidade_id", auth.id);
    t("exatamente UMA auditoria 'autorizacao_pix_cancelada' — sem duplicar (fix desta fase)", countAuditoria === 1);
    console.log(`  · info: Asaas chamado ${chamadasAsaas}x nas 8 tentativas (pode ser >1 — DELETE idempotente lá, sem risco financeiro; risco residual documentado)`);
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
