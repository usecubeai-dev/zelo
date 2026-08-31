/**
 * Eventos de conversão da Zelo.
 *
 * O funil tem TRÊS marcos, e eles não são a mesma coisa:
 *
 *   signup_start     → o visitante começou a preencher
 *   lead_captured    → o lead foi gravado no banco (captura, não conta)
 *   account_created  → a conta e a empresa existem
 *   trial_started    → os 14 dias começaram a contar
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
  /** os 14 dias começaram a contar */
  trialStarted: "trial_started",
  /**
   * A conta foi criada E a pessoa entrou de fato — sessão ativa, trial
   * rodando. Não dispara na captura de lead nem quando a conta fica
   * esperando confirmação de e-mail: sem sessão, o cadastro não terminou.
   */
  signupComplete: "signup_complete",
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
