import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("conexao-recusada");
});
test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("conexão recusada: a pessoa consegue corrigir os dados e tentar de novo (não fica presa)", async ({ page }) => {
  await admin.from("empresas").update({ provider_status: "recusada" }).eq("id", conta.empresaId);
  await loginE2E(page, conta);
  await page.goto("/app/configuracoes");

  await expect(page.getByText("Não conseguimos conectar sua conta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verificar novamente" })).toBeVisible();
  await page.getByRole("button", { name: "Corrigir dados e tentar de novo" }).click();

  // o formulário reabre, com o painel de ajuda ao lado em tela larga
  await expect(page.getByRole("button", { name: "Conectar conta" })).toBeVisible();
  await expect(page.getByLabel("Nome completo ou razão social")).toBeVisible();
  await expect(page.getByRole("button", { name: "Corrigir dados e tentar de novo" })).toHaveCount(0);
});
