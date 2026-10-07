/**
 * E-mail da COBRANÇA para o cliente final — enviado quando o profissional clica
 * em "Enviar por e-mail". Nunca é disparo automático.
 *
 * Reaproveita a mesma casca visual dos outros e-mails (`montarEmailBase`) e a
 * mesma regra de segurança: todo dado dinâmico (nome do cliente, nome da
 * empresa) passa por `escaparHtml`, e o que vai para o assunto por
 * `sanitizarCabecalho`. O link é o link público de pagamento (já validado por
 * quem chama) — o e-mail não inventa link, não leva CPF/CNPJ nem dado interno.
 */

import { montarEmailBase } from "./layout";
import { escaparHtml, sanitizarCabecalho } from "../sanitizar";

export type DadosTemplateCobrancaCliente = {
  /** primeiro nome do cliente, ou vazio */
  nomeCliente: string;
  nomeEmpresa: string;
  /** já formatado, ex.: "R$ 380,00" */
  valor: string;
  /** já formatado, ex.: "05/11" ou "05/11/2027" */
  vencimento: string;
  situacao: "a_vencer" | "vence_hoje" | "vencida";
  /** link público de pagamento (https, já validado) */
  link: string;
};

export function templateCobrancaCliente(dados: DadosTemplateCobrancaCliente): {
  subject: string;
  html: string;
  text: string;
} {
  const empresa = dados.nomeEmpresa.trim() || "Seu prestador";
  const saudacao = dados.nomeCliente ? `Olá, ${dados.nomeCliente}.` : "Olá.";
  const prazo =
    dados.situacao === "vencida"
      ? `venceu em ${dados.vencimento}`
      : dados.situacao === "vence_hoje"
        ? "vence hoje"
        : `vence em ${dados.vencimento}`;

  const subject = sanitizarCabecalho(`Cobrança de ${empresa}: ${dados.valor}`);
  const titulo = `${empresa} enviou uma cobrança`;

  const paragrafosTexto = [
    saudacao,
    `Você recebeu uma cobrança de ${dados.valor}, que ${prazo}.`,
    "Use o botão abaixo para ver as opções e pagar. Se você já pagou, pode ignorar esta mensagem.",
  ];

  const rodape = `Esta mensagem foi enviada pelo Zelo a pedido de ${empresa}, que usa o Zelo para organizar suas cobranças. Se você não reconhece esta cobrança, fale diretamente com ${empresa}.`;

  const { html, text } = montarEmailBase({
    preheader: `${dados.valor} — ${prazo}`,
    titulo: escaparHtml(titulo),
    paragrafosHtml: paragrafosTexto.map(escaparHtml),
    paragrafosTexto,
    cta: { texto: "Pagar agora", url: dados.link },
    tom: dados.situacao === "vencida" ? "atencao" : "neutro",
    rodape,
  });

  return { subject, html, text };
}
