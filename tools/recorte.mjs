/** Recorta uma região da VIEWPORT (não do documento) num beat dado. */
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";
const [W, H, beat, saida] = [390, 844, Number(process.argv[2] || 312), process.argv[3] || "recorte"];
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: 3 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate((bt) => {
  const st = window.__st;
  window.__lenis.scrollTo(st.start + (bt / st.animation.duration()) * (st.end - st.start), { immediate: true });
}, beat);
await new Promise(r => setTimeout(r, 2200));
const caixa = await p.evaluate(() => {
  const f = document.querySelector('[class*="figure"]').getBoundingClientRect();
  return { x: Math.max(0, Math.round(f.left) - 20), y: Math.max(0, Math.round(f.top) - 30), w: Math.round(f.width) + 40, h: Math.round(f.height) + 40 };
});
const shot = await p.screenshot({ encoding: "base64" });
const leitor = await b.newPage();
await leitor.goto("data:text/html,<canvas id=c></canvas>");
const recorte = await leitor.evaluate(async (b64, r, dsf) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.getElementById("c");
  c.width = r.w * dsf; c.height = r.h * dsf;
  c.getContext("2d").drawImage(img, r.x * dsf, r.y * dsf, r.w * dsf, r.h * dsf, 0, 0, r.w * dsf, r.h * dsf);
  return c.toDataURL("image/png").split(",")[1];
}, shot, caixa, 3);
writeFileSync(`shots-mobile/${saida}.png`, Buffer.from(recorte, "base64"));
console.log(`beat ${beat} · recorte da figura ${JSON.stringify(caixa)} salvo`);
await b.close();
