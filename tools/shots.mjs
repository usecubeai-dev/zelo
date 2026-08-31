/**
 * Captura quadros da narrativa em pontos exatos de progresso do scroll.
 * Uso: node tools/shots.mjs [largura] [altura] [pasta]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const OUT = process.argv[4] || "shots";
const URL = "http://localhost:3210";

/* Os pontos de captura são BEATS do roteiro, não frações do scroll: a
   timeline cresce quando um capítulo novo entra, e beat é a única unidade
   que não se desloca junto. */
const BEATS_MOBILE = [
  ["00-calma", 2],
  ["01-mariana", 13],
  ["02-troca", 21],
  ["03-joao", 25],
  ["04-planilha", 29],
  ["05-carlos", 33],
  ["06-pico", 38],
  ["07-congelou", 42],
  ["08-silencio", 54],
  ["09-frase", 63],
  ["10-sinal-verde", 74],
  ["11-sistema", 84],
  ["12-marca", 97],
  ["13-entrando", 105],
  ["14-interface", 112],
  ["15-criando", 118],
  ["16-criada", 126],
  ["17-autorizacao", 135],
  ["18-autorizado", 145],
  ["19-ativa", 153],
  ["20-abertura", 160],
  ["21-dois-polos", 166],
  ["22-debito", 170],
  ["23-transito", 176],
  ["24-pago", 182],
  ["25-recebido", 188],
  ["26-proxima", 192],
  ["27-ciclo2", 197],
  ["28-ciclo3", 206],
  ["29-final", 214],
  ["30-camera-nele", 226],
  ["31-clientes-voltam", 234],
  ["32-pagos", 242],
  ["33-rotina", 250],
  ["34-assinatura", 259],
  ["35-marca", 267],
  ["36-cta", 275],
  ["37-final", 285],
];

const BEATS_DESKTOP = [
  ["00-calma", 2],
  ["01-mariana", 12],
  ["02-joao", 19],
  ["03-carlos", 24],
  ["04-caos", 31],
  ["05-pico", 37],
  ["06-congelou", 42],
  ["07-esvaziando", 47],
  ["08-silencio", 54],
  ["09-frase", 63],
  ["10-sinal-verde", 74],
  ["11-sistema", 84],
  ["12-marca", 97],
  ["13-entrando", 105],
  ["14-interface", 112],
  ["15-criando", 118],
  ["16-criada", 126],
  ["17-autorizacao", 135],
  ["18-autorizado", 145],
  ["19-ativa", 153],
  ["20-abertura", 160],
  ["21-dois-polos", 166],
  ["22-debito", 170],
  ["23-transito", 176],
  ["24-pago", 182],
  ["25-recebido", 188],
  ["26-proxima", 192],
  ["27-ciclo2", 197],
  ["28-ciclo3", 206],
  ["29-final", 214],
  ["30-camera-nele", 226],
  ["31-clientes-voltam", 234],
  ["32-pagos", 242],
  ["33-rotina", 250],
  ["34-assinatura", 259],
  ["35-marca", 267],
  ["36-cta", 275],
  ["37-final", 285],
];

const FRAMES = W < 700 ? BEATS_MOBILE : BEATS_DESKTOP;

const CHROME =
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [`--window-size=${W},${H}`, "--force-device-scale-factor=1", "--hide-scrollbars"],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));

for (const [name, p] of FRAMES) {
  await page.evaluate((beat) => {
    const st = window.__st;
    const lenis = window.__lenis;
    if (!st) return;
    const prog = beat / st.animation.duration();
    const y = st.start + prog * (st.end - st.start);
    if (lenis) lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }, p);
  /* scrub:1 leva ~1s para alcançar a posição — esperar antes de fotografar */
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  process.stdout.write(`${name} `);
}

const state = await page.evaluate(() => {
  const st = window.__st;
  return { start: st?.start, end: st?.end, progress: st?.progress };
});

console.log("\nstate:", JSON.stringify(state));
console.log("erros:", errors.length ? errors.slice(0, 8) : "nenhum");
await browser.close();
