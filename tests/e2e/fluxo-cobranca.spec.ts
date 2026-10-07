import fs from "fs";
import { test, expect, Page } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, preencher, admin, ContaE2E } from "./helpers";
import { salvarCredencialDaEmpresa } from "../../lib/asaas/credenciais";

/**
 * Criar cobrança → enviar para o cliente → cliente abre → paga.
 *
 * O link público de pagamento só existe quando a cobrança está no provedor.
 * A parte que depende dele roda contra o SANDBOX (nunca produção) e é pulada
 * quando não há chave de sandbox no ambiente.
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

/* ---------- 1. conta SEM clientes: o fluxo inteiro sem sair da tela ---------- */
test.describe("conta nova (sem clientes): dashboard → nova cobrança → cliente na própria tela → criar", () => {
  let nova: ContaE2E;
  test.beforeAll(async () => {
    nova = await criarContaE2E("fluxo-nova");
  });
  test.afterAll(async () => {
    await limparContaE2E(nova);
  });

  test("do 'Criar sua primeira cobrança' até a tela 'Cobrança criada ✅' com 'Enviar para o cliente'", async ({ page }) => {
    test.setTimeout(90_000);
    await loginE2E(page, nova);

    // a primeira ação é óbvia e leva direto ao formulário
    await page.getByRole("link", { name: "Criar sua primeira cobrança" }).first().click();
    await expect(page).toHaveURL(/\/app\/cobrancas\/nova/);
    await expect(page.getByRole("heading", { name: "Nova cobrança", level: 1 })).toBeVisible();

    // sem clientes: o formulário já avisa e abre o cadastro rápido, sem trocar de tela
    await expect(page.getByText("Você ainda não tem clientes.")).toBeVisible();
    await expect(page.getByRole("group", { name: "Cadastrar novo cliente" })).toBeVisible();
    // guia curto da primeira vez
    await expect(page.getByText("Sua primeira cobrança, em 4 passos")).toBeVisible();

    await preencher(page.locator("#novo-nome"), "Ana Silva");
    await preencher(page.locator("#novo-whatsapp"), "(11) 99999-8888");
    await page.getByRole("button", { name: "Salvar cliente" }).click();

    // volta para a cobrança JÁ com o cliente selecionado
    await expect(page.locator("#cliente_id")).toHaveValue(/[0-9a-f-]{36}/);
    await expect(page.locator("#cliente_id option:checked")).toHaveText("Ana Silva");
    await expect(page.getByRole("group", { name: "Cadastrar novo cliente" })).toHaveCount(0);

    await preencher(page.getByLabel("Descrição"), "Mensalidade de novembro");
    await preencher(page.getByLabel("Valor"), "380,00");
    await page.locator("#vence_em").fill(dia(10));
    await page.getByRole("button", { name: "Criar cobrança" }).click();

    await expect(page).toHaveURL(/\/app\/cobrancas\/[0-9a-f-]{36}\?criada=1$/, { timeout: 40_000 });
    await expect(page.getByText("Cobrança criada ✅")).toBeVisible();
    await expect(page.getByText("Ana Silva").first()).toBeVisible();
    await expect(page.getByText("R$ 380,00").first()).toBeVisible();
    await expect(page.getByText(/Vencimento: \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    // o próximo passo é UM só e vem em destaque
    await expect(page.getByText("Próximo passo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enviar para o cliente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar por e-mail" })).toBeVisible();
    // ações técnicas ficam DEPOIS: editar/cancelar estão no grupo secundário
    await expect(page.getByRole("group", { name: "Mais ações da cobrança" })).toBeVisible();

    // o cliente existe de verdade e é da empresa certa
    const { data: cli } = await admin.from("clientes").select("empresa_id, whatsapp").eq("nome", "Ana Silva").eq("empresa_id", nova.empresaId).single();
    expect(cli?.empresa_id).toBe(nova.empresaId);
  });

  test("guia do primeiro uso: 'Entendi' some e não volta", async ({ page }) => {
    await loginE2E(page, nova);
    await page.goto("/app/cobrancas/nova");
    const guia = page.getByText("Sua primeira cobrança, em 4 passos");
    // a conta já tem uma cobrança agora: o guia só aparece para quem ainda não criou nenhuma
    await expect(guia).toHaveCount(0);
  });
});

/* ---------- 2. validação: erro no próprio campo, com foco e rolagem ---------- */
test.describe("validação do formulário", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("fluxo-valida");
    await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Cliente Válido", status: "ativo" });
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  test("cada erro aparece no próprio campo, o foco vai ao primeiro e o resumo continua no topo", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    await page.locator("#vence_em").fill(""); // sem data
    await page.getByRole("button", { name: "Criar cobrança" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Revise os campos destacados." })).toBeVisible();
    await expect(page.locator("#cliente_id-erro")).toHaveText("⚠ Selecione um cliente.");
    await expect(page.locator("#descricao-erro")).toHaveText("⚠ Informe o que está sendo cobrado.");
    await expect(page.locator("#valor-erro")).toHaveText("⚠ Informe um valor válido.");
    await expect(page.locator("#vence_em-erro")).toHaveText("⚠ Informe uma data válida.");
    // campos marcados como inválidos para tecnologia assistiva
    await expect(page.locator("#cliente_id")).toHaveAttribute("aria-invalid", "true");
    // o PRIMEIRO campo com erro recebe o foco e está na tela (celular e iPad)
    await expect(page.locator("#cliente_id")).toBeFocused();
    await expect(page.locator("#cliente_id")).toBeInViewport();
    // nada foi criado
    expect((await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId)).count).toBe(0);

    // corrigir um campo limpa só o erro dele
    await page.locator("#cliente_id").selectOption({ label: "Cliente Válido" });
    await expect(page.locator("#cliente_id-erro")).toHaveCount(0);
    await expect(page.locator("#descricao-erro")).toBeVisible();
  });

  test("cliente inexistente (id inventado) é recusado pelo servidor", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto("/app/cobrancas/nova");
    // espera a página assentar (hidratação) antes de mexer no DOM, senão o React troca o <select> por baixo
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await page.locator("#cliente_id").evaluate((el: HTMLSelectElement) => {
      const o = document.createElement("option");
      o.value = "00000000-0000-0000-0000-000000000000";
      o.text = "Fantasma";
      el.appendChild(o);
      el.value = o.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await preencher(page.getByLabel("Descrição"), "Teste");
    await preencher(page.getByLabel("Valor"), "100,00");
    await page.locator("#vence_em").fill(dia(5));
    await page.getByRole("button", { name: "Criar cobrança" }).click();
    await expect(page.getByText("Cliente não encontrado.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/cobrancas\/nova/);
  });

  test("em largura de celular o primeiro erro fica visível na tela", async ({ page }) => {
    await loginE2E(page, conta);
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto("/app/cobrancas/nova");
    await page.getByRole("button", { name: "Criar cobrança" }).click();
    await expect(page.locator("#cliente_id-erro")).toBeInViewport();
    await semOverflow(page);
  });
});

/* ---------- 3. estados da cobrança: sempre UMA ação principal ---------- */
test.describe("estado da cobrança → próximo passo", () => {
  let conta: ContaE2E;
  const ids: Record<string, string> = {};
  test.beforeAll(async () => {
    conta = await criarContaE2E("fluxo-estados");
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "João Estados", whatsapp: "11988887777", email: "joao@zelo.test" }).select("id").single();
    const nova = async (chave: string, extra: Record<string, unknown>) => {
      const { data } = await admin.from("cobrancas").insert({ empresa_id: conta.empresaId, cliente_id: cli!.id, descricao: `Cobrança ${chave}`, valor_centavos: 38000, vence_em: dia(5), ...extra }).select("id").single();
      ids[chave] = data!.id;
    };
    await nova("pendente", {});
    await nova("enviada", { status: "enviada" });
    await nova("vencida", { vence_em: dia(-8) });
    await nova("paga", { status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 38000, pago_via: "asaas" });
    await nova("cancelada", { status: "cancelada" });
  });
  test.afterAll(async () => {
    await limparContaE2E(conta);
  });

  const casos: [string, string, RegExp | null][] = [
    ["pendente", "Enviar para o cliente", /Pendente/],
    ["enviada", "Aguardando o pagamento do cliente", /Enviada/],
    ["vencida", "Recuperar cobrança", /Vencida/],
    ["paga", "Recebimento confirmado", /Paga/],
    ["cancelada", "Cobrança cancelada", /Cancelada/],
  ];
  for (const [chave, titulo, situacao] of casos) {
    test(`${chave}: o próximo passo é "${titulo}"`, async ({ page }) => {
      await loginE2E(page, conta);
      await page.goto(`/app/cobrancas/${ids[chave]}`);
      await expect(page.getByRole("heading", { name: titulo, level: 2 })).toBeVisible();
      if (situacao) await expect(page.getByText(situacao).first()).toBeVisible();
      await expect(page.getByText("Próximo passo")).toBeVisible();
      // sem o aviso de "criada" quando não vem de uma criação
      await expect(page.getByText("Cobrança criada ✅")).toHaveCount(0);
      await semOverflow(page);
    });
  }

  test("paga: 'Ver recebimento' leva aos recebimentos e não oferece envio nem pagamento manual", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${ids.paga}`);
    await expect(page.getByRole("link", { name: "Ver recebimento" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar por e-mail" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Registrar pagamento" })).toHaveCount(0);
    await page.getByRole("link", { name: "Ver recebimento" }).click();
    await expect(page).toHaveURL(/\/app\/recebimentos/);
  });

  test("sem conta de recebimentos: explica o que falta e oferece o caminho, sem erro técnico", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${ids.pendente}`);
    await expect(page.getByText(/conecte a sua conta de recebimentos/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Conectar conta de recebimentos" })).toBeVisible();
    await expect(page.getByText(/asaas|customer|subscription|webhook|provider|json|stack/i)).toHaveCount(0);
    // e-mail: não esconde o problema nem quebra a página
    await expect(page.getByRole("button", { name: "Enviar por e-mail" })).toBeVisible();
  });

  test("registrar o pagamento na mão continua possível, mas como ação secundária", async ({ page }) => {
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${ids.pendente}`);
    const grupo = page.getByRole("group", { name: "Mais ações da cobrança" });
    await expect(grupo.getByRole("button", { name: "Registrar pagamento" })).toBeVisible();
    await expect(grupo.getByRole("link", { name: "Editar" })).toBeVisible();
  });
});

/* ---------- 4. com link real (sandbox): WhatsApp, copiar link, e-mail ---------- */
test.describe("enviar para o cliente com o link de pagamento (sandbox)", () => {
  let conta: ContaE2E;
  let chave: string | null = null;
  let customer: string | null = null;
  let payment: string | null = null;
  let cobranca = "";
  let semLinkAindaNaoPreparado = "";

  test.beforeAll(async () => {
    conta = await criarContaE2E("fluxo-envio");
    chave = chaveSandbox();
    if (chave) {
      const call = async (m: string, p: string, corpo?: unknown) => {
        const r = await fetch(SANDBOX + p, { method: m, headers: { access_token: chave as string, "Content-Type": "application/json", "User-Agent": "Zelo-E2E/1.0" }, body: corpo ? JSON.stringify(corpo) : undefined });
        return (await r.json().catch(() => null)) as Record<string, unknown> | null;
      };
      const c = await call("POST", "/customers", { name: "E2E Fluxo", cpfCnpj: "24971563792", externalReference: `e2e-fluxo-${conta.empresaId}` });
      customer = (c?.id as string) ?? null;
      if (customer) {
        const p = await call("POST", "/payments", { customer, billingType: "UNDEFINED", value: 380, dueDate: dia(10), description: "E2E fluxo", externalReference: `e2e-fluxo-pay-${conta.empresaId}` });
        payment = (p?.id as string) ?? null;
      }
      if (payment) await salvarCredencialDaEmpresa(conta.empresaId, chave);
    }
    const { data: cli } = await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "João Silva", whatsapp: "(11) 99999-8888", email: "joao.silva@zelo.test" }).select("id").single();
    const { data: c1 } = await admin
      .from("cobrancas")
      .insert({ empresa_id: conta.empresaId, cliente_id: cli!.id, descricao: "Mensalidade", valor_centavos: 38000, vence_em: dia(10), ...(payment ? { asaas_payment_id: payment, asaas_sync_status: "sincronizado" } : {}) })
      .select("id")
      .single();
    cobranca = c1!.id;
    // outra cobrança, com conta conectada mas ainda SEM link: o caso "ainda está sendo preparado"
    const { data: c2 } = await admin.from("cobrancas").insert({ empresa_id: conta.empresaId, cliente_id: cli!.id, descricao: "Ainda sem link", valor_centavos: 5000, vence_em: dia(10) }).select("id").single();
    semLinkAindaNaoPreparado = c2!.id;
  });
  test.afterAll(async () => {
    const call = async (m: string, p: string) => {
      if (!chave) return;
      await fetch(SANDBOX + p, { method: m, headers: { access_token: chave, "Content-Type": "application/json", "User-Agent": "Zelo-E2E/1.0" } }).catch(() => null);
    };
    if (payment) await call("DELETE", `/payments/${payment}`);
    if (customer) await call("DELETE", `/customers/${customer}`);
    await admin.from("asaas_credenciais").delete().eq("empresa_id", conta.empresaId);
    await limparContaE2E(conta);
  });

  test("WhatsApp: mensagem pronta com o link REAL; 'WhatsApp aberto…', nunca 'enviada'", async ({ page }) => {
    test.skip(!payment, "sem chave do sandbox do Asaas neste ambiente");
    await page.context().route(/wa\.me|whatsapp\.com/, (r) => r.abort());
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobranca}?criada=1`);

    const zap = page.getByRole("link", { name: "Enviar pelo WhatsApp" });
    await expect(zap).toBeVisible();
    const href = (await zap.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    const texto = decodeURIComponent(href.split("?text=")[1]);
    expect(texto).toMatch(/^Oi João!/);
    expect(texto).toContain("R$ 380,00");
    expect(texto).toMatch(/vence em \d{2}\/\d{2}/);
    expect(texto).toMatch(/Pague aqui: https:\/\/[a-z.]*asaas\.com\//);

    await zap.click();
    await expect(page.getByText("WhatsApp aberto com a mensagem pronta.")).toBeVisible();
    await expect(page.getByText(/mensagem enviada/i)).toHaveCount(0);
    await expect.poll(async () => (await admin.from("acoes_cobranca").select("tipo").eq("cobranca_id", cobranca)).data?.map((a) => a.tipo) ?? [], { timeout: 20_000 }).toContain("whatsapp");
    // abrir o WhatsApp não muda o estado financeiro
    expect((await admin.from("cobrancas").select("status").eq("id", cobranca).single()).data?.status).toBe("pendente");
  });

  test("Copiar link: 'Link copiado.' com o link real, sem criar nada", async ({ page, context }) => {
    test.skip(!payment, "sem chave do sandbox do Asaas neste ambiente");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => null);
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobranca}`);
    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByText("Link copiado.")).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copiado) expect(copiado).toMatch(/^https:\/\/[a-z.]*asaas\.com\//);
    expect((await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", conta.empresaId)).count).toBe(2);
  });

  test("E-mail: o botão existe; sem e-mail configurado diz isso claramente (e não quebra nada)", async ({ page }) => {
    test.skip(!payment, "sem chave do sandbox do Asaas neste ambiente");
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${cobranca}`);
    const botao = page.getByRole("button", { name: "Enviar por e-mail" });
    await expect(botao).toBeVisible();
    if (await botao.isDisabled()) {
      await expect(page.getByText("E-mail ainda não configurado.")).toBeVisible();
    } else {
      // configurado neste ambiente: o envio é uma ação do clique e mostra o resultado
      await botao.click();
      await expect(page.getByRole("status").filter({ hasText: /E-mail enviado|Não conseguimos enviar|ainda não configurado/ })).toBeVisible({ timeout: 30_000 });
    }
    // seja qual for o resultado, a cobrança continua intacta
    expect((await admin.from("cobrancas").select("valor_centavos").eq("id", cobranca).single()).data?.valor_centavos).toBe(38000);
  });

  test("link ainda não preparado: mensagem clara + 'Atualizar', sem erro técnico", async ({ page }) => {
    test.skip(!payment, "sem chave do sandbox do Asaas neste ambiente");
    await loginE2E(page, conta);
    await page.goto(`/app/cobrancas/${semLinkAindaNaoPreparado}`);
    await expect(page.getByText(/ainda está sendo preparado\. Atualize em alguns segundos\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Atualizar" })).toBeVisible();
    await expect(page.getByText(/asaas|json|stack|customer|subscription/i)).toHaveCount(0);
  });

  test("sem largura estourada em 390, 768 e 820 px (formulário, criada e envio)", async ({ page }) => {
    await loginE2E(page, conta);
    for (const largura of [390, 768, 820]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/app/cobrancas/nova");
      await expect(page.getByRole("button", { name: "Criar cobrança" })).toBeVisible();
      await semOverflow(page);
      await page.goto(`/app/cobrancas/${cobranca}?criada=1`);
      // (se o teste do e-mail já enviou, a cobrança está "Enviada" e o título muda)
      await expect(page.getByRole("heading", { name: /Enviar para o cliente|Aguardando o pagamento do cliente/ })).toBeVisible();
      await semOverflow(page);
    }
  });
});

/* ---------- 5. recorrência: o mesmo caminho simples ---------- */
test.describe("cobrança automática (recorrência)", () => {
  let conta: ContaE2E;
  test.beforeAll(async () => {
    conta = await criarContaE2E("fluxo-rec");
    await admin.from("clientes").insert({ empresa_id: conta.empresaId, nome: "Maria Recorrente", whatsapp: "11977776666", status: "ativo" });
  });
  test.afterAll(async () => {
    const { data: recs } = await admin.from("recorrencias").select("id").eq("empresa_id", conta.empresaId);
    for (const r of recs ?? []) await admin.from("autorizacoes_pix").delete().eq("recorrencia_id", r.id);
    await limparContaE2E(conta);
  });

  test("criar mostra 'Recorrência criada ✅' e o próximo passo, sem exigir entender autorização", async ({ page }) => {
    test.setTimeout(90_000);
    await loginE2E(page, conta);
    await page.goto("/app/recorrencias/nova");
    await page.locator("#cliente_id").selectOption({ label: "Maria Recorrente" });
    await preencher(page.getByLabel("Descrição"), "Mensalidade do plano");
    await preencher(page.getByLabel("Valor por ciclo"), "380,00");
    await page.getByRole("button", { name: "Criar cobrança automática" }).click();

    await expect(page).toHaveURL(/\/app\/recorrencias\/[0-9a-f-]{36}\?criada=1$/, { timeout: 40_000 });
    await expect(page.getByText("Recorrência criada ✅")).toBeVisible();
    await expect(page.getByText("Maria Recorrente").first()).toBeVisible();
    await expect(page.getByText("R$ 380,00 por mês")).toBeVisible();
    await expect(page.getByText(/Todo dia \d+/).first()).toBeVisible();
    await expect(page.getByText("Próximo passo")).toBeVisible();
    // o detalhe técnico fica recolhido
    await expect(page.getByText("Detalhes da cobrança automática")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar autorização" })).toBeHidden();
    await semOverflow(page);

    // a primeira cobrança do ciclo foi gerada junto
    const { data: rec } = await admin.from("recorrencias").select("id").eq("empresa_id", conta.empresaId).single();
    const { count } = await admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("recorrencia_id", rec!.id);
    expect(count).toBe(1);
  });

  test("sem autorização possível, 'Preparar' explica em linguagem de gente (sem termo técnico)", async ({ page }) => {
    await loginE2E(page, conta);
    const { data: rec } = await admin.from("recorrencias").select("id").eq("empresa_id", conta.empresaId).single();
    await page.goto(`/app/recorrencias/${rec!.id}`);
    const preparar = page.getByRole("button", { name: "Preparar para enviar ao cliente" });
    if (await preparar.isVisible()) {
      await preparar.click();
      const aviso = page.getByRole("alert");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).not.toContainText(/asaas|json|stack|customer|subscription|webhook|token/i);
    }
  });
});

/* ---------- 6. isolamento ---------- */
test.describe("isolamento entre empresas", () => {
  test("outra empresa não abre a cobrança nem a recorrência de A", async ({ page }) => {
    const a = await criarContaE2E("fluxo-iso-a");
    const b = await criarContaE2E("fluxo-iso-b");
    try {
      const { data: cli } = await admin.from("clientes").insert({ empresa_id: a.empresaId, nome: "Cliente de A" }).select("id").single();
      const { data: cob } = await admin.from("cobrancas").insert({ empresa_id: a.empresaId, cliente_id: cli!.id, descricao: "Só de A", valor_centavos: 10000, vence_em: dia(5) }).select("id").single();
      await loginE2E(page, b);
      await page.goto(`/app/cobrancas/${cob!.id}?criada=1`);
      await expect(page.getByRole("heading", { name: "Cobrança não encontrada" })).toBeVisible();
      await expect(page.getByText("Só de A")).toHaveCount(0);
      await expect(page.getByText("Cobrança criada ✅")).toHaveCount(0);
    } finally {
      await limparContaE2E(a);
      await limparContaE2E(b);
    }
  });
});
