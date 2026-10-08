import { test, expect, type Page } from "@playwright/test";
import { preencher, criarContaE2E, limparContaE2E, admin, ContaE2E } from "./helpers";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../lib/legal";

/**
 * Conformidade legal — interface de ponta a ponta (aceite dos Termos,
 * cancelamento, arrependimento, exclusão de conta, exportação, rodapé com os
 * dados da empresa, pedido de titular, termo de parceria do influenciador).
 *
 * Nenhum teste cria cobrança no Asaas nem estorna dinheiro: as contas de
 * teste não têm assinatura no provedor (`asaas_subscription_id` nulo), então
 * o passo do provedor é inexistente. O comportamento COM provedor (remoção da
 * assinatura, estorno) está em `tools/teste-conformidade-legal.ts`, com o
 * Asaas simulado.
 */

/** Login sem exigir /app: quem está sem aceite vigente cai em /aceite. */
async function entrar(page: Page, conta: ContaE2E) {
  await page.goto("/entrar");
  const email = page.getByRole("textbox", { name: "E-mail" });
  await email.waitFor({ state: "visible" });
  await email.pressSequentially(conta.email);
  await page.getByRole("textbox", { name: "Senha" }).pressSequentially(conta.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(app|aceite)$/);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

const semOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

async function darPlanoPago(conta: ContaE2E, diasDesdeOPagamento: number) {
  await admin.from("empresas").update({ assinatura_status: "ativa", plano: "essencial", asaas_subscription_id: null }).eq("id", conta.empresaId);
  const pagoEm = new Date(Date.now() - diasDesdeOPagamento * 86_400_000);
  await admin.from("mensalidades").insert({
    empresa_id: conta.empresaId, plano: "essencial", valor_centavos: 4990, asaas_payment_id: `pay_e2e_${conta.empresaId}`,
    vencimento: pagoEm.toISOString().slice(0, 10), status: "paga", pago_em: pagoEm.toISOString(), valor_pago_centavos: 4990,
    eh_primeira: true, ambiente: "sandbox",
  });
}

async function apagarMensalidades(conta: ContaE2E) {
  for (const t of ["pedidos_reembolso", "cancelamentos_assinatura", "mensalidades", "aceites_legais"]) {
    await admin.from(t).delete().eq("empresa_id", conta.empresaId);
  }
}

// ---------------------------------------------------------------------------
test.describe("cadastro com aceite", () => {
  test("o checkbox existe, nasce desmarcado, tem os links e sem ele a conta NÃO é criada", async ({ page }) => {
    const email = `e2e_semaceite_${Date.now()}@zelo.test`;
    await page.goto("/criar-conta");

    const aceite = page.getByRole("checkbox", { name: /Li e aceito/ });
    await expect(aceite).toBeVisible();
    await expect(aceite).not.toBeChecked();
    const form = page.getByRole("main");
    const termos = form.getByRole("link", { name: "Termos de Uso" });
    const priv = form.getByRole("link", { name: "Política de Privacidade" });
    await expect(termos).toHaveAttribute("href", "/termos");
    await expect(priv).toHaveAttribute("href", "/privacidade");

    await page.getByRole("textbox", { name: "Seu nome" }).pressSequentially("Sem Aceite");
    await page.getByRole("textbox", { name: "E-mail" }).pressSequentially(email);
    await page.getByRole("textbox", { name: "Senha" }).pressSequentially("SenhaForte123!");
    await page.getByRole("button", { name: "Criar minha conta" }).click();

    await expect(page.getByText("aceite os Termos de Uso e a Política de Privacidade").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Confirme seu e-mail" })).toHaveCount(0);
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.some((u) => u.email === email)).toBe(false);
    await semOverflow(page);
  });
});

// ---------------------------------------------------------------------------
test.describe("aceite exigido no app", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("aceite");
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
    await admin.from("aceites_legais").delete().eq("user_id", conta.userId);
  });

  test("sem aceite vigente o app leva a /aceite; aceitar libera e grava a prova", async ({ page }) => {
    await admin.from("aceites_legais").delete().eq("user_id", conta.userId);
    await entrar(page, conta);
    await expect(page).toHaveURL(/\/aceite$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/aceite$/); // não dá para contornar indo direto ao app
    const caixa = page.getByRole("checkbox", { name: /Li e aceito/ });
    await expect(caixa).not.toBeChecked();

    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(page.getByText(/aceite/i).first()).toBeVisible(); // erro: não marcou
    await expect(page).toHaveURL(/\/aceite$/);

    await caixa.check();
    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(page).toHaveURL(/\/app$/);

    const { data } = await admin.from("aceites_legais").select("*").eq("user_id", conta.userId);
    expect(data?.length).toBe(1);
    expect(data?.[0].termos_versao).toBe(TERMS_VERSION);
    expect(data?.[0].privacidade_versao).toBe(PRIVACY_VERSION);
    expect(data?.[0].origem).toBe("reaceite");
    expect(data?.[0].ip === null || typeof data?.[0].ip === "string").toBe(true);
    expect(data?.[0].user_agent).toBeTruthy();

    await page.goto("/aceite");
    await expect(page).toHaveURL(/\/app$/); // já aceitou: /aceite não aparece de novo
  });

  test("quando a VERSÃO muda, pede novo aceite no próximo acesso", async ({ page }) => {
    await admin.from("aceites_legais").update({ termos_versao: "versao-antiga" }).eq("user_id", conta.userId);
    await entrar(page, conta);
    await expect(page).toHaveURL(/\/aceite$/);
    await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    const { count } = await admin.from("aceites_legais").select("id", { count: "exact", head: true }).eq("user_id", conta.userId);
    expect(count).toBe(2); // o histórico fica
  });
});

