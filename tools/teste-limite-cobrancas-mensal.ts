/**
 * Cobranças por mês — a tabela oficial de planos NÃO limita.
 *
 * Antes havia um limite mensal (50/200/600) imposto por trigger. A tabela
 * oficial (Grátis 10 · Essencial 50 · Negócio 200 · Escola ilimitado
 * CLIENTES, + R$ 1,99 por Pix recebido) não tem essa dimensão, então o banco
 * deixou de aplicá-la. Este teste garante que não sobrou limite escondido
 * (um limite que o usuário não vê na tabela de preços) e que a tradução de
 * erro antiga continua inofensiva.
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

async function novaConta(plano: string) {
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
  await admin.from("empresas").update({ plano, assinatura_status: "ativa" }).eq("id", empresaId);

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login: ${error.message}`);
  return { empresaId, sessao };
}

async function run() {
  console.log("\n=== COBRANÇAS POR MÊS — sem limite na tabela oficial ===\n");

  for (const plano of ["gratis", "essencial", "negocio", "escola"]) {
    const { data } = await admin.rpc("limite_de_cobrancas_mensal", { p_plano: plano });
    ok(`${plano}: o banco não limita cobranças/mês (NULL)`, data === null, String(data));
  }

  const { empresaId, sessao } = await novaConta("gratis");
  const { data: cliente, error: erroCliente } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente para teste de cobranças", status: "ativo" })
    .select("id")
    .single();
  if (erroCliente || !cliente) throw new Error(`não deu pra criar cliente base: ${erroCliente?.message}`);

  const lote = Array.from({ length: 120 }, (_, i) => ({
    empresa_id: empresaId,
    cliente_id: cliente.id,
    descricao: `Cobrança de teste ${i + 1}`,
    valor_centavos: 1000,
    vence_em: "2026-12-01",
    status: "pendente",
  }));
  const { error: eLote } = await admin.from("cobrancas").insert(lote);
  ok("120 cobranças no mês cabem num plano de 10 clientes (nenhum limite escondido)", !eLote, eLote?.message);

  const { error: e121 } = await sessao.from("cobrancas").insert({
    empresa_id: empresaId,
    cliente_id: cliente.id,
    descricao: "A 121ª cobrança",
    valor_centavos: 1000,
    vence_em: "2026-12-05",
  });
  ok("a 121ª pela API (sessão do usuário) também é aceita", !e121, e121?.message);

  const { mensagemDeLimiteDeCobrancas } = await import("../lib/plano");
  ok("erro antigo traduzido continua inofensivo para erro que não é desse tipo", mensagemDeLimiteDeCobrancas("outro erro") === null);

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
