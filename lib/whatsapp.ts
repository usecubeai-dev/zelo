/**
 * Enviar cobrança pelo WhatsApp em 1 clique — parte PURA (sem banco, sem
 * rede, sem React).
 *
 * O Zelo NÃO envia nada: ele só monta um link `wa.me` que abre o WhatsApp
 * (aplicativo no celular, WhatsApp Web no desktop) na conversa do cliente,
 * com a mensagem já escrita. Quem aperta "Enviar" é o profissional, no
 * próprio WhatsApp. Por isso nada aqui é "mensagem enviada": no máximo,
 * "WhatsApp iniciado". Sem API da Meta, sem API não oficial, sem automação.
 *
 * Privacidade: a mensagem leva SÓ o necessário — primeiro nome, valor,
 * vencimento e o link público de pagamento. Nunca CPF/CNPJ, ids internos,
 * tokens ou qualquer coisa financeira além do valor da própria cobrança.
 */

import { formatarCentavos } from "./dinheiro";

/**
 * Número brasileiro utilizável no `wa.me`: só dígitos, com DDI 55.
 *
 * Aceita o que o cadastro permite digitar (máscara, parênteses, hífen,
 * espaços, `+55`, `0` na frente do DDD). NÃO altera o que está salvo no
 * banco — só gera o número do link. `null` = não dá para abrir WhatsApp.
 *
 * Regras (celular brasileiro):
 *  - 11 dígitos nacionais (DDD + 9 + 8 dígitos) → o 9 é obrigatório;
 *  - 10 dígitos nacionais só se o 1º dígito do assinante for 6–9 (celular
 *    antigo sem o 9); telefone fixo (começa em 2–5) não tem WhatsApp;
 *  - com DDI: 55 + 10 ou 11 dígitos. Qualquer outro tamanho é inválido.
 */
export function normalizarWhatsappBr(bruto: string | null | undefined): string | null {
  const digitos = (bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  let nacional = digitos.replace(/^0+/, ""); // 0 do tronco / 00 internacional
  if ((nacional.length === 12 || nacional.length === 13) && nacional.startsWith("55")) {
    nacional = nacional.slice(2);
  }
  if (nacional.length !== 10 && nacional.length !== 11) return null;

  const ddd = nacional.slice(0, 2);
  if (!/^[1-9][1-9]$/.test(ddd)) return null;

  const assinante = nacional.slice(2);
  if (assinante.length === 9) {
    if (assinante[0] !== "9") return null;
  } else if (!/^[6-9]/.test(assinante)) {
    return null;
  }

  return `55${nacional}`;
}

/** Só o primeiro nome, sem controles nem quebra de linha — é o que cabe numa mensagem curta. */
export function primeiroNome(nome: string | null | undefined): string {
  // eslint-disable-next-line no-control-regex
  const limpo = (nome ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().split(/\s+/)[0] ?? "";
  return limpo.slice(0, 40);
}

/** `YYYY-MM-DD` → `DD/MM` (com o ano quando não é o ano de `hoje`). */
export function dataCurta(iso: string, hoje: string): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

/**
 * Só aceita o link público de pagamento do provedor: https, host
 * `asaas.com` (ou subdomínio), sem credenciais embutidas. Qualquer outra
 * coisa vira `null` — nunca inventamos nem repassamos URL desconhecida.
 */
export function linkPublicoValido(url: unknown): string | null {
  if (typeof url !== "string" || url.length === 0 || url.length > 300) return null;
  try {
    const u = new URL(url);
    const hostOk = u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com");
    if (u.protocol !== "https:" || !hostOk || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

export type DadosMensagemCobranca = {
  nomeCliente: string | null | undefined;
  valorCentavos: number;
  /** `YYYY-MM-DD` */
  venceEm: string;
  /** link público de pagamento, já validado */
  link: string;
  /** `YYYY-MM-DD` de hoje — injetado para ser testável */
  hoje: string;
};

/**
 * Mensagem curta e natural. Ex.:
 *   "Oi Ana! Sua cobrança de R$ 380,00 vence em 05/10. Pague aqui: https://…"
 * Adapta o verbo ao prazo (vence hoje / vence em / venceu em).
 */
export function montarMensagemCobranca(d: DadosMensagemCobranca): string {
  const nome = primeiroNome(d.nomeCliente);
  const saudacao = nome ? `Oi ${nome}!` : "Olá!";
  const valor = formatarCentavos(d.valorCentavos).replace(/ /g, " ");
  const prazo =
    d.venceEm === d.hoje
      ? "vence hoje"
      : d.venceEm > d.hoje
        ? `vence em ${dataCurta(d.venceEm, d.hoje)}`
        : `venceu em ${dataCurta(d.venceEm, d.hoje)}`;
  return `${saudacao} Sua cobrança de ${valor} ${prazo}. Pague aqui: ${d.link}`;
}

/** `https://wa.me/<número>?text=<mensagem URL-encoded>` — o mecanismo oficial de abrir conversa com texto pronto. */
export function urlWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

export type PreparoWhatsApp =
  | { estado: "pronto"; href: string; mensagem: string }
  | { estado: "indisponivel"; semTelefone: boolean; semLink: boolean };

/**
 * Decide o que a tela mostra: o botão pronto, ou o que falta (telefone
 * válido, link de pagamento — as duas faltas podem ocorrer juntas).
 */
export function prepararEnvioWhatsApp(
  d: Omit<DadosMensagemCobranca, "link"> & { whatsapp: string | null | undefined; link: string | null }
): PreparoWhatsApp {
  const numero = normalizarWhatsappBr(d.whatsapp);
  const link = linkPublicoValido(d.link);
  if (!numero || !link) {
    return { estado: "indisponivel", semTelefone: !numero, semLink: !link };
  }
  const mensagem = montarMensagemCobranca({ ...d, link });
  return { estado: "pronto", href: urlWhatsApp(numero, mensagem), mensagem };
}
