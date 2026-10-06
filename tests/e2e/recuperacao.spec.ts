import fs from "fs";
import { test, expect, Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";
import { salvarCredencialDaEmpresa } from "../../lib/asaas/credenciais";

/**
 * Cobrar → lembrar → recuperar → receber, pela interface.
 *
 * O link público de pagamento (e portanto o botão do WhatsApp e o "Copiar
 * link") só existe de verdade quando a cobrança está no Asaas. Por isso a
 * suíte cria UMA cobrança no SANDBOX do Asaas (nunca produção; abortada se o
 * ambiente local não for sandbox) e a remove no final. Sem a chave do sandbox
 * no ambiente, os testes que dependem do link são pulados.
 */

const dia = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
};

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
/** sem rolagem horizontal; se houver, o erro lista quem passou da tela (para achar o culpado) */
const semOverflow = async (page: Page) => {
  const r = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    /* quem está dentro de um contêiner que rola sozinho (a faixa de navegação, a tabela) não conta */
    const contidoEmRolagem = (e: Element) => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    const culpados = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > largura + 1 && !contidoEmRolagem(e))
      .slice(0, 6)
      .map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 40)}@${Math.round(e.getBoundingClientRect().right)}`);
    return { extra: document.documentElement.scrollWidth - largura, largura, culpados };
  });
  expect(r.extra, `largura ${r.largura}: ${r.culpados.join(" | ")}`).toBeLessThanOrEqual(0);
};

let conta: ContaE2E;
let chave: string | null = null;
let customerSandbox: string | null = null;
let paymentSandbox: string | null = null;
let cliAna: string;
let cliJoao: string;
let cliCarla: string;
let cobAna: string;
let cobJoao: string;
let cobHoje: string;
let cobCarla: string;

async function sandbox(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(SANDBOX + caminho, {
    method: metodo,
    headers: { access_token: chave as string, "Content-Type": "application/json", "User-Agent": "Zelo-E2E/1.0" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

test.beforeAll(async () => {
  conta = await criarContaE2E("recuperacao");
  chave = chaveSandbox();

  if (chave) {
    const c = await sandbox("POST", "/customers", { name: "E2E Recuperacao", cpfCnpj: "24971563792", externalReference: `e2e-${conta.empresaId}` });
    customerSandbox = (c.json?.id as string) ?? null;
    if (customerSandbox) {
      const p = await sandbox("POST", "/payments", {
        customer: customerSandbox,
        billingType: "UNDEFINED",
        value: 380,
        dueDate: dia(3),
        description: "E2E recuperação",
        externalReference: `e2e-pay-${conta.empresaId}`,
        fine: { value: 2, type: "PERCENTAGE" },
        interest: { value: 1 },
      });
      paymentSandbox = (p.json?.id as string) ?? null;
    }
    if (paymentSandbox) await salvarCredencialDaEmpresa(conta.empresaId, chave);
  }

  const novoCliente = async (nome: string, whatsapp: string | null) => {
    const { data, error } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome, whatsapp }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };
  const novaCobranca = async (clienteId: string, descricao: string, extra: Record<string, unknown>) => {
    const { data, error } = await admin
      .from("cobrancas")
      .insert({ empresa_id: conta.empresaId, cliente_id: clienteId, descricao, ...extra })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  cliAna = await novoCliente("Ana Atrasada", "(11) 99999-8888");
  cliJoao = await novoCliente("João Recente", "(11) 98888-7777");
  cliCarla = await novoCliente("Carla Em Dia", "(11) 97777-6666");

  cobAna = await novaCobranca(cliAna, "Mensalidade Ana", {
    valor_centavos: 38000,
    vence_em: dia(-8),
    forma_pagamento: "cliente_escolhe",
    multa_pct: 2,
    juros_pct_mes: 1,
    ...(paymentSandbox ? { asaas_payment_id: paymentSandbox, asaas_sync_status: "sincronizado" } : {}),
  });
  cobJoao = await novaCobranca(cliJoao, "Mensalidade João", { valor_centavos: 25000, vence_em: dia(-3) });
  cobHoje = await novaCobranca(cliJoao, "Taxa que vence hoje", { valor_centavos: 5000, vence_em: dia(0) });
  cobCarla = await novaCobranca(cliCarla, "Mensalidade Carla", { valor_centavos: 12000, vence_em: dia(10) });

  // lembretes ligados para a fila "Lembretes de hoje"
  await admin.from("empresas").update({ lembrete_no_dia: true, lembrete_1d_depois: true }).eq("id", conta.empresaId);
});

test.afterAll(async () => {
  if (chave && paymentSandbox) await sandbox("DELETE", `/payments/${paymentSandbox}`);
  if (chave && customerSandbox) await sandbox("DELETE", `/customers/${customerSandbox}`);
  await admin.from("asaas_credenciais").delete().eq("empresa_id", conta.empresaId);
  await limparContaE2E(conta);
});

test.describe("central de atraso", () => {
  test("lista quem deve: cliente, valor, vencimento, dias, valor atualizado, última ação e ação recomendada", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    await expect(page.getByRole("heading", { name: "Em atraso", level: 1 })).toBeVisible();
    await expect(page.getByText("Quem está te devendo dinheiro agora.")).toBeVisible();

    const linhaAna = page.getByRole("row").filter({ hasText: "Ana Atrasada" });
    await expect(linhaAna).toBeVisible();
    await expect(linhaAna).toContainText("R$ 380,00");
    await expect(linhaAna).toContainText("8 dias atrasado");
    // 380 + multa 2% (7,60) + juros 1%/mês × 8 dias (1,01) = 388,61 (estimativa)
    await expect(linhaAna).toContainText("R$ 388,61");
    await expect(linhaAna).toContainText("estimativa com encargos");
    await expect(linhaAna).toContainText("Nenhuma ainda");
    await expect(linhaAna).toContainText("Cobrar de novo pelo WhatsApp");

    const linhaJoao = page.getByRole("row").filter({ hasText: "João Recente" }).filter({ hasText: "Mensalidade João" });
    await expect(linhaJoao).toContainText("R$ 250,00");
    await expect(linhaJoao).toContainText("3 dias atrasado");
    await expect(linhaJoao).toContainText("sem encargos");
    await expect(linhaJoao).toContainText("Enviar lembrete");

    // quem não está atrasado NÃO aparece
    await expect(page.getByText("Carla Em Dia")).toHaveCount(0);
    await semOverflow(page);
  });

  test("resumo: total, quantidade e clientes em atraso", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    await expect(page.getByText("R$ 630,00").first()).toBeVisible(); // 380 + 250
    await expect(page.getByText("Cobranças atrasadas")).toBeVisible();
    await expect(page.getByText("Clientes em atraso")).toBeVisible();
  });

  test("Recuperar cobrança abre as opções; sem link a opção do WhatsApp avisa e nada é enviado", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    const linhaJoao = page.getByRole("row").filter({ hasText: "Mensalidade João" });
    await linhaJoao.getByRole("button", { name: "Recuperar cobrança" }).click();
    await expect(linhaJoao.getByText(/ainda não tem link de pagamento/)).toBeVisible();
    await expect(linhaJoao.getByRole("link", { name: "Abrir cobrança" })).toBeVisible();
    await expect(linhaJoao.getByRole("button", { name: "Marcar como negociada" })).toBeVisible();
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
    // abrir as opções não cria nem altera nada
    const { count } = await admin.from("acoes_cobranca").select("id", { count: "exact", head: true }).eq("cobranca_id", cobJoao);
    expect(count).toBe(0);
  });

  test("marcar como negociada tira da frente da fila, é registrado e dá para reabrir", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    const linha = () => page.getByRole("row").filter({ hasText: "Mensalidade João" });
    await linha().getByRole("button", { name: "Recuperar cobrança" }).click();
    await linha().getByRole("button", { name: "Marcar como negociada" }).click();

    await expect.poll(async () => (await admin.from("cobrancas").select("negociada_em").eq("id", cobJoao).single()).data?.negociada_em ?? null, { timeout: 20_000 }).not.toBeNull();
    await expect(linha()).toContainText("Negociada");
    const { data: acoes } = await admin.from("acoes_cobranca").select("tipo").eq("cobranca_id", cobJoao);
    expect((acoes ?? []).map((a) => a.tipo)).toContain("negociada");
    // negociar NÃO muda nada financeiro
    const { data: c } = await admin.from("cobrancas").select("status, valor_centavos").eq("id", cobJoao).single();
    expect(c?.status).toBe("pendente");
    expect(c?.valor_centavos).toBe(25000);

    // depois do refresh o painel pode continuar aberto; só abre se estiver fechado
    const reabrir = linha().getByRole("button", { name: /Reabrir/ });
    if (!(await reabrir.isVisible())) await linha().getByRole("button", { name: "Recuperar cobrança" }).click();
    await reabrir.click();
    await expect.poll(async () => (await admin.from("cobrancas").select("negociada_em").eq("id", cobJoao).single()).data?.negociada_em === null, { timeout: 20_000 }).toBe(true);
    await expect(linha()).not.toContainText("Negociada");
  });

  test("lembretes de hoje: aparece quem tem regra na vez e some depois do contato", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    const lembretes = page.getByRole("region").filter({ has: page.getByRole("heading", { name: "Lembretes de hoje" }) }).or(page.locator("section", { has: page.getByRole("heading", { name: "Lembretes de hoje" }) }));
    await expect(lembretes.first().getByText("Taxa que vence hoje").or(lembretes.first().getByText("No dia do vencimento"))).toBeVisible();
    await expect(lembretes.first().getByText("No dia do vencimento")).toBeVisible();
    // João (3 dias de atraso) NÃO está na vez: só "no dia" e "1 dia depois" estão ligadas
    await expect(lembretes.first().getByText("3 dias depois do vencimento")).toHaveCount(0);

    // um contato registrado a partir do dia da regra tira o lembrete da lista
    const { data: u } = await admin.auth.admin.getUserById(conta.userId);
    await admin.from("acoes_cobranca").insert({ empresa_id: conta.empresaId, cobranca_id: cobHoje, tipo: "lembrete_whatsapp", regra: "no_dia", usuario_id: u.user?.id });
    await page.reload();
    await expect(page.getByText("No dia do vencimento")).toHaveCount(0);
    await admin.from("acoes_cobranca").delete().eq("cobranca_id", cobHoje);
  });

  test("sem largura estourada em 390, 820 e 1280 px", async ({ page }) => {
    await loginE2E(page, conta);
    for (const largura of [390, 820, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/app/inadimplencia");
      await expect(page.getByRole("heading", { name: "Em atraso", level: 1 })).toBeVisible();
      await page.getByRole("button", { name: "Recuperar cobrança" }).first().click();
      await semOverflow(page);
    }
  });
});

test.describe("com o link de pagamento do Asaas (sandbox)", () => {
  test.skip(() => !paymentSandbox, "sem chave do sandbox do Asaas neste ambiente");

  test("WhatsApp: o link abre a conversa com a mensagem pronta e registra o contato; nada é enviado sozinho", async ({ page }) => {
    await page.context().route(/wa\.me|whatsapp\.com/, (r) => r.abort());
    await loginE2E(page, conta);
    await page.goto("/app/inadimplencia");
    const linha = page.getByRole("row").filter({ hasText: "Ana Atrasada" });
    await linha.getByRole("button", { name: "Recuperar cobrança" }).click();

    const zap = linha.getByRole("link", { name: "Enviar pelo WhatsApp" });
    await expect(zap).toBeVisible();
    const href = (await zap.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    const texto = decodeURIComponent(href.split("?text=")[1]);
    expect(texto).toContain("Oi Ana!");
    expect(texto).toContain("R$ 380,00");
    expect(texto).toMatch(/venceu em/);
    expect(texto).toMatch(/https:\/\/[a-z.]*asaas\.com\//);
    // CPF e dados internos nunca vão na mensagem
    expect(texto).not.toContain("24971563792");

    await zap.click();
    await expect.poll(async () => (await admin.from("acoes_cobranca").select("tipo").eq("cobranca_id", cobAna)).data?.map((a) => a.tipo) ?? [], { timeout: 20_000 }).toContain("whatsapp");
    // e a cobrança passa a "Em recuperação" na lista
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: "Ana Atrasada" })).toContainText("Em recuperação");
    await expect(page.getByRole("row").filter({ hasText: "Ana Atrasada" })).toContainText("WhatsApp aberto");
    // status financeiro intocado
    expect((await admin.from("cobrancas").select("status").eq("id", cobAna).single()).data?.status).toBe("pendente");
  });

  test("Copiar link: copia o link público, mostra 'Link copiado.' e não cria cobrança", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => null);
    await loginE2E(page, conta);
    const antes = (await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId)).count;

    await page.goto("/app/inadimplencia");
    const linha = page.getByRole("row").filter({ hasText: "Ana Atrasada" });
    await linha.getByRole("button", { name: "Recuperar cobrança" }).click();
    await linha.getByRole("button", { name: "Copiar link" }).click();
    await expect(linha.getByText("Link copiado.")).toBeVisible();

    const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copiado) expect(copiado).toMatch(/^https:\/\/[a-z.]*asaas\.com\//);
    await expect.poll(async () => (await admin.from("acoes_cobranca").select("tipo").eq("cobranca_id", cobAna)).data?.map((a) => a.tipo) ?? [], { timeout: 20_000 }).toContain("link_copiado");
    const depois = (await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId)).count;
    expect(depois).toBe(antes);
  });

  test("ficha da cobrança: recomendação, WhatsApp e Copiar link lado a lado, forma de pagamento e encargos", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobAna}`);
    await expect(page.getByText("Essa cobrança está atrasada.").or(page.getByText("Você já entrou em contato"))).toBeVisible();
    await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
    await expect(page.getByText("Seu cliente escolhe como pagar").first()).toBeVisible();
    await expect(page.getByText(/multa de 2% \+ juros de 1% ao mês/)).toBeVisible();
    await expect(page.getByText(/Valor atualizado \(estimativa\)/)).toBeVisible();
    await expect(page.getByText("R$ 388,61").first()).toBeVisible();
    await semOverflow(page);
  });

  test("cobrança já enviada ao Asaas: forma de pagamento e encargos aparecem travados na edição", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobAna}/editar`);
    await expect(page.getByText(/pagamento desta cobrança já foi preparado/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Seu cliente escolhe/ })).toBeDisabled();
    await expect(page.getByLabel(/Multa após o vencimento/)).toBeDisabled();
  });
});

test.describe("ficha da cobrança em atraso (sem depender do Asaas)", () => {
  test("destaque 'Essa cobrança está atrasada.' com a última ação e o botão de negociada", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobJoao}`);
    await expect(page.getByText("Essa cobrança está atrasada.")).toBeVisible();
    // outros testes desta conta podem já ter registrado ações (negociar/reabrir): aceita os dois estados
    await expect(page.getByText(/Nenhuma ação registrada ainda|Última ação:/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como negociada" })).toBeVisible();
    await expect(page.getByText("Só Pix").first()).toBeVisible();
    await semOverflow(page);
  });

  test("cobrança que ainda não venceu não mostra o destaque de atraso", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobCarla}`);
    await expect(page.getByText("Essa cobrança está atrasada.")).toHaveCount(0);
  });
});

test.describe("painel e cliente", () => {
  test("painel: indicadores Recebido, A receber, Em atraso e Previsão + destaque com botão para a central", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app");
    await expect(page.getByText("Recebido no mês")).toBeVisible();
    await expect(page.getByText("A receber este mês")).toBeVisible();
    await expect(page.getByText(/^Em atraso/).first()).toBeVisible();
    await expect(page.getByText("Previsão mensal")).toBeVisible();
    await expect(page.getByText(/cobranças atrasadas precisam da sua atenção/)).toBeVisible();
    const botao = page.getByRole("link", { name: "Ver cobranças atrasadas" });
    await expect(botao).toBeVisible();
    await botao.click();
    await expect(page).toHaveURL(/\/app\/inadimplencia/);
  });

  test("painel e menu: item 'Em atraso' leva à central", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app");
    await expect(page.getByRole("link", { name: "Em atraso" }).first()).toBeVisible();
  });

  test("cliente com atraso: totais e selo 'Em atraso'", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/clientes/${cliAna}`);
    await expect(page.getByText("Em atraso", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Total contratado")).toBeVisible();
    await expect(page.getByText("Total recebido")).toBeVisible();
    await expect(page.getByText("Em aberto", { exact: true })).toBeVisible();
    await expect(page.getByText("Atrasado", { exact: true })).toBeVisible();
    await expect(page.getByText("Próxima cobrança")).toBeVisible();
    await expect(page.getByText("R$ 380,00").first()).toBeVisible();
    await semOverflow(page);
  });

  test("cliente em dia: selo 'Em dia' e próxima cobrança", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/clientes/${cliCarla}`);
    await expect(page.getByText("Em dia", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 120,00").first()).toBeVisible();
  });
});

test.describe("formulário de cobrança e configurações", () => {
  test("forma de pagamento: 'Seu cliente escolhe como pagar', encargos com prévia e gravação no banco", async ({ page }) => {
    test.setTimeout(90_000);
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    await page.locator("#cliente_id").selectOption({ label: "Carla Em Dia" });
    await preencher(page.getByLabel("Descrição"), "Aula avulsa");
    await preencher(page.getByLabel("Valor"), "100,00");

    // padrão: só Pix, sem campos de encargo
    await expect(page.getByRole("radio", { name: /Só Pix/ })).toBeChecked();
    await expect(page.getByLabel(/Multa após o vencimento/)).toHaveCount(0);
    await expect(page.getByText(/Multa e juros só valem para boleto/).first()).toBeVisible();

    await page.getByRole("radio", { name: /Seu cliente escolhe/ }).check({ force: true });
    await expect(page.getByText(/Seu cliente escolhe como pagar\./)).toBeVisible();
    await preencher(page.getByLabel(/Multa após o vencimento/), "2");
    await preencher(page.getByLabel(/Juros \(% ao mês\)/), "1");
    await expect(page.getByText("Se atrasar, serão aplicados os encargos configurados:")).toBeVisible();
    await expect(page.getByText(/multa de 2% \+ juros de 1% ao mês/)).toBeVisible();
    await expect(page.getByText(/R\$\s102,33/)).toBeVisible(); // exemplo de 10 dias (estimativa)
    await semOverflow(page);

    await page.getByRole("button", { name: "Criar cobrança" }).click();
    // a criação tenta enviar ao Asaas (sandbox) antes de responder: pode levar alguns segundos
    await expect(page).toHaveURL(/\/app\/cobrancas\/[0-9a-f-]{36}$/, { timeout: 40_000 });
    const id = page.url().split("/").pop() as string;
    const { data } = await admin.from("cobrancas").select("forma_pagamento, multa_pct, juros_pct_mes, valor_centavos").eq("id", id).single();
    expect(data?.forma_pagamento).toBe("cliente_escolhe");
    expect(Number(data?.multa_pct)).toBe(2);
    expect(Number(data?.juros_pct_mes)).toBe(1);
    expect(data?.valor_centavos).toBe(10000);
  });

  test("valor abaixo de R$ 5: aviso no Pix e erro claro quando o cliente escolhe", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    await page.locator("#cliente_id").selectOption({ label: "Carla Em Dia" });
    await preencher(page.getByLabel("Descrição"), "Taxa pequena");
    await preencher(page.getByLabel("Valor"), "3,00");
    await expect(page.getByText(/gerado a partir de R\$\s5,00/)).toBeVisible();

    await page.getByRole("radio", { name: /Seu cliente escolhe/ }).check({ force: true });
    await page.getByRole("button", { name: "Criar cobrança" }).click();
    await expect(page.getByText(/precisa ser de pelo menos R\$\s5,00/)).toBeVisible();
    await expect(page).toHaveURL(/\/app\/cobrancas\/nova/);
  });

  test("multa fora do limite é recusada na tela e nada é gravado", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    await page.locator("#cliente_id").selectOption({ label: "Carla Em Dia" });
    await preencher(page.getByLabel("Descrição"), "Multa alta");
    await preencher(page.getByLabel("Valor"), "100,00");
    await page.getByRole("radio", { name: /Seu cliente escolhe/ }).check({ force: true });
    await preencher(page.getByLabel(/Multa após o vencimento/), "15");
    await page.getByRole("button", { name: "Criar cobrança" }).click();
    await expect(page.getByText(/A multa pode ir até 10%/)).toBeVisible();
    const { count } = await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId).eq("descricao", "Multa alta");
    expect(count).toBe(0);
  });

  test("configurações: salvar padrões, nova cobrança já nasce com eles e a existente não muda", async ({ page }) => {
    const outra = await criarContaE2E("prefs");
    try {
      await loginE2E(page, outra);
      await page.goto("/app/configuracoes");
      await expect(page.getByRole("heading", { name: "Cobrança e recuperação" })).toBeVisible();

      await page.getByRole("radio", { name: /Seu cliente escolhe como pagar/ }).check({ force: true });
      await preencher(page.getByLabel(/Multa padrão/), "2");
      await preencher(page.getByLabel(/Juros padrão/), "1");
      await page.getByLabel("3 dias antes do vencimento").check();
      await page.getByLabel("7 dias depois do vencimento").check();
      await page.getByRole("radio", { name: /Só o link de pagamento/ }).check({ force: true });
      await semOverflow(page);
      await page.getByRole("button", { name: "Salvar padrões" }).click();
      await expect(page.getByText("Padrões salvos.")).toBeVisible();

      const { data: e } = await admin.from("empresas").select("*").eq("id", outra.empresaId).single();
      expect(e?.cobranca_forma_padrao).toBe("cliente_escolhe");
      expect(Number(e?.multa_padrao_pct)).toBe(2);
      expect(Number(e?.juros_padrao_pct_mes)).toBe(1);
      expect(e?.lembrete_3d_antes).toBe(true);
      expect(e?.lembrete_7d_depois).toBe(true);
      expect(e?.lembrete_no_dia).toBe(false);
      expect(e?.canal_preferencial).toBe("link");

      // uma cobrança NOVA nasce com os padrões
      await admin.from("clientes").insert({ empresa_id: outra.empresaId, nome: "Cliente Prefs", status: "ativo" });
      await page.goto("/app/cobrancas/nova");
      await expect(page.getByRole("radio", { name: /Seu cliente escolhe/ })).toBeChecked();
      await expect(page.getByLabel(/Multa após o vencimento/)).toHaveValue("2");
      await expect(page.getByLabel(/Juros \(% ao mês\)/)).toHaveValue("1");
    } finally {
      await limparContaE2E(outra);
    }
  });

  test("configurações: multa 15% é recusada e nada é salvo", async ({ page }) => {
    const outra = await criarContaE2E("prefs-invalida");
    try {
      await loginE2E(page, outra);
      await page.goto("/app/configuracoes");
      await preencher(page.getByLabel(/Multa padrão/), "15");
      await page.getByRole("button", { name: "Salvar padrões" }).click();
      await expect(page.getByText(/A multa pode ir até 10%/)).toBeVisible();
      const { data: e } = await admin.from("empresas").select("multa_padrao_pct").eq("id", outra.empresaId).single();
      expect(e?.multa_padrao_pct).toBeNull();
    } finally {
      await limparContaE2E(outra);
    }
  });
});

test.describe("isolamento entre empresas", () => {
  test("outra empresa não vê a fila de atraso nem a cobrança de A", async ({ page }) => {
    const outra = await criarContaE2E("isolada");
    try {
      await loginE2E(page, outra);
      await page.goto("/app/inadimplencia");
      await expect(page.getByText("Nenhuma cobrança em atraso")).toBeVisible();
      await expect(page.getByText("Ana Atrasada")).toHaveCount(0);
      await page.goto(`/app/cobrancas/${cobAna}`);
      await expect(page.getByRole("heading", { name: "Cobrança não encontrada" })).toBeVisible();
      await expect(page.getByText("Mensalidade Ana")).toHaveCount(0);
    } finally {
      await limparContaE2E(outra);
    }
  });
});
