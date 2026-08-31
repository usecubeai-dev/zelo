/**
 * Limite de clientes por plano.
 *
 * O teste que importa não é o da interface: é o da API. A proteção só vale
 * se resistir a um insert direto no PostgREST com a sessão do usuário —
 * que é o caminho de quem quer burlar.
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

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passou = 0, falhou = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { passou++; console.log(`  ✓ ${n}`); }
  else { falhou++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`); }
};

const SENHA = "senha_teste_limite_12345";
const usuarios: string[] = [];

async function novaConta() {
  const email = `limite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome: "Teste Limite" } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login: ${error.message}`);
  return { empresaId, sessao };
}

/** Semeia N clientes por service_role — o trigger não distingue origem. */
async function semear(empresaId: string, n: number) {
  const linhas = Array.from({ length: n }, (_, i) => ({ empresa_id: empresaId, nome: `Cliente ${i + 1}` }));
  for (const l of linhas) {
    const { error } = await admin.from("clientes").insert(l);
    if (error) throw new Error(`semeadura parou em ${l.nome}: ${error.message}`);
  }
}

const contar = async (empresaId: string) =>
  (await admin.from("clientes").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId)).count ?? 0;

async function run() {
  console.log("\n=== LIMITE DE CLIENTES POR PLANO ===\n");
  const criadas: string[] = [];

  // --- essencial: 20 ---
  {
    const { empresaId, sessao } = await novaConta();
    criadas.push(empresaId);
    const { data: e } = await admin.from("empresas").select("plano").eq("id", empresaId).single();
    ok("empresa nova nasce no plano essencial", e?.plano === "essencial", String(e?.plano));

    await semear(empresaId, 20);
    ok("20 clientes cabem no essencial", (await contar(empresaId)) === 20);

    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "O 21º" });
    ok("BYPASS BLOQUEADO — insert direto via API recusa o 21º", Boolean(error), "nenhum erro retornado");
    ok("erro traz o marcador do limite", Boolean(error?.message?.includes("LIMITE_DE_CLIENTES")), error?.message);
    ok("continua com 20 clientes", (await contar(empresaId)) === 20);

    const { mensagemDeLimite } = await import("../lib/plano");
    const msg = mensagemDeLimite(error?.message);
    ok("mensagem traduzida cita o plano e o limite", Boolean(msg?.includes("Essencial") && msg?.includes("20")), String(msg));

    // service_role também não escapa: o trigger não olha o papel
    const { error: eAdmin } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Via service_role" });
    ok("nem service_role fura o limite", Boolean(eAdmin));
  }

  // --- profissional: 50 ---
  {
    const { empresaId, sessao } = await novaConta();
    criadas.push(empresaId);
    await admin.from("empresas").update({ plano: "profissional" }).eq("id", empresaId);
    await semear(empresaId, 50);
    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "O 51º" });
    ok("profissional aceita 50 e recusa o 51º", (await contar(empresaId)) === 50 && Boolean(error));
    ok("erro do profissional cita o limite 50", Boolean(error?.message?.includes(":profissional:50")), error?.message);
  }

  // --- premium: 150 ---
  {
    const { empresaId, sessao } = await novaConta();
    criadas.push(empresaId);
    await admin.from("empresas").update({ plano: "premium" }).eq("id", empresaId);
    await semear(empresaId, 150);
    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "O 151º" });
    ok("premium aceita 150 e recusa o 151º", (await contar(empresaId)) === 150 && Boolean(error));
  }

  // --- o dono não pode se promover ---
  {
    const { empresaId, sessao } = await novaConta();
    criadas.push(empresaId);
    await sessao.from("empresas").update({ plano: "premium" }).eq("id", empresaId);
    const { data } = await admin.from("empresas").select("plano").eq("id", empresaId).single();
    ok("dono NÃO consegue mudar o próprio plano pela API", data?.plano === "essencial", String(data?.plano));
  }

  // --- limpeza ---
  for (const id of criadas) {
    await admin.from("clientes").delete().eq("empresa_id", id);
  }
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
