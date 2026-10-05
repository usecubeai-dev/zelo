/**
 * Eventos de conversão da Zelo.
 *
 * O funil tem TRÊS marcos, e eles não são a mesma coisa:
 *
 *   signup_start     → o visitante começou a preencher
 *   lead_captured    → o lead foi gravado no banco (captura, não conta)
 *   account_created  → a conta e a empresa existem
 *   trial_started    → LEGADO: não existe mais mês grátis; a constante fica
 *                      só declarada (histórico do GA4) e nada a dispara
 *   signup_complete  → a conta existe E a pessoa entrou
 *
 * Capturar um lead **não é** concluir um cadastro. Enquanto não houver
 * criação de conta, `signup_complete` fica só declarado — se ele contasse
 * lead, todo número de conversão do GA4 estaria inflado e a decisão de
 * investir em tráfego sairia de uma métrica falsa.
 */
export const EVENTOS = {
  /** clique em "Começar agora" (hero, preço, fechamento) */
  ctaStart: "cta_start",
  /** clique em "Ver como funciona" */
  ctaDemo: "cta_demo",
  /** primeira interação com o formulário de /comecar — uma vez por sessão */
  signupStart: "signup_start",
  /** o lead foi REALMENTE gravado no Supabase (formulário de captura) */
  leadCaptured: "lead_captured",
  /** a conta existe no auth e a empresa nasceu pelo trigger */
  accountCreated: "account_created",
  /** LEGADO — o período grátis foi removido e nada dispara este evento. Mantido para não perder o nome no histórico. */
  trialStarted: "trial_started",
  /**
   * A conta foi criada E a pessoa entrou de fato — sessão ativa. Não
   * dispara na captura de lead nem quando a conta fica
   * esperando confirmação de e-mail: sem sessão, o cadastro não terminou.
   */
  signupComplete: "signup_complete",

  /* ------------------------------------------------------------
     Produto (Fase 19) — instrumentados dentro de `/app`, disparados só
     no client (`window.gtag`), sempre depois de confirmação real do
     servidor. Nunca no otimista: se a Server Action devolver erro, o
     evento não dispara. */
  /** onboarding (8 passos, `lib/core/jornada-onboarding.ts`) chegou a 100% */
  onboardingCompleted: "onboarding_completed",
  /** POST bem-sucedido em `criarCliente` */
  clientCreated: "client_created",
  /** POST bem-sucedido em `criarCobranca` (avulsa) */
  chargeCreated: "charge_created",
  /** POST bem-sucedido em `criarRecorrencia` */
  recurringChargeCreated: "recurring_charge_created",
  /** cliente gerou o QR/link de autorização Pix Automático */
  pixAuthorizationStarted: "pix_authorization_started",
  /** autorização Pix Automático chegou a ACTIVE (primeira vez que a tela mostra esse estado) */
  pixAuthorizationCompleted: "pix_authorization_completed",
  /**
   * Fase 23 — ativação rápida (`lib/core/jornada-onboarding.ts`,
   * `ativacaoRapida`) chegou a 100%: primeiro cliente, primeira cobrança,
   * cobrança enviada. Distinto de `onboarding_completed` (a jornada
   * completa de 9 passos) — este é o marco de "o profissional viu o
   * produto funcionar", bem mais cedo no funil.
   */
  activationCompleted: "activation_completed",
  /**
   * Fase 23 — clique no CTA comercial discreto mostrado ao PAGADOR depois
   * de concluir uma autorização Pix Automático em `/autorizar/[id]`. Mede
   * a página pública como canal de aquisição, não interação do produto.
   */
  authorizationCtaClick: "authorization_cta_click",

  /* --- Ainda SÓ registrados aqui, não disparados: exigiriam tracking
     server-side (GA4 Measurement Protocol) porque nascem de webhook —
     `first_charge_received` (confirmação de pagamento) e as transições
     de trial (`trial_expiring`/`trial_converted`/`trial_expired`, que
     dependem de estado, não de uma ação com resposta pra confirmar).
     Registrado aqui pra documentar o nome definitivo do evento sem fingir
     que já está instrumentado — ver relatório de Fase 19. */
  firstChargeReceived: "first_charge_received",
  trialExpiring: "trial_expiring",
  trialConverted: "trial_converted",
  trialExpired: "trial_expired",
} as const;

export type Evento = (typeof EVENTOS)[keyof typeof EVENTOS];

type Gtag = (
  comando: "event" | "config" | "js",
  alvo: string,
  parametros?: Record<string, unknown>
) => void;

/**
 * Envia um evento para o GA4, se ele estiver carregado.
 * Silencioso por design: sem NEXT_PUBLIC_GA_ID o site funciona igual e
 * nenhuma chamada falha.
 */
export function track(evento: Evento, parametros?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", evento, parametros);
}
