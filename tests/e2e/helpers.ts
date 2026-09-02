import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { expect, Page } from "@playwright/test";

/* Mesmo padrão de carregar `.env.local` na mão usado em todo `tools/teste-*.ts`
   — o processo do Playwright não herda o `.env.local` do Next automaticamente. */
function carregarEnv() {
  const arquivo = path.resolve(__dirname, "../../.env.local");
  const conteudo = fs.readFileSync(arquivo, "utf8");
  conteudo.split("\n").forEach((linha) => {
    const l = linha.trim();
    if (l.startsWith("#") || !l.includes("=")) return;
    const i = l.indexOf("=");
    const chave = l.slice(0, i).trim();
    if (!process.env[chave]) process.env[chave] = l.slice(i + 1).trim();
  });
}
carregarEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

export type ContaE2E = { userId: string; empresaId: string; email: string; senha: string };

/** Cria um usuário + empresa (via trigger) já confirmado, pronto pra login real via UI. */
export async function criarContaE2E(prefixo: string): Promise<ContaE2E> {
  const senha = "SenhaTesteE2E123!";
  const email = `e2e_${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@zelo.test`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: `E2E ${prefixo}` },
  });
  if (error) throw new Error(`criarContaE2E: ${error.message}`);
  const userId = data.user!.id;

  const { data: membro, error: eMembro } = await admin
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  if (eMembro) throw new Error(`criarContaE2E (trigger não criou empresa): ${eMembro.message}`);

  return { userId, empresaId: membro.empresa_id as string, email, senha };
}

/**
 * Login real pela UI, compartilhado por toda a suíte.
 *
 * Espera o campo estar visível e confirma o valor gravado antes de
 * seguir — no WebKit (`iPhone 13`), preencher e clicar em sequência
 * rápida demais podia correr contra a hidratação do componente cliente
 * do formulário (`CampoConta`) e o valor se perdia (achado real da
 * Fase 19, só reproduzia no projeto `mobile`, nunca em `desktop`/`tablet`).
 */
export async function loginE2E(page: Page, conta: ContaE2E) {
  await page.goto("/entrar");
  const campoEmail = page.getByRole("textbox", { name: "E-mail" });
  await campoEmail.waitFor({ state: "visible" });
  // `pressSequentially`, não `fill`: no WebKit (`iPhone 13`), `fill` às
  // vezes seta o valor no DOM (passa em `toHaveValue`) sem disparar o
  // evento que sincroniza o estado React do componente controlado —
  // digitar por evento real de teclado fecha esse buraco. Achado real
  // da Fase 19, só reproduzia em WebKit, nunca em desktop/tablet
  // (Chromium).
  await campoEmail.pressSequentially(conta.email);
  await expect(campoEmail).toHaveValue(conta.email);
  const campoSenha = page.getByRole("textbox", { name: "Senha" });
  await campoSenha.pressSequentially(conta.senha);
  await expect(campoSenha).toHaveValue(conta.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app$/);
  // `FormularioLogin` chama `router.refresh()` e depois `router.push()`
  // em sequência (revalida o RSC da sessão, depois navega) — em WebKit
  // as duas operações às vezes ainda estão em voo quando a URL já
  // mudou, e uma navegação seguinte imediata (`page.goto` no teste)
  // pode ser abortada ("interrupted by another navigation to /app").
  // `networkidle` sozinho não bastou (achado real, não suposição — só
  // reduziu a frequência); o assentamento extra fecha o resto.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/**
 * Preenche um campo de texto de forma robusta em qualquer engine —
 * mesmo motivo de `pressSequentially` no login: `fill()` pode deixar o
 * DOM e o estado React de um componente controlado dessincronizados no
 * WebKit. Usar em todo campo de formulário do produto, não só no login.
 */
export async function preencher(campo: import("@playwright/test").Locator, texto: string) {
  await campo.waitFor({ state: "visible" });
  await campo.fill(""); // limpa valor pré-existente (ex.: campo de edição já preenchido) antes de digitar
  await campo.pressSequentially(texto);
  await expect(campo).toHaveValue(texto);
}

/** Remove a conta e tudo que pertence à empresa dela — idempotente, seguro de chamar mais de uma vez. */
export async function limparContaE2E(conta: ContaE2E) {
  const tabelas = ["notificacoes", "log_acoes_financeiras", "cobrancas", "clientes", "recorrencias"];
  for (const t of tabelas) {
    await admin.from(t).delete().eq("empresa_id", conta.empresaId);
  }
  await admin.auth.admin.deleteUser(conta.userId);
}
