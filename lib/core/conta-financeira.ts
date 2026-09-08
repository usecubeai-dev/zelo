/**
 * Contrato da conexão financeira da empresa com o Asaas — sem React, sem
 * DOM.
 *
 * Duas dimensões que não podem ser confundidas:
 *
 * - `EstadoOnboarding` — bookkeeping DO ZELO sobre a própria tentativa de
 *   criar a subconta. Não vem do Asaas; é o que sustenta a idempotência
 *   (`criando` é o estado que trava criação concorrente).
 * - `StatusAprovacao` — o enum REAL do Asaas para a aprovação geral da
 *   conta, confirmado em
 *   docs.asaas.com/docs/webhook-para-verificar-situacao-da-conta
 *   (eventos `ACCOUNT_STATUS_GENERAL_APPROVAL_*`). Só chega por webhook —
 *   o Zelo nunca infere isso sozinho.
 *
 * Achado da pesquisa desta fase: a resposta de `POST /v3/accounts` **não
 * tem** um campo `onboardingUrl` único da conta. O `onboardingUrl`
 * existe por DOCUMENTO pendente, devolvido por um endpoint separado de
 * consulta de documentos — que esta fase não implementa (fica para
 * quando a Fase 3 tratar o onboarding de documentos). Registrar aqui
 * para não repetir a suposição errada.
 */

/**
 * Bookkeeping local. `criando` existe só para o compare-and-swap da
 * idempotência. `bloqueada` (Fase 3): a subconta existe do lado do
 * Asaas (confirmado por `GET /accounts?cpfCnpj=`), mas o Zelo não tem
 * mais a credencial — a `apiKey` só é devolvida uma vez, e se aquela
 * gravação falhou não há como recuperar via API. Distinto de `recusada`,
 * que significa "seguro tentar de novo".
 */
export type EstadoOnboarding = "nao_iniciada" | "criando" | "criada" | "recusada" | "bloqueada";

/**
 * Enum real do Asaas para `ACCOUNT_STATUS_GENERAL_APPROVAL_*` (webhook)
 * e para o campo `general` de `GET /myAccount/status/` (Fase 3, mesma
 * fonte de verdade dos dois lados — confirmado que são o mesmo enum).
 * `null` = ainda não sincronizado.
 */
export type StatusAprovacao = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";

/**
 * Situação completa, espelhando `GET /myAccount/status/` — 4 campos
 * reais confirmados, não 1. `documentation` é o que decide se a UI
 * mostra "documentação pendente" em vez de "em análise": um `general`
 * ainda `PENDING` pode significar tanto "documento faltando" quanto
 * "documento enviado, fila de análise" — só olhando `documentation`
 * separado dá pra saber qual dos dois.
 */
export type SituacaoContaAsaas = {
  commercialInfo: StatusAprovacao;
  bankAccountInfo: StatusAprovacao;
  documentation: StatusAprovacao;
  general: StatusAprovacao;
};

/**
 * Os 8 estados conceituais pedidos pela Fase 3 — TODOS derivados, nenhum
 * persistido a mais: é `estadoOnboarding` (banco) + `situacao` (lido ao
 * vivo do Asaas, quando disponível) combinados numa função pura. Isso é
 * o que evita duplicar estado — a regra explícita desta fase.
 */
export type EstadoConceitual =
  | "nao_iniciado"
  | "criando"
  | "documentacao_pendente"
  | "em_analise"
  | "aprovado"
  | "recusado"
  | "bloqueado"
  | "erro_temporario";

export function estadoConceitual(
  estadoOnboarding: EstadoOnboarding,
  situacao: SituacaoContaAsaas | null
): EstadoConceitual {
  if (estadoOnboarding === "nao_iniciada") return "nao_iniciado";
  if (estadoOnboarding === "criando") return "criando";
  if (estadoOnboarding === "bloqueada") return "bloqueado";
  if (estadoOnboarding === "recusada") return "erro_temporario";

  // criada — o refinamento depende do que o Asaas realmente diz
  if (!situacao) return "em_analise"; // criada, ainda sem sincronizar
  if (situacao.general === "REJECTED") return "recusado";
  if (situacao.documentation !== "APPROVED") return "documentacao_pendente";
  if (situacao.general === "APPROVED") return "aprovado";
  return "em_analise";
}

export type ContaFinanceira = {
  empresaId: string;
  estadoOnboarding: EstadoOnboarding;
  asaasAccountId: string | null;
  asaasWalletId: string | null;
  statusAprovacao: StatusAprovacao | null;
  conectadoEm: string | null;
  sincronizadoEm: string | null;
};