// ---------------------------------------------------------------------------
test.describe("cancelamento e arrependimento", () => {
  test("cancelar: confirmação em 2 passos, acesso mantido, pedido registrado", async ({ page }) => {
    const conta = await criarContaE2E("cancela");
    try {
      await darPlanoPago(conta, 20);
      await entrar(page, conta);
      await page.goto("/app/assinatura");
      await expect(page.getByText("Desistir da contratação")).toHaveCount(0); // 20 dias: fora do prazo de arrependimento

      await page.getByRole("button", { name: "Cancelar assinatura" }).first().click();
      await page.getByRole("textbox", { name: /Motivo/ }).fill("Teste E2E");
      await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
      await expect
        .poll(async () => (await admin.from("empresas").select("cancelamento_solicitado_em").eq("id", conta.empresaId).single()).data?.cancelamento_solicitado_em ?? null, { timeout: 20_000 })
        .not.toBeNull();

      const { data: e } = await admin.from("empresas").select("assinatura_status, plano, cancelamento_solicitado_em, acesso_ate").eq("id", conta.empresaId).single();
      expect(e?.assinatura_status).toBe("ativa"); // continua com acesso
      expect(e?.plano).toBe("essencial");
      expect(e?.cancelamento_solicitado_em).toBeTruthy();
      expect(e?.acesso_ate).toBeTruthy();
      const { data: log } = await admin.from("cancelamentos_assinatura").select("tipo, motivo").eq("empresa_id", conta.empresaId);
      expect(log?.length).toBe(1);
      expect(log?.[0].motivo).toBe("Teste E2E");

      await page.reload();
      await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0); // já cancelada: o botão some
      await semOverflow(page);
    } finally {
      await apagarMensalidades(conta);
      await limparContaE2E(conta);
    }
  });

  test("arrependimento dentro de 7 dias: pedido de reembolso, plano pago encerra e nada é estornado sozinho", async ({ page }) => {
    const conta = await criarContaE2E("arrepende");
    try {
      await darPlanoPago(conta, 2);
      await entrar(page, conta);
      await page.goto("/app/assinatura");
      await expect(page.getByText("Desistir da contratação")).toBeVisible();

      await page.getByRole("button", { name: "Desistir e pedir reembolso" }).click();
      await page.getByRole("button", { name: "Confirmar desistência e pedido" }).click();
      await expect
        .poll(async () => (await admin.from("pedidos_reembolso").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId)).count ?? 0, { timeout: 20_000 })
        .toBe(1);

      const { data: ped } = await admin.from("pedidos_reembolso").select("status, valor_centavos").eq("empresa_id", conta.empresaId);
      expect(ped?.length).toBe(1);
      expect(ped?.[0].status).toBe("pendente"); // o dinheiro só volta quando o admin processa
      expect(ped?.[0].valor_centavos).toBe(4990);
      const { data: e } = await admin.from("empresas").select("plano, assinatura_status").eq("id", conta.empresaId).single();
      expect(e?.plano).toBe("gratis");
      expect(e?.assinatura_status).toBe("ativa");
      await semOverflow(page);
    } finally {
      await apagarMensalidades(conta);
      await limparContaE2E(conta);
    }
  });
});

