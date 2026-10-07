import { test, expect, Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

/**
 * Meu Negócio: visão gerencial. Usa só dado que a empresa já tem; cada número
 * da tela vem do banco (com a sessão da própria pessoa).
 */

const dia = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
};

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

/* ---------- primeiro acesso ---------- */
test.describe("primeiro acesso (sem dados)", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("negocio-vazio");
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("experiência de começo: 'Seu negócio começa aqui' e o botão para a primeira cobrança", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    await expect(page.getByRole("heading", { name: "Meu negócio", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seu negócio começa aqui." })).toBeVisible();
    await expect(page.getByText("Você ainda não possui dados suficientes para mostrar sua saúde financeira.")).toBeVisible();
    await expect(page.getByText("Cadastre seu primeiro cliente")).toBeVisible();
    await expect(page.getByText("Crie sua primeira cobrança")).toBeVisible();
    await expect(page.getByText("Acompanhe seu primeiro recebimento")).toBeVisible();
    // nada de números nem gráfico inventados
    await expect(page.getByText("Saúde do negócio")).toHaveCount(0);
    await expect(page.getByText("Evolução da receita")).toHaveCount(0);
    await semOverflow(page);
    await page.getByRole("link", { name: "Criar primeira cobrança" }).click();
    await expect(page).toHaveURL(/\/app\/cobrancas\/nova/);
  });
});

/* ---------- com dados ---------- */
test.describe("com dados reais", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("negocio-dados");
    const novoCliente = async (nome: string) => {
      const { data } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome, status: "ativo" }).select("id").single();
      return data!.id as string;
    };
    const ana = await novoCliente("Ana");
    const joao = await novoCliente("João");
    const carla = await novoCliente("Carla");
    const cob = (cliente: string, descricao: string, valor: number, vence: number, extra: Record<string, unknown> = {}) =>
      admin.from("cobrancas").insert({ empresa_id: conta.empresaId, cliente_id: cliente, descricao, valor_centavos: valor, vence_em: dia(vence), status: "pendente", ...extra });
    // recebido neste mês: R$ 100,00 + R$ 250,00
    const agora = new Date().toISOString();
    await cob(ana, "Paga 1", 10000, -3, { status: "paga", pago_em: agora, valor_pago_centavos: 10000, pago_via: "asaas" });
    await cob(joao, "Paga 2", 25000, -2, { status: "paga", pago_em: agora, valor_pago_centavos: 25000, pago_via: "manual" });
    // em atraso: R$ 380,00 (8 dias) — Ana
    await cob(ana, "Atrasada", 38000, -8);
    // vence em 2 dias (aviso) e mais para frente
    await cob(carla, "Vence logo", 5000, 2);
    await cob(carla, "Vence depois", 40000, 40);
    // recorrência ativa de R$ 150,00
    await admin.from("recorrencias").insert({ empresa_id: conta.empresaId, cliente_id: carla, descricao: "Plano mensal", valor_centavos: 15000, dia_vencimento: 5, inicia_em: dia(-20), status: "ativa" });
  });
  test.afterAll(async () => {
    await admin.from("recorrencias").delete().eq("empresa_id", conta.empresaId);
    await limparContaE2E(conta);
  });

  test("resumo: receita do mês, a receber, em atraso e previsão com os valores do banco", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    await expect(page.getByText("Tenha uma visão clara do seu negócio.")).toBeVisible();
    await expect(page.getByText("Veja o que entrou, o que está para entrar e o que precisa da sua atenção.")).toBeVisible();

    const resumo = page.getByRole("region", { name: "Resumo do mês" });
    await expect(resumo).toBeVisible();
    await expect(resumo.locator("div").filter({ hasText: /^Receita do mês/ }).first()).toContainText("R$ 350,00");
    await expect(resumo.locator("div").filter({ hasText: /^A receber/ }).first()).toContainText("R$ 450,00"); // 50 + 400
    await expect(resumo.locator("div").filter({ hasText: /^Em atraso/ }).first()).toContainText("R$ 380,00");
    await expect(resumo.locator("div").filter({ hasText: /^Em atraso/ }).first()).toContainText("1 cobrança vencida");
    await expect(resumo.locator("div").filter({ hasText: /^Previsão do mês/ }).first()).toContainText("O que já entrou mais o que ainda vence neste mês.");
    // não há mês anterior: nada de variação inventada
    await expect(resumo).toContainText("Sem mês anterior para comparar ainda.");
    await semOverflow(page);
  });

  test("saúde do negócio com o motivo, e alertas com uma ação cada", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    const saude = page.getByRole("region", { name: "Saúde do negócio" });
    // 380 de 830 em aberto = 46%: passa dos 20% → atenção imediata
    await expect(saude).toContainText("Precisa de atenção imediata");
    await expect(saude).toContainText("O atraso passa de 20% de tudo o que está em aberto.");
    await expect(saude).toContainText("Não é uma nota");
    await expect(saude.getByRole("link", { name: "Recuperar cobrança" })).toBeVisible();

    const atencao = page.getByRole("region", { name: "Precisa da sua atenção" });
    await expect(atencao).toContainText("Você tem 1 cobrança vencida (R$ 380,00 em atraso).");
    await expect(atencao.getByRole("link", { name: "Recuperar cobrança" })).toHaveAttribute("href", "/app/inadimplencia");
    await expect(atencao).toContainText("1 cobrança vence nos próximos 3 dias (R$ 50,00).");
    // (nos 3 últimos dias do mês o "vence logo" já cai no mês seguinte e não entra na previsão do mês)
    if (new Date().getDate() <= 27) {
      await expect(atencao).toContainText("estão previstos para entrar ainda este mês");
      await expect(atencao.getByRole("link", { name: "Ver recebimentos" }).first()).toHaveAttribute("href", "/app/recebimentos");
    }
    // sem alertas inventados
    await expect(atencao).not.toContainText("Você ainda não criou sua primeira cobrança");
    await expect(atencao).not.toContainText("Você ainda não cadastrou nenhum cliente");
  });

  test("clientes e receita recorrente: só métricas calculáveis, com a origem explicada", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    const clientes = page.getByRole("region", { name: "Clientes" });
    await expect(clientes.locator("div").filter({ hasText: /^Clientes ativos/ }).first()).toContainText("3");
    await expect(clientes.locator("div").filter({ hasText: /^Novos este mês/ }).first()).toContainText("3");
    await expect(clientes.locator("div").filter({ hasText: /^Clientes em atraso/ }).first()).toContainText("1");
    // ticket médio = (100 + 250) / 2 = R$ 175,00
    await expect(clientes.locator("div").filter({ hasText: /^Ticket médio/ }).first()).toContainText("R$ 175,00");

    const rec = page.getByRole("region", { name: "Previsão de receita recorrente" });
    await expect(rec).toContainText("R$ 150,00");
    await expect(rec).toContainText("/mês");
    await expect(rec).toContainText("Vem de 1 cobrança automática ativa");
    await expect(rec).toContainText("É uma previsão");
    await expect(page.getByText(/receita garantida/i)).toHaveCount(0);
  });

  test("fluxo de dinheiro: recebido → a receber → em atraso", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    const fluxo = page.getByRole("region", { name: "Fluxo de dinheiro" });
    await expect(fluxo).toContainText("R$ 350,00");
    await expect(fluxo).toContainText("recebido no mês");
    await expect(fluxo).toContainText("R$ 450,00");
    await expect(fluxo).toContainText("a receber");
    await expect(fluxo).toContainText("R$ 380,00");
    await expect(fluxo).toContainText("em atraso");
    await expect(fluxo.getByRole("img", { name: /% recebido/ })).toBeVisible();
  });

  test("gráfico: 7 dias, este mês e 3 meses — com o total real e acessível", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    const bloco = page.getByRole("region", { name: "Evolução da receita" });
    await expect(bloco.getByRole("img", { name: /Receita recebida, 7 dias: R\$\s350,00 no total/ })).toBeVisible();
    await bloco.getByRole("radio", { name: "Este mês" }).check();
    await expect(bloco.getByRole("img", { name: /Receita recebida, este mês: R\$\s350,00 no total/ })).toBeVisible();
    await bloco.getByRole("radio", { name: "3 meses" }).check();
    await expect(bloco.getByRole("img", { name: /Receita recebida, 3 meses: R\$\s350,00 no total/ })).toBeVisible();
    await expect(bloco.getByRole("status")).toContainText("R$ 350,00");
    // tabela só para leitor de tela com os mesmos números
    await expect(bloco.locator("table.sr-only tbody tr")).toHaveCount(3);
    await semOverflow(page);
  });

  test("ligação entre as telas: menu, Visão geral e cobranças em atraso", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/negocio");
    // menu: 'Meu negócio' logo depois de 'Visão geral'
    const nav = page.getByRole("navigation", { name: "Navegação do sistema" });
    await expect(nav.getByRole("link", { name: "Meu negócio" })).toHaveAttribute("aria-current", "page");
    const rotulos = await nav.getByRole("link").allInnerTexts();
    expect(rotulos.indexOf("Meu negócio")).toBe(rotulos.indexOf("Visão geral") + 1);
    // a visão geral aponta para cá
    await page.goto("/app");
    await page.getByRole("link", { name: /Ver como está seu negócio/ }).first().click();
    await expect(page).toHaveURL(/\/app\/negocio/);
    // e daqui, o atraso leva à central
    await page.getByRole("region", { name: "Precisa da sua atenção" }).getByRole("link", { name: "Recuperar cobrança" }).click();
    await expect(page).toHaveURL(/\/app\/inadimplencia/);
  });

  test("responsivo: 390, 768, 820, 1024 e 1280 px sem largura estourada", async ({ page }) => {
    await loginE2E(page, conta);
    for (const largura of [390, 768, 820, 1024, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/app/negocio");
      await expect(page.getByRole("heading", { name: "Meu negócio", level: 1 })).toBeVisible();
      await semOverflow(page);
      const svg = await page.getByRole("img", { name: /Receita recebida/ }).boundingBox();
      expect(svg && svg.x >= 0 && svg.x + svg.width <= largura).toBe(true);
    }
  });
});

/* ---------- isolamento ---------- */
test.describe("isolamento", () => {
  test("outra empresa não vê os números de A", async ({ page }) => {
    const a = await criarContaE2E("negocio-iso-a");
    const b = await criarContaE2E("negocio-iso-b");
    try {
      const { data: cli } = await admin.from("clientes").insert({ empresa_id: a.empresaId, nome: "Cliente secreto de A" }).select("id").single();
      await admin.from("cobrancas").insert({ empresa_id: a.empresaId, cliente_id: cli!.id, descricao: "Só de A", valor_centavos: 777700, vence_em: dia(-9), status: "pendente" });
      await loginE2E(page, b);
      await page.goto("/app/negocio");
      await expect(page.getByRole("heading", { name: "Seu negócio começa aqui." })).toBeVisible();
      await expect(page.getByText("7.777,00")).toHaveCount(0);
      await expect(page.getByText("Cliente secreto de A")).toHaveCount(0);
    } finally {
      await limparContaE2E(a);
      await limparContaE2E(b);
    }
  });
});
