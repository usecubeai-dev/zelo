/**
 * Contrato de cobrança — sem React, sem DOM, para valer igual nos dois
 * lados. O servidor revalida tudo com estas funções.
 *
 * Regra do projeto: dinheiro é `integer` em centavos, sempre. A conversão
 * para texto vive em `lib/dinheiro.ts` e em nenhum outro lugar.
 */

import { paraCentavos } from "./dinheiro";

/** Estados REAIS, guardados no banco. `vencida` não é um deles. */
export type StatusCobranca = "pendente" | "enviada" | "paga" | "cancelada" | "estornada";

/** O que a interface mostra — inclui a situação derivada. */
export type SituacaoCobranca = StatusCobranca | "vencida";

export type Cobranca = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  recorrencia_id: string | null;
  servico_id: string | null;
  descricao: string;
  valor_centavos: number;
  vence_em: string;
  status: StatusCobranca;
  pago_em: string | null;
  valor_pago_centavos: number | null;
  /** Origem da confirmação: 'asaas' (webhook/reconciliação real) ou 'manual' (profissional declarou). `null` = não paga. */
  pago_via: "asaas" | "manual" | null;
  /** Soma dos estornos confirmados (parciais ou total). `null` = nunca estornada. */
  valor_estornado_centavos: number | null;
  estornado_em: string | null;
  asaas_payment_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type CobrancaComCliente = Cobranca & {
  clientes: { id: string; nome: string } | null;
};

export type DadosCobranca = {
  cliente_id: string;
  /** serviço cadastrado que originou esta cobrança — opcional, só preenche descrição/valor no formulário. "" = nenhum. */
  servico_id: string;
  descricao: string;
  /** como o usuário digitou: "1.234,56", "1234.56", "29,90" */
  valor: string;
  vence_em: string;
};

export type CampoCobranca = keyof DadosCobranca;
export type ErrosCobranca = Partial<Record<CampoCobranca, string>>;

export const COBRANCA_VAZIA: DadosCobranca = {
  cliente_id: "",
  servico_id: "",
  descricao: "",
  valor: "",
  vence_em: "",
};

export const ROTULOS_COBRANCA: Record<CampoCobranca, string> = {
  cliente_id: "Cliente",
  servico_id: "Serviço",
  descricao: "Descrição",
  valor: "Valor",
  vence_em: "Vencimento",
};

export const ORDEM_COBRANCA: CampoCobranca[] = [
  "cliente_id",
  "descricao",
  "valor",
  "vence_em",
];

/** Data de hoje em `YYYY-MM-DD`, no fuso local — `toISOString()` usa UTC e
    vira o dia anterior à noite no Brasil. */
export function hojeISO(agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Um centavo é o mínimo; R$ 1.000.000 o teto de sanidade. */
const VALOR_MAXIMO_CENTAVOS = 100_000_000;

export function validarCobranca(
  dados: DadosCobranca,
  hoje: string = hojeISO()
): ErrosCobranca {
  const erros: ErrosCobranca = {};

  if (!dados.cliente_id) erros.cliente_id = "Escolha o cliente.";

  const descricao = dados.descricao.trim();
  if (descricao.length < 2) erros.descricao = "Descreva o que está sendo cobrado.";
  else if (descricao.length > 200) erros.descricao = "Descrição muito longa.";

  const centavos = paraCentavos(dados.valor);
  if (centavos === null) erros.valor = "Informe um valor válido.";
  else if (centavos <= 0) erros.valor = "O valor precisa ser maior que zero.";
  else if (centavos > VALOR_MAXIMO_CENTAVOS) erros.valor = "Valor acima do limite.";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.vence_em)) {
    erros.vence_em = "Informe a data de vencimento.";
  } else if (Number.isNaN(new Date(dados.vence_em + "T00:00:00").getTime())) {
    erros.vence_em = "Data inválida.";
  } else if (dados.vence_em < hoje) {
    /* Vencimento no passado é quase sempre erro de digitação. Bloqueamos na
       criação; a edição de uma cobrança existente não revalida isso, senão
       corrigir a descrição de uma cobrança vencida ficaria impossível. */
    erros.vence_em = "O vencimento não pode ser no passado.";
  }

  return erros;
}

export function primeiroCampoInvalidoCobranca(
  erros: ErrosCobranca
): CampoCobranca | null {
  return ORDEM_COBRANCA.find((c) => erros[c]) ?? null;
}

export function cobrancaParaBanco(dados: DadosCobranca) {
  return {
    cliente_id: dados.cliente_id,
    servico_id: dados.servico_id || null,
    descricao: dados.descricao.trim().replace(/\s+/g, " "),
    valor_centavos: paraCentavos(dados.valor) ?? 0,
    vence_em: dados.vence_em,
  };
}

/**
 * A situação que o usuário vê.
 *
 * `vencida` é derivada aqui e em nenhum lugar mais: uma cobrança pendente
 * cujo vencimento já passou. Guardar isso como status exigiria um processo
 * virando a chave todo dia à meia-noite — e um processo parado viraria dado
 * errado sem ninguém perceber.
 */
export function situacaoDaCobranca(
  cobranca: Pick<Cobranca, "status" | "vence_em">,
  hoje: string = hojeISO()
): SituacaoCobranca {
  if (cobranca.status === "pendente" && cobranca.vence_em < hoje) return "vencida";
  if (cobranca.status === "enviada" && cobranca.vence_em < hoje) return "vencida";
  return cobranca.status;
}

export const ROTULO_SITUACAO: Record<SituacaoCobranca, string> = {
  pendente: "Pendente",
  enviada: "Enviada",
  paga: "Paga",
  cancelada: "Cancelada",
  vencida: "Vencida",
  estornada: "Estornada",
};

/** Só cobrança que ainda não foi paga nem cancelada pode ser alterada. */
export function podeEditar(status: StatusCobranca): boolean {
  return status === "pendente" || status === "enviada";
}

export function podeCancelar(status: StatusCobranca): boolean {
  return status === "pendente" || status === "enviada";
}

/** Marcar como paga na mão existe porque, sem o Asaas ligado, é o único
    jeito de o usuário fechar o mês. Some quando o webhook assumir. */
export function podeMarcarPaga(status: StatusCobranca): boolean {
  return status === "pendente" || status === "enviada";
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** "vence em 3 dias", "venceu há 2 dias" — o que decide ação. */
export function diasAte(vence_em: string, hoje: string = hojeISO()): number {
  const ms =
    new Date(vence_em + "T00:00:00").getTime() -
    new Date(hoje + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}
