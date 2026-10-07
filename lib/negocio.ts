/**
 * "Meu Negócio" — a visão gerencial. Regras PURAS (sem banco, sem rede, sem
 * React): recebem as linhas que a tela já leu (com RLS, da própria empresa) e
 * devolvem números, saúde, alertas e a série do gráfico.
 *
 * Princípios:
 *  - Só dado que o Zelo JÁ tem (cobranças, clientes, recorrências). Nada novo
 *    para o usuário cadastrar, nenhum valor inventado.
 *  - Saúde do negócio NÃO é um "score": são três níveis por regra explícita
 *    (`avaliarSaude`), e a tela sempre mostra o MOTIVO.
 *  - Previsão = o que já foi recebido + o que está em aberto e ainda vence no
 *    mês. Não é projeção matemática nem receita garantida.
 *  - Pronto para crescer (despesas, fluxo de caixa, metas…) sem mudar isto:
 *    cada bloco é uma função separada e a tela só compõe.
 */

import { diasAte, hojeISO } from "./cobranca";
import { somarDias } from "./recuperacao";

/* ---------- entrada ---------- */

export type CobrancaAberta = { valor_centavos: number; vence_em: string; cliente_id: string };
export type CobrancaPaga = { valor_pago_centavos: number | null; valor_centavos: number; pago_em: string };
export type RecorrenciaAtiva = { valor_centavos: number };

export type EntradaDoNegocio = {
  abertas: readonly CobrancaAberta[];
  /** pagas desde o começo do mês de 2 meses atrás (o suficiente para o mês anterior e o gráfico) */
  pagas: readonly CobrancaPaga[];
  clientesAtivos: number;
  clientesNovosNoMes: number;
  recorrencias: readonly RecorrenciaAtiva[];
  totalDeCobrancas: number;
  hoje?: string;
};

/* ---------- datas ---------- */

/** `YYYY-MM-DD` de uma data/hora (o fuso é o do servidor, o mesmo de `hojeISO`). */
export function diaDe(iso: string): string {
  return hojeISO(new Date(iso));
}

export function inicioDoMes(hoje: string, deslocamento = 0): string {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + deslocamento, 1));
  return d.toISOString().slice(0, 10);
}

