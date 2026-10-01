import { test, expect } from "@playwright/test";
import { admin, criarContaE2E, limparContaE2E, loginE2E, preencher, ContaE2E } from "./helpers";

let conta: ContaE2E;

test.beforeAll(async () => {
  conta = await criarContaE2E("onboarding");
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

// 9 passos hoje (Fase 19 acrescentou "Cadastrar seu primeiro serviço" entre
// cliente e recorrência — ver lib/core/jornada-onboarding.ts). O checklist
// completo só aparece depois que a "ativação rápida" (3 passos: cliente,
// cobrança, envio — o mesmo painel "Comece por aqui") termina. Antes disso,
// os dois painéis empilhados na primeira tela do usuário pareciam
// sobrecarregar quem acabou de criar a conta (achado de revisão de design,
// 11/09/2026) — a correção troca A ORDEM de exibição, nenhum passo foi
// removido da jornada.
const TOTAL_PASSOS = 9;

test("empresa nova: mostra 'Comece por aqui' (3 passos), não o checklist completo", async ({ page }) => {
  await loginE2E(page, conta);
  await expect(page.getByRole("heading", { name: "Comece por aqui" })).toBeVisible();
  // aparece duas vezes de propósito: o botão de ação rápida no cabeçalho
  // do painel e o item da lista — `.first()` basta pra confirmar que o
  // passo está pendente (vira link) e não concluído (viraria texto riscado).
  await expect(page.getByRole("link", { name: "Cadastre seu primeiro cliente" }).first()).toBeVisible();
  await expect(page.getByText(`de ${TOTAL_PASSOS} etapas concluídas`)).not.toBeVisible();
});

test("completar a ativação rápida (cliente + cobrança + envio) troca para o checklist de 9 passos", async ({ page }) => {
  // Seed direto no banco: a criação da cobrança e o clique em "Marcar como
  // enviada" já têm cobertura própria em outros specs — aqui o que importa
  // é só a troca de painel no dashboard, não reexercitar aquele fluxo.
  const { data: cliente, error: eCliente } = await admin
    .from("clientes")
    .insert({ empresa_id: conta.empresaId, nome: "Cliente onboarding e2e" })
    .select("id")
    .single();
  if (eCliente) throw new Error(`seed cliente: ${eCliente.message}`);

  const { error: eCobranca } = await admin.from("cobrancas").insert({
    empresa_id: conta.empresaId,
    cliente_id: cliente!.id,
    descricao: "Cobrança onboarding e2e",
    valor_centavos: 5000,
    vence_em: "2026-12-31",
    status: "enviada",
  });
  if (eCobranca) throw new Error(`seed cobrança: ${eCobranca.message}`);

  await loginE2E(page, conta);
  await expect(page.getByRole("heading", { name: "Comece por aqui" })).not.toBeVisible();
  // conta_criada + primeiro_cliente + primeira_cobranca já concluídos —
  // "cobranca_enviada" (o 3º passo da ativação rápida) não é um dos 9.
  await expect(page.getByText(`3 de ${TOTAL_PASSOS} etapas concluídas`)).toBeVisible();
});

test("completar um passo real (CPF/CNPJ) avança a jornada sem refresh manual do checklist", async ({ page }) => {
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
  await expect(page.getByText(`4 de ${TOTAL_PASSOS} etapas concluídas`)).toBeVisible();
  // o passo concluído fica riscado, não é mais um link
  await expect(page.getByRole("link", { name: "Configurar seu negócio" })).not.toBeVisible();
});
