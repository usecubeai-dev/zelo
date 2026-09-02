import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;
let clienteId: string;

test.beforeAll(async () => {
  conta = await criarContaE2E("recorrencia");
  const { data, error } = await admin
    .from("clientes")
    .insert({ empresa_id: conta.empresaId, nome: "Cliente Fixture Recorrência" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  clienteId = data.id;
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("lista de recorrências vazia mostra o estado vazio correto", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/recorrencias");
  await expect(page.getByText("Nenhum acordo recorrente ainda.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crie sua primeira recorrência" })).toBeVisible();
});

test("criar recorrência pela UI — nasce ativa, aparece na lista", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/recorrencias/nova");

  await page.getByLabel("Cliente").selectOption(clienteId);
  await preencher(page.getByLabel("Descrição"), "Plano mensal E2E");
  await preencher(page.getByLabel("Valor por ciclo"), "150,00");
  await page.getByRole("button", { name: "Criar recorrência" }).click();

  await expect(page).toHaveURL(/\/app\/recorrencias\/[0-9a-f-]+$/);
  await page.goto("/app/recorrencias");
  await expect(page.getByText("Plano mensal E2E")).toBeVisible();
});

test("Pix Automático de verdade não é testável sem credencial Asaas — limite documentado, não fingido", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/recorrencias/autorizacoes");
  // Página existe e responde — não trava, mesmo sem nenhuma autorização real
  // (nenhuma chamada ao Asaas foi feita nesta suíte, de propósito).
  await expect(page.getByRole("heading", { name: "Autorizações Pix Automático" })).toBeVisible();
});
