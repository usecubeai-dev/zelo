/**
 * Planos e checkout — o que a tela mostra e como o estado do pagamento é
 * decidido. PURO (sem banco, sem rede, sem React).
 *
 * Duas regras de honestidade que mandam neste arquivo:
 *  1. Só se promete o que existe. Hoje TODOS os planos têm os mesmos recursos;
 *     o que muda é o limite de clientes (ver `lib/plano.ts`). A comparação
 *     mostra isso, não inventa diferenças.
 *  2. "Pago" só existe quando o BACKEND confirmou (a mensalidade está paga no
 *     banco, gravada pelo webhook ou pela conferência do servidor). Clicar em
 *     "Já paguei", voltar do pagamento ou ter "sucesso" na URL nunca bastam.
 */

import { LIMITE_DE_CLIENTES, Plano, PRECO_POR_PLANO_CENTAVOS, descricaoDoLimite } from "./plano";

/** O que todo plano inclui hoje — nada aqui é promessa de funcionalidade futura. */
export const RECURSOS_DOS_PLANOS: readonly string[] = [
  "Cobranças",
  "Recorrências",
  "Controle de recebimentos",
  "Acompanhamento de atrasos",
  "WhatsApp em 1 clique",
];

export const FRASE_DO_PLANO: Record<Plano, string> = {
  gratis: "Plano mantido nas contas antigas.",
  essencial: "Para quem quer organizar suas cobranças.",
  negocio: "Para quem vive de cobrança recorrente.",
  escola: "Para negócios com muitos clientes.",
  teste: "Plano de teste do administrador.",
};

/**
 * Planos da VITRINE: os três que a pessoa pode contratar, na ordem da tela
 * (o Negócio, no meio, é o destaque). O Grátis NÃO é uma opção comercial: ele
 * continua existindo no backend e nas contas que já estão nele, mas nunca é
 * oferecido aqui. O plano de teste (R$ 5) é só do administrador e fica fora.
 */
export const PLANOS_DA_TELA: readonly Exclude<Plano, "teste" | "gratis">[] = ["essencial", "negocio", "escola"];

export type LinhaComparacao = {
  rotulo: string;
  /** um valor por plano, na ordem de `PLANOS_DA_TELA`: `true` = inclui, texto = o que muda */
  valores: (boolean | string)[];
};

/**
 * Comparação curta: só o que ajuda a decidir e só o que é verdade. Hoje não
 * existe diferença de recurso entre os planos (não há "gating" por plano):
 * muda apenas o limite de clientes — e a tabela diz exatamente isso.
 */
export function comparacaoDosPlanos(): LinhaComparacao[] {
  const todos = PLANOS_DA_TELA.map(() => true);
  return [
    {
      rotulo: "Clientes",
      valores: PLANOS_DA_TELA.map((p) => {
        const limite = LIMITE_DE_CLIENTES[p];
        return limite === null ? "Ilimitados" : `Até ${limite}`;
      }),
    },
    { rotulo: "Recorrências", valores: todos },
    { rotulo: "Recebimentos", valores: todos },
    { rotulo: "WhatsApp em 1 clique", valores: todos },
    { rotulo: "Recursos de gestão", valores: todos },
  ];
}

export function textoDoLimite(plano: Plano): string {
  return descricaoDoLimite(plano);
}

export function mensalidadeDoPlano(plano: Plano): number {
  return PRECO_POR_PLANO_CENTAVOS[plano];
}

/* ---------- estados do pagamento ---------- */

export type EstadoPagamento = "aguardando" | "processando" | "pago" | "falhou" | "cancelado" | "expirado";

/** Status do pagamento no provedor que significam "o dinheiro entrou ou está entrando". */
const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const STATUS_EM_ANALISE = new Set(["AWAITING_RISK_ANALYSIS", "REFUND_REQUESTED", "REFUND_IN_PROGRESS_FOR_EXTERN_REF"]);
const STATUS_PROBLEMA = new Set(["CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"]);

/**
 * Estado que a tela mostra.
 *
 * `confirmadoNoBanco` é a ÚNICA porta para "pago": a mensalidade já está paga
 * no banco do Zelo. Se o provedor diz que recebeu mas o banco ainda não tem
 * isso, a tela mostra "processando" — nunca "pago".
 */
export function estadoDoPagamento(dados: {
  statusProvedor: string | null | undefined;
  confirmadoNoBanco: boolean;
}): EstadoPagamento {
  if (dados.confirmadoNoBanco) return "pago";
  const s = dados.statusProvedor ?? "";
  if (STATUS_PAGO.has(s) || STATUS_EM_ANALISE.has(s)) return "processando";
  if (STATUS_PROBLEMA.has(s)) return "falhou";
  if (s === "OVERDUE") return "expirado";
  if (s === "DELETED" || s === "REFUNDED") return "cancelado";
  return "aguardando";
}

export type TextoDoEstado = { titulo: string; descricao: string; tom: "neutro" | "atencao" | "sucesso" | "erro" };

export const TEXTO_DO_ESTADO: Record<EstadoPagamento, TextoDoEstado> = {
  aguardando: {
    titulo: "Estamos esperando seu pagamento",
    descricao: "O pagamento ainda não foi confirmado. Assim que for, sua assinatura é ativada sozinha.",
    tom: "atencao",
  },
  processando: {
    titulo: "Estamos confirmando seu pagamento…",
    descricao: "Recebemos o aviso de pagamento e estamos confirmando. Isso costuma levar poucos instantes.",
    tom: "neutro",
  },
  pago: {
    titulo: "Tudo certo! 🎉",
    descricao: "Sua assinatura está ativa.",
    tom: "sucesso",
  },
  falhou: {
    titulo: "Não conseguimos confirmar o pagamento",
    descricao: "Houve um problema com este pagamento. Você pode tentar de novo ou escolher outro plano.",
    tom: "erro",
  },
  cancelado: {
    titulo: "Este pagamento foi cancelado",
    descricao: "Nada foi cobrado. Se ainda quiser assinar, volte aos planos e escolha de novo.",
    tom: "neutro",
  },
  expirado: {
    titulo: "Este pagamento venceu",
    descricao: "O prazo passou e nada foi cobrado. Gere um novo pagamento para assinar.",
    tom: "erro",
  },
};

/** "Pix", "Cartão", "Boleto" — formas que o checkout oferece. */
export type FormaDoCheckout = "pix" | "cartao" | "boleto";

/** CPF (até 11 dígitos) ou CNPJ (12 a 14): máscara progressiva, enquanto a pessoa digita. */
export function mascararDocumento(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    const [a, b, e, f] = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
    return a + (b ? `.${b}` : "") + (e ? `.${e}` : "") + (f ? `-${f}` : "");
  }
  const [a, b, e, f, g] = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  return `${a}.${b}.${e}/${f}${g ? `-${g}` : ""}`;
}
