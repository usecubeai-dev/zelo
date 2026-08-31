/** Fotografa o estado exato em que o capítulo 3 termina. */
import puppeteer from "puppeteer-core";
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H });
await p.goto("http://localhost:3210", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1800));
const r = await p.evaluate(() => {
  const tl = window.__st.animation;
  tl.pause(); tl.time(tl.duration());
  const cls = c => document.querySelector(`[class*="${c}"]`);
  const sel = q => document.querySelector(q);
  const est = (e, nome) => {
    if (!e) return `${nome}: ausente`;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const m = new DOMMatrix(cs.transform);
    const esc = Math.hypot(m.m11, m.m12).toFixed(2);
    return `${nome.padEnd(14)} op ${(+cs.opacity).toFixed(2)}  z ${m.m43.toFixed(0).padStart(5)}  escala ${esc}  caixa x${Math.round(r.x)}→${Math.round(r.right)} y${Math.round(r.y)}→${Math.round(r.bottom)}`;
  };
  return {
    duracao: tl.duration(),
    estados: [
      est(cls("camera"), "câmera"),
      est(cls("room"), "sala"),
      est(cls("figure"), "profissional"),
      est(cls("desk"), "mesa"),
      est(cls("greenLight"), "luz verde"),
      est(cls("composer"), "interface"),
      est(sel('[data-polo="cliente"]'), "polo cliente"),
      est(sel('[data-polo="voce"]'), "polo você"),
      est(sel("[data-valor]"), "valor"),
      est(sel("[data-saldo]"), "saldo"),
      est(cls("layer"), "camada caos"),
      est(cls("copy"), "headline"),
      est(cls("phrase"), "frase"),
      est(cls("brand"), "marca"),
    ],
    saldo: sel("[data-saldo-valor]")?.textContent,
    inventario: {
      cards: document.querySelectorAll("[data-card]").length,
      msgs: document.querySelectorAll("[data-msg]").length,
      chips: document.querySelectorAll("[data-chip]").length,
      planilha: document.querySelectorAll("[data-sheet]").length,
    },
  };
});
console.log(`duração da timeline: ${r.duracao} beats · saldo final: ${r.saldo}`);
console.log(`inventário reutilizável: ${JSON.stringify(r.inventario)}`);
r.estados.forEach(l => console.log("  " + l));
await b.close();
