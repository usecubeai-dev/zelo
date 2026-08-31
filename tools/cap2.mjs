/**
 * Leitura cinematográfica do capítulo 2: mede quanto tempo cada momento
 * existe FORMADO — não quando ele começa, mas por quantos beats ele fica
 * inteiro na tela antes de o próximo começar.
 *
 * Uso: node tools/cap2.mjs [largura] [altura]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const PX = W < 700 ? 52 : 72;
/* Fim da varredura = BEAT.capituloDois. Precisa acompanhar lib/scene.ts:
   com o valor antigo (172) fixo aqui, a sonda passou a medir para dentro do
   capítulo 3 depois que a densidade foi comprimida. */
const FIM = 157;

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

const dados = await page.evaluate((FIM) => {
  const tl = window.__st.animation;
  tl.pause();
  const sel = (q) => document.querySelector(q);
  const cls = (c) => document.querySelector(`[class*="${c}"]`);
  const op = (e) => (e ? +(+getComputedStyle(e).opacity).toFixed(2) : 0);
  const zz = (e) => {
    if (!e) return 0;
    return +new DOMMatrix(getComputedStyle(e).transform).m43.toFixed(0);
  };
  const cards = [...document.querySelectorAll("[data-card]")];
  const dots = [...document.querySelectorAll("[data-dot]")];

  const out = [];
  for (let t = 60; t <= FIM; t += 0.5) {
    tl.time(t);
    out.push({
      t,
      frase: op(cls("phrase")),
      sinal: op(cls("sinal")),
      estrutura: Math.min(...cards.map(op)),
      dots: Math.min(...dots.map(op)),
      marca: Math.min(op(cls("brandMark")), op(cls("brandName"))),
      comp: op(cls("composer")),
      compZ: zz(cls("composer")),
      camZ: zz(cls("camera")),
      pAcao: op(sel('[data-painel="acao"]')),
      pAuth: op(sel('[data-painel="auth"]')),
      pAtiva: op(sel('[data-painel="ativa"]')),
      bLabel: op(cls("compBtnLabel")),
      bLoad: op(cls("compBtnLoading")),
      bDone: op(cls("compBtnDone")),
      aPend: op(sel("[data-auth-pend]")),
      aOk: op(sel("[data-auth-ok]")),
    });
  }
  tl.resume();
  return out;
}, FIM);

/** Janela contínua em que uma condição vale. */
const janela = (fn) => {
  let ini = null,
    fim = null;
  for (const l of dados) {
    if (fn(l)) {
      if (ini === null) ini = l.t;
      fim = l.t;
    } else if (ini !== null && fim !== null && fim < l.t - 0.5) break;
  }
  return ini === null ? null : { ini, fim, beats: +(fim - ini).toFixed(1) };
};

const linha = (nome, j) =>
  console.log(
    `  ${nome.padEnd(34)} ${
      j ? `beat ${String(j.ini).padStart(5)} → ${String(j.fim).padStart(5)}  ${String(j.beats).padStart(5)} beats  ${String(Math.round(j.beats * PX)).padStart(5)}px` : "nunca acontece"
    }`
  );

console.log(`\n=== quanto tempo cada momento existe FORMADO (${W}x${H}) ===`);
linha("sinal verde sozinho na tela", janela((l) => l.sinal > 0.6 && l.estrutura < 0.15 && l.marca < 0.1));
linha("frase ainda legível (>0.5)", janela((l) => l.frase > 0.5));
linha("estrutura inteira + indicadores", janela((l) => l.estrutura > 0.9 && l.dots > 0.85));
linha("estrutura visível de algum modo", janela((l) => l.estrutura > 0.2));
linha("marca inteira e parada", janela((l) => l.marca > 0.95));
linha("marca + estrutura juntas", janela((l) => l.marca > 0.3 && l.estrutura > 0.08));
linha("travessia (marca saindo)", janela((l) => l.marca > 0.05 && l.marca < 0.95 && l.t > 100));
linha("interface cheia", janela((l) => l.comp > 0.95));
linha("estado CRIAR legível", janela((l) => l.bLabel > 0.9 && l.pAcao > 0.9));
linha("estado CRIANDO legível", janela((l) => l.bLoad > 0.9));
linha("estado CRIADA legível", janela((l) => l.bDone > 0.9 && l.pAcao > 0.9));
linha("AUTORIZAÇÃO PENDENTE legível", janela((l) => l.aPend > 0.9 && l.pAuth > 0.9));
linha("AUTORIZADO legível", janela((l) => l.aOk > 0.9 && l.pAuth > 0.9));
linha("COBRANÇA ATIVA legível", janela((l) => l.pAtiva > 0.9));

/* buraco: a interface na tela com o palco de estados vazio */
const buracos = dados.filter(
  (l) => l.comp > 0.9 && l.pAcao < 0.5 && l.pAuth < 0.5 && l.pAtiva < 0.5
);
console.log(
  `
=== gaps no palco de estados === ${
    buracos.length
      ? `${buracos.length} amostra(s): beats ${buracos.map((b) => b.t).join(", ")}`
      : "nenhum — o painel nunca some"
  }`
);

/* buracos: trechos em que nada muda de estado */
console.log(`\n=== o que está na tela, beat a beat ===`);
console.log("  beat | frase sinal estrut dots marca | interf  z   | painel | camZ");
for (const l of dados) {
  if (l.t % 4 !== 0) continue;
  const painel =
    l.pAtiva > 0.5 ? "ativa" : l.pAuth > 0.5 ? "auth " : l.pAcao > 0.5 ? "ação " : "  —  ";
  console.log(
    `  ${String(l.t).padStart(4)} | ${l.frase.toFixed(2)}  ${l.sinal.toFixed(2)}  ${l.estrutura.toFixed(2)}  ${l.dots.toFixed(2)} ${l.marca.toFixed(2)} | ${l.comp.toFixed(2)} ${String(l.compZ).padStart(4)} | ${painel} | ${String(l.camZ).padStart(5)}`
  );
}

await browser.close();
