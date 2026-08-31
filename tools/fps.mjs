import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--hide-scrollbars", "--window-size=1440,900"],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2000));

const res = await p.evaluate(async () => {
  const st = window.__st, lenis = window.__lenis;
  const alvo = st.start + 0.98 * (st.end - st.start);
  const deltas = [];
  let last = performance.now();
  let rodando = true;
  const loop = (t) => { deltas.push(t - last); last = t; if (rodando) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  lenis.scrollTo(alvo, { duration: 8 });
  await new Promise((r) => setTimeout(r, 8600));
  rodando = false;
  const uteis = deltas.slice(6);
  const media = uteis.reduce((a, b) => a + b, 0) / uteis.length;
  const ordenado = [...uteis].sort((a, b) => a - b);
  return {
    quadros: uteis.length,
    fpsMedio: +(1000 / media).toFixed(1),
    p95ms: +ordenado[Math.floor(ordenado.length * 0.95)].toFixed(1),
    piorMs: +ordenado[ordenado.length - 1].toFixed(1),
    acima33ms: uteis.filter((d) => d > 33).length,
    progressoFinal: +st.progress.toFixed(2),
  };
});
console.log(JSON.stringify(res));
await b.close();
