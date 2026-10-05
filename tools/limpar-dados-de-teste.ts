/**
 * Limpeza SEGURA dos dados de teste (contas `@zelo.test`).
 *
 * Rodar:
 *   npx tsx tools/limpar-dados-de-teste.ts             → só LISTA (dry-run, não apaga nada)
 *   npx tsx tools/limpar-dados-de-teste.ts --executar  → apaga o que a lista mostrou
 *
 * Por que `@zelo.test`: é o domínio que TODOS os testes automatizados do
 * projeto (tools/teste-*.ts e tests/e2e) usam para criar contas — e é um
 * domínio reservado (.test, RFC 2606) que não existe de verdade, então
 * nenhum cliente real pode ter e-mail nele. Contas com qualquer outro
 * domínio NUNCA entram, por construção.
 *
 * O que apaga: o usuário no Auth. O resto desce em cascata (membros → a
 * trigger `ao_remover_membro` remove a empresa → clientes, cobranças,
 * recorrências, autorizações, notificações, log...). Registros financeiros
 * do Zelo (`mensalidades`, `taxas_recebimento`, `comissoes`) NÃO são
 * apagados em cascata: ficam com `empresa_id` nulo, de propósito.
 *
 * Recusa-se a continuar (e não apaga NADA) se algum usuário candidato:
 *   - for administrador do Zelo, ou
 *   - tiver mensalidade paga em ambiente `production`, ou
 *   - tiver comissão paga a influenciador.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((l) => {
    const c = l.trim();
    if (c.startsWith("#") || !c.includes("=")) return;
    const i = c.indexOf("=");
    process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const executar = process.argv.includes("--executar");

async function candidatos() {
  const todos: { id: string; email: string; created_at: string }[] = [];
  for (let pagina = 1; pagina < 50; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    todos.push(...users.map((u) => ({ id: u.id, email: u.email ?? "", created_at: u.created_at })));
    if (users.length < 200) break;
  }
  return todos.filter((u) => u.email.toLowerCase().endsWith("@zelo.test"));
}

async function main() {
  const lista = await candidatos();
  const ids = lista.map((u) => u.id);
  console.log(`Contas @zelo.test encontradas: ${lista.length}`);

  const { data: membros } = await admin.from("membros").select("empresa_id, user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const empresaIds = [...new Set((membros ?? []).map((m) => m.empresa_id as string))];
  const contar = async (tabela: string) =>
    empresaIds.length ? ((await admin.from(tabela).select("id", { count: "exact", head: true }).in("empresa_id", empresaIds)).count ?? 0) : 0;

  console.log(`Empresas ligadas a elas: ${empresaIds.length}`);
  console.log(`  clientes: ${await contar("clientes")} | cobranças: ${await contar("cobrancas")} | recorrências: ${await contar("recorrencias")} | autorizações Pix: ${await contar("autorizacoes_pix")}`);

  const bloqueios: string[] = [];
  if (ids.length) {
    const { data: adm } = await admin.from("administradores_zelo").select("user_id").in("user_id", ids);
    if (adm?.length) bloqueios.push(`${adm.length} candidato(s) são administradores do Zelo`);
  }
  if (empresaIds.length) {
    const { count: pagas } = await admin.from("mensalidades").select("id", { count: "exact", head: true }).in("empresa_id", empresaIds).eq("status", "paga").eq("ambiente", "production");
    if (pagas) bloqueios.push(`${pagas} mensalidade(s) paga(s) em PRODUÇÃO ligadas a candidatos`);
    const { count: comPagas } = await admin.from("comissoes").select("id", { count: "exact", head: true }).in("empresa_id", empresaIds).eq("status", "paga");
    if (comPagas) bloqueios.push(`${comPagas} comissão(ões) já paga(s) ligadas a candidatos`);
  }

  if (bloqueios.length) {
    console.log("\nRECUSADO — nada será apagado:");
    bloqueios.forEach((b) => console.log(`  - ${b}`));
    process.exit(1);
  }

  if (!executar) {
    console.log("\nDry-run: nada foi apagado. Para apagar de verdade: --executar");
    return;
  }

  let ok = 0;
  for (const u of lista) {
    const r = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    if (r.ok) ok++;
    else console.log(`  falhou ao apagar um usuário (HTTP ${r.status})`);
  }
  console.log(`\nApagadas ${ok} de ${lista.length} contas de teste (e, em cascata, as empresas delas).`);
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
