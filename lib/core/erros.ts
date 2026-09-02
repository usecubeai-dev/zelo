/**
 * Erros de domínio do core financeiro.
 *
 * Sem React, sem DOM, sem `fetch` — um `ErroDominio` é um valor que os
 * casos de uso (`lib/core/*`) retornam, não uma exceção lançada. Forçar
 * quem chama a olhar o tipo antes de decidir o que mostrar ao usuário é
 * o que impede um `error.message` do Postgres ou do Asaas vazar direto
 * pra tela — a mesma disciplina que `lib/asaas/webhook.ts` já aplica ao
 * logar só o código do erro, nunca a mensagem crua.
 */

export type TipoErroDominio =
  | "validacao"
  | "conflito"
  | "nao_encontrado"
  | "integracao_externa"
  | "autorizacao"
  | "infraestrutura";

export type ErroDominio = {
  tipo: TipoErroDominio;
  /** Mensagem segura para o usuário — nunca a mensagem crua de baixo nível. */
  mensagem: string;
  /** Só para log do servidor. Nunca serializar isto numa resposta HTTP. */
  detalheInterno?: string;
};

const MENSAGENS_PADRAO: Record<TipoErroDominio, string> = {
  validacao: "Alguns dados não são válidos.",
  conflito: "Esta operação não pode ser feita agora.",
  nao_encontrado: "Não encontramos o que você está procurando.",
  integracao_externa: "Não foi possível falar com o Asaas agora. Tente novamente.",
  autorizacao: "Você não tem permissão para fazer isso.",
  infraestrutura: "Algo deu errado do nosso lado. Tente novamente em instantes.",
};

export function erroDominio(
  tipo: TipoErroDominio,
  mensagem?: string,
  detalheInterno?: string
): ErroDominio {
  return { tipo, mensagem: mensagem ?? MENSAGENS_PADRAO[tipo], detalheInterno };
}

/** Resultado padrão de um caso de uso: ou deu certo, ou é um erro tipado. */
export type ResultadoDominio<T> = { ok: true; dado: T } | { ok: false; erro: ErroDominio };

export function ok<T>(dado: T): ResultadoDominio<T> {
  return { ok: true, dado };
}

export function falha<T = never>(
  tipo: TipoErroDominio,
  mensagem?: string,
  detalheInterno?: string
): ResultadoDominio<T> {
  return { ok: false, erro: erroDominio(tipo, mensagem, detalheInterno) };
}
