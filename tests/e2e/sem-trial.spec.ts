import { test, expect, type Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

/**
 * Não existe mais período de teste: o Grátis é permanente. Contas antigas que
 * ainda têm `trial` no banco mantêm o histórico, mas ele nunca é apresentado
 * como "assine para continuar".
 */
const TRIAL = /per[ií]odo de teste|teste termina|teste terminou|assine para continuar|primeiro m[eê]s gr[aá]tis|30 dias gr[aá]tis|dias de teste/i;
const PAGINAS = ["/app", "/app/recebimentos", "/app/assinatura", "/app/clientes"];

const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const contas: ContaE2E[] = [];

async function semTrial(page: Page) {
  for (const rota of PAGINAS) {
    await page.goto(rota);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(TRIAL)).toHaveCount(0);
  }
}

async function nova(prefixo: string, status: "ativa" | "trial" | "pendente", plano: string, fimDoTrial: string) {
  const c = await criarContaE2E(prefixo, status);
  contas.push(c);
  await admin.from("empresas").update({ plano, trial_termina_em: fimDoTrial }).eq("id", c.empresaId);
  return c;
}

test.afterAll(async () => {
  for (const c of contas) await limparContaE2E(c);
});

test("conta Grátis (permanente): sem faixa de teste e com acesso normal", async ({ page }) => {
  test.setTimeout(90_000);
  const c = await nova("semtrialgratis", "ativa", "gratis", dia(-60));
  await loginE2E(page, c);
  await semTrial(page);
  await page.goto("/app/assinatura");
  await expect(page.getByRole("region", { name: "Seu plano atual" })).toContainText("Grátis");
  await expect(page.getByRole("status").filter({ hasText: /acesso|plano/i })).toHaveCount(0);
  // continua utilizável: a tela de clientes abre e oferece cadastrar
  await page.goto("/app/clientes");
  await expect(page.getByRole("link", { name: /novo cliente|cadastrar|adicionar/i }).first()).toBeVisible();
});

test("conta paga: nenhuma menção a teste", async ({ page }) => {
  const c = await nova("semtrialpaga", "ativa", "essencial", dia(-60));
  await loginE2E(page, c);
  await semTrial(page);
});

test("conta antiga com acesso anterior longe do fim (23 dias): sem faixa e sem 'assine para continuar'", async ({ page }) => {
  const c = await nova("semtrialantiga", "trial", "essencial", dia(23));
  await loginE2E(page, c);
  await semTrial(page);
  await page.goto("/app/recebimentos");
  await expect(page.getByText(/seu acesso atual termina/i)).toHaveCount(0);
  await page.goto("/app/assinatura");
  await expect(page.getByRole("heading", { name: "Seu acesso atual" })).toBeVisible();
});

test("conta antiga na última semana: aviso neutro que leva a escolher plano", async ({ page }) => {
  const c = await nova("semtrialfim", "trial", "essencial", dia(3));
  await loginE2E(page, c);
  await semTrial(page);
  await page.goto("/app/recebimentos");
  const faixa = page.getByRole("status").filter({ hasText: "Seu acesso atual termina em" });
  await expect(faixa).toContainText("escolha um plano");
  await expect(faixa.getByRole("link", { name: "Escolher plano" })).toBeVisible();
});

test("conta antiga com o acesso encerrado: manda escolher um plano, sem falar em teste", async ({ page }) => {
  const c = await nova("semtrialvenc", "trial", "essencial", dia(-3));
  await loginE2E(page, c);
  await semTrial(page);
  await page.goto("/app/recebimentos");
  await expect(page.getByRole("status").filter({ hasText: "Seu acesso anterior terminou" })).toContainText("Escolha um plano");
});
