/**
 * Regras de conta — mesmo padrão de `lib/lead.ts`: sem React, sem DOM,
 * para valerem igual no cliente e no servidor.
 *
 * A validação daqui é conveniência de interface. Quem realmente valida
 * credencial é o Supabase Auth, e quem realmente protege dado é o RLS.
 */

export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
};

export type ErrosConta = Partial<Record<"nome" | "email" | "senha", string>>;

export const CADASTRO_VAZIO: DadosCadastro = { nome: "", email: "", senha: "" };

/** Mínimo do Supabase é 6. Exigimos 8: 6 é curto demais para um sistema
    que guarda a carteira de clientes de alguém. */
export const SENHA_MINIMA = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validarEmail(email: string): string | undefined {
  if (!EMAIL.test(normalizarEmail(email))) return "Informe um e-mail válido.";
  return undefined;
}

export function validarSenha(senha: string): string | undefined {
  if (senha.length < SENHA_MINIMA) {
    return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return undefined;
}

export function validarCadastro(dados: DadosCadastro): ErrosConta {
  const erros: ErrosConta = {};
  if (dados.nome.trim().length < 2) erros.nome = "Informe seu nome.";
  const email = validarEmail(dados.email);
  if (email) erros.email = email;
  const senha = validarSenha(dados.senha);
  if (senha) erros.senha = senha;
  return erros;
}

export function primeiroErro(erros: ErrosConta): keyof ErrosConta | null {
  return (["nome", "email", "senha"] as const).find((c) => erros[c]) ?? null;
}

/**
 * Traduz o erro do Supabase Auth para algo que o usuário entenda.
 *
 * "Invalid login credentials" é proposital do Supabase: não diz se o
 * e-mail existe. Mantemos essa ambiguidade — dizer "e-mail não cadastrado"
 * entrega a atacante a lista de quem tem conta.
 */
export function mensagemDeErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail. Tente entrar.";
  }
  if (m.includes("email rate limit") || m.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
  }
  /* O Supabase recusa domínios reservados (example.com, test.com) e alguns
     descartáveis. Sem esta linha o usuário via a mensagem genérica e não
     tinha como saber que o problema era o domínio que ele digitou. */
  if (m.includes("email address") && m.includes("invalid")) {
    return "Este e-mail não é aceito. Use um endereço de e-mail real.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "O cadastro está temporariamente fechado.";
  }
  if (m.includes("password should be at least")) {
    return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return "Não conseguimos concluir agora. Tente de novo em instantes.";
}
