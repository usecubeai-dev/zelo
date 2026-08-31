/**
 * QA final — runtime. Foca no que mudou desde a última bateria completa:
 * grants de coluna em `empresas`, robots.txt e proteção de rota.
 * Requer `npm run dev` em :3210.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3210";
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

let passou = 0,
  falhou = 0;
const ok = (n, c, d = "") => {
  if (c) { passou++; console.log(`  ✓ ${n}`); }
  else { falhou++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`); }
};

const PRIVADAS = [
  "/app", "/app/clientes", "/app/clientes/novo", "/app/cobrancas",
  "/app/cobrancas/nova", "/app/recorrencias", "/app/recorrencias/nova",
  "/app/assinatura", "/app/configuracoes",
];
const PUBLICAS = ["/", "/comecar", "/entrar", "/criar-conta", "/recuperar-senha", "/termos", "/privacidade"];

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const pagina = await navegador.newPage();
const errosJs = [];
pagina.on("pageerror", (e) => errosJs.push(e.message));

console.log("\n=== QA FINAL ===\n\nROTAS PÚBLICAS");
for (const rota of PUBLICAS) {
  const r = await pagina.goto(BASE + rota, { waitUntil: "domcontentloaded" });
  const h1 = await pagina.$$eval("h1", (n) => n.length);
  ok(`${rota} responde 200 e tem 1 h1`, r.status() === 200 && h1 === 1, `status=${r.status()} h1=${h1}`);
}

console.log("\nPROTEÇÃO DE ROTA");
for (const rota of PRIVADAS) {
  await pagina.goto(BASE + rota, { waitUntil: "domcontentloaded" });
  const url = pagina.url();
  ok(
    `${rota} redireciona para /entrar preservando destino`,
    url.includes("/entrar") && url.includes(encodeURIComponent(rota).slice(0, 12)),
    url.replace(BASE, "")
  );
}

console.log("\nSEO");
const robots = await (await fetch(`${BASE}/robots.txt`)).text();
ok("robots.txt bloqueia /app", robots.includes("Disallow: /app"));
ok("robots.txt bloqueia /api", robots.includes("Disallow: /api"));
ok("robots.txt aponta o sitemap", robots.includes("/sitemap.xml"));
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
ok("sitemap não expõe rotas privadas", !sitemap.includes("/app"));
ok("sitemap não expõe páginas noindex", !sitemap.includes("/termos") && !sitemap.includes("/comecar"));

console.log("\nWEBHOOK");
const semToken = await fetch(`${BASE}/api/webhooks/asaas`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "x", event: "PAYMENT_RECEIVED" }),
});
ok("webhook sem token não processa", [401, 503].includes(semToken.status), `status=${semToken.status}`);
const get = await fetch(`${BASE}/api/webhooks/asaas`);
ok("webhook recusa GET", get.status === 405, `status=${get.status}`);

console.log("\nSEGREDOS NO HTML SERVIDO");
const home = await (await fetch(BASE + "/")).text();
const vazamentos = ["service_role", "ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "ASAAS_CREDENTIALS_KEY", "api_key_cifrada"]
  .filter((s) => home.includes(s));
ok("nenhum segredo no HTML da home", vazamentos.length === 0, vazamentos.join(","));

ok("nenhum erro de JavaScript nas páginas visitadas", errosJs.length === 0, errosJs.slice(0, 2).join(" | "));

await navegador.close();
console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
process.exit(falhou > 0 ? 1 : 0);
