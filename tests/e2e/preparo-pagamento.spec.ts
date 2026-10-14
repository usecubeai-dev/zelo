import fs from "fs";
import { test, expect, type Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, abrirMenuSePreciso, admin, type ContaE2E } from "./helpers";
import { salvarCredencialDaEmpresa } from "../../lib/asaas/credenciais";

/**
 * Criar a cobrança → preparar o pagamento → link real → enviar.
 *
 * Cobre o caso observado pela equipe: cobranças criadas ANTES de a conta de
 * recebimentos estar pronta. A parte que fala com o provedor roda contra o
 * SANDBOX (nunca produção) e é pulada quando o ambiente não tem chave dele.
 */

const SANDBOX = "https://sandbox.asaas.com/api/v3";

const dia = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

const semOverflow = async (page: Page) => {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, "rolagem horizontal").toBeLessThanOrEqual(0);
};

async function definirConta(empresaId: string, estado: { status: string; aprovacao: string | null }) {
  await admin
    .from("empresas")
    .update({
      provider_status: estado.status,
      provider_aprovacao: estado.aprovacao,
      asaas_account_id: estado.status === "ativa" ? `acc_e2e_${empresaId.slice(0, 8)}` : null,
    })
    .eq("id", empresaId);
}

async function novoCliente(empresaId: string, extra: Record<string, unknown> = {}) {
  const { data } = await admin
    .from("clientes")
    .insert({ empresa_id: empresaId, nome: "Cliente Preparo", whatsapp: "(11) 99999-8888", email: "preparo@zelo.test", documento: "24971563792", ...extra })
    .select("id")
    .single();
  return data!.id as string;
}

