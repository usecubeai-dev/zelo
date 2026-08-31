/**
 * Auditoria de escrita em `empresas` — colunas privilegiadas.
 *
 * A policy "dono atualiza a empresa" decide QUAL LINHA pode ser escrita.
 * Ela não decide QUAIS COLUNAS. Sem GRANT por coluna, o dono de uma
 * empresa pode alterar, via PostgREST direto, campos que só o servidor
 * deveria tocar:
 *
 *   asaas_account_id   → sequestro de webhook: passa a receber os eventos
 *                        (e marcar como pagas as cobranças) de outra conta
 *   trial_termina_em   → trial perpétuo
 *   assinatura_status  → assinatura ativa sem pagar
 *
 * Nada disso é alcançável pela interface, mas a interface não é a
 * fronteira de segurança: a chave publicável e o endpoint REST são
 * públicos por desenho.
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
if (!URL || !SERVICE || !ANON) {
  console.error("ERRO: variáveis do Supabase ausentes.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passou = 0;
let falhou = 0;
function ok(nome: string, cond: boolean, det = "") {
  if (cond) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ ${nome}${det ? ` — ${det}` : ""}`);
  }
}

const SENHA = "senha_teste_rls_12345";
const usuarios: string[] = [];

async function criarUsuario(rotulo: string) {
  const email = `rls_${rotulo}_${Date.now()}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: SENHA,
      email_confirm: true,
      user_metadata: { nome: `Empresa ${rotulo}` },
    }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`falha ao criar usuário: ${JSON.stringify(j).slice(0, 200)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;

  const sessao = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`falha no login: ${error.message}`);

  return { userId, empresaId, sessao, email };
}

async function valorDa(empresaId: string, coluna: string) {
  const { data } = await admin.from("empresas").select(coluna).eq("id", empresaId).maybeSingle();
  return (data as Record<string, unknown> | null)?.[coluna] ?? null;
}

async function run() {
  console.log("\n=== RLS — ESCRITA EM COLUNAS PRIVILEGIADAS DE `empresas` ===\n");

  const A = await criarUsuario("A");
  const B = await criarUsuario("B");

  // Marca a conta Asaas de B pelo servidor, como o onboarding faria.
  const CONTA_B = `acc_vitima_${Date.now()}`;
  await admin
    .from("empresas")
    .update({ asaas_account_id: CONTA_B, asaas_status: "ativa" })
    .eq("id", B.empresaId);

  console.log("COLUNAS DE ROTEAMENTO FINANCEIRO");

  await A.sessao
    .from("empresas")
    .update({ asaas_account_id: CONTA_B })
    .eq("id", A.empresaId);
  ok(
    "A NÃO consegue apontar sua empresa para a conta Asaas de B",
    (await valorDa(A.empresaId, "asaas_account_id")) !== CONTA_B
  );

  /* Caso separado: com a conta de B, o índice único parcial já barraria
     por colisão. Um valor inédito prova que a proteção é o privilégio de
     coluna, e não um efeito colateral do índice. */
  const CONTA_LIVRE = `acc_inedita_${Date.now()}`;
  await A.sessao
    .from("empresas")
    .update({ asaas_account_id: CONTA_LIVRE })
    .eq("id", A.empresaId);
  ok(
    "A NÃO consegue definir uma conta Asaas inédita para si",
    (await valorDa(A.empresaId, "asaas_account_id")) !== CONTA_LIVRE
  );

  await A.sessao.from("empresas").update({ asaas_status: "ativa" }).eq("id", A.empresaId);
  ok(
    "A NÃO consegue marcar a própria conta como ativa",
    (await valorDa(A.empresaId, "asaas_status")) !== "ativa"
  );

  await A.sessao
    .from("empresas")
    .update({ asaas_wallet_id: "wallet_forjada" })
    .eq("id", A.empresaId);
  ok(
    "A NÃO consegue definir o próprio walletId",
    (await valorDa(A.empresaId, "asaas_wallet_id")) !== "wallet_forjada"
  );

  console.log("\nCOLUNAS DE COBRANÇA E TRIAL");

  const trialOriginal = await valorDa(A.empresaId, "trial_termina_em");
  await A.sessao
    .from("empresas")
    .update({ trial_termina_em: "2099-12-31T00:00:00Z" })
    .eq("id", A.empresaId);
  ok(
    "A NÃO consegue estender o próprio trial",
    (await valorDa(A.empresaId, "trial_termina_em")) === trialOriginal
  );

  await A.sessao.from("empresas").update({ assinatura_status: "ativa" }).eq("id", A.empresaId);
  ok(
    "A NÃO consegue ativar a própria assinatura",
    (await valorDa(A.empresaId, "assinatura_status")) !== "ativa"
  );

  await A.sessao
    .from("empresas")
    .update({ asaas_customer_id: "cus_forjado" })
    .eq("id", A.empresaId);
  ok(
    "A NÃO consegue definir o próprio asaas_customer_id",
    (await valorDa(A.empresaId, "asaas_customer_id")) !== "cus_forjado"
  );

  console.log("\nO QUE O DONO DEVE CONTINUAR PODENDO");

  const { error: eNome } = await A.sessao
    .from("empresas")
    .update({ nome: "Nome Novo Legítimo", documento: "12345678901" })
    .eq("id", A.empresaId);
  ok("A ainda edita nome e documento da própria empresa", !eNome, eNome?.message);
  ok(
    "nome realmente mudou",
    (await valorDa(A.empresaId, "nome")) === "Nome Novo Legítimo"
  );

  console.log("\nISOLAMENTO ENTRE EMPRESAS");

  await A.sessao.from("empresas").update({ nome: "Invadida" }).eq("id", B.empresaId);
  ok("A NÃO altera a empresa de B", (await valorDa(B.empresaId, "nome")) !== "Invadida");

  const { data: leitura } = await A.sessao.from("empresas").select("id");
  ok(
    "A só enxerga a própria empresa",
    Array.isArray(leitura) && leitura.length === 1 && leitura[0].id === A.empresaId
  );

  const { data: credA } = await A.sessao.from("asaas_credenciais").select("*");
  ok("asaas_credenciais invisível para usuário logado", !credA || credA.length === 0);

  const { data: evA } = await A.sessao.from("eventos_asaas").select("*");
  ok("eventos_asaas invisível para usuário logado", !evA || evA.length === 0);

  console.log("\nLIMPEZA");
  for (const id of usuarios) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  }
  const { count } = await admin
    .from("empresas")
    .select("*", { count: "exact", head: true })
    .in("id", [A.empresaId, B.empresaId]);
  ok("empresas de teste removidas", (count ?? 0) === 0);

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
