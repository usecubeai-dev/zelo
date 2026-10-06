/**
 * Cobrar → lembrar → recuperar → receber: atraso, valor atualizado, estados de
 * recuperação, lembretes e resumos. PURO (sem banco, sem rede, sem React).
 *
 * Forma de pagamento e encargos (multa/juros) vivem em `./encargos`, de onde
 * este módulo reexporta tudo — quem importa daqui enxerga os dois.
 */

import { diasAte, hojeISO } from "./cobranca";
import { Encargos, FormaPagamento, SEM_ENCARGOS, ehFormaPagamento, temEncargos } from "./encargos";

export * from "./encargos";

/* ---------- atraso e valor atualizado ---------- */

export function diasDeAtraso(venceEm: string, hoje: string = hojeISO()): number {
  return Math.max(0, -diasAte(venceEm, hoje));
}

export type ValorAtualizado = {
  diasAtraso: number;
  multaCentavos: number;
  jurosCentavos: number;
  totalCentavos: number;
  /** `true` quando algum encargo foi somado */
  aplicou: boolean;
};

/**
 * ESTIMATIVA do valor com encargos, inteira em centavos: multa uma vez;
 * juros proporcionais aos dias de atraso sobre `jurosPctMes / 30` ao dia.
 * Quem calcula o valor final de verdade é o Asaas, no momento do pagamento
 * do boleto — a tela sempre diz "estimativa". Sem atraso ou sem encargo
 * configurado, devolve o valor original.
 */
export function valorAtualizado(dados: {
  valorCentavos: number;
  venceEm: string;
  hoje?: string;
  encargos: Encargos;
}): ValorAtualizado {
  const dias = diasDeAtraso(dados.venceEm, dados.hoje ?? hojeISO());
  const base = dados.valorCentavos;
  if (dias <= 0 || !temEncargos(dados.encargos)) {
    return { diasAtraso: dias, multaCentavos: 0, jurosCentavos: 0, totalCentavos: base, aplicou: false };
  }
  const multa = Math.round((base * (dados.encargos.multaPct ?? 0)) / 100);
  const juros = Math.round((base * (dados.encargos.jurosPctMes ?? 0) * dias) / 100 / 30);
  return { diasAtraso: dias, multaCentavos: multa, jurosCentavos: juros, totalCentavos: base + multa + juros, aplicou: multa + juros > 0 };
}

/* ---------- estados de recuperação ---------- */

export type EstadoRecuperacao =
  | "a_vencer"
  | "proxima_do_vencimento"
  | "vence_hoje"
  | "vencida"
  | "em_recuperacao"
  | "negociada"
  | "paga"
  | "encerrada";

export const ROTULO_RECUPERACAO: Record<EstadoRecuperacao, string> = {
  a_vencer: "A vencer",
  proxima_do_vencimento: "Próxima do vencimento",
  vence_hoje: "Vence hoje",
  vencida: "Vencida",
  em_recuperacao: "Em recuperação",
  negociada: "Negociada",
  paga: "Paga",
  encerrada: "Encerrada",
};

/** Dias antes do vencimento em que a cobrança passa a ser "próxima". */
export const DIAS_PROXIMA = 3;

/**
 * Estado de recuperação, derivado (nunca gravado): vem do status, do
 * vencimento, de "marcada como negociada" e de já ter havido uma ação de
 * contato. Cobrança paga/cancelada/estornada nunca entra em recuperação.
 */
export function estadoDeRecuperacao(
  cobranca: { status: string; vence_em: string; negociada_em?: string | null },
  temContato: boolean,
  hoje: string = hojeISO()
): EstadoRecuperacao {
  if (cobranca.status === "paga") return "paga";
  if (cobranca.status !== "pendente" && cobranca.status !== "enviada") return "encerrada";
  const dias = diasAte(cobranca.vence_em, hoje);
  if (dias > DIAS_PROXIMA) return "a_vencer";
  if (dias > 0) return "proxima_do_vencimento";
  if (dias === 0) return "vence_hoje";
  if (cobranca.negociada_em) return "negociada";
  return temContato ? "em_recuperacao" : "vencida";
}

/** A frase de recomendação — uma só, direta, sem prometer resultado. */
export function recomendacao(estado: EstadoRecuperacao, diasAtraso: number): string | null {
  switch (estado) {
    case "proxima_do_vencimento":
      return "Vence em breve. Um lembrete agora ajuda a receber no prazo.";
    case "vence_hoje":
      return "Vence hoje. Vale lembrar o cliente.";
    case "vencida":
      return "Essa cobrança está atrasada.";
    case "em_recuperacao":
      return "Você já entrou em contato. Acompanhe o pagamento.";
    case "negociada":
      return "Marcada como negociada.";
    default:
      return null;
  }
}

