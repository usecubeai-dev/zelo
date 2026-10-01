/**
 * Limite MENSAL de cobranças por plano — verificação ao vivo.
 *
 * Escrito na execução autônoma pós-redesign: a auditoria anterior
 * encontrou que `lib/plano.ts::mensagemDeLimiteDeCobrancas` e dois
 * pontos do código (`cobrancas/acoes.ts`, `instrucao-pagamento-pix.ts`)
 * já traduzem o erro `LIMITE_DE_COBRANCAS_MENSAL:<plano>:<limite>`, mas
 * o snapshot de `supabase/schema/` não mostra nenhum trigger que
 * realmente lance esse erro (só existe o análogo de clientes,
 * `impoe_limite_de_clientes`). Sem acesso a `pg_catalog` nesta sessão,
 * a única forma de saber com certeza é fazer exatamente o que um
 * usuário mal-intencionado faria: inserir além do limite e ver se algo
 * recusa. Mesmo padrão de `tools/teste-limite-plano.ts` (clientes),
 * aplicado a `cobrancas`.
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
const ok = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

const SENHA = "senha_teste_limite_cob_12345";
const usuarios: string[] = [];
const criadas: string[] = [];

async function novaConta() {
  const email = `limite_cob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome: "Teste Limite Cobranças" } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  criadas.push(empresaId);

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login: ${error.message}`);
  return { empresaId, sessao };
}

async function run() {
  console.log("\n=== LIMITE MENSAL DE COBRANÇAS POR PLANO (essencial = 50) ===\n");

  const { empresaId, sessao } = await novaConta();

  const { data: cliente, error: erroCliente } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente para limite de cobranças" })
    .select("id")
    .single();
  if (erroCliente || !cliente) throw new Error(`não deu pra criar cliente base: ${erroCliente?.message}`);

  console.log("Semeando 50 cobranças via service_role (limite do plano essencial)...");
  for (let i = 1; i <= 50; i++) {
    const { error } = await admin.from("cobrancas").insert({
      empresa_id: empresaId,
      cliente_id: cliente.id,
      descricao: `Cobrança de teste ${i}`,
      valor_centavos: 1000,
      vence_em: "2026-12-01",
    });
    if (error) throw new Error(`semeadura parou na cobrança ${i}: ${error.message}`);
  }

  const contarCobrancas = async () =>
    (await admin.from("cobrancas").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId)).count ?? 0;

  ok("50 cobranças cabem no essencial", (await contarCobrancas()) === 50);

  const { error: erro51 } = await sessao.from("cobrancas").insert({
    empresa_id: empresaId,
    cliente_id: cliente.id,
    descricao: "A 51ª cobrança",
    valor_centavos: 1000,
    vence_em: "2026-12-05",
  });

  const total = await contarCobrancas();

  if (erro51) {
    ok("BLOQUEADO — insert direto via API recusa a 51ª cobrança", true);
    ok("erro traz o marcador LIMITE_DE_COBRANCAS_MENSAL", Boolean(erro51.message?.includes("LIMITE_DE_COBRANCAS_MENSAL")), erro51.message);
    ok("continua com 50 cobranças", total === 50, `total=${total}`);

    const { mensagemDeLimiteDeCobrancas } = await import("../lib/plano");
    const msg = mensagemDeLimiteDeCobrancas(erro51.message);
    ok("mensagem traduzida cita o plano e o limite", Boolean(msg?.includes("Essencial") && msg?.includes("50")), String(msg));
  } else {
    ok(
      "🔴 NÃO BLOQUEADO — a 51ª cobrança foi aceita sem erro nenhum: o limite mensal do plano NÃO está sendo aplicado no banco",
      false,
      `total agora=${total} (esperado 50)`
    );
  }

  console.log("\nLIMPEZA");
  await admin.from("cobrancas").delete().eq("empresa_id", empresaId);
  await admin.from("clientes").delete().eq("empresa_id", empresaId);
  for (const id of usuarios) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  }
  const { count } = await admin.from("empresas").select("*", { count: "exact", head: true }).in("id", criadas);
  ok("banco limpo ao final", (count ?? 0) === 0);

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
