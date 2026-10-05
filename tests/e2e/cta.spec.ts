import { test, expect } from "@playwright/test";

/**
 * Regressão de um erro de PRODUÇÃO (05/10/2026): os botões "Começar agora"
 * da home levavam a `/comecar`, uma lista de espera ("em breve entramos em
 * contato para criar sua conta"), então ninguém conseguia criar conta pelos
 * CTAs. Todos os CTAs agora vão para o cadastro de verdade e `/comecar`
 * redireciona para lá.
 */

test("home: nenhum CTA aponta para a lista de espera; todos vão ao cadastro", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.filter((h) => h.includes("/comecar"))).toEqual([]);
  expect(hrefs.filter((h) => h.startsWith("/criar-conta")).length).toBeGreaterThanOrEqual(2);
});

test("clicar num CTA da home chega à tela de criar conta", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator('a[href="/criar-conta"]:visible').first();
  await cta.scrollIntoViewIfNeeded();
  await cta.click();
  await expect(page).toHaveURL(/\/criar-conta$/);
  await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
});

test("link antigo /comecar leva ao cadastro e mantém plano e indicação", async ({ page }) => {
  await page.goto("/comecar?plano=negocio&ref=ABCD1234");
  await expect(page).toHaveURL(/\/criar-conta\?plano=negocio&ref=ABCD1234$/);
  await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
  await expect(page.getByText(/Plano Negócio/)).toBeVisible();
});