/** O que sugerir primeiro, conforme o tempo de atraso. Só texto — o profissional decide. */
export function acaoRecomendada(diasAtraso: number): string {
  if (diasAtraso <= 3) return "Enviar lembrete";
  if (diasAtraso <= 14) return "Cobrar de novo pelo WhatsApp";
  return "Recuperar cobrança";
}

/* ---------- ações de recuperação e lembretes ---------- */

export type TipoAcaoCobranca = "whatsapp" | "link_copiado" | "lembrete_whatsapp" | "negociada" | "reaberta";

export const TIPOS_DE_ACAO: readonly TipoAcaoCobranca[] = ["whatsapp", "link_copiado", "lembrete_whatsapp", "negociada", "reaberta"];

export function ehTipoDeAcao(v: unknown): v is TipoAcaoCobranca {
  return typeof v === "string" && (TIPOS_DE_ACAO as readonly string[]).includes(v);
}

export const ROTULO_ACAO_COBRANCA: Record<TipoAcaoCobranca, string> = {
  whatsapp: "WhatsApp aberto",
  link_copiado: "Link copiado",
  lembrete_whatsapp: "Lembrete pelo WhatsApp",
  negociada: "Marcada como negociada",
  reaberta: "Reaberta",
};

/** Ações que contam como "já entrei em contato" (negociar/reabrir não contam). */
export function contaComoContato(tipo: string): boolean {
  return tipo === "whatsapp" || tipo === "link_copiado" || tipo === "lembrete_whatsapp";
}

export type RegraLembrete = "3d_antes" | "no_dia" | "1d_depois" | "3d_depois" | "7d_depois";

export const REGRAS_DE_LEMBRETE: readonly { id: RegraLembrete; deslocamento: number; rotulo: string }[] = [
  { id: "3d_antes", deslocamento: -3, rotulo: "3 dias antes do vencimento" },
  { id: "no_dia", deslocamento: 0, rotulo: "No dia do vencimento" },
  { id: "1d_depois", deslocamento: 1, rotulo: "1 dia depois do vencimento" },
  { id: "3d_depois", deslocamento: 3, rotulo: "3 dias depois do vencimento" },
  { id: "7d_depois", deslocamento: 7, rotulo: "7 dias depois do vencimento" },
];

export function ehRegraDeLembrete(v: unknown): v is RegraLembrete {
  return REGRAS_DE_LEMBRETE.some((r) => r.id === v);
}

/** Quais regras a empresa ligou (espelha as colunas `lembrete_*` de `empresas`). */
export type ConfigLembretes = Record<RegraLembrete, boolean>;

export const LEMBRETES_DESLIGADOS: ConfigLembretes = {
  "3d_antes": false,
  no_dia: false,
  "1d_depois": false,
  "3d_depois": false,
  "7d_depois": false,
};

/** `YYYY-MM-DD` + n dias, sem depender de fuso. */
export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Quantos dias a regra continua "de hoje" depois do dia em que cai (hoje e ontem). */
export const JANELA_LEMBRETE_DIAS = 2;

/**
 * Lembrete que está na vez desta cobrança em aberto, ou `null`.
 *
 * Uma regra está na vez no dia em que cai e no dia seguinte (quem não
 * abriu o Zelo ontem ainda a vê hoje) — e some assim que houver uma ação de
 * contato registrada a partir do dia da regra. Escolhe a regra mais
 * recente. NADA é enviado: a lista só diz o que o profissional deveria
 * mandar; quem manda é ele, pelo botão do WhatsApp.
 */
export function lembreteDaVez(dados: {
  venceEm: string;
  hoje: string;
  config: ConfigLembretes;
  /** `YYYY-MM-DD` do último contato registrado, ou `null` */
  ultimoContatoEm: string | null;
}): RegraLembrete | null {
  let escolhida: { id: RegraLembrete; dia: string } | null = null;
  for (const regra of REGRAS_DE_LEMBRETE) {
    if (!dados.config[regra.id]) continue;
    const dia = somarDias(dados.venceEm, regra.deslocamento);
    const naJanela = dados.hoje >= dia && dados.hoje < somarDias(dia, JANELA_LEMBRETE_DIAS);
    if (!naJanela) continue;
    if (dados.ultimoContatoEm && dados.ultimoContatoEm >= dia) continue;
    if (!escolhida || dia > escolhida.dia) escolhida = { id: regra.id, dia };
  }
  return escolhida?.id ?? null;
}

