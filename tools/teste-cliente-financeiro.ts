/**
 * Fase 4 do Core Financeiro — sincronização Cliente Zelo ↔ Asaas.
 *
 * Mesmo espírito das fases anteriores: sem `ASAAS_API_KEY`/credencial de
 * subconta real, o caminho "sem credencial" é testado de verdade, sem
 * mock. Para sucesso/duplicidade/resposta-perdida — onde o Asaas precisa
 * "responder algo" — `criador`/`buscador` injetados simulam a resposta,
 * mesmo padrão de DI já usado nas Fases 2 e 3.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  sincronizarClienteFinanceiro,
  CriadorDeClienteAsaas,
  BuscadorDeClienteAsaas,
} from "../lib/core/cliente-financeiro";
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

// Não configurada em `.env.local` (só em produção) — mesmo padrão de `teste-fase6.ts`
// para poder testar `salvarCredencialDaEmpresa`/`credencialDaEmpresa` localmente.
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

console.log("\n=== CORE FINANCEIRO — FASE 4 (cliente ↔ Asaas) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];

async function criarEmpresa(nome: string) {
  const email = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha_teste_cliente_fin_12345", email_confirm: true, user_metadata: { nome } }),
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

const SENHA_TESTE = "senha_teste_cliente_fin_12345";

async function criarClienteDireto(empresaId: string, nome: string, documento = "98765432100") {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome, email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test`, documento })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let chamadasCriador = 0;
const criadorSucesso: CriadorDeClienteAsaas = async (dados) => {
  chamadasCriador++;
  return { ok: true, data: { id: `cus_mock_${Math.random().toString(36).slice(2, 8)}`, name: dados.name } as any };
};
const criadorErro: CriadorDeClienteAsaas = async () => ({ ok: false, status: 504, erro: "timeout simulado" });
const LISTA_VAZIA = { object: "list" as const, hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] as never[] };
const buscadorVazio: BuscadorDeClienteAsaas = async () => ({ ok: true, data: { ...LISTA_VAZIA } });

async function run() {
  console.log("INTEGRAÇÃO REAL — sem credencial de subconta");
  {
    const { empresaId } = await criarEmpresa("Empresa sem conta financeira");
    const clienteId = await criarClienteDireto(empresaId, "Cliente sem conta");
    const r = await sincronizarClienteFinanceiro(clienteId, empresaId);
    t("sem credencial salva, falha com integracao_externa (não finge sucesso)", !r.ok && r.erro.tipo === "integracao_externa");
  }

  console.log("\nVALIDAÇÃO — cliente inexistente / arquivado");
  {
    const { empresaId } = await criarEmpresa("Empresa validação");
    const r = await sincronizarClienteFinanceiro("00000000-0000-0000-0000-000000000000", empresaId);
    t("cliente inexistente devolve nao_encontrado", !r.ok && r.erro.tipo === "nao_encontrado");

    const clienteId = await criarClienteDireto(empresaId, "Cliente arquivado");
    await admin.from("clientes").update({ status: "arquivado" }).eq("id", clienteId);
    const r2 = await sincronizarClienteFinanceiro(clienteId, empresaId);
    t("cliente arquivado não é sincronizado", !r2.ok && r2.erro.tipo === "conflito");
  }

  console.log("\nMOCK — caminho de sucesso");
  {
    const { empresaId } = await criarEmpresa("Empresa sucesso mock");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cliente");
    const clienteId = await criarClienteDireto(empresaId, "Cliente sucesso");

    chamadasCriador = 0;
    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio);
    t("sincronização com sucesso grava asaasCustomerId", r.ok && r.dado.asaasCustomerId.startsWith("cus_mock_"));
    t("não é 'jaExistia' na primeira vez", r.ok && r.dado.jaExistia === false);

    const { data: linha } = await admin.from("clientes").select("asaas_customer_id, asaas_sync_status").eq("id", clienteId).single();
    t("banco reflete customer_id e status 'sincronizado'", linha?.asaas_customer_id && linha.asaas_sync_status === "sincronizado");

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("log de auditoria registra a conclusão", (log ?? []).some((l) => l.acao === "cliente_sincronizacao_concluida"));

    console.log("\nIDEMPOTÊNCIA — chamar de novo não duplica");
    chamadasCriador = 0;
    const r2 = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio);
    t("segunda chamada é no-op idempotente", r2.ok && r2.dado.jaExistia === true);
    t("segunda chamada NÃO chama o Asaas de novo", chamadasCriador === 0);
  }

  console.log("\nMOCK — erro/timeout do Asaas");
  {
    const { empresaId } = await criarEmpresa("Empresa erro mock");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cliente");
    const clienteId = await criarClienteDireto(empresaId, "Cliente com erro");

    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorErro, buscadorVazio);
    t("erro/timeout do Asaas devolve integracao_externa", !r.ok && r.erro.tipo === "integracao_externa");

    const { data: linha } = await admin.from("clientes").select("asaas_sync_status, asaas_customer_id").eq("id", clienteId).single();
    t("depois do erro, cliente NÃO fica preso em 'sincronizando'", linha?.asaas_sync_status === "erro" && !linha.asaas_customer_id);

    console.log("\nRETRY — depois do erro, tentar de novo com sucesso");
    const r2 = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio);
    t("retry após erro consegue sincronizar", r2.ok && r2.dado.jaExistia === false);
  }

  console.log("\nRESPOSTA PERDIDA — Asaas já tem o cliente (externalReference bate), não duplica");
  {
    const { empresaId } = await criarEmpresa("Empresa resposta perdida");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cliente");
    const clienteId = await criarClienteDireto(empresaId, "Cliente perdido");

    const buscadorComAchado: BuscadorDeClienteAsaas = async () => ({
      ok: true,
      data: {
        ...LISTA_VAZIA,
        data: [{ id: "cus_recuperado_123", name: "Cliente perdido", externalReference: clienteId } as any],
      },
    });

    chamadasCriador = 0;
    const r = await sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorComAchado);
    t("recupera o customer existente em vez de criar outro", r.ok && r.dado.asaasCustomerId === "cus_recuperado_123");
    t("NÃO chama o criador quando já encontrou por externalReference", chamadasCriador === 0);

    const { data: log } = await admin.from("log_acoes_financeiras").select("acao").eq("empresa_id", empresaId);
    t("recuperação é auditada", (log ?? []).some((l) => l.acao === "cliente_sincronizacao_recuperada"));
  }

  console.log("\nCONCORRÊNCIA — duplo clique / duas sincronizações simultâneas");
  {
    const { empresaId } = await criarEmpresa("Empresa concorrência");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cliente");
    const clienteId = await criarClienteDireto(empresaId, "Cliente concorrente");

    chamadasCriador = 0;
    const [ra, rb] = await Promise.all([
      sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio),
      sincronizarClienteFinanceiro(clienteId, empresaId, null, criadorSucesso, buscadorVazio),
    ]);
    // Mesmo contrato do CAS de `iniciarOnboardingFinanceiro` (Fase 2): quem
    // perde a corrida recebe conflito OU, se a vencedora já tiver
    // terminado por completo antes da relida da perdedora (mock tem
    // latência quase zero — real seria diferente), um `ok(jaExistia:true)`
    // idempotente. As duas são corretas; só "erro" ou "duplicata" não
    // seriam (mesma ambiguidade já documentada nas Fases 5–8).
    const vencedora = ra.ok && !ra.dado.jaExistia ? ra : rb.ok && !rb.dado.jaExistia ? rb : ra;
    const perdedora = vencedora === ra ? rb : ra;
    t(
      "uma chamada sincroniza; a outra recebe conflito ou já-existia idempotente (não erro, não duplicata)",
      vencedora.ok &&
        !vencedora.dado.jaExistia &&
        (perdedora.ok ? perdedora.dado.jaExistia === true : perdedora.erro.tipo === "conflito")
    );
    t("só UMA chegou a chamar o Asaas (CAS venceu para só uma)", chamadasCriador === 1);
  }

  console.log("\nIDs ÚNICOS — dois clientes diferentes recebem customer_id diferentes");
  {
    const { empresaId } = await criarEmpresa("Empresa IDs únicos");
    await salvarCredencialDaEmpresa(empresaId, "chave_fake_teste_cliente");
    const c1 = await criarClienteDireto(empresaId, "Cliente Um", "11111111111");
    const c2 = await criarClienteDireto(empresaId, "Cliente Dois", "22222222222");

    const r1 = await sincronizarClienteFinanceiro(c1, empresaId, null, criadorSucesso, buscadorVazio);
    const r2 = await sincronizarClienteFinanceiro(c2, empresaId, null, criadorSucesso, buscadorVazio);
    t(
      "dois clientes distintos recebem asaas_customer_id distintos",
      r1.ok && r2.ok && r1.dado.asaasCustomerId !== r2.dado.asaasCustomerId
    );

    // Tenta forjar o mesmo asaas_customer_id em dois clientes — o índice único parcial deve barrar.
    const { error: erroDuplicado } = await admin
      .from("clientes")
      .update({ asaas_customer_id: (r1 as any).dado.asaasCustomerId })
      .eq("id", c2);
    t("banco recusa dois clientes com o mesmo asaas_customer_id (índice único)", !!erroDuplicado);
  }

  console.log("\nSEGURANÇA — tenant isolation e grants restritos");
  {
    const a = await criarEmpresa("Tenant A cliente");
    const b = await criarEmpresa("Tenant B cliente");
    const clienteDeA = await criarClienteDireto(a.empresaId, "Cliente do tenant A");

    const rCruzado = await sincronizarClienteFinanceiro(clienteDeA, b.empresaId);
    t("sincronizar cliente de A usando empresaId de B falha (não vaza entre tenants)", !rCruzado.ok && rCruzado.erro.tipo === "nao_encontrado");

    // Sessão real do próprio dono do cliente — não `anon` sem sessão, que
    // RLS já bloquearia por si só e não provaria nada sobre o GRANT.
    // Achado desta fase: `clientes`/`cobrancas` tinham GRANT de tabela
    // inteira (aditivo ao de coluna), então testar só com `anon` mascarava
    // um REVOKE por coluna que não fazia efeito nenhum. Ver migration
    // `fase11_corrige_grants_tabela_ampla_clientes_cobrancas`.
    const sessao = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", { auth: { persistSession: false } });
    await sessao.auth.signInWithPassword({ email: a.email, password: SENHA_TESTE });
    const { error: erroForja } = await sessao.from("clientes").update({ asaas_customer_id: "cus_forjado" }).eq("id", clienteDeA);
    t("dono do cliente NÃO consegue forjar asaas_customer_id (grant de coluna, não só RLS)", erroForja?.code === "42501");

    const { error: erroLegit, count: countLegit } = await sessao
      .from("clientes")
      .update({ nome: "Renomeado pelo dono" }, { count: "exact" })
      .eq("id", clienteDeA);
    t("mas o mesmo dono AINDA consegue editar uma coluna legítima (grant não é global demais)", !erroLegit && countLegit === 1);
  }

  console.log("\nCAMADAS — Server Action chama o caso de uso, não fala com o Asaas direto");
  {
    const conteudo = fs.readFileSync("app/(app)/app/clientes/acoes.ts", "utf8");
    t("acoes.ts importa lib/core/cliente-financeiro", conteudo.includes('from "@/lib/core/cliente-financeiro"'));
    t("criarCliente() dispara a sincronização best-effort", conteudo.includes("await sincronizarClienteFinanceiro("));
    t("existe ação manual de retry (sincronizarClienteAsaasAcao)", conteudo.includes("export async function sincronizarClienteAsaasAcao"));
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
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
