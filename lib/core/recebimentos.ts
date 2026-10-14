/**
 * Conta de recebimentos — o que a PESSOA precisa saber antes de cobrar.
 *
 * Funções puras (sem banco, sem rede, sem React): as mesmas regras valem na
 * tela "Nova cobrança", na ficha da cobrança, na lista, no tutorial e nos
 * testes. Reaproveita o modelo que já existe em `conta-financeira.ts`
 * (`EstadoOnboarding` do Zelo + `StatusAprovacao` do Asaas); não cria estado
 * novo no banco.
 *
 * Regra de honestidade: "ativa" no banco do Zelo só quer dizer que a subconta
 * FOI CRIADA. Aprovada é outra coisa — só o Asaas diz, e só `APPROVED` conta.
 * Uma conta criada cuja aprovação ainda não foi conferida NÃO é tratada como
 * pronta e também NÃO é tratada como "em análise": é "ainda não conferida".
 */

import { SituacaoContaAsaas, StatusAprovacao, estadoConceitual, type ContaFinanceira } from "./conta-financeira";
import { redigirParaLog } from "./dados-subconta";

export type EstadoRecebimentos =
  | "nao_conectada"
  | "conectando"
  | "conexao_recusada"
  | "bloqueada"
  | "cadastro_incompleto"
  | "em_analise"
  | "nao_conferida"
  | "recusada"
  | "pronta"
  | "indisponivel";

/**
 * `situacao` (lida ao vivo do Asaas) é opcional: só com ela dá para separar
 * "falta documento" de "em análise". Sem ela, usa o que já está gravado.
 */
export function estadoDeRecebimentos(
  conta: Pick<ContaFinanceira, "estadoOnboarding" | "statusAprovacao"> | null,
  situacao: SituacaoContaAsaas | null = null
): EstadoRecebimentos {
  if (!conta) return "indisponivel";
  switch (conta.estadoOnboarding) {
    case "nao_iniciada":
      return "nao_conectada";
    case "criando":
      return "conectando";
    case "recusada":
      return "conexao_recusada";
    case "bloqueada":
      return "bloqueada";
    case "criada":
      break;
  }

  if (situacao) {
    const e = estadoConceitual("criada", situacao);
    if (e === "aprovado") return "pronta";
    if (e === "recusado") return "recusada";
    if (e === "documentacao_pendente") return "cadastro_incompleto";
    return "em_analise";
  }

  const a: StatusAprovacao | null = conta.statusAprovacao;
  if (a === "APPROVED") return "pronta";
  if (a === "REJECTED") return "recusada";
  if (a === "PENDING" || a === "AWAITING_APPROVAL") return "em_analise";
  return "nao_conferida";
}

export type AvisoRecebimentos = {
  estado: EstadoRecebimentos;
  tom: "neutro" | "atencao" | "sucesso" | "erro";
  titulo: string;
  texto: string;
  /** a única ação que realmente resolve este estado (ou `null` quando não há o que fazer) */
  acao: { rotulo: string; href: string } | null;
  /** o link de pagamento pode ser gerado com segurança agora? */
  podeGerarLink: boolean;
  /** vale oferecer "tentar preparar mesmo assim" (a tentativa é segura e idempotente)? */
  podeTentar: boolean;
};

const CONFIG = "/app/configuracoes#recebimentos";

