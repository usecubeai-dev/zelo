/**
 * Limitador de taxa em memória, para endpoints públicos sem sessão.
 *
 * ⚠ Não é distribuído: em produção serverless cada instância guarda seu
 * próprio contador, e um cold start zera tudo. Isso não é uma falha do
 * desenho — é o limite honesto de "sem dependência nova, sem tabela nova".
 * O que ele impede de verdade é um script simples martelando o mesmo
 * endpoint contra a MESMA instância; não impede um ataque distribuído.
 * Para essa garantia, precisaria de Redis/Upstash — fora do escopo desta
 * etapa de hardening incremental.
 *
 * Suficiente para o que existe hoje: um formulário de pré-cadastro sem
 * autenticação, cujo pior cenário é lixo na tabela `leads`, não fraude
 * financeira.
 */

const janelas = new Map<string, { contagem: number; expiraEm: number }>();

/** Limpa entradas velhas para o Map não crescer para sempre entre cold starts. */
function limpar(agora: number) {
  if (janelas.size < 500) return;
  for (const [chave, v] of janelas) {
    if (v.expiraEm < agora) janelas.delete(chave);
  }
}

export type ResultadoLimite = { permitido: true } | { permitido: false; espereMs: number };

/**
 * `janelaMs` e `maximo`: quantas chamadas uma mesma chave pode fazer por
 * janela. Para o pré-cadastro, 5 por 10 minutos cobre um usuário
 * corrigindo o próprio formulário sem incomodar ninguém legítimo.
 */
export function verificarLimite(
  chave: string,
  maximo = 5,
  janelaMs = 10 * 60 * 1000
): ResultadoLimite {
  const agora = Date.now();
  limpar(agora);

  const atual = janelas.get(chave);
  if (!atual || atual.expiraEm < agora) {
    janelas.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return { permitido: true };
  }

  if (atual.contagem >= maximo) {
    return { permitido: false, espereMs: atual.expiraEm - agora };
  }

  atual.contagem++;
  return { permitido: true };
}
