/**
 * Escapa dado dinâmico antes de interpolar em HTML de e-mail.
 *
 * Todo template desta camada passa nome de cliente, descrição de cobrança
 * e mensagem de notificação por aqui antes de montar o HTML — nenhum
 * desses valores é confiável (vêm de cadastro de terceiro, ou do próprio
 * profissional). Sem isto, um nome de cliente como
 * `<img src=x onerror=...>` renderizaria como HTML de verdade no cliente
 * de e-mail de quem recebe.
 */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Remove quebra de linha de um valor que vai para um cabeçalho de e-mail
 * (assunto, nome de exibição). Sem isto, um `titulo`/`nome` contendo
 * `\r\n` poderia injetar um cabeçalho extra (ex. um `Bcc:` forjado) —
 * header injection clássico de e-mail. Nunca deveria acontecer com o
 * texto que o próprio Zelo escreve, mas dado dinâmico (nome de cliente,
 * descrição de cobrança) pode compor o assunto em algum template futuro.
 */
export function sanitizarCabecalho(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").trim();
}
