import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
for (const [W,H] of [[1440,900],[390,844]]) {
  const p = await b.newPage();
  await p.setViewport({ width: W, height: H });
  await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1200));
  const r = await p.evaluate(() => {
    const g = (c) => { const e = document.querySelector(`[class*="${c}"]`); if(!e) return null;
      const b = e.getBoundingClientRect();
      return `x ${Math.round(b.left/innerWidth*100)}%→${Math.round(b.right/innerWidth*100)}%  y ${Math.round(b.top/innerHeight*100)}%→${Math.round(b.bottom/innerHeight*100)}%`; };
    return { figura: g("figure"), mesa: g("desk"), laptop: g("laptop") };
  });
  console.log(`${W}x${H}`, JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
