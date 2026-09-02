import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("auth");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("rota protegida redireciona pra /entrar sem sessão", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/entrar/);
});

test("login com credenciais inválidas mostra erro e não entra", async ({ page }) => {
  await page.goto("/entrar");
  const campoEmail = page.getByRole("textbox", { name: "E-mail" });
  await campoEmail.waitFor({ state: "visible" });
  await campoEmail.pressSequentially(conta.email);
  await expect(campoEmail).toHaveValue(conta.email);
  const campoSenha = page.getByRole("textbox", { name: "Senha" });
  await campoSenha.pressSequentially("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  // `getByRole("alert")` também casa com o `__next-route-announcer__` do
  // Next (mesmo role, injetado pelo framework) — precisa da classe pra
  // mirar só o alerta do formulário.
  await expect(page.locator('[class*="erroGeral"]')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("login com credenciais válidas entra e a sessão persiste na navegação", async ({ page }) => {
  await loginE2E(page, conta);

  // sessão persiste — navegar sem refazer login
  await page.goto("/app/clientes");
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
});

test("logout encerra a sessão — voltar pra /app exige login de novo", async ({ page }) => {
  await loginE2E(page, conta);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar/);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/entrar/);
});
