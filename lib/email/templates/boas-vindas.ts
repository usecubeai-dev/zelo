/**
 * Template de boas-vindas — existe porque a Fase 22 pediu explicitamente
 * um template para este evento, mas **não está conectado a nenhum
 * disparo automático**.
 *
 * Por quê: a criação de empresa/membro acontece inteiramente num
 * trigger de banco (`ao_criar_usuario`, em `auth.users`) — não existe
 * hoje nenhum código de aplicação executado no momento do cadastro que
 * pudesse chamar `sendEmail`. Ligar isto exigiria ou (a) alterar o
 * trigger do banco, ou (b) adicionar um novo ponto de disparo na tela de
 * cadastro — as duas são mudanças fora do escopo desta fase ("não faça
 * migração de banco", "não crie funcionalidades não relacionadas"). Ver
 * `ZELO_EMAIL_RESEND_SETUP.md` para os detalhes e o próximo passo.
 */

import { montarEmailBase } from "./layout";
import { escaparHtml, sanitizarCabecalho } from "../sanitizar";

export type DadosTemplateBoasVindas = {
  nomeEmpresa: string;
  siteUrl: string;
};

export function templateBoasVindas(dados: DadosTemplateBoasVindas): {
  subject: string;
  html: string;
  text: string;
} {
  const nomeSeguro = escaparHtml(dados.nomeEmpresa);
  const subject = sanitizarCabecalho(`Bem-vindo ao Zelo, ${dados.nomeEmpresa}!`);
  const url = new URL("/app", dados.siteUrl).toString();

  const paragrafosTexto = [
    "Sua conta foi criada. Você tem 30 dias grátis para cadastrar clientes, criar cobranças e testar o Pix Automático.",
    "Qualquer dúvida, é só responder este e-mail.",
  ];

  const { html, text } = montarEmailBase({
    preheader: "Sua conta Zelo está pronta.",
    titulo: `Bem-vindo ao Zelo, ${nomeSeguro}!`,
    paragrafosHtml: paragrafosTexto.map(escaparHtml),
    paragrafosTexto,
    cta: { texto: "Entrar no Zelo", url },
    tom: "neutro",
  });

  return { subject, html, text };
}
