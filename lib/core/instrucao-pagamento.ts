/**
 * Contrato de Instrução de Pagamento — sem React, sem DOM.
 *
 * É o processamento de uma cobrança específica pelo Pix Automático,
 * gerado pelo Asaas a partir do `payment` que o Zelo cria com
 * `pixAutomaticAuthorizationId` — distinto da Cobrança (a obrigação) e
 * da Autorização (o consentimento geral da recorrência). Uma cobrança
 * tem no máximo UMA instrução viva por vez (índice único no banco).
 *
 * O enum de `status` é o enum REAL da API do Asaas — confirmado por
 * leitura direta da API Reference em 01/09/2026 (Fase 7):
 * docs.asaas.com/reference/recuperar-uma-unica-instrucao-de-pagamento-pix-automatico.
 *
 * ⚠ Correção de um erro real: a versão original deste arquivo (Fase 1)
 * usava `CRIADA|AGENDADA|RECUSADA|CANCELADA_EXTERNAMENTE` — nomes
 * inventados antes de qualquer pesquisa de doc, igual ao que já tinha
 * acontecido com `autorizacoes_pix` antes da Fase 6 corrigir. A tabela
 * nunca teve nenhuma linha gravada até a Fase 7, então a correção não
 * exigiu migração de dado — só de schema (migration
 * `fase13_instrucao_pagamento_pix_automatico`).
 */

export type StatusInstrucao = "AWAITING_REQUEST" | "SCHEDULED" | "DONE" | "CANCELLED" | "REFUSED";

export type InstrucaoPagamento = {
  id: string;
  empresa_id: string;
  cobranca_id: string;
  autorizacao_id: string;
  asaas_instruction_id: string | null;
  asaas_payment_id: string | null;
  status: StatusInstrucao;
  due_date: string | null;
  refusal_reason: string | null;
  criado_em: string;
  atualizado_em: string;
  sincronizado_em: string | null;
};

/**
 * Só estes dois estados são "vivos" — é a mesma regra que o índice
 * único `instrucoes_pagamento_uma_por_cobranca` impõe no banco.
 */
const ESTADOS_VIVOS: readonly StatusInstrucao[] = ["AWAITING_REQUEST", "SCHEDULED"];

export function estaViva(status: StatusInstrucao): boolean {
  return ESTADOS_VIVOS.includes(status);
}

/**
 * `DONE` NÃO é sinônimo de "pagamento recebido" — é só o Asaas
 * confirmando que a instrução terminou o processamento dela. A
 * confirmação financeira de verdade continua sendo
 * `cobrancas.status = 'paga'`, ligada aos eventos `PAYMENT_RECEIVED`/
 * `PAYMENT_CONFIRMED` já tratados desde a Fase 5 — nunca inferida daqui
 * (regra explícita da Fase 7, item 12).
 */
export function instrucaoConcluida(status: StatusInstrucao): boolean {
  return status === "DONE";
}

/**
 * Transições reais observadas na doc + inferidas do ciclo de vida
 * documentado (nenhuma inventada além do que os 4 eventos de webhook +
 * o campo `status` da consulta confirmam):
 *
 *   AWAITING_REQUEST → SCHEDULED   (Asaas aceitou, agendou na instituição do pagador)
 *   AWAITING_REQUEST → REFUSED     (recusada antes de agendar)
 *   AWAITING_REQUEST → CANCELLED   (cancelada antes de agendar)
 *   SCHEDULED → DONE               (processada com sucesso)
 *   SCHEDULED → REFUSED            (recusada no processamento — saldo, limite, etc.)
 *   SCHEDULED → CANCELLED          (cancelada depois de agendada — ex.: autorização caiu no meio do caminho)
 *
 * `DONE`, `REFUSED` e `CANCELLED` são terminais.
 */
const TRANSICOES_VALIDAS: Record<StatusInstrucao, readonly StatusInstrucao[]> = {
  AWAITING_REQUEST: ["SCHEDULED", "REFUSED", "CANCELLED"],
  SCHEDULED: ["DONE", "REFUSED", "CANCELLED"],
  DONE: [],
  REFUSED: [],
  CANCELLED: [],
};

export function transicaoValida(de: StatusInstrucao, para: StatusInstrucao): boolean {
  return TRANSICOES_VALIDAS[de].includes(para);
}

/**
 * Quem pode provocar cada transição — mesma disciplina de
 * `lib/core/autorizacao.ts`: nenhum status financeiro muda pela mão do
 * frontend.
 */
export type OrigemTransicao = "webhook" | "caso_de_uso" | "reconciliacao";

const ORIGEM_PERMITIDA: Record<StatusInstrucao, readonly OrigemTransicao[]> = {
  AWAITING_REQUEST: ["caso_de_uso"], // só a descoberta inicial, que já nasce nesse estado
  SCHEDULED: ["webhook", "reconciliacao"],
  DONE: ["reconciliacao"], // não existe evento de webhook pra DONE — só consulta confirma
  REFUSED: ["webhook", "reconciliacao"],
  CANCELLED: ["webhook", "reconciliacao"],
};

export function origemPermitida(para: StatusInstrucao, origem: OrigemTransicao): boolean {
  return ORIGEM_PERMITIDA[para].includes(origem);
}

/**
 * Janela operacional do Pix Automático MANUAL: a doc oficial confirma
 * "crie a instrução de pagamento entre 2 e 10 dias úteis antes do
 * vencimento" (docs.asaas.com/docs/pix-automatico-implementacao,
 * confirmado 01/09/2026 — dias ÚTEIS, não corridos, e a doc não
 * documenta o que acontece se a Zelo enviar fora da janela, então a
 * Zelo trata como precondição própria, recusada ANTES de chamar o
 * Asaas, em vez de deixar a API decidir um comportamento não
 * confirmado).
 *
 * ⚠ LIMITAÇÃO CONHECIDA E DELIBERADA: só fins de semana são excluídos.
 * Feriados nacionais/estaduais/municipais NÃO são considerados — o
 * projeto não tem hoje nenhuma fonte de calendário de feriados
 * brasileiro, e inventar uma tabela fixa seria "inventar calendário
 * bancário", que a fase proíbe explicitamente. Registrado aqui, não
 * escondido: em semanas com feriado, a contagem pode ficar 1 dia útil
 * "otimista" a mais do que o banco do pagador realmente processaria.
 */
function ehFimDeSemana(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia === 0 || dia === 6;
}

/** Dias úteis estritamente entre `hoje` e `vencimento` (contando `vencimento`, não contando `hoje`). Datas em `YYYY-MM-DD`. */
export function diasUteisAte(hoje: string, vencimento: string): number {
  const dataHoje = new Date(`${hoje}T00:00:00Z`);
  const dataVencimento = new Date(`${vencimento}T00:00:00Z`);
  if (dataVencimento <= dataHoje) return 0;

  let contagem = 0;
  const cursor = new Date(dataHoje);
  while (cursor < dataVencimento) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!ehFimDeSemana(cursor)) contagem++;
  }
  return contagem;
}

export type JanelaEnvio = { dentro: true } | { dentro: false; motivo: "cedo_demais" | "tarde_demais"; diasUteis: number };

/** A cobrança do ciclo só deve ser enviada ao Asaas dentro desta janela. */
export function janelaDeEnvio(hoje: string, vencimento: string): JanelaEnvio {
  const dias = diasUteisAte(hoje, vencimento);
  if (dias > 10) return { dentro: false, motivo: "cedo_demais", diasUteis: dias };
  if (dias < 2) return { dentro: false, motivo: "tarde_demais", diasUteis: dias };
  return { dentro: true };
}
