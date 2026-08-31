/**
 * Planos e seus limites.
 *
 * ⚠ Este arquivo NÃO impõe nada. O limite é imposto pelo trigger
 * `clientes_impoe_limite_do_plano`, no banco — porque o endpoint
 * PostgREST é público e uma verificação que exista só aqui é contornável
 * com um `curl`.
 *
 * O que existe aqui é a tradução: transformar a exceção do banco numa
 * frase que o usuário entenda, e permitir que a interface avise antes de
 * ele preencher um formulário que vai falhar. Os números precisam bater
 * com `public.limite_de_clientes()` — se divergirem, o banco é quem manda.
 */

export type Plano = "essencial" | "profissional" | "premium";

export const LIMITE_DE_CLIENTES: Record<Plano, number> = {
  essencial: 20,
  profissional: 50,
  premium: 150,
};

export const NOME_DO_PLANO: Record<Plano, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Premium",
};

export function ehPlano(valor: unknown): valor is Plano {
  return valor === "essencial" || valor === "profissional" || valor === "premium";
}

export function limiteDoPlano(plano: unknown): number {
  return ehPlano(plano) ? LIMITE_DE_CLIENTES[plano] : LIMITE_DE_CLIENTES.essencial;
}

/**
 * Traduz a exceção do trigger.
 *
 * Formato levantado pelo banco: `LIMITE_DE_CLIENTES:<plano>:<limite>`.
 * Devolve `null` quando o erro é outro, para que quem chama siga com o
 * tratamento normal em vez de engolir uma falha diferente.
 */
export function mensagemDeLimite(mensagemDoBanco: string | null | undefined): string | null {
  if (!mensagemDoBanco) return null;

  const achado = /LIMITE_DE_CLIENTES:([a-z]+):(\d+)/.exec(mensagemDoBanco);
  if (!achado) return null;

  const [, plano, limite] = achado;
  const nome = ehPlano(plano) ? NOME_DO_PLANO[plano] : "atual";

  return `Seu plano ${nome} permite até ${limite} clientes ativos. Para cadastrar mais, mude de plano nas configurações da conta.`;
}
