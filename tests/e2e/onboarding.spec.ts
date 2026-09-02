import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("onboarding");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("empresa nova: jornada começa em 1/8 (só 'criar conta' concluído)", async ({ page }) => {
  await loginE2E(page, conta);
  await expect(page.getByText("Primeiros passos (1/8)")).toBeVisible();
});

test("completar um passo real (CPF/CNPJ) avança a jornada pra 2/8 sem refresh manual do checklist", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/configuracoes");
  await preencher(page.getByLabel("CPF ou CNPJ da empresa"), "123.456.789-09");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Alterações salvas com sucesso.")).toBeVisible();
  // O formulário chama `router.refresh()` (revalida o RSC da própria
  // tela) — em WebKit isso às vezes ainda está em voo quando a mensagem
  // de sucesso já apareceu, e uma navegação imediata pode ser abortada.
  await page.waitForLoadState("networkidle");

  await page.goto("/app");
  await expect(page.getByText("Primeiros passos (2/8)")).toBeVisible();
  // o passo concluído fica riscado, não é mais um link
  await expect(page.getByRole("link", { name: "Configurar seu negócio (CPF ou CNPJ)" })).not.toBeVisible();
});
