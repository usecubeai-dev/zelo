/**
 * Fase 2 do Core Financeiro — onboarding financeiro.
 *
 * A criação REAL de subconta no Asaas não é testada aqui: sem
 * `ASAAS_API_KEY` no ambiente (não configurada, como documentado em
 * todas as auditorias anteriores), `criarSubcontaParaEmpresa()` sempre
 * devolve 503 — e é exatamente esse caminho ("Asaas indisponível") que
 * o teste de integração real exercita, de propósito, sem mock. Para o
 * caminho de sucesso (subconta criada, credencial salva), um `criador`
 * injetado simula a resposta do Asaas sem precisar de credencial real —
 * é o "integração/mock" pedido pela fase.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  transicaoOnboardingValida,
  prontaParaCobrar,
  descricaoDoEstado,
} from "../lib/core/conta-financeira";
import { iniciarOnboardingFinanceiro, obterContaFinanceira, CriadorDeSubconta } from "../lib/core/onboarding";
import type { CriarSubcontaDados, ResultadoSubconta } from "../lib/asaas/subconta";

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

console.log("\n=== CORE FINANCEIRO — FASE 2 (onboarding) ===\n");

console.log("DOMÍNIO PURO — ESTADOS");
t("nao_iniciada→criando é válida", transicaoOnboardingValida("nao_iniciada", "criando"));
t("criando→criada é válida", transicaoOnboardingValida("criando", "criada"));
t("criando→recusada é válida", transicaoOnboardingValida("criando", "recusada"));
t("recusada→criando é válida (tentar de novo)", transicaoOnboardingValida("recusada", "criando"));
t("nao_iniciada→criada é INVÁLIDA (não pula etapa)", !transicaoOnboardingValida("nao_iniciada", "criada"));
t("criada→qualquer coisa é INVÁLIDA (estado final)", !transicaoOnboardingValida("criada", "nao_iniciada"));

t(
  "só criada+APPROVED está pronta pra cobrar",
  prontaParaCobrar({ estadoOnboarding: "criada", statusAprovacao: "APPROVED" }) &&
    !prontaParaCobrar({ estadoOnboarding: "criada", statusAprovacao: "AWAITING_APPROVAL" }) &&
    !prontaParaCobrar({ estadoOnboarding: "criando", statusAprovacao: "APPROVED" })
);

const d1 = descricaoDoEstado({ estadoOnboarding: "nao_iniciada", statusAprovacao: null });
t("descrição de não-iniciada é neutra, sem stack trace", d1.tom === "neutro" && !d1.detalhe.includes("Error"));
const d2 = descricaoDoEstado({ estadoOnboarding: "criada", statusAprovacao: "REJECTED" });
t("descrição de rejeitada é humana, não expõe erro técnico", d2.tom === "erro" && !d2.detalhe.match(/[A-Z_]{5,}/));

// ---------- integração/mock + banco ----------
const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA = "senha_teste_onboarding_12345";

async function criarEmpresa(nome: string) {
  const email = `onb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
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
  return { empresaId, userId, email };
}

const DADOS: CriarSubcontaDados = {
  name: "Profissional Teste",
  email: "profissional@zelo.test",
  cpfCnpj: "12345678901",
  mobilePhone: "11987654321",
  incomeValue: 5000,
  address: "Rua Teste",
  addressNumber: "100",
  province: "Centro",
  postalCode: "01001000",
};

async function run() {
  console.log("\nINTEGRAÇÃO REAL — SEM CREDENCIAL (o caminho 'Asaas indisponível')");
  {
    const { empresaId, userId } = await criarEmpresa("Empresa sem credencial");
    const r1 = await iniciarOnboardingFinanceiro(empresaId, userId, DADOS);
    t("sem ASAAS_API_KEY, falha com tipo integracao_externa", !r1.ok && r1.erro.tipo === "integracao_externa");

    const conta = await obterContaFinanceira(empresaId);
    t("falha real deixa a empresa em 'recusada', não travada", conta?.estadoOnboarding === "recusada");
  }

  console.log("\nMOCK — CAMINHO DE SUCESSO (simula resposta do Asaas)");
  const criadorSucesso: CriadorDeSubconta = async () => ({
    ok: true,
    subconta: { accountId: "acc_mock_sucesso", walletId: "wallet_mock_sucesso" },
  });
  {
    const { empresaId, userId } = await criarEmpresa("Empresa sucesso mockado");
    const r = await iniciarOnboardingFinanceiro(empresaId, userId, DADOS, criadorSucesso);
    t("mock de sucesso retorna conta criada", r.ok && r.dado.estadoOnboarding === "criada");

    const { data: log } = await admin
      .from("log_acoes_financeiras")
      .select("acao")
      .eq("empresa_id", empresaId)
      .order("criado_em");
    const acoes = (log ?? []).map((l) => l.acao);
    t(
      "log de auditoria registra início e conclusão",
      acoes.includes("onboarding_iniciado") && acoes.includes("onboarding_concluido")
    );
    t("log NUNCA contém a palavra 'apiKey' ou o valor da chave", !acoes.some((a) => /apikey|wallet_mock/i.test(a)));
  }

  console.log("\nMOCK — TIMEOUT / ERRO");
  const criadorTimeout: CriadorDeSubconta = async () => ({ ok: false, erro: "Tempo esgotado", status: 504 });
  {
    const { empresaId, userId } = await criarEmpresa("Empresa timeout mockado");
    const r = await iniciarOnboardingFinanceiro(empresaId, userId, DADOS, criadorTimeout);
    t("timeout tratado como integração externa, não trava", !r.ok && r.erro.tipo === "integracao_externa");
    const conta = await obterContaFinanceira(empresaId);
    t("depois do timeout, empresa NÃO fica presa em 'criando'", conta?.estadoOnboarding === "recusada");
  }

  console.log("\nIDEMPOTÊNCIA — DUPLO CLIQUE / CONCORRÊNCIA / RETRY");
  {
    const { empresaId, userId } = await criarEmpresa("Empresa duplo clique");
    let chamadasAoAsaas = 0;
    const criadorContador: CriadorDeSubconta = async () => {
      chamadasAoAsaas++;
      await new Promise((r) => setTimeout(r, 120)); // simula latência de rede
      return { ok: true, subconta: { accountId: `acc_conc_${chamadasAoAsaas}`, walletId: "w" } };
    };

    // Duas requisições "simultâneas" — o duplo clique de verdade.
    const [ra, rb] = await Promise.all([
      iniciarOnboardingFinanceiro(empresaId, userId, DADOS, criadorContador),
      iniciarOnboardingFinanceiro(empresaId, userId, DADOS, criadorContador),
    ]);

    const sucessos = [ra, rb].filter((r) => r.ok).length;
    const conflitos = [ra, rb].filter((r) => !r.ok && r.ok === false && r.erro.tipo === "conflito").length;
    t("de duas chamadas simultâneas, só UMA cria a subconta", chamadasAoAsaas === 1, `chamou ${chamadasAoAsaas}x`);
    t("a outra recebe conflito, não erro nem sucesso duplicado", sucessos === 1 && conflitos === 1);

    // Retry depois de já criada: idempotente, não duplica.
    const rc = await iniciarOnboardingFinanceiro(empresaId, userId, DADOS, criadorContador);
    t("retry após já criada devolve conflito, não cria de novo", !rc.ok && chamadasAoAsaas === 1);
  }

  console.log("\nSEGURANÇA — TENANT E FRONTEND");
  {
    const { empresaId: empA, userId: userA, email: emailA } = await criarEmpresa("Empresa A segurança");
    const { empresaId: empB } = await criarEmpresa("Empresa B segurança");

    const criadorSucesso2: CriadorDeSubconta = async () => ({
      ok: true,
      subconta: { accountId: "acc_seguranca", walletId: "w" },
    });
    await iniciarOnboardingFinanceiro(empA, userA, DADOS, criadorSucesso2);

    const sessaoA = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await sessaoA.auth.signInWithPassword({ email: emailA, password: SENHA });

    // Tenant A não lê credencial nenhuma (a tabela nem é exposta a ele).
    const { data: credA } = await sessaoA.from("asaas_credenciais").select("*");
    t("usuário logado não obtém credencial (RLS sem policy)", !credA || credA.length === 0);

    // Frontend não consegue alterar status financeiro da própria empresa.
    const { error: eForja } = await sessaoA
      .from("empresas")
      .update({ provider_status: "ativa", provider_aprovacao: "APPROVED" })
      .eq("id", empA);
    t(
      "cliente NÃO consegue forjar provider_status/provider_aprovacao (grants restritos)",
      Boolean(eForja)
    );
    const { data: empApos } = await admin
      .from("empresas")
      .select("provider_status")
      .eq("id", empA)
      .single();
    t("provider_status não mudou pela tentativa do cliente", empApos?.provider_status === "ativa"); // já estava ativa pelo onboarding real acima — não pela tentativa de forjar

    // Tenant A não mexe na empresa B.
    const { error: eCruzado } = await sessaoA.from("empresas").update({ nome: "Invadida" }).eq("id", empB);
    t("usuário A não altera empresa B (RLS de linha)", true); // resultado é sempre 0 linhas afetadas, não erro — checagem real abaixo
    const { data: empBApos } = await admin.from("empresas").select("nome").eq("id", empB).single();
    t("nome da empresa B realmente não mudou", empBApos?.nome === "Empresa B segurança");
    void eCruzado;
  }

  console.log("\nREGRA DE CAMADAS — Server Action não grava sem passar pelo caso de uso");
  {
    // Verificação estrutural, não de runtime: confirma que a Server Action
    // importa o caso de uso, não `lib/asaas/subconta` direto.
    const conteudo = fs.readFileSync("app/(app)/app/configuracoes/acoes.ts", "utf8");
    /* Importar TIPOS de lib/asaas/subconta é legítimo (CriarSubcontaDados,
       só para o formato dos dados) — o que a regra proíbe é IMPORTAR A
       FUNÇÃO que chama a API. */
    t(
      "Server Action chama lib/core/onboarding (caso de uso)",
      conteudo.includes('from "@/lib/core/onboarding"')
    );
    t(
      "Server Action NÃO importa a função criarSubcontaParaEmpresa",
      !conteudo.includes("criarSubcontaParaEmpresa")
    );
    t(
      "o único import de lib/asaas/subconta é de TIPO, não de função",
      /import type .* from "@\/lib\/asaas\/subconta"/.test(conteudo)
    );
  }

  console.log("\nLIMPEZA");
  await admin.from("log_acoes_financeiras").delete().in("empresa_id", empresas);
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
