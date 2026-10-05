/**
 * Planos, preços e limites — TABELA OFICIAL DO ZELO.
 *
 *   Grátis      R$ 0        até 10 clientes     (plano permanente, NÃO é trial)
 *   Essencial   R$ 49,90    até 50 clientes
 *   Negócio     R$ 99,90    até 200 clientes    ("Mais escolhido")
 *   Escola      R$ 199,90   clientes ilimitados
 *   + R$ 1,99 por Pix recebido, em todos os planos.
 *
 * ⚠ Este arquivo NÃO impõe o LIMITE. Quem impõe é o trigger
 * `clientes_impoe_limite_do_plano`, no banco — o endpoint PostgREST é público
 * e uma verificação que exista só aqui é contornável com um `curl`. Os
 * números daqui precisam bater com `public.limite_de_clientes()`; se
 * divergirem, o banco manda. O que existe aqui é a tradução: transformar a
 * exceção do banco numa frase e deixar a interface avisar antes.
 *
 * O PREÇO, ao contrário, vive só aqui (servidor): é daqui que a mensalidade é
 * cobrada de verdade (`lib/core/assinatura-zelo.ts`). O cliente envia apenas
 * QUAL plano quer — nunca quanto paga.
 *
 * COMPATIBILIDADE: contas e cobranças antigas podem ter gravado
 * 'profissional' (hoje Negócio) e 'premium' (hoje Escola). Toda leitura de
 * `empresas.plano`/`mensalidades.plano` passa por `normalizarPlano`; os
 * registros antigos não são reescritos e o histórico fica intacto.
 */

export type Plano = "gratis" | "essencial" | "negocio" | "escola";

/** Ordem de exibição na página de preços e no seletor. */
export const PLANOS_EM_ORDEM: readonly Plano[] = ["gratis", "essencial", "negocio", "escola"];

/** Identificadores antigos que ainda podem existir no banco. */
const ALIAS_LEGADO: Record<string, Plano> = {
  profissional: "negocio",
  premium: "escola",
};

export const NOME_DO_PLANO: Record<Plano, string> = {
  gratis: "Grátis",
  essencial: "Essencial",
  negocio: "Negócio",
  escola: "Escola",
};

/** Preço mensal por plano, em centavos — FONTE ÚNICA, no servidor. */
export const PRECO_POR_PLANO_CENTAVOS: Record<Plano, number> = {
  gratis: 0,
  essencial: 4990,
  negocio: 9990,
  escola: 19990,
};

/**
 * Limite de clientes por plano. `null` = ILIMITADO (Escola): não existe um
 * número artificial por trás — o banco também devolve NULL e o trigger não
 * checa nada.
 */
export const LIMITE_DE_CLIENTES: Record<Plano, number | null> = {
  gratis: 10,
  essencial: 50,
  negocio: 200,
  escola: null,
};

/** Plano destacado como "Mais escolhido" na página pública de preços. */
export const PLANO_EM_DESTAQUE: Plano = "negocio";

/**
 * Taxa fixa de recebimento — cobrada por Pix recebido, igual em todos os
 * planos (inclusive o Grátis). Nunca é mensalidade. Nunca mencionar o
 * provider por trás dela ao usuário final (ver `lib/asaas/config.ts`).
 */
export const TAXA_DE_RECEBIMENTO_CENTAVOS = 199;

/** Aceita só os identificadores ATUAIS (é o que o cliente pode escolher). */
export function ehPlano(valor: unknown): valor is Plano {
  return typeof valor === "string" && (PLANOS_EM_ORDEM as readonly string[]).includes(valor);
}

/**
 * Traduz o que está gravado no banco (atual ou antigo) para o plano atual.
 * `null` se não for um plano conhecido.
 */
export function normalizarPlano(valor: unknown): Plano | null {
  if (ehPlano(valor)) return valor;
  if (typeof valor === "string" && valor in ALIAS_LEGADO) return ALIAS_LEGADO[valor];
  return null;
}

export function precoDoPlano(plano: Plano): number {
  return PRECO_POR_PLANO_CENTAVOS[plano];
}

/** `true` quando o plano tem mensalidade (todos menos o Grátis). */
export function planoPago(plano: Plano): boolean {
  return PRECO_POR_PLANO_CENTAVOS[plano] > 0;
}

/**
 * Limite de clientes do plano gravado. `null` = ilimitado. Valor
 * desconhecido cai no menor limite (Grátis), mesma defesa do banco.
 */
export function limiteDoPlano(plano: unknown): number | null {
  const p = normalizarPlano(plano);
  return p ? LIMITE_DE_CLIENTES[p] : LIMITE_DE_CLIENTES.gratis;
}

/** "até 50 clientes" / "clientes ilimitados" — o texto que o usuário vê. */
export function descricaoDoLimite(plano: Plano): string {
  const limite = LIMITE_DE_CLIENTES[plano];
  return limite === null ? "Clientes ilimitados" : `Até ${limite} clientes`;
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
  const normalizado = normalizarPlano(plano);
  const nome = normalizado ? NOME_DO_PLANO[normalizado] : "atual";

  return `Seu plano ${nome} permite até ${limite} clientes. Para cadastrar mais, mude de plano em Assinatura.`;
}

/**
 * Compatibilidade: a tabela oficial NÃO limita cobranças por mês e o banco
 * não levanta mais `LIMITE_DE_COBRANCAS_MENSAL`. A função fica porque os
 * pontos de captura de erro (cobranças, recorrências, instruções Pix) já
 * a chamam — com o banco atual ela sempre devolve `null` e o erro segue o
 * tratamento normal.
 */
export function mensagemDeLimiteDeCobrancas(mensagemDoBanco: string | null | undefined): string | null {
  if (!mensagemDoBanco) return null;

  const achado = /LIMITE_DE_COBRANCAS_MENSAL:([a-z]+):(\d+)/.exec(mensagemDoBanco);
  if (!achado) return null;

  const [, plano, limite] = achado;
  const normalizado = normalizarPlano(plano);
  const nome = normalizado ? NOME_DO_PLANO[normalizado] : "atual";

  return `Seu plano ${nome} permite até ${limite} cobranças por mês. Esse limite volta a zerar no início do próximo mês, ou mude de plano em Assinatura.`;
}
