/**
 * Varre o beat de caos procurando dois problemas objetivos:
 *   COLISÃO — dois elementos legíveis (opacidade > .6) com áreas que se cruzam
 *   CORTE   — um elemento legível (opacidade > .75) para fora do enquadramento
 * Elementos em plena saída de cena não contam: eles estão indo embora.
 *
 * Uso: node tools/colisao.mjs [largura] [altura] [passo]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 390);
const H = Number(process.argv[3] || 844);
const DE = Number(process.argv[4] || 6);
const ATE = Number(process.argv[5] || 100);
const PASSO = Number(process.argv[6] || 2);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

const problemas = [];
const presenca = [];

for (let beat = DE; beat <= ATE + 0.001; beat += PASSO) {
  const p = +beat.toFixed(2);
  await page.evaluate((b) => {
    const st = window.__st;
    const prog = b / st.animation.duration();
    const y = st.start + prog * (st.end - st.start);
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
  }, p);
  await new Promise((r) => setTimeout(r, 1100));

  const r = await page.evaluate(() => {
    const um = (sel, nome) => {
      const e = document.querySelector(sel);
      return e ? [[e, nome]] : [];
    };
    const alvos = [
      ...[...document.querySelectorAll("[data-card]")].map((e, i) => [e, "card" + i]),
      ...[...document.querySelectorAll("[data-msg]")].map((e, i) => [e, "msg" + i]),
      ...[...document.querySelectorAll("[data-chip]")].map((e, i) => [e, "chip" + i]),
      ...[...document.querySelectorAll("[data-sheet]")].map((e, i) => [e, "planilha"]),
      /* capítulo 3 */
      ...um('[class*="composer"]', "interface"),
      ...um('[data-polo="cliente"]', "poloCliente"),
      ...um('[data-polo="voce"]', "poloVoce"),
      ...um("[data-saldo]", "saldo"),
      ...um("[data-valor]", "valor"),
    ];
    const vivos = [];
    for (const [el, nome] of alvos) {
      if (getComputedStyle(el).display === "none") continue;
      const op = +getComputedStyle(el).opacity;
      const b = el.getBoundingClientRect();
      if (op < 0.15 || b.width === 0) continue;
      vivos.push({ nome, op: +op.toFixed(2), t: b.top, b: b.bottom, l: b.left, r: b.right });
    }
    const colisoes = [];
    for (let i = 0; i < vivos.length; i++)
      for (let j = i + 1; j < vivos.length; j++) {
        const a = vivos[i], c = vivos[j];
        if (a.op < 0.6 || c.op < 0.6) continue;
        /* o dinheiro atravessa a cena em primeiro plano: passar por cima é o
           desenho, não um defeito. O corte de quadro dele é checado à parte. */
        if (a.nome === "valor" || c.nome === "valor") continue;
        const cruza = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
        if (cruza) colisoes.push(`${a.nome}(${a.op}) × ${c.nome}(${c.op})`);
      }
    const cortes = vivos
      .filter((v) => v.op > 0.75)
      .filter((v) => v.t < -2 || v.b > innerHeight + 2 || v.l < -2 || v.r > innerWidth + 2)
      .map((v) => `${v.nome}(${v.op}) [${Math.round(v.t)}→${Math.round(v.b)}]`);
    return { vivos: vivos.map((v) => `${v.nome}:${v.op}`), colisoes, cortes };
  });

  presenca.push(`  ${p.toFixed(2)}  ${r.vivos.join("  ") || "(vazio)"}`);
  if (r.colisoes.length) problemas.push(`  ${p.toFixed(2)} COLISÃO ${r.colisoes.join(" | ")}`);
  if (r.cortes.length) problemas.push(`  ${p.toFixed(2)} CORTE   ${r.cortes.join(" | ")}`);
}

console.log(`\n=== presença ao longo do caos (${W}x${H}) ===`);
presenca.forEach((l) => console.log(l));
console.log("\n=== problemas ===");
console.log(problemas.length ? problemas.join("\n") : "  nenhum");
await browser.close();
