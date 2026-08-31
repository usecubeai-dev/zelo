/** Onde está a luz que revela o profissional, nos últimos beats. */
import puppeteer from "puppeteer-core";
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1600));
const r = await p.evaluate(() => {
  const tl = window.__st.animation; tl.pause();
  const cls = c => document.querySelector(`[class*="${c}"]`);
  const cx = (e) => { const b = e.getBoundingClientRect();
    return `x ${Math.round(b.left/innerWidth*100)}→${Math.round(b.right/innerWidth*100)}%  y ${Math.round(b.top/innerHeight*100)}→${Math.round(b.bottom/innerHeight*100)}%`; };
  const out = [];
  for (const t of [268, 300, 312]) {
    tl.time(t);
    const sala = +getComputedStyle(cls("room")).opacity;
    out.push(`beat ${t} · sala ${sala.toFixed(2)}`);
    for (const n of ["window", "bloom", "figure", "laptop", "screenGlow", "deskEdge"])
      out.push(`   ${n.padEnd(11)} ${cx(cls(n))}`);
  }
  tl.resume(); return out;
});
console.log(r.join("\n"));
await b.close();
