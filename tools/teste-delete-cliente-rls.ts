/**
 * Verificação ao vivo: um usuário real consegue excluir o próprio
 * cliente (sem histórico) via `excluirCliente()`? A auditoria anterior
 * suspeitou que não, porque `06_rls.sql` (snapshot de 02/09) não lista
 * nenhuma policy de DELETE em `clientes`. Mas o mesmo snapshot também
 * não lista a tabela `servicos` nem o trigger de limite de cobranças —
 * os dois já confirmados existentes e funcionando ao vivo nesta mesma
 * rodada. Mesmo método: bater na API real como o app bateria.
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

async function run() {
  console.log("\n=== DELETE DE CLIENTE — usuário real, sem histórico ===\n");

  const email = `delete_cli_${Date.now()}@zelo.test`;
  const senha = "senha_teste_delete_12345";
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome: "Teste Delete Cliente" } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: erroLogin } = await sessao.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) throw new Error(`login: ${erroLogin.message}`);

  const { data: cliente, error: erroCriar } = await sessao
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente descartável" })
    .select("id")
    .single();
  ok("usuário cria seu próprio cliente (sessão normal)", !erroCriar && Boolean(cliente?.id), erroCriar?.message);

  if (cliente?.id) {
    const { error: erroDelete, count } = await sessao
      .from("clientes")
      .delete({ count: "exact" })
      .eq("id", cliente.id)
      .eq("empresa_id", empresaId);

    if (erroDelete) {
      ok(
        "🔴 DELETE recusado pelo banco (erro explícito) — RLS de DELETE realmente ausente/bloqueando",
        false,
        erroDelete.message
      );
    } else if (!count) {
      ok(
        "🔴 DELETE não afetou nenhuma linha (0 rows) — confirma a suspeita: falta policy de DELETE em clientes",
        false,
        "count=0, sem erro explícito — é exatamente o sintoma de RLS sem policy pra essa operação"
      );
    } else {
      ok("DELETE funcionou — cliente removido de verdade pela própria sessão do usuário", count === 1);
    }

    const { data: aindaExiste } = await admin.from("clientes").select("id").eq("id", cliente.id).maybeSingle();
    ok("conferência via admin bate com o resultado acima", (aindaExiste === null) === !(erroDelete || !count));
  }

  console.log("\nLIMPEZA");
  await admin.from("clientes").delete().eq("empresa_id", empresaId);
  await fetch(`${URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  console.log("  ✓ dados de teste removidos");

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
