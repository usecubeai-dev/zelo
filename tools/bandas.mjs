/** Mede, no mobile, a faixa vertical que cada elemento realmente ocupa. */
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2000));
for (const prog of [0.4, 0.47]) {
  await p.evaluate((pr) => {
    const st = window.__st;
    window.__lenis.scrollTo(st.start + pr * (st.end - st.start), { immediate: true });
  }, prog);
  await new Promise(r => setTimeout(r, 1500));
  const r = await p.evaluate(() => {
    const H = innerHeight, W = innerWidth;
    const f = (sel, nome) => [...document.querySelectorAll(sel)]
      .filter(e => getComputedStyle(e).display !== "none")
      .map((e, i) => { const b = e.getBoundingClientRect();
        return `${nome}${i}: y ${Math.round(b.top/H*100)}%→${Math.round(b.bottom/H*100)}%  x ${Math.round(b.left/W*100)}%→${Math.round(b.right/W*100)}%  (${Math.round(b.height)}px)`; });
    return [...f("[data-card]","card"), ...f("[data-sheet]","planilha"), ...f("[data-msg]","msg"), ...f("[data-chip]","chip")];
  });
  console.log(`\n--- progresso ${prog} ---`);
  r.forEach(l => console.log("  " + l));
}
await b.close();
