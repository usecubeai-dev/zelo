/**
 * Decide se o ambiente atual deve ser indexado por mecanismos de busca.
 *
 * Opt-in explícito: vazio/ausente = bloqueado. Só quem estiver de fato em
 * produção deve setar NEXT_PUBLIC_PERMITIR_INDEXACAO=true — nunca a URL do
 * deploy decide isso, porque a URL de um preview de staging muda a cada
 * deploy e não dá pra comparar contra ela de forma confiável. Sem essa
 * flag, staging/dev/preview nunca vazam para o Google por esquecimento.
 *
 * Extraído para módulo próprio (sem nenhum import do Next) para poder ser
 * testado isoladamente, sem carregar `app/layout.tsx` — que puxa
 * `next/font/google` e `globals.css`, inimportáveis fora do pipeline de
 * build do Next.
 */
export function indexavelPorAmbiente(): boolean {
  return process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO === "true";
}
