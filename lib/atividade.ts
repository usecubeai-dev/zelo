/**
 * Rótulos humanos pra `log_acoes_financeiras.acao` — usados no painel
 * (atividade recente) e na timeline de uma cobrança (Fase 12). Extraído
 * de `app/(app)/app/page.tsx` pra não duplicar entre as duas telas.
 *
 * Cobre as ações mais relevantes pro profissional acompanhar; o
 * fallback (`rotuloAcao`) cobre o resto sem quebrar a tela quando uma
 * ação nova for adicionada em fase futura e ainda não tiver entrado aqui.
 */
export const ROTULO_ACAO: Record<string, string> = {
  cliente_sincronizacao_concluida: "Cliente sincronizado com o Asaas",
  cliente_sincronizacao_recuperada: "Sincronização de cliente recuperada",
  cobranca_sincronizacao_concluida: "Cobrança enviada ao Asaas",
  cobranca_sincronizacao_recuperada: "Envio de cobrança recuperado",
  cobranca_cancelada: "Cobrança cancelada",
  cobranca_cancelada_no_asaas: "Cobrança cancelada no Asaas",
  cobranca_marcada_paga_manualmente: "Cobrança marcada como paga manualmente",
  cobranca_estornada: "Cobrança estornada",
  cobranca_parcialmente_estornada: "Cobrança parcialmente estornada",
  cobranca_reconciliada_paga: "Pagamento confirmado (reconciliação)",
  cobranca_reconciliada_estornada: "Estorno confirmado (reconciliação)",
  cobranca_reconciliada_cancelada: "Cancelamento confirmado (reconciliação)",
  cobranca_chargeback_requested: "Chargeback recebido",
  cobranca_chargeback_dispute: "Chargeback em disputa",
  cobranca_awaiting_chargeback_reversal: "Aguardando resultado da disputa de chargeback",
  cobranca_refund_in_progress: "Estorno em andamento",
  cobranca_refund_denied: "Estorno negado pelo Asaas",
  ciclo_pix_automatico_preparado: "Novo ciclo de cobrança preparado",
  autorizacao_pix_solicitada: "Autorização Pix Automático solicitada",
  autorizacao_pix_criada: "Autorização Pix Automático criada",
  autorizacao_pix_recuperada: "Autorização Pix Automático recuperada",
  autorizacao_pix_active: "Autorização Pix Automático ativada",
  autorizacao_pix_cancelada: "Autorização Pix Automático cancelada",
  autorizacao_pix_refused: "Autorização Pix Automático recusada",
  autorizacao_pix_expired: "Autorização Pix Automático expirada",
  autorizacao_pix_cancelamento_falhou: "Falha ao cancelar autorização no Asaas",
  autorizacao_pix_sync_parcial_falhou: "Autorização criada, mas não espelhada localmente",
  autorizacao_pix_reconciliada_active: "Autorização confirmada ativa (reconciliação)",
  autorizacao_pix_reconciliada_cancelled: "Autorização confirmada cancelada (reconciliação)",
  autorizacao_pix_reconciliada_refused: "Autorização confirmada recusada (reconciliação)",
  autorizacao_pix_reconciliada_expired: "Autorização confirmada expirada (reconciliação)",
  instrucao_pagamento_awaiting_request: "Instrução de pagamento aguardando processamento",
  instrucao_pagamento_scheduled: "Débito automático agendado",
  instrucao_pagamento_refused: "Débito automático recusado",
  instrucao_pagamento_cancelled: "Instrução de pagamento cancelada",
  instrucao_pagamento_descoberta: "Instrução de pagamento descoberta",
  recorrencia_encerrada: "Recorrência encerrada",
  pix_automatico_elegibilidade_atualizada: "Elegibilidade Pix Automático atualizada",
  assinatura_zelo_ativada: "Assinatura Zelo ativada",
  assinatura_zelo_inadimplente: "Pagamento da assinatura Zelo em atraso",
  assinatura_zelo_cancelada: "Assinatura Zelo cancelada",
  autorizacao_email_enviado: "E-mail de autorização enviado ao cliente",
};

export function rotuloAcao(acao: string): string {
  if (ROTULO_ACAO[acao]) return ROTULO_ACAO[acao];
  return acao.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** "há 3h", "há 2 dias" — o suficiente pra uma lista de atividade, sem precisar de data completa. */
export function tempoRelativo(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