export function avisoDeRecebimentos(estado: EstadoRecebimentos): AvisoRecebimentos {
  switch (estado) {
    case "nao_conectada":
      return {
        estado,
        tom: "atencao",
        titulo: "Conecte sua conta de recebimentos",
        texto:
          "Para gerar o link de pagamento e enviar a cobrança ao cliente, precisamos concluir a configuração da sua conta.",
        acao: { rotulo: "Conectar conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: false,
      };
    case "conectando":
      return {
        estado,
        tom: "neutro",
        titulo: "Estamos conectando sua conta",
        texto: "A conexão da sua conta de recebimentos ainda não terminou. Acompanhe nas configurações.",
        acao: { rotulo: "Ver status da conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: false,
      };
    case "conexao_recusada":
      return {
        estado,
        tom: "erro",
        titulo: "Não conseguimos conectar sua conta",
        texto: "Algum dado não foi aceito. Corrija nas configurações e tente conectar de novo.",
        acao: { rotulo: "Corrigir dados da conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: false,
      };
    case "bloqueada":
      return {
        estado,
        tom: "erro",
        titulo: "Sua conta precisa de suporte",
        texto: "Encontramos um problema na conexão que não dá para resolver sozinho. Fale com o suporte do Zelo.",
        acao: { rotulo: "Ver detalhes", href: CONFIG },
        podeGerarLink: false,
        podeTentar: false,
      };
    case "cadastro_incompleto":
      return {
        estado,
        tom: "atencao",
        titulo: "Faltam dados ou documentos da sua conta",
        texto:
          "O Asaas ainda precisa receber informações para liberar sua conta. Veja nas configurações exatamente o que falta.",
        acao: { rotulo: "Ver o que falta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: true,
      };
    case "em_analise":
      return {
        estado,
        tom: "atencao",
        titulo: "Sua conta está em análise",
        texto: "O Asaas ainda precisa concluir a aprovação. Você pode acompanhar o status nas configurações.",
        acao: { rotulo: "Ver status da conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: true,
      };
    case "nao_conferida":
      return {
        estado,
        tom: "atencao",
        titulo: "Vamos conferir a situação da sua conta",
        texto:
          "Sua conta foi conectada, mas ainda não conferimos se o Asaas já a aprovou. Veja o status nas configurações.",
        acao: { rotulo: "Ver status da conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: true,
      };
    case "recusada":
      return {
        estado,
        tom: "erro",
        titulo: "O Asaas não aprovou sua conta",
        texto: "A análise encontrou um problema. Veja nas configurações o que precisa ser corrigido.",
        acao: { rotulo: "Ver o que corrigir", href: CONFIG },
        podeGerarLink: false,
        podeTentar: false,
      };
    case "pronta":
      return {
        estado,
        tom: "sucesso",
        titulo: "Conta pronta para gerar pagamentos",
        texto: "Sua conta de recebimentos está aprovada.",
        acao: null,
        podeGerarLink: true,
        podeTentar: true,
      };
    case "indisponivel":
    default:
      return {
        estado: "indisponivel",
        tom: "atencao",
        titulo: "Não conseguimos conferir sua conta agora",
        texto: "Tente de novo em instantes. Sua cobrança fica salva.",
        acao: { rotulo: "Ver status da conta", href: CONFIG },
        podeGerarLink: false,
        podeTentar: true,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Causa real de uma tentativa de preparar o pagamento                 */
/* ------------------------------------------------------------------ */

export type CausaDoPreparo =
  | "sem_conta"
  | "em_andamento"
  | "sem_acesso"
  | "nao_liberada"
  | "dados_recusados"
  | "provedor_fora"
  | "desconhecida";

export type ExplicacaoDoPreparo = {
  causa: CausaDoPreparo;
  /** português simples, sem dado pessoal, sem segredo, sem stack */
  mensagem: string;
  acao: { rotulo: string; href: string } | null;
};

type ErroDoPreparo = { codigo?: string; statusProvedor?: number; detalheInterno?: string };

/**
 * Traduz o que realmente aconteceu na tentativa em algo que a pessoa entende.
 * Só afirma o que o status/código comprovam; o resto cai em "falha
 * temporária" — nunca inventa um motivo.
 */
export function explicarPreparoDoPagamento(erro: ErroDoPreparo): ExplicacaoDoPreparo {
  if (erro.codigo === "sem_credencial") {
    return {
      causa: "sem_conta",
      mensagem: "Sua conta de recebimentos ainda não está disponível para gerar pagamentos. Conclua a conexão nas configurações.",
      acao: { rotulo: "Ver status da conta", href: CONFIG },
    };
  }
  if (erro.codigo === "em_andamento") {
    return {
      causa: "em_andamento",
      mensagem: "O pagamento já está sendo preparado. Atualize em alguns segundos.",
      acao: null,
    };
  }
  const s = erro.statusProvedor;
  if (s === 401) {
    return {
      causa: "sem_acesso",
      mensagem: "Não conseguimos acessar a sua conta de recebimentos no Asaas. Fale com o suporte do Zelo.",
      acao: { rotulo: "Ver status da conta", href: CONFIG },
    };
  }
  if (s === 403) {
    return {
      causa: "nao_liberada",
      mensagem: "O Asaas ainda não liberou sua conta para gerar cobranças. Confira a aprovação nas configurações.",
      acao: { rotulo: "Ver status da conta", href: CONFIG },
    };
  }
  if (s === 400 && erro.detalheInterno && erro.detalheInterno.length <= 200) {
    return {
      causa: "dados_recusados",
      mensagem: `O Asaas não aceitou os dados desta cobrança: ${redigirParaLog(erro.detalheInterno)}`,
      acao: null,
    };
  }
  if (s !== undefined && (s >= 500 || s === 0)) {
    return {
      causa: "provedor_fora",
      mensagem: "Não conseguimos acessar o serviço de pagamentos agora. Tente novamente em instantes.",
      acao: null,
    };
  }
  return {
    causa: "desconhecida",
    mensagem: "A cobrança foi criada, mas o link ainda não está disponível. Tente novamente em instantes.",
    acao: null,
  };
}

/** A cobrança já tem pagamento no provedor? (decide entre "link pendente" e "link preparado") */
export function pagamentoPreparado(c: { asaas_payment_id: string | null }): boolean {
  return Boolean(c.asaas_payment_id);
}