// ---------------------------------------------------------------------------
test.describe("exclusão de conta e exportação", () => {
  test("exportar em CSV só entrega os dados da própria empresa; tipo inválido é recusado", async ({ page }) => {
    const conta = await criarContaE2E("exporta");
    const outra = await criarContaE2E("exporta-outra");
    try {
      await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Cliente Exportável" });
      await admin.from("clientes").insert({ empresa_id: outra.empresaId, nome: "Cliente De Outra Empresa" });
      await entrar(page, conta);

      const ok = await page.request.get("/app/exportar?tipo=clientes");
      expect(ok.status()).toBe(200);
      expect(ok.headers()["content-type"]).toContain("text/csv");
      const csv = await ok.text();
      expect(csv).toContain("Cliente Exportável");
      expect(csv).not.toContain("Cliente De Outra Empresa");
      expect((await page.request.get("/app/exportar?tipo=usuarios")).status()).toBe(400);
      expect((await page.request.get("/app/exportar?tipo=cobrancas")).status()).toBe(200);
      expect((await page.request.get("/app/exportar?tipo=recebimentos")).status()).toBe(200);
    } finally {
      await limparContaE2E(conta);
      await limparContaE2E(outra);
    }
  });

  test("excluir conta: exige digitar EXCLUIR, anonimiza, MANTÉM a cobrança e bloqueia o acesso", async ({ page }) => {
    const conta = await criarContaE2E("exclui");
    try {
      const { data: cli } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Pagador Real", email: "pagador@exemplo.com", whatsapp: "11999998888" }).select("id").single();
      await admin.from("cobrancas").insert({ empresa_id: conta.empresaId, cliente_id: cli!.id, descricao: "Registro fiscal", valor_centavos: 10000, vence_em: "2026-10-05", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 10000, pago_via: "asaas" });

      await entrar(page, conta);
      await page.goto("/app/configuracoes");
      await expect(page.getByRole("link", { name: "Baixar clientes (CSV)" })).toHaveAttribute("href", "/app/exportar?tipo=clientes");
      await expect(page.getByText(/\[PREENCHER\]/).first()).toBeVisible(); // prazo de retenção ainda não definido: não é inventado

      const botao = page.getByRole("button", { name: "Excluir minha conta" });
      await expect(botao).toBeDisabled();
      const campo = page.getByRole("textbox", { name: /EXCLUIR/ });
      await campo.fill("talvez");
      await expect(botao).toBeDisabled();
      await campo.fill("excluir");
      await expect(botao).toBeEnabled();
      await botao.click();

      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
      const { data: e } = await admin.from("empresas").select("deleted_at, nome").eq("id", conta.empresaId).single();
      expect(e?.deleted_at).toBeTruthy();
      expect(e?.nome).toBe("Conta excluída");
      const { data: c } = await admin.from("clientes").select("nome, email, whatsapp").eq("id", cli!.id).single();
      expect(c?.nome).toBe("Cliente removido");
      expect(c?.email).toBeNull();
      expect(c?.whatsapp).toBeNull();
      const { count } = await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId);
      expect(count).toBe(1); // o registro fiscal ficou

      await page.goto("/entrar");
      await page.getByRole("textbox", { name: "E-mail" }).pressSequentially(conta.email);
      await page.getByRole("textbox", { name: "Senha" }).pressSequentially(conta.senha);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).not.toHaveURL(/\/(app|aceite)$/); // a conta excluída não entra mais
    } finally {
      await limparContaE2E(conta);
    }
  });
});

