/** Rola a narrativa até o fim e depois de volta, conferindo se os mesmos
 *  elementos reaparecem nos mesmos pontos — o teste de reversibilidade. */
import puppeteer from "puppeteer-core";
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2000));

const ler = async (beat) => {
  await p.evaluate((b) => {
    const st = window.__st;
    const pr = b / st.animation.duration();
    window.__lenis.scrollTo(st.start + pr * (st.end - st.start), { immediate: true });
  }, beat);
  await new Promise(r => setTimeout(r, 1200));
  return p.evaluate(() => {
    const f = (sel, n) => [...document.querySelectorAll(sel)]
      .filter(e => getComputedStyle(e).display !== "none")
      .map((e, i) => ({ nome: n + i, op: +(+getComputedStyle(e).opacity).toFixed(1) }))
      .filter(v => v.op > 0.2).map(v => `${v.nome}:${v.op}`);
    const txt = (sel) => (document.querySelector(sel)?.textContent || "").trim();
    return [
      ...f("[data-card]", "card"),
      ...f("[data-msg]", "msg"),
      ...f("[data-chip]", "chip"),
      ...f("[data-sheet]", "planilha"),
      ...f("[data-valor]", "valor"),
      ...f("[data-saldo]", "saldo"),
      "saldo=" + txt("[data-saldo-valor]"),
    ].join(" ");
  });
};

/* pontos em BEATS, um por capítulo: caos, sistema, trânsito do dinheiro e
   terceiro ciclo da recorrência */
/* Beats-chave, um por capítulo. Precisam acompanhar lib/scene.ts: os valores
   antigos ([25, 88, 197, 233, 268, 301]) apontavam para outros momentos
   depois que a densidade foi comprimida. */
const pontos = [25, 85, 174, 204, 242, 276];
const ida = {};
for (const pt of pontos) ida[pt] = await ler(pt);
await ler(311); // vai até o fim da narrativa
const volta = {};
for (const pt of [...pontos].reverse()) volta[pt] = await ler(pt);

let ok = true;
for (const pt of pontos) {
  const igual = ida[pt] === volta[pt];
  if (!igual) ok = false;
  console.log(`${pt}  ${igual ? "igual" : "DIFERENTE"}\n   ida:   ${ida[pt]}\n   volta: ${volta[pt]}`);
}
console.log(ok ? "\nreversível: a história volta idêntica" : "\nFALHOU: a volta não bate com a ida");
await b.close();
