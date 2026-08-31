import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2000));
for (const beat of [285, 312]) {
  await p.evaluate((bt) => {
    const st = window.__st;
    window.__lenis.scrollTo(st.start + (bt / st.animation.duration()) * (st.end - st.start), { immediate: true });
  }, beat);
  await new Promise(r => setTimeout(r, 1500));
  const info = await p.evaluate(() => {
    const f = document.querySelector('[class*="figure"]').getBoundingClientRect();
    return { beat: +window.__st.animation.time().toFixed(1), y: Math.round(f.top), b: Math.round(f.bottom) };
  });
  console.log(`alvo ${beat} → timeline em ${info.beat}, figura y ${info.y}→${info.b}`);
  await p.screenshot({ path: `shots-mobile/zoom-${beat}.png`, clip: { x: 100, y: Math.max(0, info.y - 30), width: 230, height: 190 } });
}
await b.close();