async function novaCobranca(empresaId: string, clienteId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("cobrancas")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, descricao: "Cobrança preparo", valor_centavos: 5000, vence_em: dia(10), ...extra })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/* ------------------------------------------------------------------ */
test.describe("estados da conta de recebimentos na tela Nova cobrança", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("prep-estados");
    // já não é a primeira cobrança: sem tutorial no caminho
    const cli = await novoCliente(conta.empresaId);
    await novaCobranca(conta.empresaId, cli, { asaas_payment_id: "pay_e2e_ja_preparado", asaas_sync_status: "sincronizado" });
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  const casos: { rotulo: string; estado: { status: string; aprovacao: string | null }; titulo: string; botao: string | null }[] = [
    { rotulo: "não conectada", estado: { status: "pendente", aprovacao: null }, titulo: "Conecte sua conta de recebimentos", botao: "Conectar conta" },
    { rotulo: "conexão recusada", estado: { status: "recusada", aprovacao: null }, titulo: "Não conseguimos conectar sua conta", botao: "Corrigir dados da conta" },
    { rotulo: "ainda não conferida", estado: { status: "ativa", aprovacao: null }, titulo: "Vamos conferir a situação da sua conta", botao: "Ver status da conta" },
    { rotulo: "em análise", estado: { status: "ativa", aprovacao: "PENDING" }, titulo: "Sua conta está em análise", botao: "Ver status da conta" },
    { rotulo: "recusada pelo Asaas", estado: { status: "ativa", aprovacao: "REJECTED" }, titulo: "O Asaas não aprovou sua conta", botao: "Ver o que corrigir" },
  ];

  test("cada estado mostra a mensagem e a ação certas (e o formulário continua utilizável)", async ({ page }) => {
    test.setTimeout(120_000);
    await loginE2E(page, conta);
    for (const c of casos) {
      await definirConta(conta.empresaId, c.estado);
      await page.goto("/app/cobrancas/nova");
      const aviso = page.getByRole("region", { name: "Conta de recebimentos" });
      await expect(aviso.getByRole("heading", { name: c.titulo }), c.rotulo).toBeVisible();
      if (c.botao) {
        const cta = aviso.getByRole("link", { name: c.botao });
        await expect(cta).toBeVisible();
        await expect(cta).toHaveAttribute("href", /\/app\/configuracoes#recebimentos/);
        // alvo de toque confortável
        const caixa = await cta.boundingBox();
        expect(caixa?.height ?? 0, `${c.rotulo}: altura do botão`).toBeGreaterThanOrEqual(40);
      }
      // a cobrança pode ser criada mesmo assim: o aviso diz isso e o formulário está lá
      await expect(aviso).toContainText("ela fica salva");
      await expect(page.getByRole("button", { name: "Criar cobrança" })).toBeVisible();
      await semOverflow(page);
    }
  });

  test("conta aprovada: sem aviso nenhum na criação", async ({ page }) => {
    await definirConta(conta.empresaId, { status: "ativa", aprovacao: "APPROVED" });
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    await expect(page.getByRole("button", { name: "Criar cobrança" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conta de recebimentos" })).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
test.describe("cobrança salva sem link (conta ainda não pronta)", () => {
  let conta: ContaE2E;
  let cobranca = "";
  test.beforeAll(async () => {
    conta = await criarContaE2E("prep-semlink");
    await definirConta(conta.empresaId, { status: "ativa", aprovacao: "PENDING" });
    const cli = await novoCliente(conta.empresaId);
    cobranca = await novaCobranca(conta.empresaId, cli);
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("a ficha diz a causa, mostra 'Link pendente' e NÃO oferece botões de envio que não funcionariam", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobranca}?criada=1`);
    await expect(page.getByText("Cobrança criada ✅")).toBeVisible();
    await expect(page.getByText("Cobrança salva — link de pagamento pendente")).toBeVisible();
    await expect(page.getByText("Link pendente", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preparar o pagamento" })).toBeVisible();
    await expect(page.getByText(/Sua conta está em análise/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver status da conta" })).toBeVisible();
    // nada de envio sem link
    await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copiar link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enviar por e-mail" })).toHaveCount(0);
    // a mensagem genérica de antes não volta
    await expect(page.getByText("Não conseguimos preparar o pagamento. Tente novamente em instantes.")).toHaveCount(0);
    await semOverflow(page);
  });

  test("'Tentar preparar mesmo assim' devolve o resultado REAL (sem credencial: conta ainda não disponível), sem criar nada", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobranca}`);
    await page.getByRole("button", { name: "Tentar preparar mesmo assim" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /ainda não está disponível para gerar pagamentos/ })).toBeVisible();
    const { data } = await admin.from("cobrancas").select("status, asaas_payment_id, valor_centavos").eq("id", cobranca).single();
    expect(data?.asaas_payment_id).toBeNull();
    expect(data?.status).toBe("pendente");
    expect(data?.valor_centavos).toBe(5000);
  });

  test("a lista avisa quantas cobranças estão sem link e leva a conta", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas");
    const aviso = page.getByRole("region", { name: "Conta de recebimentos" });
    await expect(aviso.getByRole("heading", { name: "1 cobrança salva está sem link de pagamento" })).toBeVisible();
    await expect(aviso.getByRole("heading", { name: "Sua conta está em análise" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Preparar pagamento da cobrança/ })).toBeVisible();
    await semOverflow(page);
  });

  test("outra empresa não vê nem toca nessa cobrança", async ({ page }) => {
    const outra = await criarContaE2E("prep-outra");
    try {
      await loginE2E(page, outra);
      await page.goto(`/app/cobrancas/${cobranca}`);
      await expect(page.getByRole("heading", { name: "Cobrança não encontrada" })).toBeVisible();
      await expect(page.getByText("Cobrança preparo")).toHaveCount(0);
      await page.goto("/app/cobrancas");
      await expect(page.getByText("sem link de pagamento")).toHaveCount(0);
    } finally {
      await limparContaE2E(outra);
    }
  });
});

/* ------------------------------------------------------------------ */
test.describe("tutorial 'Vamos fazer sua primeira cobrança?'", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("prep-tutorial");
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("abre dispensável, adapta o primeiro passo, não cobre o formulário e some com 'Agora não'", async ({ page }) => {
    test.setTimeout(90_000);
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    const tutorial = page.getByRole("region", { name: "Vamos fazer sua primeira cobrança?" });
    await expect(tutorial).toBeVisible();
    await expect(tutorial.getByRole("button", { name: "Começar" })).toBeVisible();
    await expect(tutorial.getByRole("button", { name: "Agora não" })).toBeVisible();

    await tutorial.getByRole("button", { name: "Começar" }).click();
    const passos = tutorial.getByRole("listitem");
    await expect(passos).toHaveCount(5);
    // conta não conectada: começa pela conexão
    await expect(passos.nth(0)).toContainText("Conecte sua conta de recebimentos");
    await expect(passos.nth(0).getByRole("link", { name: "Conectar conta" })).toBeVisible();
    await expect(passos.nth(1)).toContainText("Cadastre seu cliente");
    await expect(passos.nth(2)).toContainText("Crie a cobrança");
    await expect(passos.nth(3)).toContainText("Envie para o cliente");
    await expect(passos.nth(3)).toContainText("quando o link de pagamento estiver pronto");
    await expect(passos.nth(4)).toContainText("Acompanhe o pagamento");
    await semOverflow(page);

    // não cobre o formulário: o botão de criar continua alcançável e abaixo do tutorial
    const caixaTutorial = await tutorial.boundingBox();
    const caixaForm = await page.getByRole("button", { name: "Criar cobrança" }).boundingBox();
    expect((caixaForm?.y ?? 0) >= (caixaTutorial ? caixaTutorial.y + caixaTutorial.height - 1 : 0)).toBe(true);

    // "Agora não" (no cartão fechado) dispensa e não volta
    await page.reload();
    await page.getByRole("region", { name: "Vamos fazer sua primeira cobrança?" }).getByRole("button", { name: "Agora não" }).click();
    await expect(page.getByRole("region", { name: "Vamos fazer sua primeira cobrança?" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Nova cobrança", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Vamos fazer sua primeira cobrança?" })).toHaveCount(0);
  });

  test("a Ajuda (menu da conta) reabre o tutorial, com o passo da conta refletindo o estado real", async ({ page }) => {
    await definirConta(conta.empresaId, { status: "ativa", aprovacao: "PENDING" });
    await loginE2E(page, conta);
    await page.goto("/app");
    await abrirMenuSePreciso(page).catch(() => null);
    await page.goto("/app/ajuda");
    await expect(page.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
    const passos = page.getByRole("region", { name: "Como fazer sua primeira cobrança" }).getByRole("listitem");
    await expect(passos).toHaveCount(5);
    await expect(passos.nth(0)).toContainText("Aguarde a aprovação da sua conta");
    await expect(passos.nth(0).getByRole("link", { name: "Ver status da conta" })).toBeVisible();
    await expect(passos.nth(3)).toContainText("quando o link de pagamento estiver pronto");
    await semOverflow(page);
  });

  test("o menu da conta tem o atalho 'Ajuda'", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app");
    await page.getByRole("button", { name: "Menu da conta" }).or(page.locator("summary[aria-label='Menu da conta']")).first().click();
    await page.getByRole("link", { name: "Ajuda" }).first().click();
    await expect(page).toHaveURL(/\/app\/ajuda$/);
  });
});

/* ------------------------------------------------------------------ */
test.describe("criar antes, conectar depois, retomar (sandbox do provedor)", () => {
  const chave = chaveSandbox();
  let conta: ContaE2E;
  let umaId = "";
  let duasId = "";
  let tresId = "";

  const chamar = async (metodo: string, caminho: string) => {
    const r = await fetch(SANDBOX + caminho, { method: metodo, headers: { access_token: chave as string, "Content-Type": "application/json", "User-Agent": "Zelo-E2E/1.0" } });
    return (await r.json().catch(() => null)) as Record<string, unknown> | null;
  };
  const pagamentosNoProvedor = async (cobrancaId: string) => {
    const r = await chamar("GET", `/payments?externalReference=${cobrancaId}`);
    return (r?.totalCount as number | undefined) ?? -1;
  };

  test.beforeAll(async () => {
    conta = await criarContaE2E("prep-retoma");
    const cli = await novoCliente(conta.empresaId);
    umaId = await novaCobranca(conta.empresaId, cli, { descricao: "Criada antes da conexão — 1" });
    duasId = await novaCobranca(conta.empresaId, cli, { descricao: "Criada antes da conexão — 2" });
    tresId = await novaCobranca(conta.empresaId, cli, { descricao: "Criada antes da conexão — 3" });
  });
  test.afterAll(async () => {
    if (chave) {
      for (const id of [umaId, duasId, tresId]) {
        const { data } = await admin.from("cobrancas").select("asaas_payment_id").eq("id", id).maybeSingle();
        if (data?.asaas_payment_id) await chamar("DELETE", `/payments/${data.asaas_payment_id}`);
      }
      const { data: cli } = await admin.from("clientes").select("asaas_customer_id").eq("empresa_id", conta.empresaId);
      for (const c of cli ?? []) if (c.asaas_customer_id) await chamar("DELETE", `/customers/${c.asaas_customer_id}`);
    }
    await admin.from("asaas_credenciais").delete().eq("empresa_id", conta.empresaId);
    await limparContaE2E(conta);
  });

  test("conectar → abrir a cobrança prepara o link REAL sozinho, sem duplicar; as outras preparam em lote, sem duplicar", async ({ page }) => {
    test.skip(!chave, "sem chave do sandbox do Asaas neste ambiente");
    test.setTimeout(180_000);

    await loginE2E(page, conta);

    // 1. antes de conectar: salva, mas sem link e com a causa
    await page.goto(`/app/cobrancas/${umaId}`);
    await expect(page.getByText(/Conecte sua conta de recebimentos/)).toBeVisible();
    expect(await pagamentosNoProvedor(umaId)).toBe(0);

    // 2. a conta é conectada e aprovada
    await salvarCredencialDaEmpresa(conta.empresaId, chave as string);
    await definirConta(conta.empresaId, { status: "ativa", aprovacao: "APPROVED" });

    // 3. a lista avisa que há cobranças sem link e oferece preparar (ação explícita)
    await page.goto("/app/cobrancas");
    await expect(page.getByRole("heading", { name: "3 cobranças salvas estão sem link de pagamento" })).toBeVisible();

    // 4. abrir uma cobrança: UMA tentativa automática (conta pronta), com link real no fim
    await page.goto(`/app/cobrancas/${umaId}`);
    await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
    const { data: depois } = await admin.from("cobrancas").select("asaas_payment_id, asaas_sync_status, status, valor_centavos").eq("id", umaId).single();
    expect(depois?.asaas_payment_id).toMatch(/^pay_/);
    expect(depois?.asaas_sync_status).toBe("sincronizado");
    expect(depois?.status).toBe("pendente"); // nunca "enviada" nem "paga" só por existir o link
    expect(depois?.valor_centavos).toBe(5000);
    expect(await pagamentosNoProvedor(umaId)).toBe(1);

    // 5. recarregar e abrir de novo NÃO cria outro pagamento
    await page.reload();
    await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toBeVisible({ timeout: 60_000 });
    expect(await pagamentosNoProvedor(umaId)).toBe(1);

    // 6. as outras duas, em lote, a pedido da pessoa
    await page.goto("/app/cobrancas");
    await expect(page.getByRole("heading", { name: "2 cobranças salvas estão sem link de pagamento" })).toBeVisible();
    await page.getByRole("button", { name: "Preparar 2 pagamentos" }).click();
    await expect(page.getByText(/2 pagamentos preparados/).first()).toBeVisible({ timeout: 90_000 });
    expect(await pagamentosNoProvedor(duasId)).toBe(1);
    expect(await pagamentosNoProvedor(tresId)).toBe(1);
    expect(await pagamentosNoProvedor(umaId)).toBe(1);

    // 7. nada mais pendente: o aviso some, e clicar de novo não tem o que fazer
    await page.reload();
    await expect(page.getByRole("heading", { name: /sem link de pagamento/ })).toHaveCount(0);

    // o WhatsApp tem o link real e abrir não muda o estado da cobrança
    await page.context().route(/wa\.me|whatsapp\.com/, (r) => r.abort());
    await page.goto(`/app/cobrancas/${duasId}`);
    const zap = page.getByRole("link", { name: "Enviar pelo WhatsApp" });
    await expect(zap).toBeVisible();
    const href = (await zap.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(href)).toMatch(/Pague aqui: https:\/\/[a-z.]*asaas\.com\//);
    const { data: estadoFinal } = await admin.from("cobrancas").select("status").eq("id", duasId).single();
    expect(estadoFinal?.status).toBe("pendente");
  });
});
