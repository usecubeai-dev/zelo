/**
 * Estado da conta: assinatura e o que isso libera.
 *
 * Sem React e sem DOM — as mesmas regras valem no servidor e na tela. Mas
 * a decisão de acesso que **vale** é a do banco (`public.empresa_liberada`
 * e o RLS). O que está aqui é para explicar o estado ao usuário, nunca
 * para autorizar sozinho.
 *
 * Não existe mais mês grátis: a conta nasce `pendente` e só vira `ativa`
 * quando o primeiro pagamento é CONFIRMADO pelo provedor (webhook) — ou
 * quando o titular escolhe o plano Grátis, que é permanente (não é teste) e
 * não tem mensalidade.
 * `trial` sobrevive apenas como estado legado de contas criadas antes do
 * fim do período grátis — elas mantêm o prazo que já tinham; nenhuma conta
 * nova entra em `trial`.
 */

export type StatusAssinatura =
  | "trial"
  | "pendente"
  | "ativa"
  | "inadimplente"
  | "cancelada"
  | "suspensa";

export type Empresa = {
  id: string;
  nome: string;
  assinatura_status: StatusAssinatura;
  /** Só tem efeito nas contas `trial` legadas. */
  trial_termina_em: string;
  /** Capacidade contratada (limite de clientes) — ver `lib/plano.ts`. */
  plano?: string;
  /** Quando `assinatura_status` mudou pela última vez. Só o webhook grava. */
  assinatura_atualizada_em?: string | null;
};

export type SituacaoConta = {
  status: StatusAssinatura;
  /** pode usar o sistema para criar coisas novas? */
  liberada: boolean;
  /** conta antiga, ainda dentro do prazo de teste que já tinha (legado) */
  carenciaLegada: boolean;
  /** dias inteiros restantes da carência legada; 0 quando não se aplica */
  diasRestantes: number;
  /** falta pagar a mensalidade para liberar (pendente, ou teste legado vencido) */
  aguardandoPagamento: boolean;
};

export function situacaoDaConta(
  empresa: Pick<Empresa, "assinatura_status" | "trial_termina_em">,
  agora: Date = new Date()
): SituacaoConta {
  const status = empresa.assinatura_status;
  const ms = new Date(empresa.trial_termina_em).getTime() - agora.getTime();

  const carenciaLegada = status === "trial" && ms > 0;
  const diasRestantes = carenciaLegada ? Math.ceil(ms / 86_400_000) : 0;
  const trialLegadoVencido = status === "trial" && ms <= 0;

  return {
    status,
    liberada: status === "ativa" || carenciaLegada,
    carenciaLegada,
    diasRestantes,
    aguardandoPagamento: status === "pendente" || trialLegadoVencido,
  };
}

/** Frase curta para a faixa de aviso. Só o que muda a decisão da pessoa. */
export function avisoDaConta(situacao: SituacaoConta): string | null {
  if (situacao.status === "ativa") return null;

  if (situacao.carenciaLegada) {
    return situacao.diasRestantes === 1
      ? "Seu período de teste termina amanhã. Assine para continuar."
      : `Seu período de teste termina em ${situacao.diasRestantes} dias. Assine para continuar.`;
  }
  if (situacao.status === "pendente") {
    return "Escolha um plano para liberar sua conta. O plano Grátis não tem mensalidade.";
  }
  if (situacao.aguardandoPagamento) {
    return "Seu período de teste terminou. Assine para voltar a criar cobranças.";
  }
  if (situacao.status === "inadimplente") {
    return "Encontramos um problema no pagamento da sua assinatura.";
  }
  if (situacao.status === "suspensa") {
    return "Sua assinatura está suspensa.";
  }
  if (situacao.status === "cancelada") {
    return "Sua assinatura está cancelada.";
  }
  return null;
}
