/** Relatório do que está visível em cada ponto da narrativa. */
import puppeteer from "puppeteer-core";

const P = process.argv.slice(2).map(Number);
const points = P.length ? P : [0.2, 0.3, 0.4, 0.47];

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--window-size=1440,900", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

for (const p of points) {
  await page.evaluate((prog) => {
    const st = window.__st;
    const y = st.start + prog * (st.end - st.start);
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
  }, p);
  await new Promise((r) => setTimeout(r, 1500));

  const data = await page.evaluate(() => {
    const inFrame = (r) =>
      r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    const rep = (sel, label) =>
      [...document.querySelectorAll(sel)].map((e, i) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return `${label}${i}: op=${(+cs.opacity).toFixed(2)} ${
          inFrame(r) ? "dentro" : "FORA"
        } [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(
          r.height
        )}] blur=${(cs.filter.match(/blur\(([\d.]+)px\)/) || [0, 0])[1]}`;
      });
    return {
      prog: +window.__st.progress.toFixed(3),
      itens: [
        ...rep("[data-card]", "card"),
        ...rep("[data-msg]", "msg"),
        ...rep("[data-sheet]", "sheet"),
        ...rep("[data-chip]", "chip"),
      ],
    };
  });
  console.log(`\n=== progresso ${data.prog} ===`);
  data.itens.forEach((l) => console.log("  " + l));
}
await browser.close();
