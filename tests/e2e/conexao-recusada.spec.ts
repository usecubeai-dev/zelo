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

test.describe("formulário de conexão: validação na tela, antes de falar com o Asaas", () => {
  const CPF = "529.982.247-25"; // válido pelo dígito verificador (documento de teste público)
  const CNPJ = "11.222.333/0001-81";

  test.beforeEach(async ({ page }) => {
    await admin.from("empresas").update({ provider_status: "pendente", documento: null }).eq("id", conta.empresaId);
    await loginE2E(page, conta);
    await page.goto("/app/configuracoes");
    await page.getByRole("button", { name: "Configurar agora" }).click();
    await expect(page.getByRole("button", { name: "Conectar conta" })).toBeVisible();
  });

  test("formulário vazio mostra o erro em cada campo e leva o foco ao primeiro", async ({ page }) => {
    await page.getByRole("button", { name: "Conectar conta" }).click();
    await expect(page.locator("#cf-name-erro")).toContainText("nome completo");
    await expect(page.locator("#cf-email-erro")).toBeVisible();
    await expect(page.locator("#cf-doc-erro")).toBeVisible();
    await expect(page.locator("#cf-tel-erro")).toBeVisible();
    await expect(page.locator("#cf-renda-erro")).toBeVisible();
    await expect(page.locator("#cf-cep-erro")).toBeVisible();
    await expect(page.locator("#cf-endereco-erro")).toBeVisible();
    await expect(page.locator("#cf-numero-erro")).toBeVisible();
    await expect(page.locator("#cf-bairro-erro")).toBeVisible();
    await expect(page.locator("#cf-name")).toBeFocused();
  });

  test("CPF pede a data de nascimento (o que o Asaas exigiu); CNPJ pede o tipo da empresa", async ({ page }) => {
    await expect(page.locator("#cf-nasc")).toHaveCount(0);
    await expect(page.locator("#cf-tipo")).toHaveCount(0);

    await page.locator("#cf-doc").fill("52998224725");
    await expect(page.locator("#cf-doc")).toHaveValue(CPF); // máscara
    await expect(page.locator("#cf-nasc")).toBeVisible();
    await expect(page.locator("#cf-tipo")).toHaveCount(0);

    await page.locator("#cf-doc").fill("11222333000181");
    await expect(page.locator("#cf-doc")).toHaveValue(CNPJ);
    await expect(page.locator("#cf-tipo")).toBeVisible();
    await expect(page.locator("#cf-nasc")).toHaveCount(0);
    await expect(page.locator("#cf-tipo option")).toHaveCount(5); // "Selecione" + 4 tipos do Asaas
  });

  test("com tudo preenchido, mas sem a data de nascimento, o erro aparece no campo e nada é enviado", async ({ page }) => {
    await page.locator("#cf-name").fill("Maria da Silva");
    await page.locator("#cf-email").fill("maria@exemplo.com");
    await page.locator("#cf-doc").fill(CPF);
    await page.locator("#cf-tel").fill("11912345678");
    await expect(page.locator("#cf-tel")).toHaveValue("(11) 91234-5678");
    await page.locator("#cf-renda").fill("5000");
    await page.locator("#cf-cep").fill("01310100");
    await expect(page.locator("#cf-cep")).toHaveValue("01310-100");
    await page.locator("#cf-numero").fill("120");
    await page.locator("#cf-endereco").fill("Rua das Flores");
    await page.locator("#cf-bairro").fill("Centro");

    await page.getByRole("button", { name: "Conectar conta" }).click();
    await expect(page.locator("#cf-nasc-erro")).toContainText("data de nascimento");
    await expect(page.locator("#cf-nasc")).toBeFocused();

    // nada foi para o servidor: a conexão não ficou marcada como recusada
    const { data } = await admin.from("empresas").select("provider_status").eq("id", conta.empresaId).single();
    expect(data?.provider_status).toBe("pendente");

    // menor de idade também é barrado na tela
    await page.locator("#cf-nasc").fill("2015-01-01");
    await page.getByRole("button", { name: "Conectar conta" }).click();
    await expect(page.locator("#cf-nasc-erro")).toContainText("18 anos");
  });

  test("sem rolagem horizontal com o formulário aberto", async ({ page }) => {
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra).toBeLessThanOrEqual(0);
  });
});
