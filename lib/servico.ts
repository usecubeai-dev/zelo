/**
 * Contrato de serviço — mesmo padrão de `lib/cliente.ts`: sem React,
 * sem DOM, para valer igual nos dois lados.
 *
 * É o vínculo que faltava entre Cliente e Cobrança: hoje uma cobrança
 * nasce com descrição e valor livres, digitados de novo a cada vez.
 * Um serviço cadastrado (nome + tipo + valor) deixa esses dois campos
 * prontos pra reaproveitar — mas continua opcional: `servico_id` é
 * `null`-ável em `cobrancas`/`recorrencias`, e nada quebra pra quem
 * prefere continuar digitando avulso.
 */

import { paraCentavos } from "./dinheiro";

export type StatusServico = "ativo" | "arquivado";

/** "avulso" é serviço pontual (mesma ideia de cobrança avulsa); os
 *  demais descrevem a periodicidade típica quando ligado a uma
 *  recorrência — mas o tipo é só rótulo, não força nenhum comportamento:
 *  a recorrência que decide o `dia_vencimento`/`periodicidade` de verdade. */
export type TipoServico =
  | "avulso"
  | "mensalidade"
  | "pacote"
  | "trimestral"
  | "semestral";

export type Servico = {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: TipoServico;
  valor_centavos: number;
  status: StatusServico;
  criado_em: string;
  atualizado_em: string;
};

export type DadosServico = {
  nome: string;
  tipo: TipoServico;
  /** como o usuário digitou: "150,00" */
  valor: string;
};

export type CampoServico = keyof DadosServico;
export type ErrosServico = Partial<Record<CampoServico, string>>;

export const SERVICO_VAZIO: DadosServico = {
  nome: "",
  tipo: "avulso",
  valor: "",
};

export const ROTULOS_SERVICO: Record<CampoServico, string> = {
  nome: "Nome do serviço",
  tipo: "Tipo",
  valor: "Valor",
};

export const ROTULO_TIPO_SERVICO: Record<TipoServico, string> = {
  avulso: "Avulso",
  mensalidade: "Mensalidade",
  pacote: "Pacote",
  trimestral: "Trimestral",
  semestral: "Semestral",
};

export const ORDEM_TIPOS_SERVICO: TipoServico[] = [
  "avulso",
  "mensalidade",
  "pacote",
  "trimestral",
  "semestral",
];

export const ORDEM_SERVICO: CampoServico[] = ["nome", "tipo", "valor"];

const VALOR_MAXIMO_CENTAVOS = 100_000_000;

export function ehTipoServico(valor: unknown): valor is TipoServico {
  return ORDEM_TIPOS_SERVICO.includes(valor as TipoServico);
}

export function validarServico(dados: DadosServico): ErrosServico {
  const erros: ErrosServico = {};

  const nome = dados.nome.trim();
  if (nome.length < 2) erros.nome = "Descreva o serviço.";
  else if (nome.length > 120) erros.nome = "Nome muito longo.";

  if (!ehTipoServico(dados.tipo)) erros.tipo = "Escolha um tipo válido.";

  const centavos = paraCentavos(dados.valor);
  if (centavos === null) erros.valor = "Informe um valor válido.";
  else if (centavos <= 0) erros.valor = "O valor precisa ser maior que zero.";
  else if (centavos > VALOR_MAXIMO_CENTAVOS) erros.valor = "Valor acima do limite.";

  return erros;
}

export function primeiroCampoInvalidoServico(erros: ErrosServico): CampoServico | null {
  return ORDEM_SERVICO.find((c) => erros[c]) ?? null;
}

export function servicoParaBanco(dados: DadosServico) {
  return {
    nome: dados.nome.trim().replace(/\s+/g, " "),
    tipo: dados.tipo,
    valor_centavos: paraCentavos(dados.valor) ?? 0,
  };
}

export function servicoParaFormulario(servico: Servico): DadosServico {
  return {
    nome: servico.nome,
    tipo: servico.tipo,
    valor: (servico.valor_centavos / 100).toFixed(2).replace(".", ","),
  };
}
