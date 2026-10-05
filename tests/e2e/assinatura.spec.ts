import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  // `pendente`: é como TODA conta nova nasce depois do fim do mês grátis.
  conta = await criarContaE2E("assinatura", "pendente");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("conta nova (pendente): mostra os três planos com preço e a taxa, sem mês grátis", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");

  await expect(page.getByRole("list", { name: "Como funciona" })).toBeVisible();
  await expect(page.getByText("Escolha seu plano").first()).toBeVisible();
  await expect(page.getByText("R$ 24,90").first()).toBeVisible();
  await expect(page.getByText("R$ 49,90").first()).toBeVisible();
  await expect(page.getByText("R$ 99,90").first()).toBeVisible();
  await expect(page.getByText("R$ 1,99").first()).toBeVisible();
  await expect(page.getByText(/gr[aá]tis/i)).toHaveCount(0);
});

test("conta pendente não consegue criar cliente (só depois do primeiro pagamento)", async () => {
  // pelo banco, com a sessão do usuário: o RLS é quem decide, não a tela
  const { createClient } = await import("@supabase/supabase-js");
  const sessao = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  await sessao.auth.signInWithPassword({ email: conta.email, password: conta.senha });
  const { error } = await sessao.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Antes de pagar" });
  expect(error).not.toBeNull();
});

test("limite de plano bloqueia a UI além do limite (via API direta), com a assinatura ativa", async ({ page }) => {
  // Semeia 30 clientes (limite do essencial — pricing oficial: 30/100/300)
  // direto no banco — o alvo aqui é confirmar que a TELA reflete o
  // bloqueio real do banco, não repetir o teste de domínio da Fase 15
  // (já em teste-limite-plano.ts).
  await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", conta.empresaId);
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    empresa_id: conta.empresaId,
    nome: `Cliente Limite ${i + 1}`,
    status: "ativo",
  }));
  await admin.from("clientes").insert(linhas);

  await loginE2E(page, conta);
  await page.goto("/app/assinatura");
  await expect(page.getByText("30 / 30")).toBeVisible();

  await admin.from("clientes").delete().eq("empresa_id", conta.empresaId);
});

test("mudança de status via banco (simulando webhook) reflete na tela ao recarregar", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");
  await expect(page.getByText("Assinatura ativa").first()).toBeVisible();

  await admin
    .from("empresas")
    .update({ assinatura_status: "inadimplente", assinatura_atualizada_em: new Date().toISOString() })
    .eq("id", conta.empresaId);

  await page.reload();
  await expect(page.getByText("Pagamento pendente").first()).toBeVisible();

  await admin.from("empresas").update({ assinatura_status: "pendente" }).eq("id", conta.empresaId);
});
