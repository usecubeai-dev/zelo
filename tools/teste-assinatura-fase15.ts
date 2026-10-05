/**
 * Fase 15 do Core Financeiro — assinatura e planos da própria Zelo.
 *
 * Dois domínios que este teste cobre sem misturar:
 *  - `lib/core/assinatura.ts` (transições, origem, uso do plano) — puro.
 *  - o webhook em contexto "plataforma" (a mensalidade do Zelo sendo paga
 *    ou atrasada), exercitado de verdade via `processarEventoWebhook`,
 *    nunca inserindo `assinatura_status` direto no banco.
 *
 * Sem `ASAAS_API_KEY`/`ASAAS_PLATFORM_ACCOUNT_ID` reais: como em toda
 * fase anterior sem credencial, o `ASAAS_PLATFORM_ACCOUNT_ID` é definido
 * aqui só para o processo de teste poder simular um evento de conta
 * "plataforma" — não é uma chamada real ao Asaas, só o roteamento interno
 * do webhook sendo testado com uma conta plataforma conhecida.
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

process.env.ASAAS_PLATFORM_ACCOUNT_ID = "acc_plataforma_teste_fase15";
const CONTA_PLATAFORMA = process.env.ASAAS_PLATFORM_ACCOUNT_ID;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

console.log("\n=== CORE FINANCEIRO — FASE 15 (assinatura e planos da própria Zelo) ===\n");

async function main() {
  const {
    transicaoValidaAssinatura,
    origemPermitidaAssinatura,
    obterUsoDoPlano,
  } = await import("../lib/core/assinatura");
  const { situacaoDaConta, avisoDaConta } = await import("../lib/empresa");
  const { processarEventoWebhook } = await import("../lib/asaas/webhook");
  const { LIMITE_DE_CLIENTES, NOME_DO_PLANO } = await import("../lib/plano");

  console.log("DOMÍNIO — transições válidas de assinatura_status");
  {
    t("trial → ativa", transicaoValidaAssinatura("trial", "ativa"));
    t("ativa → inadimplente", transicaoValidaAssinatura("ativa", "inadimplente"));
    t("ativa → cancelada", transicaoValidaAssinatura("ativa", "cancelada"));
    t("inadimplente → ativa", transicaoValidaAssinatura("inadimplente", "ativa"));
    t("inadimplente → cancelada", transicaoValidaAssinatura("inadimplente", "cancelada"));
    t("BLOQUEADO — trial → inadimplente (não existe cobrança em atraso sem nunca ter pago)", !transicaoValidaAssinatura("trial", "inadimplente"));
    t("trial → cancelada (legado: assinatura removida antes de pagar)", transicaoValidaAssinatura("trial", "cancelada"));
    t("pendente → ativa (primeiro pagamento confirmado)", transicaoValidaAssinatura("pendente", "ativa"));
    t("pendente → cancelada (cancelou antes de pagar)", transicaoValidaAssinatura("pendente", "cancelada"));
    t("BLOQUEADO — pendente → inadimplente (nunca pagou, não há atraso a recuperar)", !transicaoValidaAssinatura("pendente", "inadimplente"));
    t("ativa → suspensa e suspensa → ativa", transicaoValidaAssinatura("ativa", "suspensa") && transicaoValidaAssinatura("suspensa", "ativa"));
    t("cancelada → pendente (nova assinatura é o único caminho de volta)", transicaoValidaAssinatura("cancelada", "pendente"));
    t("BLOQUEADO — ninguém volta a trial", !transicaoValidaAssinatura("pendente", "trial") && !transicaoValidaAssinatura("cancelada", "trial"));
    t("BLOQUEADO — cancelada é terminal (não reabre para ativa)", !transicaoValidaAssinatura("cancelada", "ativa"));
    t("BLOQUEADO — cancelada é terminal (não reabre para inadimplente)", !transicaoValidaAssinatura("cancelada", "inadimplente"));
    t("BLOQUEADO — ativa não volta a trial", !transicaoValidaAssinatura("ativa", "trial"));
  }

  console.log("\nDOMÍNIO — origem permitida (nenhuma transição nasce de ação direta do usuário)");
  {
    t("ativa aceita webhook", origemPermitidaAssinatura("ativa", "webhook"));
    t("ativa aceita reconciliação", origemPermitidaAssinatura("ativa", "reconciliacao"));
    t("inadimplente aceita webhook", origemPermitidaAssinatura("inadimplente", "webhook"));
    t("cancelada aceita webhook", origemPermitidaAssinatura("cancelada", "webhook"));
    t("trial não aceita nenhuma origem (legado, nunca é destino)", !origemPermitidaAssinatura("trial", "webhook") && !origemPermitidaAssinatura("trial", "reconciliacao") && !origemPermitidaAssinatura("trial", "caso_de_uso"));
    t("ativa NÃO aceita ação direta do usuário (só o provedor confirma pagamento)", !origemPermitidaAssinatura("ativa", "caso_de_uso"));
    t("pendente só nasce de ação do próprio cliente (assinar de novo) e não libera nada", origemPermitidaAssinatura("pendente", "caso_de_uso") && !origemPermitidaAssinatura("pendente", "webhook"));
  }

  console.log("\nDOMÍNIO — situacaoDaConta/avisoDaConta (lib/empresa.ts)");
  {
    const agora = new Date("2027-01-10T12:00:00Z");
    const daqui = (dias: number) => new Date(agora.getTime() + dias * 86_400_000).toISOString();

    const trialDentro = situacaoDaConta({ assinatura_status: "trial", trial_termina_em: daqui(5) }, agora);
    t("trial dentro do prazo: liberada", trialDentro.liberada);
    t("trial legado dentro do prazo: carência legada", trialDentro.carenciaLegada);
    t("trial legado dentro do prazo: não aguarda pagamento", !trialDentro.aguardandoPagamento);
    t("trial dentro do prazo: 5 dias restantes", trialDentro.diasRestantes === 5);

    const trialAmanha = situacaoDaConta({ assinatura_status: "trial", trial_termina_em: daqui(1) }, agora);
    t("aviso 'termina amanhã' no limiar de 1 dia", (avisoDaConta(trialAmanha) ?? "").includes("termina amanhã"));
    t("nenhum aviso promete 'grátis'", !/gr[aá]tis/i.test(avisoDaConta(trialAmanha) ?? ""));

    const trialVencido = situacaoDaConta({ assinatura_status: "trial", trial_termina_em: daqui(-2) }, agora);
    t("trial vencido: NÃO liberada", !trialVencido.liberada);
    t("trial vencido: aguarda pagamento", trialVencido.aguardandoPagamento);
    t("trial vencido: 0 dias restantes", trialVencido.diasRestantes === 0);
    t("aviso de trial vencido pede assinatura", (avisoDaConta(trialVencido) ?? "").includes("Assine"));

    const pendente = situacaoDaConta({ assinatura_status: "pendente", trial_termina_em: daqui(30) }, agora);
    t("pendente: NÃO liberada, mesmo com trial_termina_em no futuro", !pendente.liberada);
    t("pendente: aguarda pagamento", pendente.aguardandoPagamento);
    t("aviso de pendente pede para escolher um plano (e lembra que o Grátis não tem mensalidade)", (avisoDaConta(pendente) ?? "").includes("Escolha um plano") && (avisoDaConta(pendente) ?? "").includes("Grátis"));
    const suspensa = situacaoDaConta({ assinatura_status: "suspensa", trial_termina_em: daqui(-30) }, agora);
    t("suspensa: NÃO liberada", !suspensa.liberada);

    const ativa = situacaoDaConta({ assinatura_status: "ativa", trial_termina_em: daqui(-30) }, agora);
    t("ativa: liberada mesmo com trial_termina_em no passado", ativa.liberada);
    t("ativa: nenhum aviso (nada a decidir)", avisoDaConta(ativa) === null);

    const inadimplente = situacaoDaConta({ assinatura_status: "inadimplente", trial_termina_em: daqui(-30) }, agora);
    t("inadimplente: NÃO liberada", !inadimplente.liberada);
    t("aviso de inadimplência menciona o problema", (avisoDaConta(inadimplente) ?? "").includes("problema"));

    const cancelada = situacaoDaConta({ assinatura_status: "cancelada", trial_termina_em: daqui(-30) }, agora);
    t("cancelada: NÃO liberada", !cancelada.liberada);
    t("aviso de cancelada é claro", (avisoDaConta(cancelada) ?? "").includes("cancelada"));
  }

  console.log("\nDOMÍNIO — obterUsoDoPlano (uso real, não estimado)");
  const usuarios: string[] = [];
  const empresas: string[] = [];
  const SENHA = "senha_teste_assinatura_fase15_12345";

  async function novaConta(nome: string) {
    const email = `assin15_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@zelo.test`;
    const r = await fetch(`${URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome } }),
    });
    const j = await r.json();
    const userId = j.id || j.user?.id;
    if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
    usuarios.push(userId);

    const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
    const empresaId = m?.[0]?.empresa_id as string;
    empresas.push(empresaId);

    const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
    if (error) throw new Error(`login: ${error.message}`);

    return { empresaId, sessao };
  }

  {
    const { empresaId } = await novaConta("Empresa uso de plano");

    const semClientes = await obterUsoDoPlano(empresaId, "essencial");
    t("0 clientes ativos numa empresa nova", semClientes.clientesAtivos === 0);
    t("limite bate com lib/plano.ts (essencial=50)", semClientes.limiteClientes === LIMITE_DE_CLIENTES.essencial);
    t("nome do plano bate com lib/plano.ts", semClientes.nomePlano === NOME_DO_PLANO.essencial);

    // Lote com colunas mistas: PostgREST usa a união das chaves e manda
    // `null` explícito onde falta — não "usa o default". `status` precisa
    // vir explícito em toda linha do lote por causa disso.
    await admin.from("clientes").insert([
      { empresa_id: empresaId, nome: "Cliente 1", status: "ativo" },
      { empresa_id: empresaId, nome: "Cliente 2", status: "ativo" },
      { empresa_id: empresaId, nome: "Cliente 3", status: "arquivado" },
    ]);
    const comClientes = await obterUsoDoPlano(empresaId, "essencial");
    t("conta só os ATIVOS (2, não 3 — arquivado não entra)", comClientes.clientesAtivos === 2);

    const planoInvalido = await obterUsoDoPlano(empresaId, "plano_que_nao_existe");
    t("plano desconhecido cai para o Grátis (menor limite — mesma defesa de lib/plano.ts e do banco)", planoInvalido.plano === "gratis");

    await admin.from("clientes").delete().eq("empresa_id", empresaId);
  }

  console.log("\nWEBHOOK (contexto plataforma) — transições reais via processarEventoWebhook, nunca escritas direto no banco");
  {
    const { empresaId } = await novaConta("Empresa assinatura Zelo");
    const customerId = `cus_plataforma_${empresaId.slice(0, 8)}`;
    const subscriptionId = `sub_plataforma_${empresaId.slice(0, 8)}`;
    await admin.from("empresas").update({ asaas_customer_id: customerId, asaas_subscription_id: subscriptionId }).eq("id", empresaId);

    const buscar = async () => (await admin.from("empresas").select("assinatura_status, assinatura_atualizada_em").eq("id", empresaId).single()).data;
    const logExiste = async (acao: string) =>
      !!(await admin.from("log_acoes_financeiras").select("id").eq("empresa_id", empresaId).eq("acao", acao).maybeSingle()).data;
    const notificacaoExiste = async (chave: string) =>
      !!(await admin.from("notificacoes").select("id").eq("empresa_id", empresaId).eq("chave_idempotencia", chave).maybeSingle()).data;

    function paymentEvent(eventId: string, event: string, overrides: Record<string, unknown> = {}) {
      return {
        id: eventId,
        event,
        dateCreated: new Date().toISOString(),
        account: { id: CONTA_PLATAFORMA },
        payment: { id: `pay_${eventId}`, customer: customerId, dateCreated: "2027-01-01", dueDate: "2027-01-05", value: 29.9, billingType: "PIX", status: "RECEIVED", ...overrides },
      };
    }

    // 1. PAYMENT_RECEIVED: trial → ativa
    {
      const r = await processarEventoWebhook(paymentEvent(`evt_a_${empresaId}`, "PAYMENT_RECEIVED") as any);
      t("evento processado com sucesso", r.ok);
      const emp = await buscar();
      t("assinatura_status vira 'ativa'", emp?.assinatura_status === "ativa");
      t("assinatura_atualizada_em preenchido", !!emp?.assinatura_atualizada_em);
      t("auditoria 'assinatura_zelo_ativada' registrada", await logExiste("assinatura_zelo_ativada"));
    }

    // 2. PAYMENT_OVERDUE: ativa → inadimplente
    {
      const eventoId = `evt_b_${empresaId}`;
      const r = await processarEventoWebhook(paymentEvent(eventoId, "PAYMENT_OVERDUE", { status: "OVERDUE" }) as any);
      t("evento processado com sucesso", r.ok);
      const emp = await buscar();
      t("assinatura_status vira 'inadimplente'", emp?.assinatura_status === "inadimplente");
      t("auditoria 'assinatura_zelo_inadimplente' registrada", await logExiste("assinatura_zelo_inadimplente"));
      t("notificação de atraso criada", await notificacaoExiste(`assinatura_inadimplente:${empresaId}:${eventoId}`));
    }

    // 2b. Reenvio do MESMO evento OVERDUE — idempotente pela constraint de eventos_asaas.
    {
      const r2 = await processarEventoWebhook(paymentEvent(`evt_b_${empresaId}`, "PAYMENT_OVERDUE", { status: "OVERDUE" }) as any);
      t("reenvio do mesmo evento é idempotente", r2.ok && (r2 as any).idempotente === true);
      const emp = await buscar();
      t("status não muda no reenvio", emp?.assinatura_status === "inadimplente");
    }

    // 3. PAYMENT_RECEIVED de novo: inadimplente → ativa (recuperação)
    {
      const eventoId = `evt_c_${empresaId}`;
      const r = await processarEventoWebhook(paymentEvent(eventoId, "PAYMENT_CONFIRMED") as any);
      t("evento processado com sucesso", r.ok);
      const emp = await buscar();
      t("assinatura_status volta a 'ativa'", emp?.assinatura_status === "ativa");
      t("notificação de regularização criada", await notificacaoExiste(`assinatura_regularizada:${empresaId}:${eventoId}`));
    }

    // 4. SUBSCRIPTION_DELETED: ativa → cancelada
    {
      const eventoId = `evt_d_${empresaId}`;
      const evento = {
        id: eventoId,
        event: "SUBSCRIPTION_DELETED",
        dateCreated: new Date().toISOString(),
        account: { id: CONTA_PLATAFORMA },
        subscription: { id: subscriptionId },
      };
      const r = await processarEventoWebhook(evento as any);
      t("evento processado com sucesso", r.ok);
      const emp = await buscar();
      t("assinatura_status vira 'cancelada'", emp?.assinatura_status === "cancelada");
      t("auditoria 'assinatura_zelo_cancelada' registrada", await logExiste("assinatura_zelo_cancelada"));
      t("notificação de cancelamento criada", await notificacaoExiste(`assinatura_cancelada:${empresaId}:${eventoId}`));
    }

    // 5. cancelada é TERMINAL: um PAYMENT_RECEIVED fora de ordem depois do cancelamento não reabre.
    {
      const r = await processarEventoWebhook(paymentEvent(`evt_e_${empresaId}`, "PAYMENT_RECEIVED") as any);
      t("evento ainda é aceito (200, não quebra o webhook)", r.ok);
      const emp = await buscar();
      t("BLOQUEADO — status continua 'cancelada' (transição inválida recusada)", emp?.assinatura_status === "cancelada");
    }

    // 6. Evento de um customer desconhecido: processa sem erro, não afeta ninguém.
    {
      const r = await processarEventoWebhook(
        paymentEvent(`evt_f_${empresaId}`, "PAYMENT_RECEIVED", { customer: "cus_desconhecido_xyz" }) as any
      );
      t("customer desconhecido: evento aceito sem quebrar", r.ok);
    }
  }

  console.log("\nSEGURANÇA — impacto real de 'inadimplente'/'cancelada': INSERT bloqueado, leitura preservada");
  {
    const { empresaId, sessao } = await novaConta("Empresa bloqueio real");
    await admin.from("empresas").update({ assinatura_status: "inadimplente" }).eq("id", empresaId);

    const { error: eInsert } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "Não deveria entrar" });
    t("BLOQUEADO — INSERT de cliente recusado com assinatura inadimplente (prova a mensagem da UI)", Boolean(eInsert));

    await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Cliente pré-existente" });
    const { data: lidos, error: eLeitura } = await sessao.from("clientes").select("id").eq("empresa_id", empresaId);
    t("leitura continua funcionando (o que já existe continua acessível)", !eLeitura && (lidos?.length ?? 0) === 1);

    await admin.from("clientes").delete().eq("empresa_id", empresaId);
  }

  console.log("\nSEGURANÇA — colunas de assinatura são só-leitura para authenticated (mesma disciplina das Fases 5-6)");
  {
    const { empresaId, sessao } = await novaConta("Empresa grants assinatura");

    const { error: e1 } = await sessao.from("empresas").update({ assinatura_status: "ativa" }).eq("id", empresaId);
    t("BLOQUEADO — authenticated não grava assinatura_status", Boolean(e1));

    const { error: e2 } = await sessao.from("empresas").update({ plano: "premium" }).eq("id", empresaId);
    t("BLOQUEADO — authenticated não grava plano", Boolean(e2));

    const { error: e3 } = await sessao.from("empresas").update({ assinatura_atualizada_em: new Date().toISOString() }).eq("id", empresaId);
    t("BLOQUEADO — authenticated não grava assinatura_atualizada_em (coluna nova desta fase)", Boolean(e3));

    const { data: intacta } = await admin.from("empresas").select("assinatura_status, plano").eq("id", empresaId).single();
    t("nada mudou de verdade no banco", ["trial", "pendente"].includes(intacta?.assinatura_status) && intacta?.plano === "essencial");
  }

  console.log("\nSEGURANÇA — isolamento de tenant nos dados de assinatura");
  {
    const { empresaId: idA } = await novaConta("Empresa A assinatura");
    const { sessao: sessaoB } = await novaConta("Empresa B assinatura");

    const { data: vazamento, error } = await sessaoB.from("empresas").select("id, plano, assinatura_status").eq("id", idA);
    t("B não enxerga a assinatura de A", !error && (vazamento?.length ?? 0) === 0);
  }

  console.log("\nESTRUTURAL — camadas");
  {
    const conteudoPagina = fs.readFileSync("app/(app)/app/assinatura/page.tsx", "utf8");
    t("página não importa nada de lib/asaas além de config (leitura de status, não escrita)", !/from "@\/lib\/asaas\/(?!config)/.test(conteudoPagina));
    t("página usa obterUsoDoPlano (não recalcula limite sozinha)", conteudoPagina.includes("obterUsoDoPlano"));
    t("página usa situacaoDaConta (mesma função do resto do app, não duplica a regra)", conteudoPagina.includes("situacaoDaConta"));

    const conteudoWebhook = fs.readFileSync("lib/asaas/webhook.ts", "utf8");
    t("webhook valida transição de assinatura antes de escrever (não decide sozinho)", conteudoWebhook.includes("transicaoValidaAssinatura"));
  }

  console.log("\nLIMPEZA");
  for (const id of empresas) {
    await admin.from("clientes").delete().eq("empresa_id", id);
    await admin.from("notificacoes").delete().eq("empresa_id", id);
    await admin.from("log_acoes_financeiras").delete().eq("empresa_id", id);
    await admin.from("mensalidades").delete().eq("empresa_id", id);
  }
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

main().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
