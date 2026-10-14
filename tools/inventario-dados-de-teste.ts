/**
 * Inventário SOMENTE-LEITURA dos dados de teste no banco compartilhado.
 *
 * NÃO apaga, NÃO altera, NÃO imprime dado pessoal: só contagens. Serve para
 * saber o que é teste e o que é real ANTES de qualquer limpeza (que é manual,
 * ver `docs/DADOS_DE_TESTE.md`).
 *
 * Critério de "teste": o e-mail do usuário termina em `@zelo.test` (é o
 * domínio que TODA suíte automatizada usa) ou o nome da empresa tem o prefixo
 * de uma suíte (E2E, REC, LC, ZZ, debug_, Teste Limite).
 *
 * Uso: npx tsx tools/inventario-dados-de-teste.ts
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) continue;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const PREFIXOS_DE_NOME = ["E2E", "REC ", "LC ", "ZZ ", "debug_", "Teste Limite"];
const ehNomeDeTeste = (nome: string) => PREFIXOS_DE_NOME.some((p) => nome.startsWith(p));

async function main() {
  const usuarios: { id: string; email: string | null }[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    usuarios.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null })));
    if (data.users.length < 200) break;
  }
  const idsDeTeste = new Set(usuarios.filter((u) => (u.email ?? "").toLowerCase().endsWith("@zelo.test")).map((u) => u.id));

  const { data: membros } = await admin.from("membros").select("user_id, empresa_id");
  const { data: empresas } = await admin.from("empresas").select("id, nome, deleted_at");

  const empresaDeTestePorUsuario = new Set((membros ?? []).filter((m) => idsDeTeste.has(m.user_id as string)).map((m) => m.empresa_id as string));
  const todas = (empresas ?? []).filter((e) => !e.deleted_at);
  const teste = todas.filter((e) => empresaDeTestePorUsuario.has(e.id as string) || ehNomeDeTeste((e.nome as string) ?? ""));
  const idsTeste = new Set(teste.map((e) => e.id as string));
  const reais = todas.filter((e) => !idsTeste.has(e.id as string));

  const contar = async (tabela: string, filtroEmpresas: Set<string>) => {
    const ids = [...filtroEmpresas];
    if (ids.length === 0) return 0;
    const { count } = await admin.from(tabela).select("id", { count: "exact", head: true }).in("empresa_id", ids);
    return count ?? 0;
  };

  console.log("INVENTÁRIO (somente leitura, só contagens)\n");
  console.log(`usuários no total ........................ ${usuarios.length}`);
  console.log(`  com e-mail @zelo.test (teste) ......... ${idsDeTeste.size}`);
  console.log(`  demais (candidatos a reais) ........... ${usuarios.length - idsDeTeste.size}`);
  console.log(`empresas ativas .......................... ${todas.length}`);
  console.log(`  de teste (e-mail @zelo.test ou prefixo) ${teste.length}`);
  console.log(`  reais (nenhum critério de teste) ...... ${reais.length}`);
  for (const [rotulo, tabela] of [
    ["clientes", "clientes"],
    ["cobranças", "cobrancas"],
    ["recorrências", "recorrencias"],
    ["mensalidades", "mensalidades"],
  ] as const) {
    console.log(`${rotulo}: teste=${await contar(tabela, idsTeste)} | reais=${await contar(tabela, new Set(reais.map((e) => e.id as string)))}`);
  }
  console.log("\nNenhum dado foi alterado. Procedimento de limpeza: docs/DADOS_DE_TESTE.md");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
