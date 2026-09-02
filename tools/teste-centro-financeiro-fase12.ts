/**
 * Fase 12 do Core Financeiro — centro financeiro (recebimentos, cobranças,
 * recorrências, autorizações, instruções, falhas).
 *
 * Foco: as consultas por trás das 3 telas novas (`/app/recebimentos`,
 * `/app/recorrencias/autorizacoes`, `/app/recorrencias/instrucoes`) e
 * dos filtros novos de `/app/cobrancas` (período/valor) — testadas com
 * uma sessão real (`signInWithPassword`), exatamente como o Server
 * Component da página roda (RLS-scoped, nunca `service_role`).
 *
 * Achado real ao testar de verdade (não só ler o código): a consulta de
 * autorizações que embute `recorrencias` quebrava com `PGRST201`
 * (relação ambígua) — `autorizacoes_pix` tem duas relações com
 * `recorrencias` (a FK direta `recorrencia_id` e a reversa
 * `recorrencias.autorizacao_atual_id`). Corrigido nomeando a constraint
 * explicitamente no embed.
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

console.log("\n=== CORE FINANCEIRO — FASE 12 (centro financeiro) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_centro_financeiro_fase12_12345";

async function criarEmpresa(nome: string) {
  const email = `centro12_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  return { empresaId, email };
}

async function sessaoDe(email: string) {
  const sessao = createClient(URL, ANON, { auth: { persistSession: false } });
  await sessao.auth.signInWithPassword({ email, password: SENHA_TESTE });
  return sessao;
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

async function criarRecorrenciaComAutorizacao(empresaId: string, clienteId: string, statusAuth: string) {
  const { data: rec, error } = await admin
    .from("recorrencias")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Mensalidade teste", valor_centavos: 35000, periodicidade: "mensal", dia_vencimento: 5, inicia_em: "2027-01-01", status: "ativa" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: auth, error: erroAuth } = await admin
    .from("autorizacoes_pix")
    .insert({ empresa_id: empresaId, recorrencia_id: rec.id, cliente_id: clienteId, asaas_authorization_id: `auth_c12_${rec.id.slice(0, 8)}`, status: statusAuth, finish_date: "2032-01-01", retry_policy: "ALLOW_THREE_IN_SEVEN_DAYS" })
    .select("id")
    .single();
  if (erroAuth) throw new Error(erroAuth.message);
  if (statusAuth === "ACTIVE") await admin.from("recorrencias").update({ autorizacao_atual_id: auth.id }).eq("id", rec.id);
  return { recorrenciaId: rec.id as string, autorizacaoId: auth.id as string };
}

let contadorVencimento = 0;
async function criarCobrancaComInstrucao(empresaId: string, clienteId: string, recorrenciaId: string, autorizacaoId: string, statusInstrucao: string, valorCentavos = 10000) {
  contadorVencimento++;
  const dia = String(5 + (contadorVencimento % 20)).padStart(2, "0");
  const asaasPaymentId = `pay_c12_${Math.random().toString(36).slice(2, 10)}`;
  const { data: cob, error } = await admin
    .from("cobrancas")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, recorrencia_id: recorrenciaId, descricao: "Cobrança teste centro financeiro", valor_centavos: valorCentavos, vence_em: `2027-06-${dia}`, status: "pendente", asaas_payment_id: asaasPaymentId, asaas_sync_status: "sincronizado" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: instr, error: erroInstr } = await admin
    .from("instrucoes_pagamento")
    .insert({ empresa_id: empresaId, cobranca_id: cob.id, autorizacao_id: autorizacaoId, asaas_payment_id: asaasPaymentId, status: statusInstrucao, due_date: `2027-06-${dia}` })
    .select("id")
    .single();
  if (erroInstr) throw new Error(erroInstr.message);
  return { cobrancaId: cob.id as string, instrucaoId: instr.id as string, asaasPaymentId };
}

async function run() {
  console.log("\nRECEBIMENTOS — lista, filtro de período e valor, isolamento por tenant");
  {
    const { empresaId: empA, email: emailA } = await criarEmpresa("Empresa A recebimentos");
    const { empresaId: empB, email: emailB } = await criarEmpresa("Empresa B recebimentos");
    const clienteId = await criarCliente(empA, "Cliente Recebimentos");
    const { recorrenciaId, autorizacaoId } = await criarRecorrenciaComAutorizacao(empA, clienteId, "ACTIVE");
    const { instrucaoId, asaasPaymentId } = await criarCobrancaComInstrucao(empA, clienteId, recorrenciaId, autorizacaoId, "DONE", 25000);
    await admin.from("pagamentos").insert({ empresa_id: empA, instrucao_id: instrucaoId, asaas_payment_id: asaasPaymentId, valor_liquido_centavos: 24500, taxa_centavos: 500, liquidado_em: "2027-06-10T10:00:00Z" });

    const sessaoA = await sessaoDe(emailA);
    const r1 = await sessaoA
      .from("pagamentos")
      .select("id, valor_liquido_centavos, instrucoes_pagamento!inner(cobrancas!inner(clientes!inner(nome)))", { count: "exact" })
      .eq("empresa_id", empA)
      .order("liquidado_em", { ascending: false });
    t("dono vê o recebimento", !r1.error && r1.count === 1);

    const r2 = await sessaoA.from("pagamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empA).gte("liquidado_em", "2027-06-01").lte("liquidado_em", "2027-06-30T23:59:59");
    t("filtro de período (dentro) encontra o recebimento", r2.count === 1);

    const r3 = await sessaoA.from("pagamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empA).gte("liquidado_em", "2027-07-01");
    t("filtro de período (fora) não encontra nada", r3.count === 0);

    const r4 = await sessaoA.from("pagamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empA).gte("valor_liquido_centavos", 30000);
    t("filtro de valor mínimo (acima do que existe) não encontra nada", r4.count === 0);

    const sessaoB = await sessaoDe(emailB);
    const r5 = await sessaoB.from("pagamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empA);
    t("empresa B não vê recebimento de A (RLS)", (r5.count ?? 0) === 0);
  }

  console.log("\nAUTORIZAÇÕES — lista com embed de recorrência (achado: FK ambígua), filtro de status, isolamento");
  {
    const { empresaId: empA, email: emailA } = await criarEmpresa("Empresa A autorizacoes");
    const { empresaId: empB, email: emailB } = await criarEmpresa("Empresa B autorizacoes");
    const clienteId = await criarCliente(empA, "Cliente Auth Ativa");
    await criarRecorrenciaComAutorizacao(empA, clienteId, "ACTIVE");
    const clienteId2 = await criarCliente(empA, "Cliente Auth Recusada");
    await criarRecorrenciaComAutorizacao(empA, clienteId2, "REFUSED");

    const sessaoA = await sessaoDe(emailA);
    const rTodas = await sessaoA
      .from("autorizacoes_pix")
      .select("id, status, recorrencias!autorizacoes_pix_recorrencia_id_fkey!inner(descricao, clientes(nome))", { count: "exact" })
      .eq("empresa_id", empA);
    t("consulta com FK nomeada não quebra (regressão do achado PGRST201)", !rTodas.error);
    t("lista as 2 autorizações da empresa", rTodas.count === 2);

    const rAtivas = await sessaoA.from("autorizacoes_pix").select("id", { count: "exact", head: true }).eq("empresa_id", empA).eq("status", "ACTIVE");
    t("filtro por status ACTIVE encontra só 1", rAtivas.count === 1);

    const rRecusadas = await sessaoA.from("autorizacoes_pix").select("id", { count: "exact", head: true }).eq("empresa_id", empA).eq("status", "REFUSED");
    t("filtro por status REFUSED encontra só 1", rRecusadas.count === 1);

    const sessaoB = await sessaoDe(emailB);
    const rIsolamento = await sessaoB.from("autorizacoes_pix").select("id", { count: "exact", head: true }).eq("empresa_id", empA);
    t("empresa B não vê autorizações de A (RLS)", (rIsolamento.count ?? 0) === 0);
  }

  console.log("\nINSTRUÇÕES — lista, filtro de status (inclui 'falhas' = REFUSED), isolamento");
  {
    const { empresaId: empA, email: emailA } = await criarEmpresa("Empresa A instrucoes");
    const { empresaId: empB, email: emailB } = await criarEmpresa("Empresa B instrucoes");
    const clienteId = await criarCliente(empA, "Cliente Instrucoes");
    const { recorrenciaId, autorizacaoId } = await criarRecorrenciaComAutorizacao(empA, clienteId, "ACTIVE");
    await criarCobrancaComInstrucao(empA, clienteId, recorrenciaId, autorizacaoId, "SCHEDULED");
    await criarCobrancaComInstrucao(empA, clienteId, recorrenciaId, autorizacaoId, "REFUSED");

    const sessaoA = await sessaoDe(emailA);
    const rTodas = await sessaoA
      .from("instrucoes_pagamento")
      .select("id, status, cobrancas!inner(descricao, clientes(nome))", { count: "exact" })
      .eq("empresa_id", empA);
    t("lista as 2 instruções da empresa", !rTodas.error && rTodas.count === 2);

    const rRecusadas = await sessaoA.from("instrucoes_pagamento").select("id", { count: "exact", head: true }).eq("empresa_id", empA).eq("status", "REFUSED");
    t("filtro por status REFUSED (falhas) encontra só 1", rRecusadas.count === 1);

    const sessaoB = await sessaoDe(emailB);
    const rIsolamento = await sessaoB.from("instrucoes_pagamento").select("id", { count: "exact", head: true }).eq("empresa_id", empA);
    t("empresa B não vê instruções de A (RLS)", (rIsolamento.count ?? 0) === 0);
  }

  console.log("\nCOBRANÇAS — filtros novos de período e valor (Fase 12)");
  {
    const { empresaId: empA, email: emailA } = await criarEmpresa("Empresa A filtros cobranca");
    const clienteId = await criarCliente(empA, "Cliente Filtros");
    await admin.from("cobrancas").insert({ empresa_id: empA, cliente_id: clienteId, descricao: "Cobrança barata", valor_centavos: 5000, vence_em: "2027-06-10", status: "pendente" });
    await admin.from("cobrancas").insert({ empresa_id: empA, cliente_id: clienteId, descricao: "Cobrança cara", valor_centavos: 100000, vence_em: "2027-06-15", status: "pendente" });

    const sessaoA = await sessaoDe(emailA);
    const rPeriodo = await sessaoA.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empA).gte("vence_em", "2027-06-01").lte("vence_em", "2027-06-30");
    t("filtro de período encontra as 2", rPeriodo.count === 2);

    const rValorMin = await sessaoA.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empA).gte("valor_centavos", 50000);
    t("filtro de valor mínimo encontra só a cara", rValorMin.count === 1);

    const rValorMax = await sessaoA.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empA).lte("valor_centavos", 10000);
    t("filtro de valor máximo encontra só a barata", rValorMax.count === 1);
  }

  console.log("\nTIMELINE — log_acoes_financeiras cobre cobrança + instrução vinculada");
  {
    const { empresaId: empA, email: emailA } = await criarEmpresa("Empresa A timeline");
    const clienteId = await criarCliente(empA, "Cliente Timeline");
    const { recorrenciaId, autorizacaoId } = await criarRecorrenciaComAutorizacao(empA, clienteId, "ACTIVE");
    const { cobrancaId, instrucaoId } = await criarCobrancaComInstrucao(empA, clienteId, recorrenciaId, autorizacaoId, "SCHEDULED");
    await admin.from("log_acoes_financeiras").insert([
      { empresa_id: empA, acao: "cobranca_sincronizacao_concluida", entidade_id: cobrancaId },
      { empresa_id: empA, acao: "instrucao_pagamento_scheduled", entidade_id: instrucaoId },
    ]);

    const sessaoA = await sessaoDe(emailA);
    const { data: eventos, error } = await sessaoA
      .from("log_acoes_financeiras")
      .select("id, acao")
      .eq("empresa_id", empA)
      .in("entidade_id", [cobrancaId, instrucaoId])
      .order("criado_em", { ascending: true });
    t("timeline reúne eventos da cobrança e da instrução vinculada", !error && (eventos ?? []).length === 2);
  }

  console.log("\nCAMADAS — nav e páginas ligadas corretamente");
  {
    const conteudoNav = fs.readFileSync("app/(app)/app/NavegacaoApp.tsx", "utf8");
    t("nav inclui Recebimentos", conteudoNav.includes('href: "/app/recebimentos"'));

    const conteudoRecorrencias = fs.readFileSync("app/(app)/app/recorrencias/page.tsx", "utf8");
    t("recorrências linka pra autorizações", conteudoRecorrencias.includes("/app/recorrencias/autorizacoes"));
    t("recorrências linka pra instruções", conteudoRecorrencias.includes("/app/recorrencias/instrucoes"));

    const conteudoRecebimentos = fs.readFileSync("app/(app)/app/recebimentos/page.tsx", "utf8");
    t("recebimentos não fala com lib/asaas direto (só lê via RLS)", !conteudoRecebimentos.includes('from "@/lib/asaas'));

    const conteudoCobrancaDetalhe = fs.readFileSync("app/(app)/app/cobrancas/[id]/page.tsx", "utf8");
    t("ficha da cobrança monta a timeline a partir do log de auditoria", conteudoCobrancaDetalhe.includes("log_acoes_financeiras"));
    t("ficha da cobrança não revela o motivo de recusa sem clique (details/summary)", conteudoCobrancaDetalhe.includes("<details>"));
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
