/**
 * Forma de pagamento e encargos (multa/juros) — regras PURAS (sem banco, sem rede,
 * sem React). O servidor revalida tudo com estas funções; a tela só as usa
 * para mostrar o que o servidor vai aceitar.
 *
 * O que o Asaas realmente faz (confirmado na documentação e na sondagem do
 * sandbox em 06/10/2026):
 *  - toda cobrança tem valor MÍNIMO de R$ 5,00 (Pix, boleto ou "cliente
 *    escolhe"). Abaixo disso o Asaas recusa e não existe link de pagamento;
 *  - multa (`fine`) e juros (`interest`, % ao mês, máximo 11%) só valem para
 *    BOLETO. Em cobrança só-Pix o Asaas não os aplica. Por isso o Zelo só
 *    envia encargos quando o cliente pode escolher (inclui boleto) — nunca
 *    promete encargo num Pix.
 *
 * Nada aqui é regra fiscal ou jurídica: são os campos que o provedor aceita.
 * Os limites de digitação (multa até 10%) existem para evitar erro de
 * vírgula, não para dizer o que é permitido por lei.
 */

/** Como o cliente final paga. */
export type FormaPagamento = "pix" | "cliente_escolhe";

export const FORMAS_DE_PAGAMENTO: readonly FormaPagamento[] = ["pix", "cliente_escolhe"];

export function ehFormaPagamento(valor: unknown): valor is FormaPagamento {
  return valor === "pix" || valor === "cliente_escolhe";
}

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: "Só Pix",
  cliente_escolhe: "Seu cliente escolhe como pagar",
};

/** Menor cobrança que o Asaas aceita (qualquer forma de pagamento). */
export const VALOR_MINIMO_ASAAS_CENTAVOS = 500;

/** Limite de digitação da multa (Zelo). */
export const MULTA_MAXIMA_PCT = 10;
/** Limite de juros ao mês aceito pelo Asaas. */
export const JUROS_MAXIMO_PCT_MES = 11;

export type Encargos = {
  /** % de multa sobre o valor, uma vez, após o vencimento. `null` = sem multa. */
  multaPct: number | null;
  /** % de juros ao mês, proporcional aos dias de atraso. `null` = sem juros. */
  jurosPctMes: number | null;
};

export const SEM_ENCARGOS: Encargos = { multaPct: null, jurosPctMes: null };

/**
 * "2", "2,5", "0,033" → número. Vazio → `null` (sem encargo). Inválido →
 * `NaN`, para quem chama distinguir "não preenchi" de "digitei errado".
 * Duas casas decimais no máximo (é o que o banco guarda).
 */
export function lerPercentual(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  const bruto = String(texto).trim().replace("%", "").replace(/\s/g, "");
  if (bruto === "") return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(bruto)) return Number.NaN;
  const n = Number(bruto.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : Number.NaN;
}

export type ErrosEncargos = { multa?: string; juros?: string };

/** Valida o que a pessoa digitou. Vazio é válido (sem encargo). */
export function validarEncargos(multa: string, juros: string): ErrosEncargos {
  const erros: ErrosEncargos = {};
  const m = lerPercentual(multa);
  const j = lerPercentual(juros);
  if (m !== null && Number.isNaN(m)) erros.multa = "Use um número, como 2 ou 2,5.";
  else if (m !== null && m > MULTA_MAXIMA_PCT) erros.multa = `A multa pode ir até ${MULTA_MAXIMA_PCT}%.`;
  if (j !== null && Number.isNaN(j)) erros.juros = "Use um número, como 1 ou 0,5.";
  else if (j !== null && j > JUROS_MAXIMO_PCT_MES) erros.juros = `Os juros podem ir até ${JUROS_MAXIMO_PCT_MES}% ao mês.`;
  return erros;
}

/** Texto → `Encargos` já limpos (0 e vazio viram `null`: nada a aplicar). Só chamar depois de `validarEncargos`. */
export function encargosDoTexto(multa: string, juros: string): Encargos {
  const m = lerPercentual(multa);
  const j = lerPercentual(juros);
  return {
    multaPct: m && !Number.isNaN(m) && m > 0 ? m : null,
    jurosPctMes: j && !Number.isNaN(j) && j > 0 ? j : null,
  };
}

export function temEncargos(e: Encargos): boolean {
  return (e.multaPct ?? 0) > 0 || (e.jurosPctMes ?? 0) > 0;
}

/** `5` → "5", `0.5` → "0,5", `null` → "" — o que volta para o campo. */
export function percentualParaCampo(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n).replace(".", ",");
}

/** "2%" / "0,5% ao mês" — para mostrar nas telas. */
export function textoEncargos(e: Encargos): string {
  const partes: string[] = [];
  if (e.multaPct) partes.push(`multa de ${percentualParaCampo(e.multaPct)}%`);
  if (e.jurosPctMes) partes.push(`juros de ${percentualParaCampo(e.jurosPctMes)}% ao mês`);
  return partes.join(" + ");
}

/**
 * O que o Zelo pede ao Asaas e por quê. Única decisão de "qual forma/encargo
 * vai no payload": Pix Automático e cobrança só-Pix nunca levam encargos.
 */
export type PlanoDePagamento =
  | { billingType: "PIX"; encargos: Encargos }
  | { billingType: "UNDEFINED"; encargos: Encargos };

export function planoDePagamento(forma: FormaPagamento, encargos: Encargos, valorCentavos: number): PlanoDePagamento {
  if (forma === "cliente_escolhe" && valorCentavos >= VALOR_MINIMO_ASAAS_CENTAVOS) {
    return { billingType: "UNDEFINED", encargos };
  }
  return { billingType: "PIX", encargos: SEM_ENCARGOS };
}

export type ErrosForma = { forma?: string; valor?: string };

/** "Seu cliente escolhe" só com valor a partir de R$ 5,00. */
export function validarForma(forma: FormaPagamento, valorCentavos: number | null): ErrosForma {
  if (forma === "cliente_escolhe" && (valorCentavos === null || valorCentavos < VALOR_MINIMO_ASAAS_CENTAVOS)) {
    return { forma: "Para o cliente escolher como pagar, o valor precisa ser de pelo menos R$ 5,00." };
  }
  return {};
}

/** Aviso (não bloqueia): cobrança abaixo do mínimo do Asaas não gera link de pagamento. */
export function abaixoDoMinimoDoAsaas(valorCentavos: number | null): boolean {
  return valorCentavos !== null && valorCentavos > 0 && valorCentavos < VALOR_MINIMO_ASAAS_CENTAVOS;
}
