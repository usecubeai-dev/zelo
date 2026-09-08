/**
 * Contrato de recorrência — sem React, sem DOM, para valer igual no
 * cliente e no servidor.
 *
 * A recorrência é o ACORDO que gera cobranças periódicas, e não a
 * cobrança individual de cada mês.
 *
 * Dinheiro é `integer` em centavos, dia_vencimento entre 1 e 28 (para caber
 * em todos os meses sem exceção de calendário).
 */

import { paraCentavos } from "./dinheiro";

export type StatusRecorrencia = "ativa" | "pausada" | "encerrada";
export type Periodicidade = "mensal";

export type Recorrencia = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  servico_id: string | null;
  descricao: string;
  valor_centavos: number;
  periodicidade: Periodicidade;
  dia_vencimento: number;
  inicia_em: string;
  status: StatusRecorrencia;
  asaas_subscription_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type RecorrenciaComCliente = Recorrencia & {
  clientes: { id: string; nome: string } | null;
};

export type DadosRecorrencia = {
  cliente_id: string;
  /** serviço cadastrado que originou esta recorrência — opcional, só preenche descrição/valor no formulário. "" = nenhum. */
  servico_id: string;
  descricao: string;
  /** como o usuário digitou: "350,00", "29,90" */
  valor: string;
  /** dia do mês entre 1 e 28 */
  dia_vencimento: string;
  /** data de início em YYYY-MM-DD */
  inicia_em: string;
};

export type CampoRecorrencia = keyof DadosRecorrencia;
export type ErrosRecorrencia = Partial<Record<CampoRecorrencia, string>>;

export const RECORRENCIA_VAZIA: DadosRecorrencia = {
  cliente_id: "",
  servico_id: "",
  descricao: "",
  valor: "",
  dia_vencimento: "5",
  inicia_em: "",
};

export const ROTULOS_RECORRENCIA: Record<CampoRecorrencia, string> = {
  cliente_id: "Cliente",
  servico_id: "Serviço",
  descricao: "Descrição",
  valor: "Valor por ciclo",
  dia_vencimento: "Dia de vencimento (1 a 28)",
  inicia_em: "Início da recorrência",
};

export const ORDEM_RECORRENCIA: CampoRecorrencia[] = [
  "cliente_id",
  "descricao",
  "valor",
  "dia_vencimento",
  "inicia_em",
];

const VALOR_MAXIMO_CENTAVOS = 100_000_000;

export function validarRecorrencia(
  dados: DadosRecorrencia
): ErrosRecorrencia {
  const erros: ErrosRecorrencia = {};

  if (!dados.cliente_id) erros.cliente_id = "Escolha o cliente.";

  const descricao = dados.descricao.trim();
  if (descricao.length < 2) erros.descricao = "Descreva o que está sendo cobrado.";
  else if (descricao.length > 200) erros.descricao = "Descrição muito longa.";

  const centavos = paraCentavos(dados.valor);
  if (centavos === null) erros.valor = "Informe um valor válido.";
  else if (centavos <= 0) erros.valor = "O valor precisa ser maior que zero.";
  else if (centavos > VALOR_MAXIMO_CENTAVOS) erros.valor = "Valor acima do limite.";

  const dia = Number(dados.dia_vencimento);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    erros.dia_vencimento = "Escolha um dia entre 1 e 28.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.inicia_em)) {
    erros.inicia_em = "Informe a data de início.";
  } else if (Number.isNaN(new Date(dados.inicia_em + "T00:00:00").getTime())) {
    erros.inicia_em = "Data inválida.";
  }

  return erros;
}

export function primeiroCampoInvalidoRecorrencia(
  erros: ErrosRecorrencia
): CampoRecorrencia | null {
  return ORDEM_RECORRENCIA.find((c) => erros[c]) ?? null;
}

export function recorrenciaParaBanco(dados: DadosRecorrencia) {
  return {
    cliente_id: dados.cliente_id,
    servico_id: dados.servico_id || null,
    descricao: dados.descricao.trim().replace(/\s+/g, " "),
    valor_centavos: paraCentavos(dados.valor) ?? 0,
    periodicidade: "mensal" as Periodicidade,
    dia_vencimento: Number(dados.dia_vencimento),
    inicia_em: dados.inicia_em,
  };
}

/**
 * Calcula a data do primeiro vencimento a partir da data de início e do dia escolhido.
 * Se o dia de início for anterior ou igual ao dia de vencimento, vence no mesmo mês.
 * Caso contrário, vence no mês seguinte.
 */
export function calcularPrimeiroVencimento(
  inicia_em: string,
  dia_vencimento: number
): string {
  const [anoStr, mesStr, diaStr] = inicia_em.split("-");
  let ano = Number(anoStr);
  let mes = Number(mesStr); // 1..12
  const diaInicio = Number(diaStr);

  if (diaInicio > dia_vencimento) {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }

  const mm = String(mes).padStart(2, "0");
  const dd = String(dia_vencimento).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

/**
 * Calcula o próximo vencimento avançando exatamente 1 mês a partir do último vencimento.
 */
export function calcularProximoVencimento(
  ultimoVencimentoISO: string,
  dia_vencimento: number
): string {
  const [anoStr, mesStr] = ultimoVencimentoISO.split("-");
  let ano = Number(anoStr);
  let mes = Number(mesStr) + 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia_vencimento).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

export const ROTULO_STATUS_RECORRENCIA: Record<StatusRecorrencia, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export function podeEditarRecorrencia(status: StatusRecorrencia): boolean {
  return status !== "encerrada";
}

export function podePausarRecorrencia(status: StatusRecorrencia): boolean {
  return status === "ativa";
}

export function podeReativarRecorrencia(status: StatusRecorrencia): boolean {
  return status === "pausada";
}

export function podeEncerrarRecorrencia(status: StatusRecorrencia): boolean {
  return status === "ativa" || status === "pausada";
}
