import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto("data:text/html,<body style='background:#111'></body>");
const r = await p.evaluate(async () => {
  const d = []; let last = performance.now(); let on = true;
  const loop = t => { d.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  await new Promise(r => setTimeout(r, 4000)); on = false;
  const u = d.slice(6); const m = u.reduce((a,b)=>a+b,0)/u.length;
  return { fps: +(1000/m).toFixed(1), acima33: u.filter(x=>x>33).length, total: u.length };
});
console.log("página vazia:", JSON.stringify(r));
await b.close();
