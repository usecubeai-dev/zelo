/**
 * Dinheiro é `integer` em centavos no banco inteiro, e a conversão para
 * texto acontece só aqui.
 *
 * Ponto flutuante não representa 0,1 exatamente: somar centenas de valores
 * em `number` acumula erro e o total da tela deixa de bater com o extrato.
 * Num sistema de cobrança isso não é detalhe — é a razão de o usuário
 * parar de confiar no produto.
 */

export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "1.234,56" ou "1234.56" → 123456. Retorna null se não for número. */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return null;

  /* pt-BR usa vírgula como decimal; aceitamos os dois formatos porque o
     usuário digita como está acostumado, não como o parser prefere */
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return Math.round(valor * 100);
}
