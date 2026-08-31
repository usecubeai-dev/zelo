import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });

const casos = [
  ["completo", []],
  ["sem grão+vinheta", ["grain", "vignette"]],
  ["sem gradientes borrados", ["bloom", "haze", "screenGlow", "deskPool"]],
  ["sem caos", ["layer"]],
  ["sem sala", ["room"]],
  ["só texto", ["room", "layer", "grain", "vignette"]],
];

for (const [nome, alvos] of casos) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1800));
  const r = await p.evaluate(async (alvos) => {
    alvos.forEach(a => document.querySelectorAll(`[class*="${a}"]`).forEach(e => (e.style.display = "none")));
    const st = window.__st, lenis = window.__lenis;
    const d = []; let last = performance.now(); let on = true;
    const loop = t => { d.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    lenis.scrollTo(st.start + 0.98 * (st.end - st.start), { duration: 6 });
    await new Promise(r => setTimeout(r, 6400)); on = false;
    const u = d.slice(6); const m = u.reduce((a,b)=>a+b,0)/u.length;
    return { fps: +(1000/m).toFixed(1), lentos: u.filter(x=>x>33).length, total: u.length };
  }, alvos);
  console.log(nome.padEnd(26), JSON.stringify(r));
  await p.close();
}
await b.close();
