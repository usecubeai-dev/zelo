/**
 * E-mail para o cliente final AUTORIZAR a cobrança automática (Pix Automático) —
 * enviado só quando o profissional clica em "Enviar por e-mail". Mesma casca e
 * mesma regra de segurança de `cobranca-cliente.ts`: dado dinâmico escapado, link
 * validado por quem chama, nenhum dado interno.
 */

import { montarEmailBase } from "./layout";
import { escaparHtml, sanitizarCabecalho } from "../sanitizar";

export type DadosTemplateAutorizacaoCliente = {
  nomeCliente: string;
  nomeEmpresa: string;
  /** já formatado, ex.: "R$ 380,00" */
  valor: string;
  /** dia do mês da cobrança */
  diaVencimento: number;
  /** link público de autorização (https, já validado) */
  link: string;
};

export function templateAutorizacaoCliente(dados: DadosTemplateAutorizacaoCliente): {
  subject: string;
  html: string;
  text: string;
} {
  const empresa = dados.nomeEmpresa.trim() || "Seu prestador";
  const saudacao = dados.nomeCliente ? `Olá, ${dados.nomeCliente}.` : "Olá.";
  const subject = sanitizarCabecalho(`${empresa}: autorize sua cobrança automática`);

  const paragrafosTexto = [
    saudacao,
    `${empresa} vai cobrar ${dados.valor} por mês, todo dia ${dados.diaVencimento}.`,
    "Use o botão abaixo para autorizar a cobrança automática. Você faz isso uma vez e as próximas cobranças acontecem sozinhas.",
  ];

  const rodape = `Esta mensagem foi enviada pelo Zelo a pedido de ${empresa}, que usa o Zelo para organizar suas cobranças. Se você não reconhece esta cobrança, fale diretamente com ${empresa}.`;

  const { html, text } = montarEmailBase({
    preheader: `${dados.valor} por mês — autorize a cobrança automática`,
    titulo: escaparHtml(`${empresa} pediu a sua autorização`),
    paragrafosHtml: paragrafosTexto.map(escaparHtml),
    paragrafosTexto,
    cta: { texto: "Autorizar cobrança automática", url: dados.link },
    tom: "neutro",
    rodape,
  });

  return { subject, html, text };
}
