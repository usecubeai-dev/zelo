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

/**
 * Regressão (iPad em pé, 768–820px): o canvas decorativo do hero ficava por
 * cima do botão "Criar minha primeira cobrança" e engolia o toque. Aqui o
 * teste é de INTERAÇÃO de verdade, não de existência: cada CTA visível tem
 * de ser o elemento que recebe o ponteiro no seu próprio centro e o clique
 * real tem de levar ao cadastro.
 */
for (const largura of [390, 768, 820, 1024, 1280]) {
  test(`hero ${largura}px: todos os CTAs recebem o toque e o botão principal leva ao cadastro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura < 700 ? 844 : 1100 });
    await page.goto("/");
    await page.waitForTimeout(1200);

    const resultado = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('a[href^="/criar-conta"]')) as HTMLElement[])
        .map((a) => {
          a.scrollIntoView({ block: "center" });
          const b = a.getBoundingClientRect();
          const visivel = b.width > 0 && b.height > 0 && getComputedStyle(a).visibility !== "hidden";
          const topo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { texto: (a.textContent ?? "").trim().slice(0, 40), visivel, recebe: !!topo && (topo === a || a.contains(topo)) };
        })
        .filter((x) => x.visivel)
    );
    expect(resultado.length).toBeGreaterThanOrEqual(4);
    expect(resultado.filter((x) => !x.recebe)).toEqual([]);

    const principal = page.getByRole("link", { name: /Criar minha primeira cobrança/ });
    await principal.scrollIntoViewIfNeeded();
    await principal.click(); // clique de verdade (o Playwright falha se algo cobrir o botão)
    await expect(page).toHaveURL(/\/criar-conta$/);
    await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
  });
}
