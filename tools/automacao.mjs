/**
 * Sonda da seção Automação (#automacao).
 *
 * Uso: node tools/automacao.mjs [largura] [altura] [pasta]
 *   node tools/automacao.mjs 1440 900 shots-automacao
 *   node tools/automacao.mjs 390 844 shots-automacao-mobile
 *
 * Verifica os invariantes da transformação ANTES → DEPOIS ao longo do
 * ScrollTrigger da seção: no repouso nada do "antes" existe e o "depois" é
 * só um fantasma; no fim o ciclo está fechado, o "antes" recuado, a
 * passagem preenchida e a linha do "depois" percorrida até o verde.
 *
 * Não depende de nome de classe (CSS Modules muda o hash): tudo é achado
 * pelos data-attributes que a própria timeline usa.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const OUT = process.argv[4] || "shots-automacao";
const MOBILE = W <= 860;

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

const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});
page.on("pageerror", (e) => erros.push(String(e)));

await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

/** lê a escala real do elemento a partir da matriz computada */
const LEITURA = `
  (() => {
    const escala = (el, eixo) => {
      if (!el) return null;
      const t = getComputedStyle(el).transform;
      if (!t || t === "none") return 1;
      const n = t.match(/matrix\\(([^)]+)\\)/);
      if (!n) return 1;
      const v = n[1].split(",").map(Number);
      return +(eixo === "x" ? v[0] : v[3]).toFixed(3);
    };
    const op = (el) => (el ? +(+getComputedStyle(el).opacity).toFixed(3) : null);
    const par = document.querySelector("[data-antes]")?.parentElement;
    const antes = document.querySelector("[data-antes]");
    const depois = document.querySelector("[data-depois]");
    const estreito = window.matchMedia("(max-width: 760px)").matches;
    return {
      colunaAntes: op(antes),
      colunaDepois: op(depois),
      antesPassos: [...document.querySelectorAll("[data-antes-passo]")].map(op),
      antesTracos: [...document.querySelectorAll("[data-antes-traco]")].map((e) => escala(e, "y")),
      retorno: { op: op(document.querySelector("[data-retorno]")), s: escala(document.querySelector("[data-retorno]"), "y") },
      seta: op(document.querySelector("[data-retorno-seta]")),
      passagem: escala(document.querySelector("[data-passagem-energia]"), estreito ? "y" : "x"),
      passagemNo: op(document.querySelector("[data-passagem-no]")),
      depoisPassos: [...document.querySelectorAll("[data-depois-passo]")].map(op),
      depoisEnergias: [...document.querySelectorAll("[data-depois-energia]")].map((e) => escala(e, "y")),
      aneis: [...document.querySelectorAll("[data-anel]")].map(op),
      larguraPar: par ? +par.getBoundingClientRect().width.toFixed(1) : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()
`;

/* o gatilho é o próprio .par: start "top 82%", end "bottom 62%" */
const faixa = await page.evaluate(() => {
  const par = document.querySelector("[data-antes]").parentElement;
  const r = par.getBoundingClientRect();
  const topo = r.top + window.scrollY;
  const base = r.bottom + window.scrollY;
  return {
    inicio: topo - window.innerHeight * 0.82,
    fim: base - window.innerHeight * 0.62,
    altura: +r.height.toFixed(1),
  };
});

const irPara = async (y) => {
  await page.evaluate((alvo) => {
    if (window.__lenis) window.__lenis.scrollTo(alvo, { immediate: true });
    else window.scrollTo(0, alvo);
  }, y);
  /* scrub 0.8: precisa de folga para assentar antes de medir */
  await new Promise((r) => setTimeout(r, 1400));
};

const PARADAS = [0, 0.2, 0.4, 0.55, 0.7, 0.85, 1];
const linhas = [];

for (const p of PARADAS) {
  const y = faixa.inicio + p * (faixa.fim - faixa.inicio);
  await irPara(y);
  const m = await page.evaluate(LEITURA);
  linhas.push({ p, ...m });
  await page.screenshot({ path: `${OUT}/automacao-${String(Math.round(p * 100)).padStart(3, "0")}.png` });
}

const rep = (n) => (n === null ? "—" : n);
console.log(`viewport ${W}x${H} · altura do par ${faixa.altura}px · faixa ${Math.round(faixa.fim - faixa.inicio)}px`);
console.log("");
for (const l of linhas) {
  console.log(
    `p=${l.p.toFixed(2)} | antes ${rep(l.colunaAntes)} passos[${l.antesPassos.join(" ")}] tracos[${l.antesTracos.join(" ")}]` +
      ` | retorno ${rep(l.retorno.s)}/${rep(l.retorno.op)} seta ${rep(l.seta)}` +
      ` | passagem ${rep(l.passagem)} no ${rep(l.passagemNo)}` +
      ` | depois passos[${l.depoisPassos.join(" ")}] energias[${l.depoisEnergias.join(" ")}] aneis[${l.aneis.join(" ")}]` +
      ` | overflow ${l.overflow}`
  );
}

/* --- invariantes --- */
const ini = linhas[0];
const fim = linhas[linhas.length - 1];
const quase = (a, b, t = 0.06) => a !== null && Math.abs(a - b) <= t;
const checagens = [
  ["repouso: nenhuma tarefa manual existe", ini.antesPassos.every((o) => o < 0.05)],
  ["repouso: o depois é fantasma, não ausente", ini.depoisPassos.every((o) => quase(o, 0.16, 0.05))],
  ["repouso: nada percorrido", ini.antesTracos.every((s) => s < 0.05) && ini.depoisEnergias.every((s) => s < 0.05) && ini.passagem < 0.05],
  ["fim: as cinco tarefas manuais chegaram", fim.antesPassos.every((o) => quase(o, 1))],
  ["fim: o ciclo se fechou", quase(fim.retorno.s, 1) && quase(fim.retorno.op, 1) && quase(fim.seta, 1)],
  ["fim: o antes recuou", quase(fim.colunaAntes, 0.4, 0.05)],
  ["fim: a passagem foi feita", quase(fim.passagem, 1) && quase(fim.passagemNo, 1)],
  ["fim: os quatro passos do depois acenderam", fim.depoisPassos.every((o) => quase(o, 1))],
  ["fim: a energia percorreu a linha inteira", fim.depoisEnergias.every((s) => quase(s, 1))],
  ["fim: automação e dinheiro marcados", fim.aneis.length === 2 && fim.aneis.every((o) => quase(o, 1))],
  ["fim: o depois nunca é o que recua", quase(fim.colunaDepois, 1)],
  ["nenhum overflow horizontal em nenhuma parada", linhas.every((l) => l.overflow <= 0)],
  ["console limpo", erros.length === 0],
];

console.log("");
let ok = true;
for (const [nome, passou] of checagens) {
  if (!passou) ok = false;
  console.log(`${passou ? "ok  " : "FALHA"} ${nome}`);
}
if (erros.length) console.log("erros:", erros.slice(0, 5));
console.log(ok ? "\nTODOS OS INVARIANTES CUMPRIDOS" : "\nHÁ INVARIANTE QUEBRADO");

await browser.close();
process.exit(ok ? 0 : 1);
