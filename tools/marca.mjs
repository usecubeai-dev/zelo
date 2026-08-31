/**
 * Extrai os assets oficiais da folha de marca.
 *
 * A folha é um JPG 2×2 sobre fundo escuro. Nada aqui redesenha a logo: o
 * script recorta os quadrantes, acha o conteúdo real de cada um e
 * reconstrói o canal alfa a partir da distância de cada pixel para a cor
 * de fundo — que é o que devolve a arte utilizável sobre qualquer fundo.
 *
 * Usa o Chrome já instalado (canvas), sem dependência nova.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const FOLHA = "C:/Users/matos/OneDrive/Imagens/zelo logo.jpg";
const RAIZ = path.resolve(import.meta.dirname, "..");
const MARCA = path.join(RAIZ, "public", "marca");
fs.mkdirSync(MARCA, { recursive: true });

const dataUri = `data:image/jpeg;base64,${fs.readFileSync(FOLHA).toString("base64")}`;

const CHROME =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const pagina = await navegador.newPage();

const saidas = await pagina.evaluate(async (uri) => {
  const img = new Image();
  img.src = uri;
  await img.decode();

  const L = img.width / 2;
  const A = img.height / 2;

  /** Quadrantes da folha, na ordem em que aparecem. */
  const QUADRANTES = {
    lockup: [0, 0, L, A],
    simbolo: [L, 0, L, A],
    wordmark: [0, A, L, A],
    appIcon: [L, A, L, A],
  };

  /* A folha separa os quadrantes por linhas finas, um pouco mais claras
     que o fundo. Elas passavam no teste de "isto é arte" e entravam na
     caixa, deixando margem morta e um retângulo fantasma na borda do
     asset. Descartar 18px de cada lado do quadrante resolve na origem —
     a arte nunca chega perto da divisória. */
  const MARGEM_DIVISORIA = 18;

  function recorta(x, y, w, h) {
    const m = MARGEM_DIVISORIA;
    const c = document.createElement("canvas");
    c.width = w - m * 2;
    c.height = h - m * 2;
    c.getContext("2d").drawImage(img, x + m, y + m, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }

  /** Cor de fundo estimada pela mediana dos quatro cantos. */
  function fundoDe(canvas) {
    const ctx = canvas.getContext("2d");
    const amostras = [
      ctx.getImageData(2, 2, 8, 8).data,
      ctx.getImageData(canvas.width - 10, 2, 8, 8).data,
      ctx.getImageData(2, canvas.height - 10, 8, 8).data,
      ctx.getImageData(canvas.width - 10, canvas.height - 10, 8, 8).data,
    ];
    let r = 0, g = 0, b = 0, n = 0;
    for (const d of amostras)
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return [r / n, g / n, b / n];
  }

  /** Distância máxima por canal — serve de medida de "quanto isto é arte". */
  const dist = (d, i, bg) =>
    Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));

  /** Caixa do conteúdo, para o asset não vir com margem morta. */
  function caixa(canvas, bg, limiar = 26) {
    const { width: w, height: h } = canvas;
    const d = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (dist(d, (y * w + x) * 4, bg) > limiar) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /**
   * Fundo escuro → alfa. `px = fg·a + bg·(1−a)`; conhecendo `bg` e
   * estimando `a` pela distância, recupera-se `fg` sem lavar o violeta.
   */
  function transparenta(canvas, bg, escala = 205) {
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.min(1, dist(d, i, bg) / escala);
      if (a < 0.12) { d[i + 3] = 0; continue; }
      for (let k = 0; k < 3; k++) {
        const v = (d[i + k] - bg[k] * (1 - a)) / a;
        d[i + k] = Math.max(0, Math.min(255, Math.round(v)));
      }
      d[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function apara(canvas, cx, folga = 0) {
    const w = cx.x1 - cx.x0 + 1 + folga * 2;
    const h = cx.y1 - cx.y0 + 1 + folga * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(canvas, cx.x0 - folga, cx.y0 - folga, w, h, 0, 0, w, h);
    return c;
  }

  const png = (c) => c.toDataURL("image/png");
  const out = {};

  // --- as três peças vetoriais-equivalentes, com fundo removido ---
  for (const nome of ["lockup", "simbolo", "wordmark"]) {
    const [x, y, w, h] = QUADRANTES[nome];
    const c = recorta(x, y, w, h);
    const bg = fundoDe(c);
    const cx = caixa(c, bg);
    out[nome] = png(transparenta(apara(c, cx, 4), bg));
    out[nome + "_dim"] = [cx.x1 - cx.x0 + 9, cx.y1 - cx.y0 + 9];
  }

  /* O app icon é montado, não recortado.
     Recortá-lo da folha traria junto o glow violeta de ambientação, e a
     borda do quadrado escuro é indistinguível do fundo — a tentativa de
     isolar cortou o padding e deixou o símbolo sangrando nas bordas.
     Montar a partir do símbolo oficial sobre o fundo da marca dá o mesmo
     resultado da folha, com a safe area correta. Não há redesenho: o
     símbolo é o asset extraído do quadrante 2. */
  {
    const [x, y, w, h] = QUADRANTES.simbolo;
    const c = recorta(x, y, w, h);
    const bg = fundoDe(c);
    const simbolo = transparenta(apara(c, caixa(c, bg), 4), bg);

    const montaIcone = (lado) => {
      const s = document.createElement("canvas");
      s.width = s.height = lado;
      const ctx = s.getContext("2d");
      ctx.fillStyle = `rgb(${bg.map(Math.round).join(",")})`;
      ctx.fillRect(0, 0, lado, lado);
      /* 62% de ocupação: o símbolo é mais alto que largo, então a altura
         é que governa — é o que impede o corte na máscara circular do
         Android e no arredondamento do iOS. */
      const alvoA = lado * 0.62;
      const alvoL = (simbolo.width / simbolo.height) * alvoA;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(simbolo, (lado - alvoL) / 2, (lado - alvoA) / 2, alvoL, alvoA);
      return s;
    };

    const q = montaIcone(512);
    out.appIcon = png(q);
    out.appIcon_dim = [512, 512];
    const noTamanho = (t) => png(montaIcone(t));

    out.icon512 = out.appIcon;
    out.appleIcon = noTamanho(180);
  }

  /* Open Graph: 1200×630 obrigatórios. Fundo da marca + lockup centrado a
     62% da largura — proporção que sobrevive ao recorte quadrado que
     WhatsApp e Telegram aplicam. */
  {
    const [x, y, w, h] = QUADRANTES.lockup;
    const c = recorta(x, y, w, h);
    const bg = fundoDe(c);
    const arte = transparenta(apara(c, caixa(c, bg), 4), bg);

    const og = document.createElement("canvas");
    og.width = 1200;
    og.height = 630;
    const ctx = og.getContext("2d");
    ctx.fillStyle = `rgb(${bg.map(Math.round).join(",")})`;
    ctx.fillRect(0, 0, 1200, 630);
    const alvoL = 1200 * 0.62;
    const alvoA = (arte.height / arte.width) * alvoL;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(arte, (1200 - alvoL) / 2, (630 - alvoA) / 2, alvoL, alvoA);
    out.og = png(og);
    out.corFundo = `rgb(${bg.map(Math.round).join(",")})`;
  }

  /* Prova visual: as três peças transparentes compostas sobre o fundo da
     marca. Serve para conferir que o branco tem alfa cheio — sobre fundo
     branco de visualizador, arte branca some e parece defeito. */
  {
    const prova = document.createElement("canvas");
    prova.width = 1200;
    prova.height = 900;
    const ctx = prova.getContext("2d");
    ctx.fillStyle = out.corFundo || "rgb(17,17,22)";
    ctx.fillRect(0, 0, 1200, 900);
    let y = 40;
    for (const nome of ["lockup", "simbolo", "wordmark"]) {
      const im = new Image();
      im.src = out[nome];
      await im.decode();
      const alvoA = nome === "simbolo" ? 240 : 150;
      const alvoL = (im.width / im.height) * alvoA;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, 40, y, alvoL, alvoA);
      y += alvoA + 40;
    }
    const ic = new Image();
    ic.src = out.appIcon;
    await ic.decode();
    ctx.drawImage(ic, 900, 40, 240, 240);
    ctx.drawImage(ic, 900, 320, 96, 96);
    ctx.drawImage(ic, 900, 440, 32, 32);
    out.prova = prova.toDataURL("image/png");
  }

  return out;
}, dataUri);

await navegador.close();

const grava = (destino, dataUrl) => {
  const arquivo = path.join(RAIZ, destino);
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, Buffer.from(dataUrl.split(",")[1], "base64"));
  const kb = (fs.statSync(arquivo).size / 1024).toFixed(0);
  console.log(`  ${destino.padEnd(34)} ${kb} KB`);
};

console.log("\nAssets gerados a partir de 'zelo logo.jpg':\n");
grava("public/marca/zelo-lockup.png", saidas.lockup);
grava("public/marca/zelo-simbolo.png", saidas.simbolo);
grava("public/marca/zelo-wordmark.png", saidas.wordmark);
grava("public/marca/zelo-app-icon.png", saidas.appIcon);
grava("app/icon.png", saidas.icon512);
grava("app/apple-icon.png", saidas.appleIcon);
grava("public/og.png", saidas.og);
grava("tools/prova-marca.png", saidas.prova);

console.log(
  `\n  dimensões: lockup ${saidas.lockup_dim} · símbolo ${saidas.simbolo_dim} · wordmark ${saidas.wordmark_dim} · appIcon ${saidas.appIcon_dim}`
);
console.log(`  fundo da marca: ${saidas.corFundo}\n`);
