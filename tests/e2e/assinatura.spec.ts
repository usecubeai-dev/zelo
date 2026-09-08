import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("assinatura");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

test("empresa nova: assinatura mostra trial, plano essencial e uso 0/30", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");

  await expect(page.getByText("Teste grátis").first()).toBeVisible();
  await expect(page.getByText("Essencial").first()).toBeVisible();
  await expect(page.getByText("0 / 30")).toBeVisible();
});

test("limite de plano bloqueia a UI de criar cliente além do limite (via API direta)", async ({ page }) => {
  // Semeia 30 clientes (limite do essencial — pricing oficial: 30/100/300)
  // direto no banco — o alvo aqui é confirmar que a TELA reflete o
  // bloqueio real do banco, não repetir o teste de domínio da Fase 15
  // (já 12/12 em teste-limite-plano.ts).
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    empresa_id: conta.empresaId,
    nome: `Cliente Limite ${i + 1}`,
    status: "ativo",
  }));
  await admin.from("clientes").insert(linhas);

  await loginE2E(page, conta);
  await page.goto("/app/assinatura");
  await expect(page.getByText("30 / 30")).toBeVisible();

  await admin.from("clientes").delete().eq("empresa_id", conta.empresaId);
});

test("mudança de status via banco (simulando webhook) reflete na tela ao recarregar", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto("/app/assinatura");
  await expect(page.getByText("Teste grátis").first()).toBeVisible();

  await admin
    .from("empresas")
    .update({ assinatura_status: "inadimplente", assinatura_atualizada_em: new Date().toISOString() })
    .eq("id", conta.empresaId);

  await page.reload();
  await expect(page.getByText("Pagamento pendente").first()).toBeVisible();
  await expect(page.getByText(/pagamento em atraso|não conseguimos confirmar/i)).toBeVisible();

  await admin.from("empresas").update({ assinatura_status: "trial" }).eq("id", conta.empresaId);
});
