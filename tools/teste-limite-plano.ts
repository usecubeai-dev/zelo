/**
 * Limite de clientes por plano — TABELA OFICIAL:
 *   Grátis 10 · Essencial 50 · Negócio 200 · Escola ilimitado.
 *
 * O teste que importa não é o da interface: é o da API. A proteção só vale
 * se resistir a um insert direto no PostgREST com a sessão do usuário —
 * que é o caminho de quem quer burlar.
 *
 * Compatibilidade: os identificadores antigos ('profissional' = Negócio,
 * 'premium' = Escola) continuam gravados em contas antigas e precisam
 * seguir impondo o limite certo.
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

async function novaConta(plano: string) {
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
  const { error: eP } = await admin.from("empresas").update({ plano, assinatura_status: "ativa" }).eq("id", empresaId);
  if (eP) throw new Error(`plano ${plano}: ${eP.message}`);

  const sessao = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sessao.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login: ${error.message}`);
  return { empresaId, sessao };
}

/** Semeia N clientes por service_role em lotes — o trigger não distingue origem e vale linha a linha. */
async function semear(empresaId: string, n: number) {
  for (let ini = 0; ini < n; ini += 50) {
    const lote = Array.from({ length: Math.min(50, n - ini) }, (_, i) => ({
      empresa_id: empresaId,
      nome: `Cliente ${ini + i + 1}`,
      status: "ativo",
    }));
    const { error } = await admin.from("clientes").insert(lote);
    if (error) throw new Error(`semeadura parou perto de ${ini}: ${error.message}`);
  }
}

const contar = async (empresaId: string) =>
  (await admin.from("clientes").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId)).count ?? 0;

async function limiteDeterminado(plano: string, limite: number, nome: string, marcador: string) {
  const { empresaId, sessao } = await novaConta(plano);
  await semear(empresaId, limite);
  ok(`${nome}: ${limite} clientes cabem`, (await contar(empresaId)) === limite);

  const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: `O ${limite + 1}º` });
  ok(`${nome}: BYPASS BLOQUEADO — insert direto via API recusa o ${limite + 1}º`, Boolean(error), "nenhum erro retornado");
  ok(`${nome}: erro traz o marcador do limite (${marcador})`, Boolean(error?.message?.includes(`LIMITE_DE_CLIENTES:${marcador}:${limite}`)), error?.message);
  ok(`${nome}: continua com ${limite} clientes`, (await contar(empresaId)) === limite);

  const { mensagemDeLimite } = await import("../lib/plano");
  const msg = mensagemDeLimite(error?.message);
  ok(`${nome}: mensagem traduzida cita o plano e o limite`, Boolean(msg?.includes(nome) && msg?.includes(String(limite))), String(msg));

  const { error: eAdmin } = await admin.from("clientes").insert({ empresa_id: empresaId, nome: "Via service_role" });
  ok(`${nome}: nem service_role fura o limite`, Boolean(eAdmin));
  return empresaId;
}

async function run() {
  console.log("\n=== LIMITE DE CLIENTES POR PLANO (tabela oficial) ===\n");
  const criadas: string[] = [];

  const { PRECO_POR_PLANO_CENTAVOS, LIMITE_DE_CLIENTES, limiteDoPlano, normalizarPlano } = await import("../lib/plano");

  console.log("TABELA (servidor) × BANCO");
  for (const [plano, preco, limite] of [["gratis", 0, 10], ["essencial", 4990, 50], ["negocio", 9990, 200], ["escola", 19990, null]] as const) {
    const { data } = await admin.rpc("limite_de_clientes", { p_plano: plano });
    ok(`${plano}: R$ ${(preco / 100).toFixed(2)} · limite ${limite ?? "ilimitado"} (servidor)`, PRECO_POR_PLANO_CENTAVOS[plano] === preco && LIMITE_DE_CLIENTES[plano] === limite);
    ok(`${plano}: o BANCO impõe o mesmo limite (${limite ?? "NULL = ilimitado"})`, data === limite, String(data));
  }
  ok("ilimitado é null — nenhum número artificial", LIMITE_DE_CLIENTES.escola === null && limiteDoPlano("escola") === null);
  ok("identificadores antigos: profissional=Negócio(200), premium=Escola(ilimitado)", normalizarPlano("profissional") === "negocio" && normalizarPlano("premium") === "escola" && limiteDoPlano("profissional") === 200 && limiteDoPlano("premium") === null);
  ok("plano desconhecido cai no menor limite (Grátis = 10)", limiteDoPlano("inventado") === 10);
  const { data: lGrat } = await admin.rpc("limite_de_clientes", { p_plano: "inventado" });
  ok("…e o banco faz o mesmo", lGrat === 10);

  console.log("\nGRÁTIS — 10");
  criadas.push(await limiteDeterminado("gratis", 10, "Grátis", "gratis"));

  console.log("\nESSENCIAL — 50");
  criadas.push(await limiteDeterminado("essencial", 50, "Essencial", "essencial"));

  console.log("\nNEGÓCIO — 200");
  criadas.push(await limiteDeterminado("negocio", 200, "Negócio", "negocio"));

  console.log("\nESCOLA — ilimitado");
  {
    const { empresaId, sessao } = await novaConta("escola");
    criadas.push(empresaId);
    await semear(empresaId, 250);
    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "O 251º" });
    ok("Escola aceita muito além do limite do Negócio (250+1 clientes, sem erro)", !error && (await contar(empresaId)) === 251, error?.message);
  }

  console.log("\nCOMPATIBILIDADE — contas antigas");
  {
    const { empresaId, sessao } = await novaConta("profissional");
    criadas.push(empresaId);
    await semear(empresaId, 200);
    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "O 201º" });
    ok("conta antiga 'profissional' continua com 200 (= Negócio)", (await contar(empresaId)) === 200 && Boolean(error));
  }
  {
    const { empresaId, sessao } = await novaConta("premium");
    criadas.push(empresaId);
    await semear(empresaId, 205);
    const { error } = await sessao.from("clientes").insert({ empresa_id: empresaId, nome: "Mais um" });
    ok("conta antiga 'premium' é ilimitada (= Escola)", !error);
  }
  {
    const { empresaId } = await novaConta("essencial");
    criadas.push(empresaId);
    const { error } = await admin.from("empresas").update({ plano: "plano_que_nao_existe" }).eq("id", empresaId);
    ok("o banco recusa identificador de plano inventado", Boolean(error));
  }

  console.log("\nO DONO NÃO PODE SE PROMOVER");
  {
    const { empresaId, sessao } = await novaConta("gratis");
    criadas.push(empresaId);
    const r1 = await sessao.from("empresas").update({ plano: "escola" }).eq("id", empresaId);
    const r2 = await sessao.from("empresas").update({ plano_escolhido: "escola" }).eq("id", empresaId);
    const { data } = await admin.from("empresas").select("plano, plano_escolhido").eq("id", empresaId).single();
    ok("dono NÃO consegue mudar o próprio plano pela API", Boolean(r1.error) && data?.plano === "gratis", String(data?.plano));
    ok("dono NÃO consegue gravar plano_escolhido pela API", Boolean(r2.error) && data?.plano_escolhido === null);
  }

  console.log("\nLIMPEZA");
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
