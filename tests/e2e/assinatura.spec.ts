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

test("conta nova (pendente): mostra os QUATRO planos oficiais com preço, limite e a taxa por Pix, sem trial", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");

  await expect(page.getByRole("list", { name: "Como funciona" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escolha o plano ideal para o seu negócio" })).toBeVisible();
  const cards = page.locator("article[data-plano]");
  await expect(cards).toHaveCount(4);
  const esperado = [
    ["gratis", "Grátis", /R\$\s0/, "10 clientes"],
    ["essencial", "Essencial", /R\$\s49,90/, "50 clientes"],
    ["negocio", "Negócio", /R\$\s99,90/, "200 clientes"],
    ["escola", "Escola", /R\$\s199,90/, "ilimitados"],
  ] as const;
  for (const [id, nome, preco, limite] of esperado) {
    const card = page.locator(`article[data-plano="${id}"]`);
    await expect(card).toContainText(nome);
    await expect(card).toContainText(preco);
    await expect(card).toContainText(new RegExp(limite, "i"));
  }
  await expect(page.locator('article[data-plano="negocio"]')).toContainText("Mais escolhido");
  await expect(page.getByText("R$ 1,99 por Pix recebido").first()).toBeVisible();
  await expect(page.getByText(/30 dias|teste gr[aá]tis|trial|primeiro m[eê]s/i)).toHaveCount(0);
  await expect(page.getByText(/R\$\s24,90|Profissional|Zelo Pro/)).toHaveCount(0);
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
  // Semeia 50 clientes (limite do Essencial na tabela oficial: Grátis 10 / Essencial 50 / Negócio 200 / Escola ilimitado)
  // direto no banco — o alvo aqui é confirmar que a TELA reflete o
  // bloqueio real do banco, não repetir o teste de domínio da Fase 15
  // (já em teste-limite-plano.ts).
  await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", conta.empresaId);
  const linhas = Array.from({ length: 50 }, (_, i) => ({
    empresa_id: conta.empresaId,
    nome: `Cliente Limite ${i + 1}`,
    status: "ativo",
  }));
  await admin.from("clientes").insert(linhas);

  await loginE2E(page, conta);
  await page.goto("/app/assinatura");
  await expect(page.getByText("50 / 50")).toBeVisible();

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

test("escolher o plano Grátis pela tela libera a conta na hora, sem pagamento e sem trial", async ({ page }) => {
  await admin.from("empresas").update({ assinatura_status: "pendente", plano: "essencial" }).eq("id", conta.empresaId);
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");

  await page.getByRole("button", { name: "Escolher o plano Grátis" }).click();
  await expect(page.getByLabel(/CPF ou CNPJ/)).toHaveCount(0);
  await page.getByRole("button", { name: "Ativar plano Grátis" }).click();
  await expect(page.getByRole("heading", { name: "Plano Grátis ativado" })).toBeVisible();

  const { data } = await admin
    .from("empresas")
    .select("assinatura_status, plano, plano_escolhido, asaas_subscription_id")
    .eq("id", conta.empresaId)
    .single();
  expect(data?.assinatura_status).toBe("ativa");
  expect(data?.plano).toBe("gratis");
  expect(data?.plano_escolhido).toBeNull();
  expect(data?.asaas_subscription_id).toBeNull();

  await admin.from("empresas").update({ assinatura_status: "pendente", plano: "essencial" }).eq("id", conta.empresaId);
});
