import puppeteer from "puppeteer-core";
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);
const beats = process.argv.slice(4).map(Number);
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1800));
const out = await p.evaluate((beats) => {
  const tl = window.__st.animation; tl.pause();
  const cls = c => document.querySelector(`[class*="${c}"]`);
  const pos = (e, n) => {
    if (!e) return `${n}: ausente`;
    const r = e.getBoundingClientRect(), o = +getComputedStyle(e).opacity;
    return `${n.padEnd(13)} op ${o.toFixed(2)} x ${Math.round(r.x/innerWidth*100)}%→${Math.round(r.right/innerWidth*100)}%  y ${Math.round(r.y/innerHeight*100)}%→${Math.round(r.bottom/innerHeight*100)}%`;
  };
  const res = [];
  for (const t of beats) {
    tl.time(t);
    const cards = [...document.querySelectorAll("[data-card]")];
    res.push(`--- beat ${t} ---`);
    cards.forEach((c,i) => res.push("  " + pos(c, "card"+i)));
    res.push("  " + pos(cls("composer"), "sistema"));
    res.push("  " + pos(cls("saldo"), "saldo"));
    res.push("  " + pos(cls("figure"), "profissional"));
    res.push("  " + pos(cls("brandIn"), "marca/assin."));
    res.push("  " + pos(document.querySelector("[data-cta]"), "cta"));
  }
  tl.resume();
  return res;
}, beats);
console.log(out.join("\n"));
await b.close();
