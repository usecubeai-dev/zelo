/**
 * Tutorial "Vamos fazer sua primeira cobrança?" — o conteúdo de cada passo,
 * adaptado ao estado REAL da conta (puro: sem React, sem banco).
 *
 * Regra de honestidade: o tutorial nunca diz que dá para enviar ao cliente
 * antes de existir um link de pagamento válido. O passo 1 muda conforme a
 * conta de recebimentos; os passos 2 e 3 refletem o que a empresa já fez.
 */

import type { EstadoRecebimentos } from "./recebimentos";

export type PassoDoTutorial = {
  id: "conta" | "cliente" | "cobranca" | "envio" | "acompanhar";
  titulo: string;
  texto: string;
  feito: boolean;
  acao: { rotulo: string; href: string } | null;
};

export type EntradaDoTutorial = {
  estado: EstadoRecebimentos;
  temClientes: boolean;
  temCobrancas: boolean;
};

function passoDaConta(estado: EstadoRecebimentos): PassoDoTutorial {
  const base = { id: "conta" as const, titulo: "Conecte sua conta de recebimentos" };
  const config = "/app/configuracoes#recebimentos";
  switch (estado) {
    case "pronta":
      return { ...base, texto: "Sua conta está aprovada. Os links de pagamento já podem ser gerados.", feito: true, acao: null };
    case "nao_conectada":
      return {
        ...base,
        texto: "Configure os dados necessários e aguarde a aprovação quando exigida.",
        feito: false,
        acao: { rotulo: "Conectar conta", href: config },
      };
    case "conectando":
      return {
        ...base,
        texto: "Estamos conectando sua conta. Acompanhe o andamento nas configurações.",
        feito: false,
        acao: { rotulo: "Ver status da conta", href: config },
      };
    case "em_analise":
    case "nao_conferida":
    case "cadastro_incompleto":
      return {
        ...base,
        titulo: "Aguarde a aprovação da sua conta",
        texto:
          "Sua conta foi conectada, mas o Asaas ainda precisa aprovar. Você pode seguir com o cliente e a cobrança; o link de pagamento só aparece depois da aprovação.",
        feito: false,
        acao: { rotulo: "Ver status da conta", href: config },
      };
    case "conexao_recusada":
    case "recusada":
    case "bloqueada":
      return {
        ...base,
        titulo: "Resolva a pendência da sua conta",
        texto: "Sua conta precisa de atenção antes de gerar links de pagamento. Veja nas configurações o que fazer.",
        feito: false,
        acao: { rotulo: "Ver o que fazer", href: config },
      };
    case "indisponivel":
    default:
      return {
        ...base,
        texto: "Não conseguimos conferir sua conta agora. Veja o status nas configurações.",
        feito: false,
        acao: { rotulo: "Ver status da conta", href: config },
      };
  }
}

export function passosDoTutorial(e: EntradaDoTutorial): PassoDoTutorial[] {
  const pronta = e.estado === "pronta";
  return [
    passoDaConta(e.estado),
    {
      id: "cliente",
      titulo: "Cadastre seu cliente",
      texto: "Nome e contato (WhatsApp ou e-mail) necessários para a cobrança.",
      feito: e.temClientes,
      acao: e.temClientes ? null : { rotulo: "Cadastrar cliente", href: "/app/clientes/novo" },
    },
    {
      id: "cobranca",
      titulo: "Crie a cobrança",
      texto: "Escolha cliente, descrição, valor e vencimento. Ela fica salva mesmo se a conta ainda não estiver pronta.",
      feito: e.temCobrancas,
      acao: e.temCobrancas ? null : { rotulo: "Criar cobrança", href: "/app/cobrancas/nova" },
    },
    {
      id: "envio",
      titulo: "Envie para o cliente",
      texto: pronta
        ? "Use WhatsApp, Copiar link ou E-mail, quando disponíveis, na tela da cobrança."
        : "WhatsApp, Copiar link e E-mail aparecem na tela da cobrança quando o link de pagamento estiver pronto.",
      feito: false,
      acao: null,
    },
    {
      id: "acompanhar",
      titulo: "Acompanhe o pagamento",
      texto: "Veja o status de cada cobrança na tela de cobranças. O pagamento só conta como recebido quando é confirmado.",
      feito: false,
      acao: { rotulo: "Ver cobranças", href: "/app/cobrancas" },
    },
  ];
}

/** O primeiro passo ainda pendente entre os três que dependem da pessoa (conta, cliente, cobrança). */
export function passoAtual(passos: PassoDoTutorial[]): PassoDoTutorial["id"] | null {
  const p = passos.slice(0, 3).find((x) => !x.feito);
  return p ? p.id : null;
}
