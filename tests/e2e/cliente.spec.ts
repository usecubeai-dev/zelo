import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";

let contaA: ContaE2E;
let contaB: ContaE2E;

test.beforeAll(async () => {
  contaA = await criarContaE2E("clienteA");
  contaB = await criarContaE2E("clienteB");
});

test.afterAll(async () => {
  await limparContaE2E(contaA);
  await limparContaE2E(contaB);
});

test("criar cliente pela UI — aparece na lista de verdade", async ({ page }) => {
  await loginE2E(page, contaA);
  await page.goto("/app/clientes/novo");
  await preencher(page.getByLabel("Nome"), "Cliente E2E Um");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();

  await expect(page).toHaveURL(/\/app\/clientes\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Cliente E2E Um" })).toBeVisible();

  await page.goto("/app/clientes");
  await expect(page.getByText("Cliente E2E Um")).toBeVisible();
});

test("editar cliente — mudança persiste depois de recarregar", async ({ page }) => {
  await loginE2E(page, contaA);
  await page.goto("/app/clientes");
  await page.getByText("Cliente E2E Um").click();
  await page.getByRole("link", { name: "Editar" }).click();

  await preencher(page.getByLabel("Nome"), "Cliente E2E Um (editado)");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("heading", { name: "Cliente E2E Um (editado)" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Cliente E2E Um (editado)" })).toBeVisible();
});

test("ISOLAMENTO — empresa B não acessa cliente da empresa A por URL direta", async ({ page }) => {
  const { data: clienteDeA } = await admin
    .from("clientes")
    .select("id")
    .eq("empresa_id", contaA.empresaId)
    .limit(1)
    .single();
  expect(clienteDeA).toBeTruthy();

  await loginE2E(page, contaB);
  await page.goto(`/app/clientes/${clienteDeA!.id}`);

  // nunca deveria mostrar o nome do cliente de A — 404 é o esperado (ver Fase 2: "id inexistente" também dá 404, não "sem permissão")
  await expect(page.getByText("Cliente E2E Um")).not.toBeVisible();
});
