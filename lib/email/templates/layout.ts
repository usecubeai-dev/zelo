/**
 * Casca visual compartilhada de todo e-mail do Zelo — cabeçalho com a
 * marca, um único cartão de conteúdo, CTA opcional, rodapé. Nenhum
 * template monta HTML de e-mail do zero; todos passam por aqui.
 *
 * Regras de e-mail HTML (diferentes de CSS de página normal):
 * - Tabelas para layout, não flexbox/grid (suporte real em clientes de
 *   e-mail antigos, incluindo Outlook desktop).
 * - CSS inline, nunca `<style>` externo nem classes — muitos clientes
 *   removem `<style>` do `<head>`.
 * - Largura máxima ~560px — legível tanto em desktop quanto no celular
 *   sem precisar de media query (que boa parte dos clientes ignora).
 *
 * Cores: as mesmas 4 tokens de marca de `app/product-tokens.css`
 * (`--violet`, `--success`, `--warning`, `--danger`) — não inventadas
 * para o e-mail, copiadas literalmente para manter a identidade visual
 * coerente com o produto (pedido explícito desta fase).
 */

import { escaparHtml } from "../sanitizar";

export type TomEmail = "neutro" | "atencao" | "sucesso" | "erro";

const CORES: Record<TomEmail, string> = {
  neutro: "#6C3BFF", // --violet
  atencao: "#96702A", // --warning
  sucesso: "#16805C", // --success
  erro: "#B23B3B", // --danger
};

const TEXTO_PRIMARIO = "#14201C";
const TEXTO_SECUNDARIO = "#45504C";
const TEXTO_MUTED = "#5F6965";
const FUNDO = "#F6F7F6";
const SUPERFICIE = "#FFFFFF";
const VIOLET = "#6C3BFF";

export type OpcoesLayout = {
  /** Texto de preview mostrado pela caixa de entrada antes de abrir — nunca visível no corpo. Pode ser texto cru (não precisa vir pré-escapado); esta função escapa antes de interpolar. */
  preheader: string;
  titulo: string;
  /** Já em HTML seguro — quem chama já passou dado dinâmico por `escaparHtml`. */
  paragrafosHtml: string[];
  /** Mesmo conteúdo, em texto puro (alternativa `text/plain`). */
  paragrafosTexto: string[];
  cta?: { texto: string; url: string };
  tom: TomEmail;
};

export function montarEmailBase(opcoes: OpcoesLayout): { html: string; text: string } {
  const cor = CORES[opcoes.tom];
  // `preheader` é o único campo que este arquivo interpola sem esperar
  // que o chamador já tenha escapado (`paragrafosHtml`/`titulo` são
  // contrato do chamador — ver tipos abaixo) — por isso é escapado aqui,
  // e não no chamador, evitando duplo-escape se algum dia herdar o mesmo
  // texto de `paragrafosHtml`.
  const preheaderSeguro = escaparHtml(opcoes.preheader);

  const paragrafosHtml = opcoes.paragrafosHtml
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXTO_SECUNDARIO};">${p}</p>`
    )
    .join("\n");

  const botao = opcoes.cta
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      <tr>
        <td style="border-radius:8px;background:${VIOLET};">
          <a href="${opcoes.cta.url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
            ${opcoes.cta.texto}
          </a>
        </td>
      </tr>
    </table>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opcoes.titulo}</title>
  </head>
  <body style="margin:0;padding:0;background:${FUNDO};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${FUNDO};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheaderSeguro}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 4px 20px;">
                <span style="font-size:20px;font-weight:700;color:${TEXTO_PRIMARIO};letter-spacing:-0.02em;">Zelo</span>
              </td>
            </tr>
            <tr>
              <td style="background:${SUPERFICIE};border-radius:12px;border-left:4px solid ${cor};padding:28px 28px 24px;">
                <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:${TEXTO_PRIMARIO};">${opcoes.titulo}</h1>
                ${paragrafosHtml}
                ${botao}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXTO_MUTED};">
                  Este é um e-mail transacional do Zelo, enviado por causa de uma ação ou evento na sua conta — não uma campanha de marketing.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Zelo",
    "",
    opcoes.titulo,
    "",
    ...opcoes.paragrafosTexto,
    opcoes.cta ? `\n${opcoes.cta.texto}: ${opcoes.cta.url}` : "",
    "\n—\nEste é um e-mail transacional do Zelo, enviado por causa de uma ação ou evento na sua conta.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { html, text };
}
