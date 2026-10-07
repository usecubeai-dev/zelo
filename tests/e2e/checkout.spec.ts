import fs from "fs";
import { test, expect, Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";

/**
 * Planos → confirmação → checkout → pagamento.
 *
 * A parte do pagamento roda contra o SANDBOX REAL do parceiro de pagamentos
 * (nada simulado): a assinatura é criada de verdade, o QR Pix vem de verdade e
 * tudo é removido no final. Precisa de o servidor de desenvolvimento ter a
 * chave do sandbox; sem ela, esses testes são pulados. A confirmação do
 * pagamento em si (webhook e conferência) é coberta em `tools/teste-checkout.ts`.
 */

function chaveSandbox(): string | null {
  try {
    const env: Record<string, string> = {};
    for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    if (env.ASAAS_ENV === "production") return null;
    return env.ASAAS_API_KEY || null;
  } catch {
    return null;
  }
}
const SANDBOX = "https://sandbox.asaas.com/api/v3";

/** sem rolagem horizontal; se houver, o erro lista quem passou da tela */
const semOverflow = async (page: Page) => {
  const r = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const contido = (e: Element) => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    const culpados = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > largura + 1 && !contido(e))
      .slice(0, 6)
      .map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 40)}@${Math.round(e.getBoundingClientRect().right)}`);
    return { extra: document.documentElement.scrollWidth - largura, largura, culpados };
  });
  expect(r.extra, `largura ${r.largura}: ${r.culpados.join(" | ")}`).toBeLessThanOrEqual(0);
};

const CPF_TESTE = "249.715.637-92";

/* ---------------------------------------------------------------- */
test.describe("planos e confirmação", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("checkout-planos", "pendente");
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("tela de planos: título, 4 cards com a tabela oficial, Negócio em destaque e taxa em todos", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    await expect(page.getByRole("heading", { name: "Escolha o plano ideal para o seu negócio" })).toBeVisible();
    await expect(page.getByText("Comece simples. Cresça sem complicação.")).toBeVisible();

    const cards = page.locator("article[data-plano]");
    await expect(cards).toHaveCount(4);
    const esperado = [
      ["gratis", "Grátis", /R\$\s0/, "sem mensalidade", "Até 10 clientes"],
      ["essencial", "Essencial", /R\$\s49,90/, "/mês", "Até 50 clientes"],
      ["negocio", "Negócio", /R\$\s99,90/, "/mês", "Até 200 clientes"],
      ["escola", "Escola", /R\$\s199,90/, "/mês", "Clientes ilimitados"],
    ] as const;
    for (const [id, nome, preco, periodo, limite] of esperado) {
      const card = page.locator(`article[data-plano="${id}"]`);
      await expect(card.getByRole("heading", { name: nome })).toBeVisible();
      await expect(card).toContainText(preco);
      await expect(card).toContainText(periodo);
      await expect(card).toContainText(limite);
      await expect(card).toContainText("+ R$ 1,99 por Pix recebido");
      await expect(card.getByRole("button", { name: new RegExp(`Escolher o plano ${nome}`) })).toBeEnabled();
      for (const recurso of ["Cobranças", "Recorrências", "Controle de recebimentos", "Acompanhamento de atrasos", "WhatsApp em 1 clique"]) {
        await expect(card).toContainText(recurso);
      }
    }
    // só o Negócio é o destaque, com o selo
    await expect(page.locator('article[data-destaque="true"]')).toHaveCount(1);
    await expect(page.locator('article[data-plano="negocio"]')).toContainText("Mais escolhido");
    await expect(page.locator('article[data-plano="negocio"]')).toHaveAttribute("data-destaque", "true");
    // nada de preço antigo, trial ou "30 dias grátis"
    await expect(page.getByText(/R\$\s24,90|Profissional|Zelo Pro|30 dias|trial|teste gr[aá]tis/i)).toHaveCount(0);
    // o plano de teste NÃO aparece para conta comum
    await expect(page.getByText(/Teste \(R\$ 5\)/)).toHaveCount(0);
    await semOverflow(page);
  });

  test("comparação curta e verdadeira", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    const tabela = page.getByRole("table");
    await expect(tabela).toBeVisible();
    await expect(page.getByText("Todos os planos incluem os mesmos recursos. O que muda é quantos clientes você pode ter.")).toBeVisible();
    for (const linha of ["Cobranças", "Recorrências", "Controle de recebimentos", "WhatsApp em 1 clique", "Acompanhamento de atrasos", "Clientes"]) {
      await expect(tabela.getByRole("rowheader", { name: linha })).toBeVisible();
    }
    const clientes = tabela.getByRole("row", { name: /Clientes/ });
    await expect(clientes).toContainText("Até 10");
    await expect(clientes).toContainText("Até 50");
    await expect(clientes).toContainText("Até 200");
    await expect(clientes).toContainText("Ilimitados");
    await semOverflow(page);
  });

  test("escolher o Negócio mostra a confirmação (sem cobrar nada) e 'Alterar plano' volta", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    await page.getByRole("button", { name: "Escolher o plano Negócio" }).click();

    await expect(page.getByRole("heading", { name: "Você escolheu o Negócio" })).toBeVisible();
    await expect(page.getByText("R$ 99,90/mês")).toBeVisible();
    await expect(page.getByText("Até 200 clientes")).toBeVisible();
    await expect(page.getByText("Seu plano inclui")).toBeVisible();
    for (const r of ["Cobranças", "Recorrências", "Controle de recebimentos", "Acompanhamento de atrasos", "WhatsApp em 1 clique"]) {
      await expect(page.getByRole("list").filter({ hasText: r }).first()).toBeVisible();
    }
    await expect(page.getByText("Taxa por Pix recebido")).toBeVisible();
    await expect(page.getByText("R$ 1,99").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar para pagamento" })).toBeVisible();
    await semOverflow(page);

    // escolher NÃO é pagar: nada foi criado
    const { data } = await admin.from("empresas").select("asaas_subscription_id, assinatura_status, plano_escolhido").eq("id", conta.empresaId).single();
    expect(data?.asaas_subscription_id).toBeNull();
    expect(data?.assinatura_status).toBe("pendente");

    await page.getByRole("button", { name: "Alterar plano" }).click();
    await expect(page.getByRole("heading", { name: "Escolha o plano ideal para o seu negócio" })).toBeVisible();
  });

  test("link com ?plano= (vindo da landing) abre direto na confirmação do plano certo", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura?plano=escola");
    await expect(page.getByRole("heading", { name: "Você escolheu o Escola" })).toBeVisible();
    await expect(page.getByText("R$ 199,90/mês")).toBeVisible();
    await expect(page.getByText("Clientes ilimitados")).toBeVisible();
    // plano inválido não quebra: cai nos planos
    await page.goto("/app/assinatura?plano=inexistente");
    await expect(page.getByRole("heading", { name: "Escolha o plano ideal para o seu negócio" })).toBeVisible();
  });

  test("checkout: resumo permanente, total sem soma da taxa e validação do CPF/CNPJ no próprio campo", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura?plano=negocio");
    await page.getByRole("button", { name: "Continuar para pagamento" }).click();

    const resumo = page.getByRole("complementary", { name: "Resumo do pedido" });
    await expect(resumo).toBeVisible();
    await expect(resumo).toContainText("Seu plano");
    await expect(resumo).toContainText("Negócio");
    await expect(resumo).toContainText("Mensalidade");
    await expect(resumo).toContainText("R$ 99,90/mês");
    await expect(resumo).toContainText("até 200");
    await expect(resumo).toContainText("R$ 1,99 por Pix recebido");
    await expect(resumo).toContainText("Total da assinatura");
    await expect(resumo.locator("strong").filter({ hasText: "R$ 99,90" })).toBeVisible();
    await expect(resumo).toContainText("não é somada à mensalidade");
    await expect(resumo).toContainText("Você está contratando o Zelo para organizar suas cobranças e recebimentos.");
    // sem promessas inventadas
    await expect(resumo).not.toContainText(/clientes satisfeitos|avalia|garantid|certifica|%/i);

    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#documento-erro")).toHaveText("⚠ Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    await expect(page.locator("#documento")).toBeFocused();
    await semOverflow(page);
  });
});

/* ---------------------------------------------------------------- */
test.describe("Grátis", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("checkout-gratis", "pendente");
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("confirmação do Grátis e ativação na hora, sem pagamento", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    await page.getByRole("button", { name: "Escolher o plano Grátis" }).click();
    await expect(page.getByRole("heading", { name: "Você escolheu o Grátis" })).toBeVisible();
    await expect(page.getByText("R$ 0, sem mensalidade")).toBeVisible();
    await expect(page.getByLabel(/CPF ou CNPJ/)).toHaveCount(0);
    await page.getByRole("button", { name: "Ativar plano Grátis" }).click();
    await expect(page.getByRole("heading", { name: "Plano Grátis ativado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para meu painel" })).toBeVisible();

    const { data } = await admin.from("empresas").select("assinatura_status, plano, plano_escolhido, asaas_subscription_id").eq("id", conta.empresaId).single();
    expect(data?.assinatura_status).toBe("ativa");
    expect(data?.plano).toBe("gratis");
    expect(data?.asaas_subscription_id).toBeNull();
  });
});

/* ---------------------------------------------------------------- */
test.describe("pagamento real no sandbox", () => {
  test.describe.configure({ mode: "serial" });
  let conta: ContaE2E;
  const chave = chaveSandbox();

  test.beforeAll(async () => {
    conta = await criarContaE2E("checkout-pagar", "pendente");
  });
  test.afterAll(async () => {
    // remove o que o teste criou no sandbox
    const { data } = await admin.from("empresas").select("asaas_subscription_id, asaas_customer_id").eq("id", conta.empresaId).single();
    if (chave && data) {
      const h = { access_token: chave, "Content-Type": "application/json", "User-Agent": "Zelo-E2E/1.0" };
      if (data.asaas_subscription_id) await fetch(`${SANDBOX}/subscriptions/${data.asaas_subscription_id}`, { method: "DELETE", headers: h }).catch(() => null);
      if (data.asaas_customer_id) await fetch(`${SANDBOX}/customers/${data.asaas_customer_id}`, { method: "DELETE", headers: h }).catch(() => null);
    }
    await admin.from("mensalidades").delete().eq("empresa_id", conta.empresaId);
    await limparContaE2E(conta);
  });

  test("gerar o pagamento: Pix com QR Code e 'copia e cola', valor certo, status 'aguardando'", async ({ page, context }) => {
    test.skip(!chave, "sem chave do sandbox neste ambiente");
    test.setTimeout(120_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => null);
    await loginE2E(page, conta);
    await page.goto("/app/assinatura?plano=negocio");
    await page.getByRole("button", { name: "Continuar para pagamento" }).click();
    await preencher(page.locator("#documento"), CPF_TESTE);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    // se o servidor de testes não tem a chave do parceiro, não dá para seguir: avisa e pula
    const indisponivel = page.getByText("O pagamento ainda não está disponível");
    if (await indisponivel.isVisible().catch(() => false)) test.skip(true, "o servidor de desenvolvimento está sem a chave do parceiro de pagamentos");

    await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Pague com Pix")).toBeVisible();
    await expect(page.getByText("Escaneie o QR Code ou copie o código.")).toBeVisible();
    await expect(page.getByRole("img", { name: "QR Code Pix para pagar a assinatura" })).toBeVisible();
    const codigo = await page.locator("#pix-codigo").inputValue();
    expect(codigo).toMatch(/^000201/); // início padrão de todo BR Code (EMV)
    // o valor é o da tabela, vindo do servidor
    await expect(page.getByText("R$ 99,90").first()).toBeVisible();
    await expect(page.getByText("Estamos esperando seu pagamento")).toBeVisible();

    await page.getByRole("button", { name: "Copiar código" }).click();
    await expect(page.getByRole("button", { name: "Código Pix copiado." })).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copiado) expect(copiado).toBe(codigo);

    // criou a assinatura de verdade, com o plano e o valor certos — e NADA foi ativado
    const { data: e } = await admin.from("empresas").select("assinatura_status, plano_escolhido, asaas_subscription_id, documento").eq("id", conta.empresaId).single();
    expect(e?.asaas_subscription_id).toBeTruthy();
    expect(e?.plano_escolhido).toBe("negocio");
    expect(e?.assinatura_status).toBe("pendente");
    expect(e?.documento).toBe("24971563792");
    const { data: m } = await admin.from("mensalidades").select("valor_centavos, status, plano").eq("empresa_id", conta.empresaId);
    expect((m ?? []).length).toBeGreaterThanOrEqual(1);
    expect(m![0].valor_centavos).toBe(9990);
    expect(m![0].status).toBe("pendente");
    await semOverflow(page);
  });

  test("'Já paguei' só PERGUNTA: sem pagamento, continua aguardando e a conta continua pendente", async ({ page }) => {
    test.skip(!chave, "sem chave do sandbox neste ambiente");
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    // retomada: a pessoa volta à tela e o pagamento em aberto reaparece
    await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("img", { name: "QR Code Pix para pagar a assinatura" })).toBeVisible();

    await page.getByRole("button", { name: "Já paguei — verificar pagamento" }).click();
    await expect(page.getByText(/Ainda não recebemos a confirmação/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Tudo certo! 🎉")).toHaveCount(0);
    await expect(page.getByText("Sua assinatura está ativa.")).toHaveCount(0);
    const { data } = await admin.from("empresas").select("assinatura_status, plano").eq("id", conta.empresaId).single();
    expect(data?.assinatura_status).toBe("pendente");
  });

  test("cartão e boleto: página segura do parceiro, sem dado de cartão no Zelo", async ({ page }) => {
    test.skip(!chave, "sem chave do sandbox neste ambiente");
    await loginE2E(page, conta);
    await page.goto("/app/assinatura");
    await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("radio", { name: /Cartão/ }).check();
    await expect(page.getByText(/O Zelo não recebe nem guarda os dados do seu cartão/)).toBeVisible();
    const link = page.getByRole("link", { name: /Pagar com cartão/ });
    await expect(link).toHaveAttribute("href", /^https:\/\/[a-z.]*asaas\.com\//);
    await expect(link).toHaveAttribute("target", "_blank");
    // o Zelo não tem nenhum campo de cartão
    await expect(page.locator('input[autocomplete*="cc-"]')).toHaveCount(0);
    await expect(page.getByLabel(/número do cartão|cvv|validade/i)).toHaveCount(0);
  });

  test("retorno depois de pagar: 'Estamos confirmando…' e NUNCA 'confirmado' sem o servidor confirmar", async ({ page }) => {
    test.skip(!chave, "sem chave do sandbox neste ambiente");
    await loginE2E(page, conta);
    await page.goto("/app/assinatura/retorno?sucesso=1&status=pago");
    await expect(page.getByRole("heading", { name: "Estamos confirmando seu pagamento…" }).first()).toBeVisible();
    // mesmo com "sucesso" na URL, o servidor não confirmou: nada de "Tudo certo"
    await page.waitForTimeout(2500);
    await expect(page.getByText("Tudo certo! 🎉")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Atualizar status" })).toBeVisible();
    const { data } = await admin.from("empresas").select("assinatura_status").eq("id", conta.empresaId).single();
    expect(data?.assinatura_status).toBe("pendente");
  });

  test("checkout sem largura estourada em 390, 768, 820 e 1280 px (QR dentro da tela)", async ({ page }) => {
    test.skip(!chave, "sem chave do sandbox neste ambiente");
    await loginE2E(page, conta);
    for (const largura of [390, 768, 820, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/app/assinatura");
      await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("img", { name: "QR Code Pix para pagar a assinatura" })).toBeVisible();
      await semOverflow(page);
      const qr = await page.getByRole("img", { name: "QR Code Pix para pagar a assinatura" }).boundingBox();
      expect(qr && qr.x >= 0 && qr.x + qr.width <= largura).toBe(true);
    }
  });
});

/* ---------------------------------------------------------------- */
test.describe("isolamento", () => {
  test("outra empresa não vê o pagamento de A (a tela dela segue nos planos)", async ({ page }) => {
    const a = await criarContaE2E("checkout-iso-a", "pendente");
    const b = await criarContaE2E("checkout-iso-b", "pendente");
    try {
      await admin.from("empresas").update({ asaas_subscription_id: "sub_de_a_nao_existe", plano_escolhido: "negocio" }).eq("id", a.empresaId);
      await loginE2E(page, b);
      await page.goto("/app/assinatura");
      await expect(page.getByRole("heading", { name: "Escolha o plano ideal para o seu negócio" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toHaveCount(0);
    } finally {
      await limparContaE2E(a);
      await limparContaE2E(b);
    }
  });
});
