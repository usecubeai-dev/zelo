import { test, expect } from "@playwright/test";
import { criarContaE2E, limparContaE2E, loginE2E, admin, ContaE2E } from "./helpers";

/**
 * "Enviar pelo WhatsApp" na cobrança — estados que dá para exercitar sem o
 * provedor de pagamento: o link `wa.me` só existe quando a cobrança tem o
 * link público de pagamento do provedor (consulta feita no servidor), o que o
 * ambiente de teste não tem. A montagem do link em si (telefone, mensagem,
 * URL encoding, link público) é coberta em `tools/teste-whatsapp.ts`.
 */

let conta: ContaE2E;
let clienteComFone: string;
let clienteSemFone: string;
let cobrancaSemLink: string;
let cobrancaSemFone: string;
let cobrancaPaga: string;

const amanha = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

test.beforeAll(async () => {
  conta = await criarContaE2E("whatsapp");
  const novoCliente = async (nome: string, whatsapp: string | null) => {
    const { data, error } = await admin
      .from("clientes")
      .insert({ empresa_id: conta.empresaId, nome, whatsapp })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };
  const novaCobranca = async (clienteId: string, descricao: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await admin
      .from("cobrancas")
      .insert({ empresa_id: conta.empresaId, cliente_id: clienteId, descricao, valor_centavos: 38050, vence_em: amanha(), ...extra })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  clienteComFone = await novoCliente("José Antônio da Silva", "(11) 99999-8888");
  clienteSemFone = await novoCliente("Maria Sem Telefone", null);
  cobrancaSemLink = await novaCobranca(clienteComFone, "Mensalidade com fone, sem link");
  cobrancaSemFone = await novaCobranca(clienteSemFone, "Mensalidade sem telefone");
  cobrancaPaga = await novaCobranca(clienteComFone, "Mensalidade já paga", {
    status: "paga",
    pago_em: new Date().toISOString(),
    valor_pago_centavos: 38050,
    pago_via: "asaas",
  });
});

test.afterAll(async () => {
  await limparContaE2E(conta);
});

const semOverflow = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

test("cobrança em aberto sem link de pagamento: avisa com clareza e NÃO inventa link", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto(`/app/cobrancas/${cobrancaSemLink}`);

  await expect(page.getByText(/ainda não possui link de pagamento/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveCount(0);
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await semOverflow(page);

  // só olhar a tela não muda nada na cobrança
  const { data } = await admin.from("cobrancas").select("status").eq("id", cobrancaSemLink).single();
  expect(data?.status).toBe("pendente");
});

test("cliente sem WhatsApp válido: mensagem clara e caminho para corrigir o cadastro", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto(`/app/cobrancas/${cobrancaSemFone}`);

  await expect(page.getByText("Este cliente não possui um WhatsApp válido cadastrado.")).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await semOverflow(page);

  await page.getByRole("link", { name: "Corrigir o cadastro do cliente" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/clientes/${clienteSemFone}/editar$`));
});

test("cobrança já paga não oferece envio pelo WhatsApp", async ({ page }) => {
  await loginE2E(page, conta);
  await page.goto(`/app/cobrancas/${cobrancaPaga}`);

  await expect(page.getByText("Registrar pagamento")).toHaveCount(0);
  await expect(page.getByText(/WhatsApp/)).toHaveCount(0);
  await semOverflow(page);
});
