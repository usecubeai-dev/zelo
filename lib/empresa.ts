/**
 * Estado da conta: trial, assinatura e o que isso libera.
 *
 * Sem React e sem DOM — as mesmas regras valem no servidor e na tela. Mas
 * a decisão de acesso que **vale** é a do banco (`public.empresa_liberada`
 * e o RLS). O que está aqui é para explicar o estado ao usuário, nunca
 * para autorizar sozinho.
 */

export type StatusAssinatura = "trial" | "ativa" | "inadimplente" | "cancelada";

export type Empresa = {
  id: string;
  nome: string;
  assinatura_status: StatusAssinatura;
  trial_termina_em: string;
};

export const PRECO_MENSAL_CENTAVOS = 2990;
export const DIAS_DE_TRIAL = 14;

export type SituacaoConta = {
  status: StatusAssinatura;
  /** pode usar o sistema para criar coisas novas? */
  liberada: boolean;
  /** está no teste grátis, ainda dentro do prazo? */
  emTrial: boolean;
  /** dias inteiros restantes; 0 quando acabou */
  diasRestantes: number;
  /** trial que já passou da data */
  trialExpirado: boolean;
};

export function situacaoDaConta(
  empresa: Pick<Empresa, "assinatura_status" | "trial_termina_em">,
  agora: Date = new Date()
): SituacaoConta {
  const fim = new Date(empresa.trial_termina_em);
  const ms = fim.getTime() - agora.getTime();
  const diasRestantes = ms > 0 ? Math.ceil(ms / 86_400_000) : 0;

  const status = empresa.assinatura_status;
  const emTrial = status === "trial" && ms > 0;
  const trialExpirado = status === "trial" && ms <= 0;
  const liberada = status === "ativa" || emTrial;

  return { status, liberada, emTrial, diasRestantes, trialExpirado };
}

/** Frase curta para a faixa de aviso. Só o que muda a decisão da pessoa. */
export function avisoDaConta(situacao: SituacaoConta): string | null {
  if (situacao.status === "ativa") return null;

  if (situacao.emTrial) {
    if (situacao.diasRestantes <= 3) {
      return situacao.diasRestantes === 1
        ? "Seu teste grátis termina amanhã."
        : `Seu teste grátis termina em ${situacao.diasRestantes} dias.`;
    }
    return `Teste grátis: ${situacao.diasRestantes} dias restantes.`;
  }

  if (situacao.trialExpirado) {
    return "Seu teste grátis terminou. Assine para voltar a criar cobranças.";
  }
  if (situacao.status === "inadimplente") {
    return "Encontramos um problema no pagamento da sua assinatura.";
  }
  if (situacao.status === "cancelada") {
    return "Sua assinatura está cancelada.";
  }
  return null;
}
