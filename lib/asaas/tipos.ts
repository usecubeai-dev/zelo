/**
 * Contratos de tipos da API v3 do Asaas.
 *
 * Baseado na especificação oficial da API v3 do Asaas (https://docs.asaas.com).
 */

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS_FOR_EXTERN_REF"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS"
  | "DELETED";

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  cpfCnpj?: string | null;
  postalCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  externalReference?: string | null;
  notificationDisabled?: boolean;
  dateCreated?: string;
  deleted?: boolean;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  dateCreated: string;
  dueDate: string;
  value: number;
  netValue?: number;
  originalValue?: number;
  interestValue?: number;
  description?: string;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  pixTransaction?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  installmentNumber?: number | null;
  invoiceUrl?: string;
  bankSlipUrl?: string | null;
  transactionReceiptUrl?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
  /**
   * Presente (mesmo que `null`) no payload do webhook — confirmado no
   * exemplo de `PAYMENT_RECEIVED` em docs.asaas.com/docs/webhook-para-
   * cobrancas (01/09/2026). Populado com um item por estorno realizado
   * (total ou parcial) — mesmo formato do `PaymentRefundGetResponseDTO`
   * documentado em `GET /v3/payments/{id}`.
   */
  refunds?: { value: number; status?: string; dateCreated?: string }[] | null;
};

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

export type AsaasSubscriptionCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export type AsaasSubscriptionStatus = "ACTIVE" | "INACTIVE" | "EXPIRED";

export type AsaasSubscription = {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: AsaasSubscriptionCycle;
  description?: string;
  billingType: AsaasBillingType;
  status: AsaasSubscriptionStatus;
  externalReference?: string | null;
  dateCreated?: string;
  deleted?: boolean;
};

export type AsaasEventType =
  | "PAYMENT_CREATED"
  | "PAYMENT_AWAITING_RISK_ANALYSIS"
  | "PAYMENT_APPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_REPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_UPDATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
  | "PAYMENT_ANTICIPATED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_PARTIALLY_REFUNDED"
  | "PAYMENT_REFUND_IN_PROGRESS"
  | "PAYMENT_REFUND_DENIED"
  | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED"
  | "PAYMENT_BANK_SLIP_VIEWED"
  | "PAYMENT_CHECKOUT_VIEWED"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_DELETED"
  | "SUBSCRIPTION_SPLIT_DISABLED"
  /* Eventos de CONTA — situação cadastral da subconta, não de cobrança
     nem de pagamento. Confirmados em
     docs.asaas.com/docs/webhook-para-verificar-situacao-da-conta.
     "GENERAL_APPROVAL" grava `provider_aprovacao` direto pelo nome do
     evento; BANK_ACCOUNT_INFO/COMMERCIAL_INFO/DOCUMENT_APPROVED disparam
     uma ressincronização (`sincronizarStatusFinanceiro`) em vez de gravar
     um valor fabricado a partir do nome — ver `lib/asaas/webhook.ts`. */
  | "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED"
  | "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL"
  | "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING"
  | "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED"
  | "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED"
  | "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL"
  | "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING"
  | "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED"
  | "ACCOUNT_STATUS_DOCUMENT_APPROVED"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON"
  | "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED"
  /* Eventos de AUTORIZAÇÃO de Pix Automático — confirmados em
     docs.asaas.com/docs/eventos-para-pix-automático (Fase 6, 01/09/2026).
     O payload de exemplo da doc NÃO mostra o campo `account` (diferente
     dos demais eventos v3) — por isso `webhook.ts` resolve o tenant
     destes eventos por `authorization.id` → `autorizacoes_pix`, não por
     `account.id`. Ver comentário em `resolverContextoAutorizacaoPix`. */
  | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED"
  | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED"
  | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED"
  | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED"
  | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED"
  /* Elegibilidade da CONTA para Pix Automático (não da autorização
     individual) — quando fica INELIGIBLE, o próprio Asaas cancela as
     autorizações ativas e dispara AUTHORIZATION_CANCELLED para cada uma,
     que já é tratado. Este evento só é reconhecido/auditado, sem
     handler próprio — não inventar um efeito além do que a doc confirma. */
  | "PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED"
  /* Eventos de INSTRUÇÃO DE PAGAMENTO de Pix Automático — confirmados
     em docs.asaas.com/docs/eventos-para-pix-automático (Fase 7,
     01/09/2026). Só 4 eventos existem — NÃO existe evento pra `DONE`;
     esse estado só é descoberto por consulta (ver
     `lib/core/instrucao-pagamento.ts`, `origemPermitida`). Mesmo achado
     da Fase 6: o payload de exemplo não mostra `account`. */
  | "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED"
  | "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED"
  | "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED"
  | "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED";

