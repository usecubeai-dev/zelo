/**
 * Template genérico de notificação — usado para toda notificação
 * existente que ganhou e-mail nesta fase (ver `MAPA_TEMPLATE_EMAIL` em
 * `lib/core/notificacoes.ts`). Reaproveita literalmente o mesmo
 * `titulo`/`mensagem`/`link` já computado pelo caso de uso que gerou a
 * notificação in-app — nenhum texto novo é inventado aqui, só embalado
 * num layout de e-mail.
 */

import { montarEmailBase, TomEmail } from "./layout";
import { escaparHtml, sanitizarCabecalho } from "../sanitizar";

export type DadosTemplateNotificacao = {
  titulo: string;
  mensagem: string;
  /** Caminho relativo (ex. "/app/recorrencias") ou já absoluto. `null` = sem CTA (raro; a maioria das notificações tem link). */
  link: string | null;
  tom: TomEmail;
  siteUrl: string;
};

export function templateNotificacao(dados: DadosTemplateNotificacao): {
  subject: string;
  html: string;
  text: string;
} {
  const tituloSeguro = escaparHtml(dados.titulo);
  const mensagemSegura = escaparHtml(dados.mensagem);
  const url = dados.link ? new URL(dados.link, dados.siteUrl).toString() : undefined;

  const { html, text } = montarEmailBase({
    preheader: dados.mensagem,
    titulo: tituloSeguro,
    paragrafosHtml: [mensagemSegura],
    paragrafosTexto: [dados.mensagem],
    cta: url ? { texto: "Abrir no Zelo", url } : undefined,
    tom: dados.tom,
  });

  return { subject: sanitizarCabecalho(dados.titulo), html, text };
}