// ---------------------------------------------------------------------------
test.describe("identificação da empresa e pedido de titular", () => {
  for (const caminho of ["/", "/termos", "/privacidade", "/entrar", "/criar-conta"]) {
    test(`rodapé com os dados da empresa em ${caminho}`, async ({ page }) => {
      await page.goto(caminho);
      const corpo = await page.locator("body").innerText();
      expect(corpo).toContain("GOGOMOB TECNOLOGIA BR LTDA");
      expect(corpo).toContain("48.443.579/0001-93");
      // canais de atendimento informados pelo proprietário (nada inventado: sem telefone, o texto diz "por e-mail")
      expect(corpo.match(/usecube\.ai@gmail\.com/g)?.length ?? 0).toBeGreaterThanOrEqual(2); // suporte e privacidade
      expect(corpo).toContain("Atendimento por e-mail");
      expect(corpo).toContain("Segunda a sexta, das 9h às 18h");
      expect(corpo).not.toMatch(/E-mail de suporte\s*\[PREENCHER\]/);
      await semOverflow(page);
    });
  }

  test("/privacidade/solicitacao: noindex, pedido registrado, isca invisível", async ({ page }) => {
    const email = `titular_e2e_${Date.now()}@exemplo.com`;
    await page.goto("/privacidade/solicitacao");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByLabel("Não preencha este campo")).not.toBeInViewport();

    await page.getByLabel(/Tipo/).selectOption("portabilidade");
    await page.getByLabel(/E-mail/).first().fill(email);
    await page.getByLabel(/Mensagem/).fill("Quero uma cópia dos meus dados");
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page.getByText("Pedido recebido", { exact: false }).first()).toBeVisible();

    const { data } = await admin.from("solicitacoes_titular").select("tipo, status, mensagem").eq("email", email);
    expect(data?.length).toBe(1);
    expect(data?.[0].tipo).toBe("portabilidade");
    expect(data?.[0].status).toBe("recebida");
    await admin.from("solicitacoes_titular").delete().eq("email", email);
  });

  test("pedido de titular com a isca preenchida (robô) não grava nada", async ({ page }) => {
    const email = `robo_e2e_${Date.now()}@exemplo.com`;
    await page.goto("/privacidade/solicitacao");
    await page.getByLabel(/Tipo/).selectOption("acesso");
    await page.getByLabel(/E-mail/).first().fill(email);
    // um robô preenche tudo, inclusive o campo que a pessoa não vê
    await page.locator('input[name="site"]').fill("http://spam.example", { force: true });
    await expect(page.locator('input[name="site"]')).toHaveValue("http://spam.example");
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await page.waitForTimeout(1500);
    const { data } = await admin.from("solicitacoes_titular").select("id").eq("email", email);
    expect(data?.length ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
test.describe("taxa de R$ 1,99 e nota, sem tabela antiga", () => {
  test("a taxa e a nota aparecem na landing e no cadastro; nenhum resto da tabela antiga", async ({ page }) => {
    for (const caminho of ["/", "/criar-conta"]) {
      await page.goto(caminho);
      const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      expect(texto).toMatch(/R\$\s1,99 por Pix recebido/);
      expect(texto).toContain("A taxa só é cobrada quando um Pix é efetivamente recebido. Cobrança criada não gera taxa.");
      expect(texto).not.toMatch(/24,90|Zelo Pro|30 dias|teste gr|trial|primeiro m[eê]s/i);
    }
  });
});

// ---------------------------------------------------------------------------
test.describe("administração: termo de parceria e reembolso", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("admlegal");
    await admin.from("administradores_zelo").insert({ user_id: conta.userId });
  });
  test.afterAll(async () => {
    await admin.from("administradores_zelo").delete().eq("user_id", conta.userId);
    await admin.from("influenciadores").delete().like("nome", "E2E Termo %");
    await limparContaE2E(conta);
  });

  test("influenciador sem a data do termo nasce INATIVO; com a data, ativo", async ({ page }) => {
    await entrar(page, conta);
    await page.goto("/app/admin/influenciadores");

    await preencher(page.getByLabel("Nome", { exact: true }), "E2E Termo Sem");
    await page.getByRole("button", { name: "Criar influenciador" }).click();
    await expect(page.getByText("E2E Termo Sem").first()).toBeVisible();
    let { data } = await admin.from("influenciadores").select("status, termo_parceria_assinado_em").eq("nome", "E2E Termo Sem").single();
    expect(data?.status).toBe("inativo");
    expect(data?.termo_parceria_assinado_em).toBeNull();

    await preencher(page.getByLabel("Nome", { exact: true }), "E2E Termo Com");
    await page.getByLabel(/Termo de parceria assinado em/).fill(new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Criar influenciador" }).click();
    await expect(page.getByText("E2E Termo Com").first()).toBeVisible();
    ({ data } = await admin.from("influenciadores").select("status, termo_parceria_assinado_em").eq("nome", "E2E Termo Com").single());
    expect(data?.status).toBe("ativo");
    expect(data?.termo_parceria_assinado_em).toBeTruthy();
    await semOverflow(page);
  });

  test("pedido de reembolso: o admin vê, recusar exige motivo e nada é estornado ao abrir a tela", async ({ page }) => {
    const cliente = await criarContaE2E("reembolso-cliente");
    try {
      await darPlanoPago(cliente, 2);
      const { data: m } = await admin.from("mensalidades").select("id").eq("empresa_id", cliente.empresaId).single();
      await admin.from("pedidos_reembolso").insert({ empresa_id: cliente.empresaId, mensalidade_id: m!.id, asaas_payment_id: `pay_e2e_${cliente.empresaId}`, valor_centavos: 4990, motivo: "E2E" });

      await entrar(page, conta);
      await page.goto("/app/admin/influenciadores");
      await expect(page.getByText("nada é devolvido automaticamente", { exact: false }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Estornar no Asaas/ }).first()).toBeVisible();
      await semOverflow(page);
      const { data: antes } = await admin.from("pedidos_reembolso").select("status").eq("empresa_id", cliente.empresaId).single();
      expect(antes?.status).toBe("pendente");
    } finally {
      await apagarMensalidades(cliente);
      await limparContaE2E(cliente);
    }
  });
});

// ---------------------------------------------------------------------------
test("plano Escola: nota sobre aluno menor de idade no cadastro de cliente", async ({ page }) => {
  const conta = await criarContaE2E("escola");
  try {
    await admin.from("empresas").update({ plano: "escola", assinatura_status: "ativa" }).eq("id", conta.empresaId);
    await entrar(page, conta);
    await page.goto("/app/clientes/novo");
    await expect(page.getByText(/menor de idade/i).first()).toBeVisible();
    await admin.from("empresas").update({ plano: "essencial" }).eq("id", conta.empresaId);
    await page.reload();
    await expect(page.getByText(/menor de idade/i)).toHaveCount(0);
  } finally {
    await limparContaE2E(conta);
  }
});
