import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;
let cobrancaId = "";

test.beforeAll(async () => {
  conta = await criarContaE2E("tmpadmin");
  await admin.from("administradores_zelo").insert({ user_id: conta.userId });
  const { data: cli } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Cli", status: "ativo" }).select("id").single();
  const { data: cob } = await admin
    .from("cobrancas")
    .insert({ empresa_id: conta.empresaId, cliente_id: cli!.id, descricao: "x", valor_centavos: 1000, vence_em: "2027-01-01", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 1000, pago_via: "asaas" })
    .select("id")
    .single();
  cobrancaId = cob!.id;
  await admin.from("taxas_recebimento").insert({ empresa_id: conta.empresaId, cobranca_id: cobrancaId, asaas_payment_id: `pay_tmpadmin_${Date.now()}`, valor_centavos: 199, ambiente: "production", status: "registrada" });
});

test.afterAll(async () => {
  await admin.from("taxas_recebimento").delete().eq("empresa_id", conta.empresaId);
  await admin.from("administradores_zelo").delete().eq("user_id", conta.userId);
  await limparContaE2E(conta);
});

test("admin: taxas a cobrar aparece e a página não estoura a largura", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/admin/influenciadores");
  await expect(page.getByRole("heading", { name: "Taxas de recebimento a cobrar" })).toBeVisible();
  await expect(page.getByText("R$ 1,99").first()).toBeVisible();
  const folga = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(folga).toBeLessThanOrEqual(0);
});

test("admin: marcar como cobrada exige referência e limpa a lista", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/admin/influenciadores");
  await page.getByRole("button", { name: "Marcar como cobrada" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "referência" })).toBeVisible();
  await page.getByLabel(/Referência da cobrança/).fill("Pix teste 10/2026");
  await page.getByRole("button", { name: "Marcar como cobrada" }).click();
  await expect(page.getByRole("heading", { name: "Nenhuma taxa a cobrar" })).toBeVisible();
});

test("não administrador não vê o painel", async ({ page }) => {
  const outra = await criarContaE2E("tmpnaoadmin");
  try {
    await loginE2E(page, outra);
    await page.goto("/app/admin/influenciadores");
    await expect(page.getByRole("heading", { name: "Influenciadores" })).toHaveCount(0);
    await expect(page.getByText("Taxas de recebimento a cobrar")).toHaveCount(0);
  } finally {
    await limparContaE2E(outra);
  }
});
