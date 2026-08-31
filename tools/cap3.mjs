/**
 * Sonda do capítulo 3. Percorre os beats lendo o estado real da cena e
 * cobra os invariantes da narrativa:
 *   - o valor nunca sai do enquadramento enquanto está legível
 *   - o token está sempre em UM estado (viajando ou pago), nunca nos dois
 *     nem em nenhum
 *   - o saldo só cresce, na ordem 0 → 350 → 700 → 1050
 *   - a data do card só avança: 05 SET → Hoje → 05 OUT → 05 NOV → 05 DEZ
 *   - nada fica preso no fim: o token some, o saldo fecha em 1.050,00
 *
 * Uso: node tools/cap3.mjs [largura] [altura]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
/* Faixa do capítulo 3, de pouco antes de BEAT.abertura até
   BEAT.capituloTres. Precisa acompanhar lib/scene.ts: com os valores
   antigos (168→242) fixos aqui, a sonda passou a varrer para dentro do
   capítulo 4 depois que a densidade foi comprimida. */
const INICIO = 153;
const FIM = 216;

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

const ler = await page.evaluate(({ INICIO, FIM }) => {
  const tl = window.__st.animation;
  tl.pause();
  const sel = (q) => document.querySelector(q);
  const cls = (c) => document.querySelector(`[class*="${c}"]`);
  const op = (e) => (e ? +(+getComputedStyle(e).opacity).toFixed(2) : 0);
  const caixa = (e) => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return {
      x: Math.round(b.left),
      r: Math.round(b.right),
      y: Math.round(b.top),
      b: Math.round(b.bottom),
      dentro:
        b.right > 2 &&
        b.left < innerWidth - 2 &&
        b.bottom > 2 &&
        b.top < innerHeight - 2,
    };
  };
  /* qual item da faixa de rolagem está visível */
  const rolagem = (track) => {
    if (!track) return "";
    const item = track.firstElementChild;
    if (!item) return "";
    /* offsetHeight, não getBoundingClientRect: o card está escalado e o
       retângulo renderizado não bate com o translate local da faixa */
    const dy = new DOMMatrix(getComputedStyle(track).transform).m42;
    const i = Math.round(-dy / item.offsetHeight);
    return (track.children[i] || track.children[0]).textContent.trim();
  };

  const valor = sel("[data-valor]");
  const corpo = [...document.querySelectorAll("[data-valor-corpo]")];
  const linhas = [];
  for (let t = INICIO; t <= FIM; t += 0.5) {
    tl.time(t);
    linhas.push({
      t,
      card: op(cls("composer")),
      cardCaixa: caixa(cls("composer")),
      poloC: op(sel('[data-polo="cliente"]')),
      poloV: op(sel('[data-polo="voce"]')),
      valor: op(valor),
      valorCaixa: caixa(valor),
      corpo: Math.max(...corpo.map(op)),
      pago: op(sel("[data-valor-pago]")),
      saldo: op(sel("[data-saldo]")),
      saldoTexto: (sel("[data-saldo-valor]")?.textContent || "").trim(),
      data: rolagem(sel("[data-datas]")),
      pagoData: rolagem(sel("[data-pago-datas]")),
      camZ: +new DOMMatrix(getComputedStyle(cls("camera")).transform).m43.toFixed(0),
    });
  }
  tl.resume();
  return linhas;
}, { INICIO, FIM });

const problemas = [];

/* 1. o valor não pode estar legível e fora do quadro */
ler
  .filter((l) => l.valor > 0.6 && l.valorCaixa && !l.valorCaixa.dentro)
  .forEach((l) => problemas.push(`beat ${l.t}: valor legível FORA do quadro`));

/* 2. estado indefinido do token: visível sem corpo nem comprovante, ou com os dois */
ler
  .filter((l) => l.valor > 0.6 && l.corpo < 0.35 && l.pago < 0.35)
  .forEach((l) => problemas.push(`beat ${l.t}: token visível SEM estado`));
ler
  .filter((l) => l.corpo > 0.7 && l.pago > 0.7)
  .forEach((l) => problemas.push(`beat ${l.t}: token em DOIS estados ao mesmo tempo`));

/* 3. o saldo só cresce */
let anterior = -1;
for (const l of ler) {
  const n = Number(
    (l.saldoTexto || "0").replace(/[^\d,]/g, "").replace(",", ".")
  );
  if (n + 0.01 < anterior) problemas.push(`beat ${l.t}: saldo REGREDIU (${l.saldoTexto})`);
  anterior = Math.max(anterior, n);
}

/* 4. a data só avança */
const ordem = ["05 SET", "Hoje", "05 OUT", "05 NOV", "05 DEZ"];
let ultima = 0;
for (const l of ler) {
  const i = ordem.indexOf(l.data);
  if (i >= 0 && i < ultima) problemas.push(`beat ${l.t}: data VOLTOU para ${l.data}`);
  if (i >= 0) ultima = Math.max(ultima, i);
}

/* 5. o dinheiro precisa REALMENTE atravessar: em cada ciclo o token tem de
      aparecer do lado do cliente e depois do lado do prestador */
const vertical = W < 700;
const meio = vertical ? H / 2 : W / 2;
const centro = (c) => (vertical ? (c.y + c.b) / 2 : (c.x + c.r) / 2);
const visiveis = ler.filter((l) => l.valor > 0.6 && l.valorCaixa);
const ladoCliente = visiveis.filter((l) => centro(l.valorCaixa) < meio).length;
const ladoPrestador = visiveis.filter((l) => centro(l.valorCaixa) > meio).length;
if (!ladoCliente) problemas.push("o valor nunca aparece do lado do cliente");
if (!ladoPrestador) problemas.push("o valor NUNCA CHEGA do lado do prestador");
console.log(
  `
=== travessia === amostras do lado do cliente: ${ladoCliente} · do lado do prestador: ${ladoPrestador}`
);

/* 5. nada preso no fim */
const fim = ler[ler.length - 1];
if (fim.valor > 0.1) problemas.push(`fim: token ainda visível (${fim.valor})`);
if (!fim.saldoTexto.includes("1.050")) problemas.push(`fim: saldo é ${fim.saldoTexto}`);
if (fim.data !== "05 DEZ") problemas.push(`fim: data é ${fim.data}`);
if (fim.card < 0.9) problemas.push(`fim: card do cliente sumiu (${fim.card})`);

console.log(`\n=== capítulo 3, beat a beat (${W}x${H}) ===`);
console.log("  beat | card polos | valor estado    | saldo        | próxima | camZ");
for (const l of ler) {
  if (l.t % 2 !== 0) continue;
  const estado =
    l.valor < 0.1 ? "—        " : l.pago > 0.5 ? "pago     " : "viajando ";
  console.log(
    `  ${String(l.t).padStart(4)} | ${l.card.toFixed(2)} ${l.poloC.toFixed(2)}/${l.poloV.toFixed(2)} | ${l.valor.toFixed(2)} ${estado} | ${(l.saldo > 0.3 ? l.saldoTexto : "—").padEnd(12)} | ${l.data.padEnd(7)} | ${String(l.camZ).padStart(5)}`
  );
}

console.log(`\n=== invariantes ===`);
console.log(problemas.length ? "  " + problemas.join("\n  ") : "  todos cumpridos");
await browser.close();
