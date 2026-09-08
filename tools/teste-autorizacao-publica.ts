/**
 * Rodada de simplificação UX — link público de autorização (`/autorizar/[id]`).
 *
 * Foco: segurança e isolamento do novo caminho SEM sessão —
 * `obterAutorizacaoPublica` (lib/core/autorizacao-pix.ts) e
 * `atualizarStatusAutorizacaoPublicaAcao` (app/autorizar/[id]/acoes.ts).
 * O "token" é o próprio id da autorização (UUID); o que garante isolamento
 * é a superfície de dados devolvida nunca incluir empresa_id/recorrencia_id/
 * cliente_id/ids do Asaas, e o lookup errado nunca vazar dado de outro
 * tenant.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { obterAutorizacaoPublica } from "../lib/core/autorizacao-pix";
import { atualizarStatusAutorizacaoPublicaAcao } from "../app/autorizar/[id]/acoes";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

console.log("\n=== AUTORIZAÇÃO PÚBLICA (/autorizar/[id]) ===\n");

const usuarios: string[] = [];
const empresas: string[] = [];
const SENHA_TESTE = "senha_teste_autorizacao_publica_12345";

async function criarEmpresa(nome: string) {
  const email = `autpub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA_TESTE, email_confirm: true, user_metadata: { nome } }),
  });
  const j = await r.json();
  const userId = j.id || j.user?.id;
  if (!userId) throw new Error(`usuário: ${JSON.stringify(j).slice(0, 150)}`);
  usuarios.push(userId);

  const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", userId);
  const empresaId = m?.[0]?.empresa_id as string;
  empresas.push(empresaId);
  await admin.from("empresas").update({ nome }).eq("id", empresaId);
  return { empresaId, userId, email };
}

async function criarCliente(empresaId: string, nome: string) {
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome, email: `${nome.toLowerCase().replace(/\s+/g, "")}@zelo.test` })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function criarRecorrencia(empresaId: string, clienteId: string, descricao: string, valorCentavos: number) {
  const { data, error } = await admin
    .from("recorrencias")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      descricao,
      valor_centavos: valorCentavos,
      periodicidade: "mensal",
      dia_vencimento: 12,
      inicia_em: "2027-01-12",
      status: "ativa",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function criarAutorizacaoRow(empresaId: string, recorrenciaId: string, clienteId: string, status: string) {
  const { data, error } = await admin
    .from("autorizacoes_pix")
    .insert({
      empresa_id: empresaId,
      recorrencia_id: recorrenciaId,
      cliente_id: clienteId,
      status,
      finish_date: "2032-01-01",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function run() {
  console.log("LEITURA PÚBLICA — link inválido");
  {
    const r = await obterAutorizacaoPublica("00000000-0000-0000-0000-000000000000");
    t("id inexistente devolve nao_encontrado", !r.ok && r.motivo === "nao_encontrado");

    const rMalFormado = await obterAutorizacaoPublica("nao-e-um-uuid");
    t("id mal formado não derruba a função, devolve nao_encontrado", !rMalFormado.ok);
  }

  console.log("\nLEITURA PÚBLICA — dados mínimos, sem credencial Asaas (degrada sem QR)");
  {
    const { empresaId } = await criarEmpresa("Estúdio de Pilates Teste");
    const clienteId = await criarCliente(empresaId, "Cliente Pilates");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId, "Mensalidade Pilates", 19900);
    const autorizacaoId = await criarAutorizacaoRow(empresaId, recorrenciaId, clienteId, "CREATED");

    const r = await obterAutorizacaoPublica(autorizacaoId);
    t("autorização CREATED é encontrada", r.ok);
    if (r.ok) {
      t("devolve o nome da empresa certa", r.dado.empresaNome === "Estúdio de Pilates Teste");
      t("devolve a descrição da recorrência", r.dado.descricao === "Mensalidade Pilates");
      t("devolve o valor em centavos", r.dado.valorCentavos === 19900);
      t("devolve o dia de vencimento", r.dado.diaVencimento === 12);
      t("sem asaas_authorization_id salvo, degrada sem QR (não quebra)", r.dado.payload === null && r.dado.encodedImage === null);

      const chaves = Object.keys(r.dado);
      t(
        "NUNCA expõe empresa_id/recorrencia_id/cliente_id/ids do Asaas",
        !chaves.some((k) => /empresa_?id|recorrencia_?id|cliente_?id|asaas/i.test(k))
      );
    }
  }

  console.log("\nLEITURA PÚBLICA — estados terminais (dead-end sem vazar detalhe técnico)");
  {
    const { empresaId } = await criarEmpresa("Consultório Teste");
    const clienteId = await criarCliente(empresaId, "Cliente Consultório");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId, "Sessão mensal", 25000);

    for (const status of ["ACTIVE", "REFUSED", "CANCELLED", "EXPIRED"]) {
      const autorizacaoId = await criarAutorizacaoRow(empresaId, recorrenciaId, clienteId, status);
      const r = await obterAutorizacaoPublica(autorizacaoId);
      t(`status ${status} é encontrado e devolve o status real`, r.ok && r.dado.status === status);
    }
  }

  console.log("\nISOLAMENTO — autorização de uma empresa nunca mistura dado de outra");
  {
    const a = await criarEmpresa("Tenant A (autorização pública)");
    const b = await criarEmpresa("Tenant B (autorização pública)");
    const clienteA = await criarCliente(a.empresaId, "Cliente de A");
    const clienteB = await criarCliente(b.empresaId, "Cliente de B");
    const recA = await criarRecorrencia(a.empresaId, clienteA, "Cobrança de A", 10000);
    const recB = await criarRecorrencia(b.empresaId, clienteB, "Cobrança de B", 77700);
    const autA = await criarAutorizacaoRow(a.empresaId, recA, clienteA, "CREATED");
    const autB = await criarAutorizacaoRow(b.empresaId, recB, clienteB, "CREATED");

    const rA = await obterAutorizacaoPublica(autA);
    const rB = await obterAutorizacaoPublica(autB);
    t(
      "id de A devolve só o nome/descrição/valor de A",
      rA.ok && rA.dado.empresaNome === "Tenant A (autorização pública)" && rA.dado.descricao === "Cobrança de A" && rA.dado.valorCentavos === 10000
    );
    t(
      "id de B devolve só o nome/descrição/valor de B",
      rB.ok && rB.dado.empresaNome === "Tenant B (autorização pública)" && rB.dado.descricao === "Cobrança de B" && rB.dado.valorCentavos === 77700
    );
  }

  console.log("\nATUALIZAR STATUS (Server Action pública) — reaproveita sincronizarStatusAutorizacaoPix");
  {
    const rInexistente = await atualizarStatusAutorizacaoPublicaAcao("00000000-0000-0000-0000-000000000000");
    t("id inexistente devolve 'Link inválido.'", !rInexistente.ok && rInexistente.mensagem === "Link inválido.");

    const { empresaId } = await criarEmpresa("Empresa sem credencial (atualizar status)");
    const clienteId = await criarCliente(empresaId, "Cliente sem credencial");
    const recorrenciaId = await criarRecorrencia(empresaId, clienteId, "Teste sem credencial", 5000);
    const autorizacaoId = await criarAutorizacaoRow(empresaId, recorrenciaId, clienteId, "CREATED");

    const r = await atualizarStatusAutorizacaoPublicaAcao(autorizacaoId);
    t(
      "sem credencial Asaas configurada, falha com mensagem segura (não expõe stack/detalhe técnico)",
      !r.ok && typeof r.mensagem === "string" && !r.mensagem.toLowerCase().includes("asaasrequisicao")
    );
  }

  console.log("\nCAMADAS — a página pública usa a leitura pública, não o caminho autenticado");
  {
    const conteudoPagina = fs.readFileSync("app/autorizar/[id]/page.tsx", "utf8");
    t("page.tsx importa obterAutorizacaoPublica", conteudoPagina.includes("obterAutorizacaoPublica"));
    t("page.tsx não importa usuarioAtual/supabaseServer (não depende de sessão)", !conteudoPagina.includes("usuarioAtual") && !conteudoPagina.includes("supabaseServer"));

    const conteudoAcoes = fs.readFileSync("app/autorizar/[id]/acoes.ts", "utf8");
    t("acoes.ts reaproveita sincronizarStatusAutorizacaoPix (não duplica lógica de reconciliação)", conteudoAcoes.includes("sincronizarStatusAutorizacaoPix"));
  }

  console.log("\nLIMPEZA");
  await admin.from("autorizacoes_pix").delete().in("empresa_id", empresas);
  await admin.from("recorrencias").delete().in("empresa_id", empresas);
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
