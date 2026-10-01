/**
 * Fase 22 — camada de e-mail transacional (Resend).
 *
 * UNIT — sem rede, sem chave real do Resend, sem `.env.local`. O
 * `fetch` global é substituído por um mock local em cada bloco que
 * precisa simular uma resposta do provider; restaurado no final. Nenhum
 * e-mail real é enviado em nenhum momento desta execução.
 */

import { provedorResend } from "../lib/email/resend";
import { sendEmail } from "../lib/email/enviar";
import { templateNotificacao } from "../lib/email/templates/notificacao";
import { templateBoasVindas } from "../lib/email/templates/boas-vindas";
import { escaparHtml, sanitizarCabecalho } from "../lib/email/sanitizar";
import { getEmailConfiguration } from "../lib/email/config";

let passou = 0,
  falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n} ${d}`);
  }
};

const originalFetch = globalThis.fetch;
function mockFetch(fn: typeof fetch) {
  globalThis.fetch = fn;
}
function restoreFetch() {
  globalThis.fetch = originalFetch;
}

const CHAVE_FALSA_DE_TESTE = "re_test_1234567890abcdefNAOEUSAREMEMPRODUCAO";

async function run() {
  console.log("\n=== CONFIGURAÇÃO — sem variáveis, isConfigured é false ===\n");
  {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    const config = getEmailConfiguration();
    t("sem RESEND_API_KEY/EMAIL_FROM, isConfigured é false", config.isConfigured === false);
    t("apiKey undefined quando ausente", config.apiKey === undefined);
  }

  console.log("\n=== PROVIDER NÃO CONFIGURADO — nunca finge sucesso, nunca chama fetch ===\n");
  {
    let fetchChamado = false;
    mockFetch(async () => {
      fetchChamado = true;
      throw new Error("fetch não deveria ser chamado sem configuração");
    });

    const resultado = await provedorResend.enviar({
      to: "destinatario@example.com",
      subject: "Teste",
      html: "<p>oi</p>",
      text: "oi",
    });

    restoreFetch();
    t("resultado é 'nao_configurado'", resultado.status === "nao_configurado");
    t("fetch NUNCA foi chamado sem apiKey/from", !fetchChamado);
  }

  console.log("\n=== PROVIDER CONFIGURADO — sucesso, rejeição (4xx) e falha (5xx/timeout) ===\n");
  {
    process.env.RESEND_API_KEY = CHAVE_FALSA_DE_TESTE;
    process.env.EMAIL_FROM = "Zelo <naoresponda@zelopay.com.br>";

    // sucesso
    let corpoEnviado: any = null;
    let headersEnviados: Record<string, string> = {};
    mockFetch(async (_url, opts: any) => {
      corpoEnviado = JSON.parse(opts.body);
      headersEnviados = opts.headers;
      return new Response(JSON.stringify({ id: "email_mock_123" }), { status: 200 });
    });
    const sucesso = await provedorResend.enviar({
      to: "cliente@example.com",
      subject: "Assunto de teste",
      html: "<p>corpo</p>",
      text: "corpo",
    });
    restoreFetch();
    t("sucesso: status 'enviado'", sucesso.status === "enviado");
    t("sucesso: id devolvido pelo provider", sucesso.status === "enviado" && sucesso.id === "email_mock_123");
    t("payload enviado usa o EMAIL_FROM configurado", corpoEnviado?.from === "Zelo <naoresponda@zelopay.com.br>");
    t("payload enviado tem o destinatário correto", JSON.stringify(corpoEnviado?.to) === JSON.stringify(["cliente@example.com"]));
    t("header Authorization usa Bearer + a chave configurada", headersEnviados.Authorization === `Bearer ${CHAVE_FALSA_DE_TESTE}`);

    // rejeitado (4xx)
    mockFetch(async () => new Response(JSON.stringify({ message: "domínio não verificado" }), { status: 422 }));
    const rejeitado = await provedorResend.enviar({ to: "x@example.com", subject: "s", html: "<p>h</p>", text: "h" });
    restoreFetch();
    t("4xx do provider vira 'rejeitado'", rejeitado.status === "rejeitado");
    t("'rejeitado' carrega o detalhe do provider", rejeitado.status === "rejeitado" && rejeitado.detalhe === "domínio não verificado");

    // falhou (5xx)
    mockFetch(async () => new Response(JSON.stringify({ message: "erro interno" }), { status: 500 }));
    const falhouResultado = await provedorResend.enviar({ to: "x@example.com", subject: "s", html: "<p>h</p>", text: "h" });
    restoreFetch();
    t("5xx do provider vira 'falhou'", falhouResultado.status === "falhou");

    // erro de rede
    mockFetch(async () => {
      throw new TypeError("network down");
    });
    const erroRede = await provedorResend.enviar({ to: "x@example.com", subject: "s", html: "<p>h</p>", text: "h" });
    restoreFetch();
    t("erro de rede vira 'falhou', nunca lança", erroRede.status === "falhou");
  }

  console.log("\n=== sendEmail — validação de destinatário, nunca lança ===\n");
  {
    process.env.RESEND_API_KEY = CHAVE_FALSA_DE_TESTE;
    process.env.EMAIL_FROM = "Zelo <naoresponda@zelopay.com.br>";

    const resultadoInvalido = await sendEmail(
      { to: "isso-nao-e-um-email", subject: "s", html: "<p>h</p>", text: "h" },
      "teste"
    );
    t("destinatário inválido é 'rejeitado' sem tentar enviar", resultadoInvalido.status === "rejeitado");

    mockFetch(async () => new Response(JSON.stringify({ id: "ok" }), { status: 200 }));
    const resultadoValido = await sendEmail(
      { to: "valido@example.com", subject: "s", html: "<p>h</p>", text: "h" },
      "teste"
    );
    restoreFetch();
    t("destinatário válido é enviado", resultadoValido.status === "enviado");

    // provider lançando exceção não deveria derrubar sendEmail
    mockFetch(async () => {
      throw new Error("catástrofe simulada");
    });
    let lancou = false;
    try {
      await sendEmail({ to: "valido@example.com", subject: "s", html: "<p>h</p>", text: "h" }, "teste");
    } catch {
      lancou = true;
    }
    restoreFetch();
    t("sendEmail nunca lança, mesmo com erro inesperado no provider", !lancou);
  }

  console.log("\n=== SANITIZAÇÃO — escaparHtml e sanitizarCabecalho ===\n");
  {
    t(
      "escaparHtml neutraliza tag/atributo perigoso",
      escaparHtml('<img src=x onerror="alert(1)">') === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
    t("escaparHtml escapa aspas simples", escaparHtml("it's") === "it&#39;s");
    t("escaparHtml texto normal fica intacto", escaparHtml("Cobrança paga") === "Cobrança paga");

    t(
      "sanitizarCabecalho remove quebra de linha (header injection)",
      sanitizarCabecalho("Assunto normal\r\nBcc: atacante@evil.com") === "Assunto normal Bcc: atacante@evil.com"
    );
    t("sanitizarCabecalho remove \\n solto também", !sanitizarCabecalho("linha1\nlinha2").includes("\n"));
  }

  console.log("\n=== TEMPLATES — dado perigoso nunca vira HTML de verdade ===\n");
  {
    const nomeMalicioso = '<script>alert(1)</script>';
    const conteudo = templateNotificacao({
      titulo: `Cobrança de ${nomeMalicioso} venceu`,
      mensagem: `O cliente ${nomeMalicioso} está em atraso.`,
      link: "/app/cobrancas",
      tom: "atencao",
      siteUrl: "https://zelopay.com.br",
    });
    t("titulo malicioso não aparece como tag real no HTML", !conteudo.html.includes("<script>alert(1)</script>"));
    t("titulo malicioso aparece escapado no HTML", conteudo.html.includes("&lt;script&gt;"));
    t("subject não tem quebra de linha", !conteudo.subject.includes("\n") && !conteudo.subject.includes("\r"));
    t("html não vaza a chave de API de teste em nenhum lugar", !conteudo.html.includes(CHAVE_FALSA_DE_TESTE));
    t("text não vaza a chave de API de teste em nenhum lugar", !conteudo.text.includes(CHAVE_FALSA_DE_TESTE));
    t("link relativo é resolvido contra siteUrl", conteudo.html.includes("https://zelopay.com.br/app/cobrancas"));

    const semLink = templateNotificacao({
      titulo: "Alerta",
      mensagem: "mensagem sem link",
      link: null,
      tom: "neutro",
      siteUrl: "https://zelopay.com.br",
    });
    t("sem link, não quebra (sem CTA)", typeof semLink.html === "string" && semLink.html.length > 0);

    const boasVindas = templateBoasVindas({ nomeEmpresa: "Estúdio Pilates <ok>", siteUrl: "https://zelopay.com.br" });
    t("boas-vindas escapa o nome da empresa", boasVindas.html.includes("&lt;ok&gt;"));
    t("boas-vindas aponta pro /app", boasVindas.html.includes("https://zelopay.com.br/app"));
  }

  console.log("\n=== NUNCA EXPÕE A API KEY — em HTML, texto, log, subject ===\n");
  {
    process.env.RESEND_API_KEY = CHAVE_FALSA_DE_TESTE;
    process.env.EMAIL_FROM = "Zelo <naoresponda@zelopay.com.br>";

    const logsCapturados: string[] = [];
    const logOriginal = console.log;
    console.log = (...args: unknown[]) => {
      logsCapturados.push(args.map(String).join(" "));
    };

    mockFetch(async () => new Response(JSON.stringify({ id: "ok" }), { status: 200 }));
    await sendEmail({ to: "cliente@example.com", subject: "Assunto", html: "<p>corpo</p>", text: "corpo" }, "teste_log");
    restoreFetch();
    console.log = logOriginal;

    const logsComChave = logsCapturados.filter((l) => l.includes(CHAVE_FALSA_DE_TESTE));
    t("nenhuma linha de log contém a API key", logsComChave.length === 0);

    const logsComEmailCompleto = logsCapturados.filter((l) => l.includes("cliente@example.com"));
    t("log não expõe o endereço completo do destinatário (só domínio)", logsComEmailCompleto.length === 0);
  }

  console.log("\n=== INTEGRAÇÃO FASE 21 — mapa de tom cobre as notificações de elegibilidade ===\n");
  {
    // Import dinâmico: lib/core/notificacoes.ts não exporta o mapa (é
    // interno), então a verificação é indireta — chamando criarNotificacao
    // exigiria banco. Aqui confirmamos só que os templates que a Fase 21
    // usa continuam renderizando corretamente com as mensagens reais.
    const inelegivel = templateNotificacao({
      titulo: "Pix Automático não está disponível no momento",
      mensagem:
        "Você ainda pode continuar cobrando seus clientes usando Pix comum, com lembretes automáticos. Vamos avisar quando o Pix Automático estiver disponível novamente.",
      link: "/app/recorrencias",
      tom: "atencao",
      siteUrl: "https://zelopay.com.br",
    });
    t("notificação de inelegibilidade renderiza sem erro", inelegivel.html.includes("Pix Automático"));
    t("notificação de inelegibilidade menciona Pix comum como alternativa", inelegivel.html.includes("Pix comum"));

    const elegivel = templateNotificacao({
      titulo: "Pix Automático disponível",
      mensagem: "Sua conta agora pode usar Pix Automático para cobranças recorrentes.",
      link: "/app/recorrencias",
      tom: "sucesso",
      siteUrl: "https://zelopay.com.br",
    });
    t("notificação de reelegibilidade renderiza sem erro", elegivel.html.includes("Pix Automático"));
  }

  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  restoreFetch();
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
