import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1500));
const r = await p.evaluate(() => {
  const g = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : "ausente"; };
  return {
    pendente: g("[data-auth-pend]"),
    autorizado: g("[data-auth-ok]"),
    pix: g('[data-painel="auth"] [class*="authWho"]'),
    dot: getComputedStyle(document.querySelector("[data-dot]")).backgroundColor,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