/** Só quando aprovada pelo Asaas E a subconta existe é que a empresa está pronta pra cobrar de verdade. */
export function prontaParaCobrar(c: Pick<ContaFinanceira, "estadoOnboarding" | "statusAprovacao">): boolean {
  return c.estadoOnboarding === "criada" && c.statusAprovacao === "APPROVED";
}

/**
 * Transições do bookkeeping local. `criando` só volta para `nao_iniciada`
 * em caso de falha — nunca fica "travado" para sempre; ver
 * `lib/core/onboarding.ts` para o mecanismo de destravar após timeout.
 */
const TRANSICOES_ONBOARDING: Record<EstadoOnboarding, readonly EstadoOnboarding[]> = {
  nao_iniciada: ["criando"],
  criando: ["criada", "recusada", "nao_iniciada", "bloqueada"],
  criada: [],
  recusada: ["criando", "bloqueada"], // reconciliação pode descobrir bloqueio numa tentativa que parecia só "recusada"
  bloqueada: [], // exige intervenção manual — nenhuma transição automática sai daqui
};

export function transicaoOnboardingValida(de: EstadoOnboarding, para: EstadoOnboarding): boolean {
  return TRANSICOES_ONBOARDING[de].includes(para);
}

export type DescricaoEstado = {
  titulo: string;
  detalhe: string;
  tom: "neutro" | "atencao" | "sucesso" | "erro";
};

/**
 * Texto seguro para a UI — nunca expõe detalhe técnico.
 *
 * `situacao` é opcional (o refinamento "documentação pendente" só existe
 * depois de uma consulta ao vivo via `sincronizarStatusFinanceiro`). Sem
 * ela, cai para uma leitura mais simples baseada só em `statusAprovacao`
 * (o `general` já persistido por webhook) — é o mesmo texto que existia
 * antes desta fase, preservado de propósito: sintetizar os 4 campos de
 * `SituacaoContaAsaas` a partir de um `statusAprovacao` isolado inventaria
 * `documentation`, que não temos sem a consulta ao vivo.
 */
export function descricaoDoEstado(
  c: Pick<ContaFinanceira, "estadoOnboarding" | "statusAprovacao">,
  situacao: SituacaoContaAsaas | null = null
): DescricaoEstado {
  if (!situacao && c.estadoOnboarding === "criada") {
    if (c.statusAprovacao === "APPROVED") {
      return { titulo: "Conta de recebimentos", detalhe: "Conectada e pronta para cobranças.", tom: "sucesso" };
    }
    if (c.statusAprovacao === "REJECTED") {
      return {
        titulo: "Sua conta precisa de atenção",
        detalhe: "Nosso parceiro financeiro encontrou um problema na análise. Entre em contato com o suporte para regularizar.",
        tom: "erro",
      };
    }
    return {
      titulo: "Conta em análise",
      detalhe: "Sua conta foi criada e está sendo analisada pelo nosso parceiro financeiro.",
      tom: "atencao",
    };
  }

  const estado = estadoConceitual(c.estadoOnboarding, situacao);

  switch (estado) {
    case "nao_iniciado":
      return {
        titulo: "Conecte sua conta de recebimentos",
        detalhe: "Para começar a cobrar seus clientes, precisamos configurar sua conta financeira.",
        tom: "neutro",
      };
    case "criando":
      return {
        titulo: "Configurando sua conta",
        detalhe: "Estamos conectando sua conta de recebimentos. Isso leva só um instante.",
        tom: "atencao",
      };
    case "erro_temporario":
      return {
        titulo: "Não conseguimos conectar sua conta",
        detalhe: "Verifique seus dados e tente novamente.",
        tom: "erro",
      };
    case "bloqueado":
      return {
        titulo: "Sua conta precisa de suporte",
        detalhe: "Identificamos um problema na conexão que não conseguimos resolver automaticamente. Fale com o suporte da Zelo.",
        tom: "erro",
      };
    case "documentacao_pendente":
      return {
        titulo: "Documentação pendente",
        detalhe: "Falta enviar ou aprovar alguns documentos para liberar sua conta. Veja abaixo o que falta.",
        tom: "atencao",
      };
    case "recusado":
      return {
        titulo: "Sua conta precisa de atenção",
        detalhe: "Nosso parceiro financeiro encontrou um problema na análise. Entre em contato com o suporte para regularizar.",
        tom: "erro",
      };
    case "aprovado":
      return { titulo: "Conta de recebimentos", detalhe: "Conectada e pronta para cobranças.", tom: "sucesso" };
    case "em_analise":
    default:
      return {
        titulo: "Conta em análise",
        detalhe: "Sua conta foi criada e está sendo analisada pelo nosso parceiro financeiro.",
        tom: "atencao",
      };
  }
}