/**
 * Conta que originou o evento.
 *
 * O Asaas passou a enviar este objeto no corpo de todos os eventos da API
 * v3 justamente para reconciliação em ecossistemas de subcontas. É a
 * ÚNICA fonte confiável de tenant num webhook: `externalReference` e
 * `asaas_payment_id` são valores que descrevem a cobrança, não a conta
 * dona dela.
 *
 * `ownerId` é `null` quando a conta é raiz — o caso da própria plataforma.
 */
export type AsaasWebhookAccount = {
  id: string;
  ownerId?: string | null;
};

export type AsaasWebhookPayload = {
  id: string;
  event: AsaasEventType;
  dateCreated: string;
  account?: AsaasWebhookAccount;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  authorization?: AsaasPixAutomaticAuthorization;
  paymentInstruction?: AsaasPixAutomaticPaymentInstruction;
};

/**
 * Pix Automático — Instrução de pagamento (o processamento de UM ciclo).
 *
 * Confirmado por consulta direta à API Reference em 01/09/2026 (Fase 7):
 * docs.asaas.com/reference/recuperar-uma-unica-instrucao-de-pagamento-pix-automatico,
 * .../listar-instrucoes-de-pagamento-pix-automatico,
 * .../criar-retentativa-de-instrucao-de-pagamento-pix-automatico.
 *
 * Não existe endpoint de CRIAÇÃO — a instrução nasce da cobrança que o
 * Zelo cria com `pixAutomaticAuthorizationId`; só é descoberta, nunca
 * criada por nós.
 */
export type AsaasStatusInstrucaoPix = "AWAITING_REQUEST" | "SCHEDULED" | "DONE" | "CANCELLED" | "REFUSED";
export type AsaasPurposeInstrucaoPix = "RETRY_AFTER_DUE_DATE" | "SCHEDULE";

export type AsaasPixAutomaticPaymentInstruction = {
  id: string;
  endToEndIdentifier?: string | null;
  authorization: {
    id: string;
    endToEndIdentifier?: string | null;
    customerId?: string;
  };
  dueDate: string;
  status: AsaasStatusInstrucaoPix;
  paymentId: string | null;
  purpose?: AsaasPurposeInstrucaoPix;
  refusalReason?: string | null;
  retryAttempt?: number;
};

/**
 * Pix Automático — Autorização recorrente.
 *
 * Confirmado por consulta direta à API Reference em 01/09/2026:
 * docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico,
 * .../recuperar-uma-unica-autorizacao-pix-automatico,
 * .../cancelar-uma-autorizacao-pix-automatico,
 * .../listar-autorizacoes-pix-automatico.
 *
 * `status` é o mesmo enum de `lib/core/autorizacao.ts` (`StatusAutorizacao`)
 * — duplicado de propósito, mesma disciplina de `StatusAprovacaoAsaas` em
 * `lib/asaas/conta.ts`: a camada `asaas/` não importa tipos de `core/`.
 */
export type AsaasFrequenciaPix = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "ANNUALLY";
export type AsaasPaymentCreationMode = "MANUAL" | "SUBSCRIPTION";
export type AsaasRetryPolicyPix = "ALLOW_THREE_IN_SEVEN_DAYS" | "NOT_ALLOWED";
export type AsaasStatusAutorizacaoPix = "CREATED" | "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED";

export type AsaasPixAutomaticAuthorization = {
  id: string;
  status: AsaasStatusAutorizacaoPix;
  customerId: string;
  /** Campo de correlação nosso — NÃO existe `externalReference` neste endpoint. Máx. 35 chars. */
  contractId: string;
  frequency: AsaasFrequenciaPix;
  startDate: string;
  finishDate?: string | null;
  value?: number | null;
  description?: string | null;
  minLimitValue?: number | null;
  paymentCreationMode: AsaasPaymentCreationMode;
  retryPolicy: AsaasRetryPolicyPix;
  /** Pix copia-e-cola do QR de primeiro pagamento/consentimento. */
  payload?: string;
  /** QR code em base64. */
  encodedImage?: string;
  immediateQrCode?: {
    conciliationIdentifier?: string;
    expirationDate?: string;
  };
  endToEndIdentifier?: string | null;
  cancellationDate?: string | null;
  cancellationReason?: string | null;
  subscriptionId?: string | null;
};

/** Subconta — apenas os campos que o Zelo usa. */
export type AsaasSubconta = {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /** Devolvida UMA ÚNICA VEZ, na criação. Nunca sai do servidor. */
  apiKey?: string;
  walletId: string;
  accountNumber?: {
    agency?: string;
    account?: string;
    accountDigit?: string;
  };
};

export type AsaasApiErrorItem = {
  code: string;
  description: string;
};

export type AsaasApiErrorResponse = {
  errors: AsaasApiErrorItem[];
};

export type AsaasListResponse<T> = {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};