export function fimDoMes(hoje: string): string {
  const [a, m] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Valor efetivamente recebido de uma cobrança paga (o que entrou, não o que foi cobrado). */
export function valorRecebido(c: CobrancaPaga): number {
  return c.valor_pago_centavos ?? c.valor_centavos;
}

/* ---------- saúde do negócio ---------- */

export type NivelDeSaude = "ok" | "atencao" | "imediata";

export type Saude = { nivel: NivelDeSaude; titulo: string; motivo: string };

export const LIMITE_ATRASO_IMEDIATO_QTD = 5;
export const LIMITE_ATRASO_IMEDIATO_PCT = 20;
export const LIMITE_ATRASO_IMEDIATO_DIAS = 30;

/**
 * Três níveis, três regras que cabem em uma frase:
 *  - nenhuma cobrança atrasada → "Tudo sob controle";
 *  - há atraso, mas pouco → "Atenção aos recebimentos";
 *  - 5 ou mais atrasadas, OU o atraso passa de 20% do que está em aberto, OU
 *    alguma está atrasada há mais de 30 dias → "Precisa de atenção imediata".
 */
export function avaliarSaude(d: {
  qtdAtrasadas: number;
  atrasadoCentavos: number;
  /** tudo em aberto, incluindo o atrasado */
  abertoTotalCentavos: number;
  maisAntigaEmDias: number;
}): Saude {
  if (d.qtdAtrasadas === 0) {
    return { nivel: "ok", titulo: "Tudo sob controle", motivo: "Nenhuma cobrança atrasada." };
  }
  const pct = d.abertoTotalCentavos > 0 ? (d.atrasadoCentavos / d.abertoTotalCentavos) * 100 : 0;
  const plural = d.qtdAtrasadas > 1;
  if (d.qtdAtrasadas >= LIMITE_ATRASO_IMEDIATO_QTD) {
    return { nivel: "imediata", titulo: "Precisa de atenção imediata", motivo: `${d.qtdAtrasadas} cobranças atrasadas (${LIMITE_ATRASO_IMEDIATO_QTD} ou mais).` };
  }
  if (pct >= LIMITE_ATRASO_IMEDIATO_PCT) {
    return { nivel: "imediata", titulo: "Precisa de atenção imediata", motivo: `O atraso passa de ${LIMITE_ATRASO_IMEDIATO_PCT}% de tudo o que está em aberto.` };
  }
  if (d.maisAntigaEmDias > LIMITE_ATRASO_IMEDIATO_DIAS) {
    return { nivel: "imediata", titulo: "Precisa de atenção imediata", motivo: `Há cobrança atrasada há mais de ${LIMITE_ATRASO_IMEDIATO_DIAS} dias.` };
  }
  return {
    nivel: "atencao",
    titulo: plural ? "Existem cobranças atrasadas" : "Atenção aos recebimentos",
    motivo: `${d.qtdAtrasadas} cobrança${plural ? "s" : ""} atrasada${plural ? "s" : ""}, ainda um atraso pequeno.`,
  };
}

/* ---------- alertas (só dados reais) ---------- */

export type Alerta = {
  id: string;
  tom: "perigo" | "atencao" | "info";
  texto: string;
  acao: { rotulo: string; href: string };
};

/* ---------- resultado ---------- */

export type ResumoDoNegocio = {
  semDados: boolean;
  receitaMesCentavos: number;
  receitaMesAnteriorCentavos: number;
  /** variação % da receita sobre o mês anterior; `null` quando não há base de comparação */
  variacaoPct: number | null;
  aReceberCentavos: number;
  qtdAReceber: number;
  emAtrasoCentavos: number;
  qtdEmAtraso: number;
  clientesEmAtraso: number;
  /** recebido no mês + ainda a vencer no mês (não é projeção, é o que já existe) */
  previsaoDoMesCentavos: number;
  venceEmBreve: { qtd: number; valorCentavos: number };
  maisAntigaEmDias: number;
  clientesAtivos: number;
  clientesNovosNoMes: number;
  /** média do valor recebido por cobrança paga nos últimos 3 meses; `null` sem nenhuma */
  ticketMedioCentavos: number | null;
  recorrente: { mensalCentavos: number; quantidade: number };
  saude: Saude;
  alertas: Alerta[];
  fluxo: { recebidoCentavos: number; aReceberCentavos: number; emAtrasoCentavos: number };
};

export const DIAS_DE_AVISO = 3;

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

export function resumirNegocio(entrada: EntradaDoNegocio): ResumoDoNegocio {
  const hoje = entrada.hoje ?? hojeISO();
  const iniMes = inicioDoMes(hoje);
  const iniMesAnterior = inicioDoMes(hoje, -1);
  const fim = fimDoMes(hoje);
  const limiteAviso = somarDias(hoje, DIAS_DE_AVISO);

  let receitaMes = 0;
  let receitaAnterior = 0;
  let somaTicket = 0;
  let qtdTicket = 0;
  for (const p of entrada.pagas) {
    const dia = diaDe(p.pago_em);
    const v = valorRecebido(p);
    if (dia >= iniMes) receitaMes += v;
    else if (dia >= iniMesAnterior) receitaAnterior += v;
    somaTicket += v;
    qtdTicket += 1;
  }

  let aReceber = 0;
  let qtdAReceber = 0;
  let aVencerNoMes = 0;
  let emAtraso = 0;
  let qtdEmAtraso = 0;
  let maisAntiga = 0;
  let breveQtd = 0;
  let breveValor = 0;
  const clientesAtrasados = new Set<string>();
  for (const c of entrada.abertas) {
    if (c.vence_em < hoje) {
      emAtraso += c.valor_centavos;
      qtdEmAtraso += 1;
      clientesAtrasados.add(c.cliente_id);
      maisAntiga = Math.max(maisAntiga, -diasAte(c.vence_em, hoje));
    } else {
      aReceber += c.valor_centavos;
      qtdAReceber += 1;
      if (c.vence_em <= fim) aVencerNoMes += c.valor_centavos;
      if (c.vence_em <= limiteAviso) {
        breveQtd += 1;
        breveValor += c.valor_centavos;
      }
    }
  }

  const recorrenteMensal = entrada.recorrencias.reduce((t, r) => t + r.valor_centavos, 0);
  const previsao = receitaMes + aVencerNoMes;
  const saude = avaliarSaude({
    qtdAtrasadas: qtdEmAtraso,
    atrasadoCentavos: emAtraso,
    abertoTotalCentavos: aReceber + emAtraso,
    maisAntigaEmDias: maisAntiga,
  });

  const semDados = entrada.totalDeCobrancas === 0;
  const alertas: Alerta[] = [];
  if (entrada.clientesAtivos === 0) {
    alertas.push({ id: "sem-clientes", tom: "info", texto: "Você ainda não cadastrou nenhum cliente.", acao: { rotulo: "Cadastrar cliente", href: "/app/clientes/novo" } });
  }
  if (entrada.totalDeCobrancas === 0) {
    alertas.push({ id: "sem-cobranca", tom: "info", texto: "Você ainda não criou sua primeira cobrança.", acao: { rotulo: "Criar cobrança", href: "/app/cobrancas/nova" } });
  }
  if (qtdEmAtraso > 0) {
    alertas.push({
      id: "atrasadas",
      tom: saude.nivel === "imediata" ? "perigo" : "atencao",
      texto: `${qtdEmAtraso === 1 ? "Você tem 1 cobrança vencida" : `Você tem ${qtdEmAtraso} cobranças vencidas`} (${brl(emAtraso)} em atraso).`,
      acao: { rotulo: "Recuperar cobrança", href: "/app/inadimplencia" },
    });
    if (clientesAtrasados.size > 0) {
      alertas.push({
        id: "clientes-atrasados",
        tom: "atencao",
        texto: `${clientesAtrasados.size === 1 ? "1 cliente está atrasado" : `${clientesAtrasados.size} clientes estão atrasados`}.`,
        acao: { rotulo: "Ver cobranças", href: "/app/inadimplencia" },
      });
    }
  }
  if (breveQtd > 0) {
    alertas.push({
      id: "vencem-em-breve",
      tom: "info",
      texto: `${breveQtd === 1 ? "1 cobrança vence" : `${breveQtd} cobranças vencem`} nos próximos ${DIAS_DE_AVISO} dias (${brl(breveValor)}).`,
      acao: { rotulo: "Ver cobranças", href: "/app/cobrancas?f=pendentes" },
    });
  }
  if (aVencerNoMes > 0) {
    alertas.push({
      id: "previsto",
      tom: "info",
      texto: `${brl(aVencerNoMes)} estão previstos para entrar ainda este mês.`,
      acao: { rotulo: "Ver recebimentos", href: "/app/recebimentos" },
    });
  }
  if (previsao > 0 && !semDados) {
    alertas.push({
      id: "previsao-do-mes",
      tom: "info",
      texto: `Sua receita prevista este mês é de ${brl(previsao)} (o que já entrou mais o que ainda vence no mês).`,
      acao: { rotulo: "Ver recebimentos", href: "/app/recebimentos" },
    });
  }

  return {
    semDados,
    receitaMesCentavos: receitaMes,
    receitaMesAnteriorCentavos: receitaAnterior,
    variacaoPct: receitaAnterior > 0 ? Math.round(((receitaMes - receitaAnterior) / receitaAnterior) * 100) : null,
    aReceberCentavos: aReceber,
    qtdAReceber,
    emAtrasoCentavos: emAtraso,
    qtdEmAtraso,
    clientesEmAtraso: clientesAtrasados.size,
    previsaoDoMesCentavos: previsao,
    venceEmBreve: { qtd: breveQtd, valorCentavos: breveValor },
    maisAntigaEmDias: maisAntiga,
    clientesAtivos: entrada.clientesAtivos,
    clientesNovosNoMes: entrada.clientesNovosNoMes,
    ticketMedioCentavos: qtdTicket > 0 ? Math.round(somaTicket / qtdTicket) : null,
    recorrente: { mensalCentavos: recorrenteMensal, quantidade: entrada.recorrencias.length },
    saude,
    alertas,
    fluxo: { recebidoCentavos: receitaMes, aReceberCentavos: aReceber, emAtrasoCentavos: emAtraso },
  };
}

/* ---------- gráfico: evolução da receita ---------- */

export type PeriodoDoGrafico = "7d" | "mes" | "3m";

export type PontoDaSerie = { rotulo: string; valorCentavos: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Receita recebida por dia (7 dias, mês corrente) ou por mês (3 meses). Só soma
 * o que está pago; dia sem recebimento aparece com zero — o gráfico nunca
 * "inventa" um valor.
 */
export function serieDeReceita(pagas: readonly CobrancaPaga[], periodo: PeriodoDoGrafico, hojeParam?: string): PontoDaSerie[] {
  const hoje = hojeParam ?? hojeISO();
  const porDia = new Map<string, number>();
  for (const p of pagas) {
    const dia = diaDe(p.pago_em);
    porDia.set(dia, (porDia.get(dia) ?? 0) + valorRecebido(p));
  }

  if (periodo === "7d") {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = somarDias(hoje, i - 6);
      return { rotulo: dia.slice(8, 10) + "/" + dia.slice(5, 7), valorCentavos: porDia.get(dia) ?? 0 };
    });
  }

  if (periodo === "mes") {
    const ini = inicioDoMes(hoje);
    const n = Number(hoje.slice(8, 10));
    return Array.from({ length: n }, (_, i) => {
      const dia = somarDias(ini, i);
      return { rotulo: String(i + 1), valorCentavos: porDia.get(dia) ?? 0 };
    });
  }

  const meses = [-2, -1, 0].map((d) => inicioDoMes(hoje, d));
  return meses.map((ini) => {
    const prefixo = ini.slice(0, 7);
    let soma = 0;
    for (const [dia, v] of porDia) if (dia.startsWith(prefixo)) soma += v;
    return { rotulo: MESES[Number(ini.slice(5, 7)) - 1], valorCentavos: soma };
  });
}

/** Larguras (%) do fluxo recebido → a receber → em atraso. Sem nada: três partes iguais e apagadas. */
export function proporcoesDoFluxo(f: { recebidoCentavos: number; aReceberCentavos: number; emAtrasoCentavos: number }): { recebido: number; aReceber: number; emAtraso: number } {
  const total = f.recebidoCentavos + f.aReceberCentavos + f.emAtrasoCentavos;
  if (total <= 0) return { recebido: 0, aReceber: 0, emAtraso: 0 };
  const recebido = Math.round((f.recebidoCentavos / total) * 100);
  const aReceber = Math.round((f.aReceberCentavos / total) * 100);
  return { recebido, aReceber, emAtraso: Math.max(0, 100 - recebido - aReceber) };
}

export function textoDaVariacao(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct === 0) return "igual ao mês anterior";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% em relação ao mês anterior`;
}
