/**
 * Fase 5 do Core Financeiro — Cobrança Zelo ↔ Asaas.
 *
 * Mesmo espírito das fases anteriores: sem credencial real, o caminho
 * "sem credencial" é testado de verdade, sem mock. Para sucesso/erro/
 * resposta-perdida/cancelamento — onde o Asaas precisa "responder algo"
 * — `criador`/`buscador`/`cancelador` injetados simulam a resposta,
 * mesmo padrão de DI já usado nas Fases 2–4.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  sincronizarCobrancaFinanceira,
  cancelarCobrancaFinanceira,
  CriadorDeCobrancaAsaas,
  BuscadorDeCobrancaAsaas,
  CanceladorDeCobrancaAsaas,
} from "../lib/core/cobranca-financeira";
import { salvarCredencialDaEmpresa } from "../lib/asaas/credenciais";

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

console.log("\n=== CORE FINANCEIRO — FASE 5 (cobrança ↔ Asaas) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_cobranca_fin_12345";

async function criarEmpresa(nome: string) {
  const email = `cob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  return { empresaId, userId, email };
}

async function criarClienteDireto(empresaId: string, nome: string, comCustomerId = true) {
  const { data, error } = await admin
    .from("clientes")
    .insert({
      empresa_id: empresaId,
      nome,
      email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test`,
      documento: "98765432100",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (comCustomerId) {
    await admin.from("clientes").update({ asaas_customer_id: `cus_mock_${data.id.slice(0, 8)}` }).eq("id", data.id);
  }
  return data.id as string;
}

async function criarCobrancaDireta(empresaId: string, clienteId: string, valorCentavos = 5000) {
  const { data, error } = await admin
    .from("cobrancas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao: "Cobrança de teste",
      valor_centavos: valorCentavos,
      vence_em: "2027-01-15",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let chamadasCriador = 0;
const criadorSucesso: CriadorDeCobrancaAsaas = async (dados) => {
  chamadasCriador++;
  return {
    ok: true,
    data: { id: `pay_mock_${Math.random().toString(36).slice(2, 8)}`, customer: dados.customer } as any,
  };
};
const criador4xx: CriadorDeCobrancaAsaas = async () => ({ ok: false, status: 400, erro: "Dados inválidos para o Asaas." });
const criador5xx: CriadorDeCobrancaAsaas = async () => ({ ok: false, status: 500, erro: "Erro interno do Asaas." });
const criadorTimeout: CriadorDeCobrancaAsaas = async () => ({ ok: false, status: 504, erro: "timeout simulado" });
const LISTA_VAZIA = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as never[] };
const buscadorVazio: BuscadorDeCobrancaAsaas = async () => ({ ok: true, data: { ...LISTA_VAZIA } });

async function run() {
  console.log("INTEGRAÇÃO REAL — sem credencial de subconta");
  {
    const { empresaId } = await criarEmpresa("Empresa sem conta financeira");
    const clienteId = await criarClienteDireto(empresaId, "Cliente sem conta");
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);
    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId);
    t("sem credencial salva, falha com integracao_externa (não finge sucesso)", !r.ok && r.erro.tipo === "integracao_externa");
  }

  console.log("\nVALIDAÇÃO — cobrança inexistente / já paga / já cancelada");
  {
    const { empresaId } = await criarEmpresa("Empresa validação");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const r = await sincronizarCobrancaFinanceira("00000000-0000-0000-0000-000000000000", empresaId);
    t("cobrança inexistente devolve nao_encontrado", !r.ok && r.erro.tipo === "nao_encontrado");

    const clienteId = await criarClienteDireto(empresaId, "Cliente validação");
    const cobPaga = await criarCobrancaDireta(empresaId, clienteId);
    await admin.from("cobrancas").update({ status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 5000, pago_via: "asaas" }).eq("id", cobPaga);
    const rPaga = await sincronizarCobrancaFinanceira(cobPaga, empresaId);
    t("cobrança já paga não é enviada ao Asaas", !rPaga.ok && rPaga.erro.tipo === "conflito");

    const cobCancelada = await criarCobrancaDireta(empresaId, clienteId);
    await admin.from("cobrancas").update({ status: "cancelada" }).eq("id", cobCancelada);
    const rCancelada = await sincronizarCobrancaFinanceira(cobCancelada, empresaId);
    t("cobrança cancelada não é enviada ao Asaas", !rCancelada.ok && rCancelada.erro.tipo === "conflito");
  }

  console.log("\nVALIDAÇÃO — cliente arquivado / cliente sem asaas_customer_id (auto-sync)");
  {
    const { empresaId } = await criarEmpresa("Empresa cliente arquivado");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente a arquivar", false);
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);
    await admin.from("clientes").update({ status: "arquivado" }).eq("id", clienteId);

    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio);
    t("cliente arquivado bloqueia o envio da cobrança", !r.ok && r.erro.tipo === "conflito");
  }
  {
    // Cliente existe mas ainda não tem asaas_customer_id — a cobrança deve
    // disparar a sincronização do cliente (Fase 4) antes de criar o payment.
    const { empresaId } = await criarEmpresa("Empresa cliente não sincronizado");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente ainda não sincronizado", false);
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);

    // Sem credencial de cliente asaas_customer_id, sincronizarClienteFinanceiro
    // real vai chamar criarClienteAsaas de verdade (não injetável neste nível) —
    // como não há ASAAS_API_KEY real, o resultado esperado é falha propagada,
    // não sucesso fingido.
    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio);
    t("cliente sem asaas_customer_id tenta auto-sincronizar e propaga falha real (não finge)", !r.ok && r.erro.tipo === "integracao_externa");
  }

  console.log("\nMOCK — caminho de sucesso");
  {
    const { empresaId } = await criarEmpresa("Empresa sucesso mock");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente sucesso");
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);

    chamadasCriador = 0;
    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio);
    t("sincronização com sucesso grava asaasPaymentId", r.ok && r.dado.asaasPaymentId.startsWith("pay_mock_"));
    t("não é 'jaExistia' na primeira vez", r.ok && r.dado.jaExistia === false);

    const { data: linha } = await admin.from("cobrancas").select("asaas_payment_id, asaas_sync_status, status").eq("id", cobrancaId).single();
    t("banco reflete payment_id e sync_status 'sincronizado'", !!linha?.asaas_payment_id && linha.asaas_sync_status === "sincronizado");
    t("status COMERCIAL da cobrança NÃO foi tocado (continua 'pendente')", linha?.status === "pendente");

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("log de auditoria registra a conclusão", (log ?? []).some((l) => l.acao === "cobranca_sincronizacao_concluida"));

    console.log("\nIDEMPOTÊNCIA — chamar de novo não duplica");
    chamadasCriador = 0;
    const r2 = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio);
    t("segunda chamada é no-op idempotente", r2.ok && r2.dado.jaExistia === true);
    t("segunda chamada NÃO chama o Asaas de novo", chamadasCriador === 0);
  }

  console.log("\nASAAS — 4xx / 5xx / timeout tratados como falha, sem travar a cobrança");
  for (const [nome, criadorErro] of [
    ["4xx", criador4xx],
    ["5xx", criador5xx],
    ["timeout (504)", criadorTimeout],
  ] as const) {
    const { empresaId } = await criarEmpresa(`Empresa erro ${nome}`);
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, `Cliente erro ${nome}`);
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);

    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorErro, buscadorVazio);
    t(`${nome}: devolve integracao_externa`, !r.ok && r.erro.tipo === "integracao_externa");

    const { data: linha } = await admin.from("cobrancas").select("asaas_sync_status, asaas_payment_id").eq("id", cobrancaId).single();
    t(`${nome}: cobrança NÃO fica presa em 'sincronizando'`, linha?.asaas_sync_status === "erro" && !linha.asaas_payment_id);

    // RETRY após erro
    const r2 = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio);
    t(`${nome}: retry após erro consegue sincronizar`, r2.ok && r2.dado.jaExistia === false);
  }

  console.log("\nRESPOSTA PERDIDA — Asaas já tem o payment (externalReference bate), não duplica");
  {
    const { empresaId } = await criarEmpresa("Empresa resposta perdida");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente perdido");
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);

    const buscadorComAchado: BuscadorDeCobrancaAsaas = async () => ({
      ok: true,
      data: { ...LISTA_VAZIA, data: [{ id: "pay_recuperado_123", externalReference: cobrancaId } as any] },
    });

    chamadasCriador = 0;
    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorComAchado);
    t("recupera o payment existente em vez de criar outro", r.ok && r.dado.asaasPaymentId === "pay_recuperado_123");
    t("NÃO chama o criador quando já encontrou por externalReference", chamadasCriador === 0);

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("recuperação é auditada", (log ?? []).some((l) => l.acao === "cobranca_sincronizacao_recuperada"));
  }

  console.log("\nCONCORRÊNCIA — duplo clique / duas sincronizações simultâneas (timeout + retry incluso)");
  {
    const { empresaId } = await criarEmpresa("Empresa concorrência");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente concorrente");
    const cobrancaId = await criarCobrancaDireta(empresaId, clienteId);

    chamadasCriador = 0;
    const [ra, rb] = await Promise.all([
      sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio),
      sincronizarCobrancaFinanceira(cobrancaId, empresaId, null, criadorSucesso, buscadorVazio),
    ]);
    // A perdedora do lock tem dois desfechos válidos, dependendo de quem
    // termina primeiro: "conflito" (releu o estado antes da vencedora
    // terminar) OU `ok` idempotente (a vencedora já tinha terminado
    // quando ela releu). As duas provam a mesma coisa — nenhuma
    // duplicata — achado confirmado na Fase 6 pra este mesmo padrão de
    // CAS. Só a contagem de chamadas ao Asaas prova a exclusão mútua.
    const semDuplicar =
      (ra.ok && rb.ok) || (ra.ok && !rb.ok && rb.erro.tipo === "conflito") || (!ra.ok && rb.ok && ra.erro.tipo === "conflito");
    t("as duas chamadas resolvem sem erro inesperado (conflito ou sucesso idempotente)", semDuplicar);
    t("só UMA chegou a chamar o Asaas (CAS venceu para só uma)", chamadasCriador === 1);
  }

  console.log("\nPERSISTÊNCIA — IDs únicos entre cobranças diferentes");
  {
    const { empresaId } = await criarEmpresa("Empresa IDs únicos");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente IDs únicos");
    const c1 = await criarCobrancaDireta(empresaId, clienteId, 1000);
    const c2 = await criarCobrancaDireta(empresaId, clienteId, 2000);

    const r1 = await sincronizarCobrancaFinanceira(c1, empresaId, null, criadorSucesso, buscadorVazio);
    const r2 = await sincronizarCobrancaFinanceira(c2, empresaId, null, criadorSucesso, buscadorVazio);
    t(
      "duas cobranças distintas recebem asaas_payment_id distintos",
      r1.ok && r2.ok && r1.dado.asaasPaymentId !== r2.dado.asaasPaymentId
    );

    const { error: erroDuplicado } = await admin
      .from("cobrancas")
      .update({ asaas_payment_id: (r1 as any).dado.asaasPaymentId })
      .eq("id", c2);
    t("banco recusa duas cobranças com o mesmo asaas_payment_id (índice único)", !!erroDuplicado);
  }

  console.log("\nCANCELAMENTO");
  {
    const { empresaId } = await criarEmpresa("Empresa cancelamento");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cobranca");
    const clienteId = await criarClienteDireto(empresaId, "Cliente cancelamento");

    // Cobrança nunca enviada ao Asaas: cancelamento é só local.
    const cobLocal = await criarCobrancaDireta(empresaId, clienteId);
    const rLocal = await cancelarCobrancaFinanceira(cobLocal, empresaId);
    t("cobrança nunca sincronizada cancela só localmente (sem payment pra cancelar)", rLocal.ok);
    const { data: linhaLocal } = await admin.from("cobrancas").select("status").eq("id", cobLocal).single();
    t("status vira 'cancelada'", linhaLocal?.status === "cancelada");

    // Cobrança já sincronizada: cancelamento chama o Asaas primeiro.
    const cobSync = await criarCobrancaDireta(empresaId, clienteId);
    await sincronizarCobrancaFinanceira(cobSync, empresaId, null, criadorSucesso, buscadorVazio);

    let chamadasCancelador = 0;
    const canceladorSucesso: CanceladorDeCobrancaAsaas = async () => {
      chamadasCancelador++;
      return { ok: true, data: { id: "pay_x", deleted: true } };
    };
    const rCancel = await cancelarCobrancaFinanceira(cobSync, empresaId, null, canceladorSucesso);
    t("cobrança sincronizada: cancelamento chama o Asaas", chamadasCancelador === 1 && rCancel.ok);

    // Falha no Asaas: NÃO marca cancelada localmente (não finge).
    const cobSync2 = await criarCobrancaDireta(empresaId, clienteId);
    await sincronizarCobrancaFinanceira(cobSync2, empresaId, null, criadorSucesso, buscadorVazio);
    const canceladorFalha: CanceladorDeCobrancaAsaas = async () => ({ ok: false, status: 500, erro: "falha simulada" });
    const rCancelFalha = await cancelarCobrancaFinanceira(cobSync2, empresaId, null, canceladorFalha);
    t("falha ao cancelar no Asaas NÃO marca cancelada localmente (não mente pro usuário)", !rCancelFalha.ok);
    const { data: linhaFalha } = await admin.from("cobrancas").select("status").eq("id", cobSync2).single();
    t("status continua 'pendente' (Asaas ainda considera ativo)", linhaFalha?.status === "pendente");

    // Retry (idempotência): Asaas responde 404 (já não existe) — trata como sucesso.
    const cobSync3 = await criarCobrancaDireta(empresaId, clienteId);
    await sincronizarCobrancaFinanceira(cobSync3, empresaId, null, criadorSucesso, buscadorVazio);
    const cancelador404: CanceladorDeCobrancaAsaas = async () => ({ ok: false, status: 404, erro: "não encontrado" });
    const rCancel404 = await cancelarCobrancaFinanceira(cobSync3, empresaId, null, cancelador404);
    t("cancelamento retry (payment já sumiu no Asaas, 404) é tratado como sucesso", rCancel404.ok);
  }

  console.log("\nSEGURANÇA — tenant isolation e grants restritos");
  {
    const a = await criarEmpresa("Tenant A cobranca");
    const b = await criarEmpresa("Tenant B cobranca");
    const clienteDeA = await criarClienteDireto(a.empresaId, "Cliente do tenant A");
    const cobrancaDeA = await criarCobrancaDireta(a.empresaId, clienteDeA);

    const rCruzado = await sincronizarCobrancaFinanceira(cobrancaDeA, b.empresaId);
    t("sincronizar cobrança de A usando empresaId de B falha (não vaza entre tenants)", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email: a.email, password: SENHA_TESTE });
    const { error: erroForja } = await sessao.from("cobrancas").update({ asaas_payment_id: "pay_forjado" }).eq("id", cobrancaDeA);
    t("dono da cobrança NÃO consegue forjar asaas_payment_id (grant de coluna)", erroForja?.code === "42501");

    const { error: erroLegit, count: countLegit } = await sessao
      .from("cobrancas")
      .update({ descricao: "Editado pelo dono" }, { count: "exact" })
      .eq("id", cobrancaDeA);
    t("mas o mesmo dono ainda consegue editar uma coluna legítima", !erroLegit && countLegit === 1);
  }

  console.log("\nCAMADAS — Server Action chama o caso de uso, não fala com o Asaas direto");
  {
    const conteudoCobrancas = fs.readFileSync("app/(app)/app/cobrancas/acoes.ts", "utf8");
    t("cobrancas/acoes.ts importa lib/core/cobranca-financeira", conteudoCobrancas.includes('from "@/lib/core/cobranca-financeira"'));
    t("criarCobranca() dispara a sincronização best-effort", conteudoCobrancas.includes("await sincronizarCobrancaFinanceira("));
    t("cancelarCobranca() usa o caso de uso de cancelamento", conteudoCobrancas.includes("await cancelarCobrancaFinanceira("));
    t("existe ação manual de retry (sincronizarCobrancaAsaasAcao)", conteudoCobrancas.includes("export async function sincronizarCobrancaAsaasAcao"));

    const conteudoRecorrencias = fs.readFileSync("app/(app)/app/recorrencias/acoes.ts", "utf8");
    t("recorrencias/acoes.ts também sincroniza os ciclos gerados", conteudoRecorrencias.includes("await sincronizarCobrancaFinanceira("));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
  await admin.from("cobrancas").delete().in("empresa_id", empresas);
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
