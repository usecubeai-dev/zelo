/**
 * Sonda ad-hoc: fotografa o HERO em cada estado do ciclo da demonstração.
 * O ciclo é um loop próprio do GSAP, independente do scroll — e tem
 * repeatDelay, então esperar por relógio derrapa. Aqui a sonda OBSERVA o DOM
 * e dispara a foto quando o estado realmente aparece.
 *
 * Uso: node tools/herociclo.mjs [largura] [altura] [pasta]
 */
import puppeteer from "puppeteer-core";
import fs from "fs";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const OUT = process.argv[4] || "shots-hero";
const MOBILE = W < 700;

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({
  width: W,
  height: H,
  deviceScaleFactor: 1,
  isMobile: MOBILE,
  hasTouch: MOBILE,
});
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });

const lerEstado = () =>
  page.evaluate(() => {
    const op = (q) => {
      const e = document.querySelector(q);
      return e ? +getComputedStyle(e).opacity : 0;
    };
    return {
      criada: op('[data-hero-state="criada"]'),
      auth: op('[data-hero-state="auth"]'),
      pago: op('[data-hero-state="pago"]'),
      saldoPago: op('[data-hero-saldo="pago"]'),
      aura: op("[data-hero-aura-deep]"),
      core: op("[data-hero-core-field]"),
    };
  });

/* cada alvo é [nome, teste]; a sonda varre o ciclo e fotografa a primeira
   vez que cada condição vale de fato */
const ALVOS = [
  ["01-inicial", (s) => s.criada > 0.99 && s.auth < 0.02 && s.aura < 0.1],
  ["02-autorizado", (s) => s.auth > 0.9 && s.aura < 0.15],
  ["03-processando", (s) => s.aura > 0.7 || s.core > 0.7],
  ["04-pago", (s) => s.pago > 0.9 && s.saldoPago > 0.9],
];

const pendentes = new Map(ALVOS);
const inicio = Date.now();

while (pendentes.size && Date.now() - inicio < 40000) {
  const estado = await lerEstado();
  for (const [nome, teste] of [...pendentes]) {
    if (teste(estado)) {
      await page.screenshot({ path: `${OUT}/${nome}.png` });
      console.log(nome, JSON.stringify(estado));
      pendentes.delete(nome);
    }
  }
  await new Promise((r) => setTimeout(r, 120));
}

if (pendentes.size) console.log("NÃO capturados:", [...pendentes.keys()]);
await browser.close();
