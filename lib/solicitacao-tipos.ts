/**
 * Tipos de pedido de titular de dados — parte PURA (sem banco, sem Node),
 * para poder ser importada por componentes de formulário. A gravação e a
 * validação estão em `lib/core/solicitacao-titular.ts` (servidor).
 */

export const TIPOS_SOLICITACAO = ["acesso", "correcao", "exclusao", "portabilidade", "outro"] as const;
export type TipoSolicitacao = (typeof TIPOS_SOLICITACAO)[number];

export const ROTULO_SOLICITACAO: Record<TipoSolicitacao, string> = {
  acesso: "Acesso aos meus dados",
  correcao: "Correção de dados",
  exclusao: "Exclusão de dados",
  portabilidade: "Portabilidade dos dados",
  outro: "Outro pedido sobre meus dados",
};

export type StatusSolicitacao = "recebida" | "em_andamento" | "concluida" | "recusada";
export const STATUS_SOLICITACAO: readonly StatusSolicitacao[] = ["recebida", "em_andamento", "concluida", "recusada"];

export const ROTULO_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  recebida: "Recebida",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  recusada: "Recusada",
};
