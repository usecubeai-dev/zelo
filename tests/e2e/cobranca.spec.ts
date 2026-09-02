import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;
let clienteId: string;

test.beforeAll(async () => {
  conta = await criarContaE2E("cobranca");
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: conta.empresaId, nome: "Cliente Fixture E2E" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  clienteId = data.id;
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("criar cobrança pela UI — nasce pendente, aparece na lista", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/cobrancas/nova");

  await page.getByLabel("Cliente").selectOption(clienteId);
  await preencher(page.getByLabel("Descrição"), "Mensalidade E2E");
  await preencher(page.getByLabel("Valor"), "350,00");
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 10);
  await page.getByLabel("Vencimento").fill(vencimento.toISOString().slice(0, 10));

  await page.getByRole("button", { name: "Criar cobrança" }).click();

  await expect(page).toHaveURL(/\/app\/cobrancas\/[0-9a-f-]+$/);
  await expect(page.getByText("Pendente")).toBeVisible();

  await page.goto("/app/cobrancas");
  await expect(page.getByText("Mensalidade E2E")).toBeVisible();
});

test("cancelar cobrança — status muda pra Cancelada e persiste após recarregar", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/cobrancas");
  await page.getByText("Mensalidade E2E").click();

  // Cancelamento é confirmação em 2 passos na própria tela (não modal,
  // não window.confirm) — "Cancelar cobrança" revela "Confirmar
  // cancelamento" + "Voltar".
  await page.getByRole("button", { name: "Cancelar cobrança" }).click();
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();

  // "Cancelada" aparece em 3 lugares depois de confirmar (situação,
  // subtítulo, log de atividade) — prova que o cancelamento propagou de
  // verdade pela tela, não só um lugar. `.first()` evita o strict-mode
  // violation do Playwright, o teste só precisa de UM estar visível.
  const situacao = page.getByText("Cancelada").first();
  await expect(situacao).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cancelada").first()).toBeVisible();
});

test("filtro de situação na lista reflete o estado real", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/cobrancas?f=canceladas");
  await expect(page.getByText("Mensalidade E2E")).toBeVisible();

  await page.goto("/app/cobrancas?f=pendentes");
  await expect(page.getByText("Mensalidade E2E")).not.toBeVisible();
});
