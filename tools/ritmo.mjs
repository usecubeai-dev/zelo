/**
 * Leitura de ritmo: pausa a timeline mestre e percorre os 100 beats,
 * registrando o que está em cena em cada instante. Serve para avaliar
 * cadência, densidade e respiro sem depender do olho.
 *
 * Uso: node tools/ritmo.mjs [largura] [altura]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

const dados = await page.evaluate(() => {
  const tl = window.__st.animation;
  tl.pause();
  const nomes = [
    ...[...document.querySelectorAll("[data-card]")].map((e, i) => [e, ["Mariana", "João", "Carlos"][i]]),
    ...[...document.querySelectorAll("[data-msg]")].map((e, i) => [e, "msg" + i]),
    ...[...document.querySelectorAll("[data-chip]")].map((e, i) => [e, "chip" + i]),
    ...[...document.querySelectorAll("[data-sheet]")].map((e) => [e, "planilha"]),
  ].filter(([e]) => getComputedStyle(e).display !== "none");

  const op = (el) => +(+getComputedStyle(el).opacity).toFixed(3);
  const acha = (sel) => document.querySelector(`[class*="${sel}"]`);
  const copy = acha("copy");
  const frase = acha("phrase");
  const marca = acha("brand");
  const composer = acha("composer");
  const camera = acha("camera");
  const zCam = () => {
    const m = new DOMMatrix(getComputedStyle(camera).transform);
    return +m.m43.toFixed(1);
  };

  const linhas = [];
  for (let t = 0; t <= 100; t += 0.5) {
    tl.time(t);
    const vivos = nomes.filter(([e]) => op(e) > 0.35).map(([, n]) => n);
    /* a frase só está legível quando as palavras param de escorregar */
    const palavras = [...document.querySelectorAll("[data-word]")];
    const assentadas =
      palavras.length &&
      palavras.every((w) => Math.abs(new DOMMatrix(getComputedStyle(w).transform).m42) < 1.5);
    linhas.push({
      t,
      n: vivos.length,
      vivos,
      copy: op(copy),
      frase: op(frase),
      marca: op(marca),
      composer: op(composer),
      assentadas: op(frase) > 0.5 && assentadas,
      z: zCam(),
    });
  }
  tl.resume();
  return linhas;
});

/* --- quando cada elemento cruza o limiar de "está em cena" --- */
const entradas = {};
const saidas = {};
for (let i = 1; i < dados.length; i++) {
  const antes = new Set(dados[i - 1].vivos);
  const agora = new Set(dados[i].vivos);
  for (const n of agora) if (!antes.has(n)) entradas[n] = dados[i].t;
  for (const n of antes) if (!agora.has(n)) saidas[n] = dados[i].t;
}

console.log(`\n=== cadência de chegadas (${W}x${H}) ===`);
const ordem = Object.entries(entradas).sort((a, b) => a[1] - b[1]);
let anterior = null;
for (const [nome, t] of ordem) {
  const intervalo = anterior === null ? "—" : `+${(t - anterior).toFixed(1)}`;
  const sai = saidas[nome] !== undefined ? `sai em ${saidas[nome]}` : "fica";
  console.log(`  beat ${String(t).padStart(5)}  ${nome.padEnd(10)} intervalo ${intervalo.padStart(5)}   ${sai}`);
  anterior = t;
}

console.log(`\n=== densidade e câmera ===`);
console.log("  beat | em cena | z câmera | headline | frase | marca | interface");
for (const l of dados) {
  if (l.t % 2 !== 0) continue;
  const barra = "█".repeat(l.n);
  console.log(
    `  ${String(l.t).padStart(4)} | ${String(l.n).padStart(2)} ${barra.padEnd(6)} | ${String(l.z).padStart(7)} | ${l.copy.toFixed(2)} | ${l.frase.toFixed(2)} | ${l.marca.toFixed(2)} | ${l.composer.toFixed(2)}`
  );
}

/* --- janelas importantes --- */
const primeiroVazio = dados.find((l) => l.t > 50 && l.n === 0);
const fraseCheia = dados.filter((l) => l.frase > 0.95);
/* px por beat vem do próprio roteiro; o total cresce a cada capítulo novo */
const px = W < 700 ? 52 * 100 : 72 * 100;
console.log(`\n=== respiro ===`);
console.log(
  `  1 beat = ${(px / 100).toFixed(0)}px de scroll — trecho pinado total: ${(
    (px / 100) *
    dados[dados.length - 1].t
  ).toFixed(0)}px`
);
if (primeiroVazio) console.log(`  cena fica vazia a partir do beat ${primeiroVazio.t}`);
const legivel = dados.filter((l) => l.assentadas);
if (legivel.length)
  console.log(
    `  frase LEGÍVEL (palavras paradas) do beat ${legivel[0].t} ao ${legivel[legivel.length - 1].t}` +
      ` — ${(((legivel[legivel.length - 1].t - legivel[0].t) * px) / 100).toFixed(0)}px`
  );
/* o silêncio é a janela CONTÍNUA entre a cena esvaziar e a frase acender —
   varrer o resto da página não mede nada */
const iniSil = dados.findIndex((l) => l.t > 44 && l.n === 0 && l.frase < 0.05);
if (iniSil >= 0) {
  let fim = iniSil;
  while (fim + 1 < dados.length && dados[fim + 1].n === 0 && dados[fim + 1].frase < 0.05)
    fim++;
  const beats = dados[fim].t - dados[iniSil].t;
  console.log(
    `  SILÊNCIO (tela vazia, frase apagada): beat ${dados[iniSil].t} → ${dados[fim].t}` +
      ` = ${beats} beats, ${((beats * px) / 100).toFixed(0)}px de scroll`
  );
}
if (fraseCheia.length)
  console.log(
    `  frase visível do beat ${fraseCheia[0].t} ao ${fraseCheia[fraseCheia.length - 1].t}` +
      ` (${((fraseCheia[fraseCheia.length - 1].t - fraseCheia[0].t) * px / 100).toFixed(0)}px de scroll)`
  );

await browser.close();
