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
  | "SUBSCRIPTION_SPLIT_DISABLED";

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
