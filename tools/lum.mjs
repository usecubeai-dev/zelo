/**
 * Auditoria de luminância. Fotografa a cena em beats escolhidos e MEDE o
 * brilho médio de regiões nomeadas, em vez de julgar no olho.
 *
 * A leitura é feita decodificando o PNG dentro do próprio Chrome (canvas),
 * porque o Node aqui não tem decodificador de imagem.
 *
 * Escala: 0 = preto, 100 = branco. Referência prática de leitura:
 *   < 4    praticamente indistinguível de preto
 *   4–10   penumbra com volume perceptível
 *   10–20  ambiente escuro legível
 *   > 60   superfície clara (interface, texto)
 *
 * Uso: node tools/lum.mjs [largura] [altura] [beat,beat,...]
 */
import puppeteer from "puppeteer-core";

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const BEATS = (process.argv[4] || "2,31,63,104,197,268,311")
  .split(",")
  .map(Number);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

/* página auxiliar só para decodificar os PNGs */
const leitor = await browser.newPage();
await leitor.goto("data:text/html,<canvas id=c></canvas>");

/** brilho médio e máximo de um retângulo, em % */
const medir = async (b64, x, y, w, h) =>
  leitor.evaluate(
    async (b64, x, y, w, h) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.getElementById("c");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(x, y, w, h).data;
      let soma = 0,
        max = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        soma += l;
        if (l > max) max = l;
      }
      const n = d.length / 4;
      return { media: +((soma / n / 255) * 100).toFixed(1), pico: +((max / 255) * 100).toFixed(1) };
    },
    b64,
    x,
    y,
    w,
    h
  );

console.log(`\n=== luminância medida (${W}x${H}) ===`);
console.log("  beat | região                | média | pico");

for (const beat of BEATS) {
  await page.evaluate((bt) => {
    const st = window.__st;
    window.__lenis.scrollTo(
      st.start + (bt / st.animation.duration()) * (st.end - st.start),
      { immediate: true }
    );
  }, beat);
  /* o Lenis precisa assentar antes da foto: medir cedo demais lê o quadro
     anterior e produz número errado */
  await new Promise((r) => setTimeout(r, 2600));

  const regioes = await page.evaluate(() => {
    const r = (sel, nome) => {
      const e =
        document.querySelector(sel) ||
        document.querySelector(`[class*="${sel}"]`);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      const x = Math.max(0, Math.round(b.left));
      const y = Math.max(0, Math.round(b.top));
      const w = Math.min(innerWidth - x, Math.round(b.width));
      const h = Math.min(innerHeight - y, Math.round(b.height));
      return w > 4 && h > 4 ? { nome, x, y, w, h } : null;
    };
    return [
      { nome: "fundo (canto sup. esq.)", x: 10, y: 10, w: Math.round(innerWidth * 0.2), h: Math.round(innerHeight * 0.2) },
      { nome: "fundo (centro-baixo)", x: Math.round(innerWidth * 0.06), y: Math.round(innerHeight * 0.78), w: Math.round(innerWidth * 0.22), h: Math.round(innerHeight * 0.16) },
      r('[class*="figure"]', "profissional"),
      r('[class*="laptop"]', "notebook"),
      r('[class*="composer"]', "interface"),
      r("[data-card]", "card de cobrança"),
      r("[data-cta]", "CTA"),
      r('[class*="brandLine"]', "assinatura"),
      r("[data-saldo]", "saldo"),
    ].filter(Boolean);
  });

  const b64 = await page.screenshot({ encoding: "base64" });
  for (const g of regioes) {
    const m = await medir(b64, g.x, g.y, g.w, g.h);
    const alerta = m.media < 4 ? "  ← quase preto" : m.media < 7 ? "  ← limítrofe" : "";
    console.log(
      `  ${String(beat).padStart(4)} | ${g.nome.padEnd(21)} | ${String(m.media).padStart(5)} | ${String(m.pico).padStart(5)}${alerta}`
    );
  }
}

await browser.close();
