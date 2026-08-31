import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2000));
const res = await p.evaluate(async () => {
  const st = window.__st, lenis = window.__lenis;
  const d = []; let last = performance.now(); let on = true;
  const loop = t => { d.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  lenis.scrollTo(st.start + 0.98 * (st.end - st.start), { duration: 8 });
  await new Promise(r => setTimeout(r, 8600)); on = false;
  const u = d.slice(6); const m = u.reduce((a,b)=>a+b,0)/u.length;
  const o = [...u].sort((a,b)=>a-b);
  return { fpsMedio: +(1000/m).toFixed(1), p95ms: +o[Math.floor(o.length*0.95)].toFixed(1), acima33ms: u.filter(x=>x>33).length, quadros: u.length };
});
console.log("mobile:", JSON.stringify(res));
await b.close();
