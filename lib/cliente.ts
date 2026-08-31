/**
 * Contrato de cliente — mesmo padrão de `lib/lead.ts`: sem React, sem DOM,
 * para valer igual nos dois lados. O servidor revalida tudo com estas
 * funções; a validação do navegador é conveniência, não garantia.
 */

export type StatusCliente = "ativo" | "arquivado";

export type Cliente = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  documento: string | null;
  observacoes: string | null;
  status: StatusCliente;
  criado_em: string;
  atualizado_em: string;
};

/** O que o formulário manda. Nada além disso é aceito pelo servidor. */
export type DadosCliente = {
  nome: string;
  email: string;
  whatsapp: string;
  documento: string;
  observacoes: string;
};

export type CampoCliente = keyof DadosCliente;
export type ErrosCliente = Partial<Record<CampoCliente, string>>;

export const CLIENTE_VAZIO: DadosCliente = {
  nome: "",
  email: "",
  whatsapp: "",
  documento: "",
  observacoes: "",
};

export const ROTULOS_CLIENTE: Record<CampoCliente, string> = {
  nome: "Nome",
  email: "E-mail",
  whatsapp: "WhatsApp",
  documento: "CPF ou CNPJ",
  observacoes: "Observações",
};

/** Ordem de leitura do formulário — o foco vai para o primeiro inválido. */
export const ORDEM_CLIENTE: CampoCliente[] = [
  "nome",
  "email",
  "whatsapp",
  "documento",
  "observacoes",
];

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function normalizarCliente(dados: DadosCliente): DadosCliente {
  return {
    nome: dados.nome.trim().replace(/\s+/g, " "),
    email: dados.email.trim().toLowerCase(),
    whatsapp: soDigitos(dados.whatsapp),
    documento: soDigitos(dados.documento),
    observacoes: dados.observacoes.trim(),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Só o nome é obrigatório.
 *
 * Exigir e-mail e documento agora travaria o cadastro de quem só tem o
 * telefone do cliente na agenda — que é exatamente o público. O Asaas vai
 * exigir documento quando a cobrança for gerada; a exigência entra lá, no
 * momento em que faz sentido, e não aqui.
 */
export function validarCliente(dados: DadosCliente): ErrosCliente {
  const limpo = normalizarCliente(dados);
  const erros: ErrosCliente = {};

  if (limpo.nome.length < 2) erros.nome = "Informe o nome do cliente.";
  if (limpo.nome.length > 120) erros.nome = "Nome muito longo.";

  if (limpo.email && !EMAIL.test(limpo.email)) {
    erros.email = "E-mail inválido.";
  }

  if (limpo.whatsapp && (limpo.whatsapp.length < 10 || limpo.whatsapp.length > 13)) {
    erros.whatsapp = "Informe o número com DDD.";
  }

  /* 11 dígitos = CPF, 14 = CNPJ. Não validamos o dígito verificador: um
     documento formalmente válido não prova que é daquela pessoa, e recusar
     um número certo por engano é pior que aceitar um errado que o Asaas
     vai recusar depois. */
  if (limpo.documento && limpo.documento.length !== 11 && limpo.documento.length !== 14) {
    erros.documento = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  }

  if (limpo.observacoes.length > 1000) {
    erros.observacoes = "Observações muito longas.";
  }

  return erros;
}

export function primeiroCampoInvalidoCliente(
  erros: ErrosCliente
): CampoCliente | null {
  return ORDEM_CLIENTE.find((c) => erros[c]) ?? null;
}

/** Campos vazios viram NULL no banco: "" e NULL significando a mesma coisa
    em colunas diferentes é fonte garantida de bug em relatório. */
export function paraBanco(dados: DadosCliente) {
  const limpo = normalizarCliente(dados);
  return {
    nome: limpo.nome,
    email: limpo.email || null,
    whatsapp: limpo.whatsapp || null,
    documento: limpo.documento || null,
    observacoes: limpo.observacoes || null,
  };
}

export function paraFormulario(cliente: Cliente): DadosCliente {
  return {
    nome: cliente.nome,
    email: cliente.email ?? "",
    whatsapp: cliente.whatsapp ?? "",
    documento: cliente.documento ?? "",
    observacoes: cliente.observacoes ?? "",
  };
}

/** (66) 99999-8888 — só para exibir; o banco guarda só dígitos. */
export function formatarWhatsapp(digitos: string | null): string {
  if (!digitos) return "—";
  const d = soDigitos(digitos);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function formatarDocumento(digitos: string | null): string {
  if (!digitos) return "—";
  const d = soDigitos(digitos);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d;
}