export function rotuloDaRegra(id: RegraLembrete): string {
  return REGRAS_DE_LEMBRETE.find((r) => r.id === id)?.rotulo ?? id;
}

/* ---------- preferências da empresa ---------- */

export type CanalPreferencial = "whatsapp" | "link";

export const ROTULO_CANAL: Record<CanalPreferencial, string> = {
  whatsapp: "WhatsApp (abre a conversa com a mensagem pronta)",
  link: "Só o link de pagamento (copiar e colar)",
};

export function ehCanal(v: unknown): v is CanalPreferencial {
  return v === "whatsapp" || v === "link";
}

export type PreferenciasCobranca = {
  forma: FormaPagamento;
  encargos: Encargos;
  lembretes: ConfigLembretes;
  canal: CanalPreferencial;
};

export const PREFERENCIAS_PADRAO: PreferenciasCobranca = {
  forma: "pix",
  encargos: SEM_ENCARGOS,
  lembretes: LEMBRETES_DESLIGADOS,
  canal: "whatsapp",
};

/** Linha de `empresas` (colunas novas) → preferências. Valor desconhecido cai no padrão seguro. */
export function preferenciasDaEmpresa(linha: Record<string, unknown> | null | undefined): PreferenciasCobranca {
  if (!linha) return PREFERENCIAS_PADRAO;
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    forma: ehFormaPagamento(linha.cobranca_forma_padrao) ? linha.cobranca_forma_padrao : "pix",
    encargos: { multaPct: num(linha.multa_padrao_pct), jurosPctMes: num(linha.juros_padrao_pct_mes) },
    lembretes: {
      "3d_antes": linha.lembrete_3d_antes === true,
      no_dia: linha.lembrete_no_dia === true,
      "1d_depois": linha.lembrete_1d_depois === true,
      "3d_depois": linha.lembrete_3d_depois === true,
      "7d_depois": linha.lembrete_7d_depois === true,
    },
    canal: ehCanal(linha.canal_preferencial) ? linha.canal_preferencial : "whatsapp",
  };
}

/** Colunas de `empresas` que guardam as preferências — para o `select`. */
export const COLUNAS_PREFERENCIAS =
  "cobranca_forma_padrao, multa_padrao_pct, juros_padrao_pct_mes, lembrete_3d_antes, lembrete_no_dia, lembrete_1d_depois, lembrete_3d_depois, lembrete_7d_depois, canal_preferencial";

/* ---------- resumo financeiro (cliente e painel) ---------- */

export type LinhaFinanceira = {
  status: string;
  vence_em: string;
  valor_centavos: number;
  valor_pago_centavos: number | null;
};

export type ResumoFinanceiro = {
  /** soma de tudo que foi cobrado e não foi cancelado */
  contratadoCentavos: number;
  recebidoCentavos: number;
  /** em aberto (a vencer + atrasado) */
  emAbertoCentavos: number;
  atrasadoCentavos: number;
  qtdAtrasadas: number;
  proxima: { venceEm: string; valorCentavos: number } | null;
  emDia: boolean;
};

export function resumirFinanceiro(linhas: readonly LinhaFinanceira[], hoje: string = hojeISO()): ResumoFinanceiro {
  let contratado = 0;
  let recebido = 0;
  let aberto = 0;
  let atrasado = 0;
  let qtd = 0;
  let proxima: ResumoFinanceiro["proxima"] = null;
  for (const l of linhas) {
    if (l.status === "cancelada") continue;
    contratado += l.valor_centavos;
    if (l.status === "paga") {
      recebido += l.valor_pago_centavos ?? l.valor_centavos;
    } else if (l.status === "pendente" || l.status === "enviada") {
      aberto += l.valor_centavos;
      if (l.vence_em < hoje) {
        atrasado += l.valor_centavos;
        qtd += 1;
      } else if (!proxima || l.vence_em < proxima.venceEm) {
        proxima = { venceEm: l.vence_em, valorCentavos: l.valor_centavos };
      }
    }
  }
  return { contratadoCentavos: contratado, recebidoCentavos: recebido, emAbertoCentavos: aberto, atrasadoCentavos: atrasado, qtdAtrasadas: qtd, proxima, emDia: qtd === 0 };
}
