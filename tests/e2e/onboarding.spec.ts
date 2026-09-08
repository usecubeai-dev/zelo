import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("onboarding");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

// 9 passos hoje (Fase 19 acrescentou "Cadastrar seu primeiro serviço" entre
// cliente e recorrência — ver lib/core/jornada-onboarding.ts). O checklist
// não mostra mais "(N/8)" no título: virou uma barra de progresso com
// "X de Y etapas concluídas" + percentual, ver app/(app)/app/page.tsx.
const TOTAL_PASSOS = 9;

test("empresa nova: jornada começa em 1/9 (só 'criar conta' concluído)", async ({ page }) => {
  await loginE2E(page, conta);
  await expect(page.getByText(`1 de ${TOTAL_PASSOS} etapas concluídas`)).toBeVisible();
});

test("completar um passo real (CPF/CNPJ) avança a jornada pra 2/9 sem refresh manual do checklist", async ({ page }) => {
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
  await expect(page.getByText(`2 de ${TOTAL_PASSOS} etapas concluídas`)).toBeVisible();
  // o passo concluído fica riscado, não é mais um link
  await expect(page.getByRole("link", { name: "Configurar seu negócio (CPF ou CNPJ)" })).not.toBeVisible();
});
