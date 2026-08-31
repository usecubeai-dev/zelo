/**
 * Sonda dos capítulos 4 e 5. Cobra os invariantes da conclusão:
 *   - o profissional CRESCE e continua na cena até o último beat
 *   - os três clientes voltam e trocam de estado: some "cobrar"/status antigo,
 *     entra "Pago" — nunca os dois ao mesmo tempo, nunca nenhum
 *   - o sistema fica fora de foco mas continua VIVO (o saldo muda)
 *   - a assinatura aparece antes da marca; a marca antes do CTA
 *   - o CTA só é clicável depois de existir
 *   - no último beat sobram apenas marca, assinatura, CTA e profissional
 *
 * Uso: node tools/cap45.mjs [largura] [altura]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
/* Faixa dos capítulos 4 e 5. Precisa acompanhar lib/scene.ts: com os valores
   antigos (240→312) fixos aqui, a sonda passou a varrer fora da timeline
   depois que a densidade foi comprimida. INICIO fica pouco antes de
   BEAT.atencao; ROTINA_* espelham BEAT.rotina → BEAT.assinatura. */
const INICIO = 214;
const FIM = 286;
const ATENCAO = 216;
const ROTINA_DE = 242;
const ROTINA_ATE = 252;

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
  const cls = (c) => document.querySelector(`[class*="${c}"]`);
  const todos = (c) => [...document.querySelectorAll(`[class*="${c}"]`)];
  const sel = (q) => document.querySelector(q);
  const op = (e) => (e ? +(+getComputedStyle(e).opacity).toFixed(2) : 0);
  const alt = (e) => (e ? Math.round(e.getBoundingClientRect().height) : 0);
  const dentro = (e) => {
    if (!e) return true;
    const b = e.getBoundingClientRect();
    return b.right > 2 && b.left < innerWidth - 2 && b.bottom > 2 && b.top < innerHeight - 2;
  };

  const linhas = [];
  for (let t = INICIO; t <= FIM; t += 0.5) {
    tl.time(t);
    linhas.push({
      t,
      figuraAlt: alt(cls("figure")),
      cards: Math.min(...[...document.querySelectorAll("[data-card]")].map(op)),
      /* "statusPago" contém "status": sem excluir, a pílula nova era medida
         como se fosse a antiga */
      statusAntigo: Math.max(
        ...todos("status")
          .filter((e) => !e.className.includes("statusPago"))
          .map(op)
      ),
      pago: Math.min(...[...document.querySelectorAll("[data-pago]")].map(op)),
      cobrar: Math.max(...todos("cardAct").map(op)),
      saldo: op(sel("[data-saldo]")),
      saldoTexto: (sel("[data-saldo-valor]")?.textContent || "").trim(),
      assinatura: op(cls("brandLine")),
      marca: op(cls("brandMark")),
      cta: op(sel("[data-cta]")),
      ctaClicavel: sel("[data-cta]")
        ? getComputedStyle(sel("[data-cta]")).pointerEvents
        : "",
      ctaDentro: dentro(sel("[data-cta]")),
      publico: op(sel("[data-publico]")),
      sistema: op(cls("composer")),
    });
  }
  tl.resume();
  return linhas;
}, { INICIO, FIM });

const problemas = [];
const emBeat = (t) => ler.find((l) => l.t === t);

/* 1. o profissional cresce e nunca sai */
const alt0 = emBeat(ATENCAO).figuraAlt;
const altPico = Math.max(...ler.map((l) => l.figuraAlt));
if (altPico < alt0 * 1.25)
  problemas.push(`o profissional cresceu só ${((altPico / alt0 - 1) * 100).toFixed(0)}%`);
if (ler[ler.length - 1].figuraAlt < alt0)
  problemas.push("o profissional encolheu abaixo do tamanho inicial no fim");

/* 2. o estado dos cards nunca fica indefinido nem duplicado */
ler
  .filter((l) => l.cards > 0.6 && l.statusAntigo < 0.3 && l.pago < 0.3)
  .forEach((l) => problemas.push(`beat ${l.t}: card legível SEM estado`));
ler
  .filter((l) => l.statusAntigo > 0.7 && l.pago > 0.7)
  .forEach((l) => problemas.push(`beat ${l.t}: status antigo E "Pago" juntos`));
ler
  .filter((l) => l.pago > 0.7 && l.cobrar > 0.4)
  .forEach((l) => problemas.push(`beat ${l.t}: card "Pago" ainda dizendo "cobrar"`));

/* 3. o sistema continua vivo enquanto está fora de foco */
const rotina = ler
  .filter((l) => l.t >= ROTINA_DE && l.t <= ROTINA_ATE)
  .map((l) => l.saldoTexto);
if (new Set(rotina).size < 3)
  problemas.push("o saldo não se move durante a rotina fora de foco");

/* 4. ordem da conclusão: assinatura → marca → CTA */
const chega = (campo) => ler.find((l) => l[campo] > 0.5)?.t ?? Infinity;
const tAss = chega("assinatura"), tMarca = chega("marca"), tCta = chega("cta");
if (!(tAss < tMarca && tMarca < tCta))
  problemas.push(`ordem errada: assinatura ${tAss}, marca ${tMarca}, cta ${tCta}`);

/* 5. o CTA só é clicável quando existe */
ler
  .filter((l) => l.ctaClicavel === "auto" && l.cta < 0.5)
  .forEach((l) => problemas.push(`beat ${l.t}: CTA clicável estando invisível`));
ler.filter((l) => l.cta > 0.9 && !l.ctaDentro).forEach((l) =>
  problemas.push(`beat ${l.t}: CTA visível FORA do quadro`)
);

/* 6. último quadro: só marca, assinatura, CTA e profissional */
const fim = ler[ler.length - 1];
if (fim.sistema > 0.05) problemas.push(`fim: sistema ainda visível (${fim.sistema})`);
if (fim.cards > 0.05) problemas.push(`fim: cards ainda visíveis (${fim.cards})`);
if (fim.saldo > 0.05) problemas.push(`fim: saldo ainda visível (${fim.saldo})`);
if (fim.cta < 0.9) problemas.push(`fim: CTA em ${fim.cta}`);
if (fim.marca < 0.9) problemas.push(`fim: marca em ${fim.marca}`);
if (fim.publico < 0.9) problemas.push(`fim: linha de público em ${fim.publico}`);

console.log(`\n=== capítulos 4 e 5 (${W}x${H}) ===`);
console.log("  beat | profis. | cards estado      | saldo        | assin marca cta | sistema");
for (const l of ler) {
  if (l.t % 4 !== 0) continue;
  const estado =
    l.cards < 0.1 ? "—        " : l.pago > 0.5 ? "pago     " : l.statusAntigo > 0.5 ? "em aberto" : "trocando ";
  console.log(
    `  ${String(l.t).padStart(4)} | ${String(l.figuraAlt).padStart(5)}px | ${l.cards.toFixed(2)} ${estado} | ${(l.saldo > 0.2 ? l.saldoTexto : "—").padEnd(12)} | ${l.assinatura.toFixed(2)}  ${l.marca.toFixed(2)}  ${l.cta.toFixed(2)} | ${l.sistema.toFixed(2)}`
  );
}
console.log(`\n=== invariantes ===`);
console.log(problemas.length ? "  " + problemas.join("\n  ") : "  todos cumpridos");
await browser.close();
