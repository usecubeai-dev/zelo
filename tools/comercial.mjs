/**
 * Sonda ad-hoc da Etapa 6: fotografa o hero (hint novo), o fim do pin e as
 * três seções comerciais novas, fora do alcance de shots.mjs (que só cobre
 * os beats do Stage). Não faz parte do conjunto de sondas permanentes.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const OUT = process.argv[4] || "shots-comercial";

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1000));

const total = await page.evaluate(() => document.documentElement.scrollHeight);
console.log("altura total do documento:", total);

await page.screenshot({ path: `${OUT}/00-hero-hint.png` });

const stagePx = await page.evaluate(() => {
  const isMobile = window.innerWidth <= 860;
  return isMobile ? 52 * 312 : 72 * 312;
});
console.log("fim do pin (px):", stagePx);

await page.evaluate((y) => window.scrollTo(0, y - 40), stagePx);
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${OUT}/01-fim-do-pin.png` });

await page.evaluate((y) => window.scrollTo(0, y + 200), stagePx);
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/02-quem-e-a-zelo.png` });

const whoBottom = await page.evaluate(() => {
  const el = document.querySelector('[class*="WhoItsFor"]') || null;
  return el ? el.getBoundingClientRect().bottom + window.scrollY : null;
});
if (whoBottom) {
  await page.evaluate((y) => window.scrollTo(0, y - 300), whoBottom);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${OUT}/03-beneficios.png` });
}

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/04-fechamento-cta.png` });

console.log("ok");
await browser.close();
