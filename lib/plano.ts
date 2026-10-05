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

/**
 * Pricing oficial aprovado pelo proprietário — fonte única, nunca
 * duplicar estes números em outro lugar do código. Os limites precisam
 * bater com `public.limite_de_clientes()` (clientes) e
 * `public.limite_de_cobrancas_mensal()` (cobranças/mês), que são quem
 * IMPÕE de verdade — ver comentário do topo do arquivo.
 */
export const LIMITE_DE_CLIENTES: Record<Plano, number> = {
  essencial: 30,
  profissional: 100,
  premium: 300,
};

/** "premium" é a chave interna (bate com o CHECK constraint do banco,
 *  `empresas_plano_valido`); "Zelo Pro" é como o plano é chamado pro usuário —
 *  trocar o nome de exibição não exige migration nenhuma. */
export const NOME_DO_PLANO: Record<Plano, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Zelo Pro",
};

/**
 * Preço mensal por plano, em centavos — FONTE ÚNICA, no servidor.
 *
 * É daqui que a mensalidade do Zelo é cobrada de verdade
 * (`lib/core/assinatura-zelo.ts` lê este mapa; o cliente só diz QUAL plano
 * quer, nunca QUANTO paga) e é também o valor da comissão de influenciador
 * da primeira mensalidade. A página de preços só formata estes números.
 */
export const PRECO_POR_PLANO_CENTAVOS: Record<Plano, number> = {
  essencial: 2490,
  profissional: 4990,
  premium: 9990,
};

export function precoDoPlano(plano: Plano): number {
  return PRECO_POR_PLANO_CENTAVOS[plano];
}

/** Plano destacado como "Mais escolhido" na página pública de preços. */
export const PLANO_EM_DESTAQUE: Plano = "profissional";

/** Taxa fixa de recebimento — cobrada por pagamento confirmado, igual em
 *  todos os planos. Nunca chamar de "tarifa", nunca mencionar o provider
 *  por trás dela ao usuário final (ver `lib/asaas/config.ts`). */
export const TAXA_DE_RECEBIMENTO_CENTAVOS = 199;

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

/**
 * Segunda dimensão de limite (Fase 19): cobranças criadas no mês
 * corrente (avulsa + gerada por recorrência, mesma contagem — a origem
 * não importa). Imposto por trigger próprio (`impoe_limite_de_cobrancas`,
 * `public.limite_de_cobrancas_mensal`) — mesmo motivo de
 * `LIMITE_DE_CLIENTES` acima: o endpoint PostgREST é público, e uma
 * checagem que existisse só aqui seria contornável com um `curl`.
 */
export const LIMITE_DE_COBRANCAS_MENSAL: Record<Plano, number> = {
  essencial: 50,
  profissional: 200,
  premium: 600,
};

export function limiteDeCobrancasDoPlano(plano: unknown): number {
  return ehPlano(plano) ? LIMITE_DE_COBRANCAS_MENSAL[plano] : LIMITE_DE_COBRANCAS_MENSAL.essencial;
}

/** Traduz `LIMITE_DE_COBRANCAS_MENSAL:<plano>:<limite>`, mesmo padrão de `mensagemDeLimite`. */
export function mensagemDeLimiteDeCobrancas(mensagemDoBanco: string | null | undefined): string | null {
  if (!mensagemDoBanco) return null;

  const achado = /LIMITE_DE_COBRANCAS_MENSAL:([a-z]+):(\d+)/.exec(mensagemDoBanco);
  if (!achado) return null;

  const [, plano, limite] = achado;
  const nome = ehPlano(plano) ? NOME_DO_PLANO[plano] : "atual";

  return `Seu plano ${nome} permite até ${limite} cobranças por mês. Esse limite volta a zerar no início do próximo mês, ou mude de plano nas configurações da conta.`;
}
