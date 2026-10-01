/**
 * Log estruturado da camada de e-mail — mesmo padrão de
 * `lib/asaas/webhook.ts` (`registrar()`): uma linha, campos `chave=valor`,
 * nunca o payload cru.
 *
 * O que NUNCA entra aqui: `RESEND_API_KEY`, o HTML/texto completo do
 * e-mail (pode conter dado pessoal do cliente final do profissional) e o
 * endereço de destino completo (só o domínio — suficiente pra depurar
 * "e-mails pra gmail.com estão falhando" sem logar o endereço de ninguém).
 */
function dominioDoEmail(endereco: string): string {
  const arroba = endereco.indexOf("@");
  return arroba === -1 ? "invalido" : endereco.slice(arroba + 1);
}

export function registrarEnvioEmail(
  evento: string,
  campos: {
    provider?: string;
    template?: string;
    resultado?: string;
    destinoDominio?: string;
    erro?: string;
  } = {}
) {
  const partes = Object.entries(campos)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  console.log(`[email] ${evento}${partes.length ? ` | ${partes.join(" ")}` : ""}`);
}

export { dominioDoEmail };
