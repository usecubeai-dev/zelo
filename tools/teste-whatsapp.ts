/**
 * Enviar cobrança pelo WhatsApp em 1 clique — lógica pura + garantias
 * estruturais. Rodar:  npx tsx tools/teste-whatsapp.ts
 *
 * Sem banco e sem rede: o que se testa é a montagem do link (telefone,
 * mensagem, URL encoding, link público) e que o código NÃO envia nada, não
 * escreve nada e não promete envio automático.
 */

import fs from "fs";
import {
  dataCurta,
  linkPublicoValido,
  montarMensagemCobranca,
  normalizarWhatsappBr,
  prepararEnvioWhatsApp,
  primeiroNome,
  urlWhatsApp,
} from "../lib/whatsapp";

let passou = 0;
let falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

const LINK = "https://www.asaas.com/i/abc123def";
const base = { nomeCliente: "Ana Souza", whatsapp: "(11) 99999-8888", valorCentavos: 38000, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" };

console.log("\n=== WHATSAPP EM 1 CLIQUE ===\n");

console.log("TELEFONE — normalização para o link (o cadastro no banco não muda)");
{
  const n = normalizarWhatsappBr;
  t("máscara completa → 5511999998888", n("(11) 99999-8888") === "5511999998888");
  t("com +55, espaços e hífen", n("+55 (11) 99999-8888") === "5511999998888");
  t("já com DDI, só dígitos", n("5511999998888") === "5511999998888");
  t("só DDD + número (11 dígitos)", n("11999998888") === "5511999998888");
  t("0 na frente do DDD", n("011 99999-8888") === "5511999998888");
  t("00 internacional na frente", n("0055 11 99999 8888") === "5511999998888");
  t("celular antigo sem o 9 (10 dígitos, começa em 9)", n("(11) 9999-8888") === "551199998888");
  t("DDD 55 (RS) sem DDI não é confundido com DDI", n("55991234567") === "5555991234567");
  t("DDI 55 + DDD 55", n("5555991234567") === "5555991234567");
  t("telefone FIXO não tem WhatsApp → null", n("(11) 3333-4444") === null);
  t("11 dígitos sem o 9 de celular → null", n("11888887777") === null);
  t("DDD inválido (10) → null", n("10999998888") === null);
  t("curto demais → null", n("99999-888") === null && n("123") === null);
  t("vazio / nulo / indefinido → null", n("") === null && n(null) === null && n(undefined) === null && n("   ") === null);
  t("lixo sem dígitos → null", n("abc") === null);
  t("número estrangeiro não vira número brasileiro por acidente", n("+1 415 555 2671") === null);
  t("comprimento 14+ → null", n("551199999888812") === null);
}

console.log("\nMENSAGEM — curta, natural, só o necessário");
{
  const m = montarMensagemCobranca({ nomeCliente: "Ana Souza", valorCentavos: 38000, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" });
  t("exemplo exato do pedido", m === `Oi Ana! Sua cobrança de R$ 380,00 vence em 05/10. Pague aqui: ${LINK}`, m);
  t("valor usa espaço comum (sem NBSP)", !m.includes(" "));
  t("centavos e milhar: R$ 1.234,56", montarMensagemCobranca({ nomeCliente: "Ana", valorCentavos: 123456, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" }).includes("R$ 1.234,56"));
  t("centavos simples: R$ 29,90", montarMensagemCobranca({ nomeCliente: "Ana", valorCentavos: 2990, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" }).includes("R$ 29,90"));
  t("vence hoje", montarMensagemCobranca({ nomeCliente: "Ana", valorCentavos: 2990, venceEm: "2026-10-01", link: LINK, hoje: "2026-10-01" }).includes("vence hoje"));
  t("vencida: 'venceu em'", montarMensagemCobranca({ nomeCliente: "Ana", valorCentavos: 2990, venceEm: "2026-09-28", link: LINK, hoje: "2026-10-01" }).includes("venceu em 28/09"));
  t("outro ano: inclui o ano", montarMensagemCobranca({ nomeCliente: "Ana", valorCentavos: 2990, venceEm: "2027-01-05", link: LINK, hoje: "2026-10-01" }).includes("vence em 05/01/2027"));
  t("nome com acento usa só o primeiro nome", montarMensagemCobranca({ nomeCliente: "José Antônio da Conceição", valorCentavos: 2990, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" }).startsWith("Oi José!"));
  t("sem nome: saudação genérica", montarMensagemCobranca({ nomeCliente: "", valorCentavos: 2990, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" }).startsWith("Olá!"));
  t("nome com quebra de linha/controle não quebra a mensagem", !/[\n\r\t]/.test(montarMensagemCobranca({ nomeCliente: "Ana\nSouza\t", valorCentavos: 2990, venceEm: "2026-10-05", link: LINK, hoje: "2026-10-01" })));
  t("primeiro nome limitado a 40 caracteres", primeiroNome("A".repeat(200)).length === 40);
  t("dataCurta: DD/MM no mesmo ano", dataCurta("2026-10-05", "2026-01-01") === "05/10");
  t("mensagem não contém CPF/CNPJ nem uuid", !/\d{11,14}/.test(m.replace(LINK, "")) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(m));
}

console.log("\nLINK DE PAGAMENTO — só o link público do provedor");
{
  const v = linkPublicoValido;
  t("link público https do provedor é aceito", v("https://www.asaas.com/i/abc123") === "https://www.asaas.com/i/abc123");
  t("sandbox também (subdomínio)", v("https://sandbox.asaas.com/i/abc123") !== null);
  t("http (sem TLS) recusado", v("http://www.asaas.com/i/abc") === null);
  t("outro domínio recusado", v("https://evil.com/i/abc") === null);
  t("domínio que só CONTÉM asaas.com recusado", v("https://asaas.com.evil.com/x") === null && v("https://evilasaas.com/x") === null);
  t("credenciais embutidas na URL recusadas", v("https://user:pw@www.asaas.com/i/1") === null);
  t("javascript:/data: recusados", v("javascript:alert(1)") === null && v("data:text/html,x") === null);
  t("vazio, nulo e não-string recusados", v("") === null && v(null) === null && v(undefined) === null && v(123) === null);
  t("URL gigante recusada", v("https://www.asaas.com/" + "a".repeat(400)) === null);
  t("lixo que não é URL recusado", v("não é url") === null);
}

console.log("\nURL DO WHATSAPP — wa.me com texto codificado");
{
  const msgs = [
    "Oi José! Sua cobrança de R$ 1.234,56 vence em 05/10. Pague aqui: https://www.asaas.com/i/abc?x=1&y=2#frag",
    "Ação & pagamento: 100% ✓ #1 ?? + = / \\ \" ' < > çãõéü — 😀",
    "linha1\nlinha2",
  ];
  for (const msg of msgs) {
    const href = urlWhatsApp("5511999998888", msg);
    const u = new URL(href);
    t(`'${msg.slice(0, 28)}…' → host wa.me, caminho = número, texto íntegro`, u.hostname === "wa.me" && u.pathname === "/5511999998888" && u.searchParams.get("text") === msg);
    t("   sem espaço nem caractere que quebre a URL", !/[\s"<>\\]/.test(href) && href.split("?").length === 2 && !href.includes("#"));
  }
  const pronto = prepararEnvioWhatsApp(base);
  t("fluxo completo: pronto, wa.me + número normalizado + mensagem codificada", pronto.estado === "pronto" && pronto.href.startsWith("https://wa.me/5511999998888?text=") && new URL(pronto.href).searchParams.get("text") === pronto.mensagem);
  t("a URL final NÃO carrega CPF/CNPJ, token nem id interno", pronto.estado === "pronto" && !/\d{11,14}/.test(decodeURIComponent(pronto.href.split("?text=")[1]).replace(LINK, "")) && !/token|cpf|cnpj|uuid/i.test(pronto.href));
}

console.log("\nESTADOS — o que a tela mostra");
{
  const semFone = prepararEnvioWhatsApp({ ...base, whatsapp: null });
  t("sem telefone → indisponível (corrigir cadastro)", semFone.estado === "indisponivel" && semFone.semTelefone && !semFone.semLink);
  const fixo = prepararEnvioWhatsApp({ ...base, whatsapp: "(11) 3333-4444" });
  t("telefone fixo → sem WhatsApp válido", fixo.estado === "indisponivel" && fixo.semTelefone);
  const semLink = prepararEnvioWhatsApp({ ...base, link: null });
  t("sem link de pagamento → indisponível, NUNCA inventa URL", semLink.estado === "indisponivel" && semLink.semLink && !semLink.semTelefone);
  const linkRuim = prepararEnvioWhatsApp({ ...base, link: "https://evil.com/pague" });
  t("link de outro domínio é tratado como ausente", linkRuim.estado === "indisponivel" && linkRuim.semLink);
  const ambos = prepararEnvioWhatsApp({ ...base, whatsapp: "", link: null });
  t("sem telefone E sem link: as duas faltas são informadas", ambos.estado === "indisponivel" && ambos.semTelefone && ambos.semLink);
  const mascarado = prepararEnvioWhatsApp({ ...base, whatsapp: "+55 (21) 98888-7777" });
  t("telefone com máscara funciona", mascarado.estado === "pronto" && mascarado.href.includes("/5521988887777?"));
}

console.log("\nESTRUTURAL — é só um link; não envia, não escreve, não promete automático");
{
  const ler = (p: string) => fs.readFileSync(p, "utf8");
  /** código sem comentários: os testes de texto/chamadas olham o que EXECUTA e o que o usuário VÊ */
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const botao = semComentarios(ler("app/(app)/app/cobrancas/[id]/BotaoWhatsapp.tsx"));
  const bloco = semComentarios(ler("app/(app)/app/cobrancas/[id]/WhatsappCobranca.tsx"));
  const link = semComentarios(ler("lib/core/link-cobranca.ts"));
  const puro = semComentarios(ler("lib/whatsapp.ts"));

  t("o botão é um <a href> para fora, com noopener (clique imediato, sem window.open)", /<a[\s\S]*href=\{href\}[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"/.test(botao) && !/window\.open\(/.test(botao));
  t("o botão não chama Server Action nem faz fetch", !/from "\.\.\/acoes"|fetch\(|"use server"/.test(botao));
  t("o bloco só lê: nenhum insert/update/delete/rpc", !/\.(insert|update|delete|upsert|rpc)\(/.test(bloco + link));
  t("a consulta ao provedor é GET (nenhum POST/PUT/DELETE)", !/metodo:\s*"(POST|PUT|DELETE)"/.test(link) && link.includes("obterCobrancaAsaas"));
  t("a lógica pura não faz rede nem toca em banco", !/fetch\(|supabase|process\.env/.test(puro));
  const textoUi = botao + bloco;
  t("a interface nunca diz que a mensagem foi enviada nem fala em envio automático", !/enviamos por você|disparo autom|WhatsApp autom|mensagem enviada|foi enviad/i.test(textoUi));
  t("o aviso depois do clique diz que o WhatsApp foi ABERTO", botao.includes("WhatsApp aberto com a mensagem pronta"));
  t("analytics registra 'iniciado', não 'enviado'", ler("lib/analytics.ts").includes('chargeWhatsappStarted: "charge_whatsapp_started"'));
  const faq = semComentarios(ler("components/Faq.tsx"));
  t("marketing honesto: 'em 1 clique' e 'você só aperta Enviar', sem prometer envio automático", /pelo WhatsApp em 1 clique/.test(faq) && /aperta Enviar/.test(faq) && !/WhatsApp autom|disparo autom|enviamos por você/i.test(faq));
  const pagina = ler("app/(app)/app/cobrancas/[id]/page.tsx");
  t("só aparece para cobrança em aberto (pendente/enviada)", /const aberta = cobranca\.status === "pendente" \|\| cobranca\.status === "enviada"/.test(pagina) && /aberta && cobranca\.clientes/.test(pagina));
  t("carregamento em Suspense: a página não espera o provedor", pagina.includes("<Suspense") && pagina.includes("WhatsappPreparando"));
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
process.exit(falhou > 0 ? 1 : 0);
