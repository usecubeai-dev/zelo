"use client";

import { useEffect, useRef } from "react";

/**
 * O objeto do Hero — lâminas de vidro empilhadas, em canvas.
 *
 * Três placas de acrílico violeta com cantos muito arredondados, flutuando
 * levemente deslocadas em escada ascendente. Cada uma tem espessura real:
 * face superior iluminada, parede lateral mais escura e a aresta acesa na
 * quina. Empilhadas, leem como camadas de um mesmo produto — a cobrança
 * que se repete e sobe.
 *
 * Por que não o anel anterior: era um toro escuro com o miolo vazio, e
 * miolo vazio dentro de um contorno claro é a forma de um olho. Com o
 * brilho verde embaixo, a leitura virava criatura. Formas sólidas,
 * assimétricas e sem furo central não têm esse problema.
 *
 * Nada de aresta viva, vermelho, névoa ou contraste dramático: luz de
 * estúdio, material translúcido e cantos generosos.
 */

/** Isometria suave: inclinação e compressão do plano superior. */
const SKEW_X = -0.46;
const SKEW_Y = 0.26;
const COMPRESSAO = 0.58;

type Lamina = {
  lado: number;
  dx: number;
  dz: number;
  y: number;
  espessura: number;
  /** defasagem da respiração, para as três não subirem juntas */
  fase: number;
  /** a única que carrega o traço verde */
  recebimento?: boolean;
};

const LAMINAS: Lamina[] = [
  { lado: 1.02, dx: 0.1, dz: 0.08, y: -0.5, espessura: 0.11, fase: 0 },
  { lado: 0.84, dx: -0.12, dz: -0.06, y: -0.04, espessura: 0.1, fase: 1.1 },
  { lado: 0.62, dx: 0.08, dz: -0.16, y: 0.4, espessura: 0.09, fase: 2.2, recebimento: true },
];

export default function HeroObjeto() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let L = 0;
    let A = 0;
    let escala = 1;

    const dimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.getBoundingClientRect();
      L = c.width;
      A = c.height;
      canvas.width = Math.round(L * dpr);
      canvas.height = Math.round(A * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      escala = Math.min(L, A) * 0.34;
    };
    dimensionar();
    const ro = new ResizeObserver(dimensionar);
    ro.observe(canvas);

    let inicio = performance.now();
    let quadro = 0;
    let vivo = true;

    /** Traça (sem preencher) a placa arredondada no plano isométrico. */
    const placa = (px: number, py: number, lado: number, deriva: number) => {
      const s = lado * escala;
      ctx.save();
      ctx.translate(px, py);
      ctx.transform(1, SKEW_Y + deriva * 0.06, SKEW_X + deriva * 0.1, COMPRESSAO, 0, 0);
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.3);
      ctx.restore();
    };

    const render = (agora: number) => {
      const t = reduzido ? 4 : (agora - inicio) / 1000;
      ctx.clearRect(0, 0, L, A);

      const cx = L / 2;
      const cy = A * 0.44;
      const deriva = reduzido ? 0 : Math.sin(t * 0.17) * 0.5;

      // sombra de contato no pedestal
      const sy = cy + escala * 1.5;
      const sg = ctx.createRadialGradient(cx, sy, 0, cx, sy, escala * 1.25);
      sg.addColorStop(0, "rgba(0,0,0,0.46)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(cx, sy, escala * 1.25, escala * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Halo de estúdio. O raio precisa caber dentro do canvas: passando
         das bordas, o gradiente é cortado em reta e aparece como um
         retângulo claro em volta do objeto. */
      const raioHalo = Math.min(escala * 1.7, L * 0.46, A * 0.46);
      const halo = ctx.createRadialGradient(cx, cy, escala * 0.2, cx, cy, raioHalo);
      halo.addColorStop(0, "rgba(150, 118, 255, 0.13)");
      halo.addColorStop(0.7, "rgba(150, 118, 255, 0.03)");
      halo.addColorStop(1, "rgba(150, 118, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, raioHalo, 0, Math.PI * 2);
      ctx.fill();

      /* De baixo para cima: a placa inferior é desenhada primeiro, para as
         de cima assentarem sobre ela. */
      for (let i = LAMINAS.length - 1; i >= 0; i--) {
        const l = LAMINAS[i];
        const respira = reduzido ? 0 : Math.sin(t * 0.6 + l.fase) * escala * 0.022;

        const px = cx + (l.dx + l.dz * SKEW_X) * escala + deriva * escala * 0.05;
        const py = cy + (l.y * escala + l.dz * escala * COMPRESSAO) + respira;
        const alturaPx = l.espessura * escala;

        // ---------- parede lateral ----------
        /* A mesma placa deslocada para baixo. O intervalo entre as duas é
           o que se lê como espessura do acrílico. */
        placa(px, py + alturaPx, l.lado, deriva);
        const lateral = ctx.createLinearGradient(
          px - escala * 0.5,
          py,
          px + escala * 0.5,
          py + alturaPx
        );
        lateral.addColorStop(0, "rgba(48, 32, 96, 0.95)");
        lateral.addColorStop(0.5, "rgba(74, 48, 148, 0.95)");
        lateral.addColorStop(1, "rgba(34, 22, 70, 0.95)");
        ctx.fillStyle = lateral;
        ctx.fill();

        // ---------- face superior, vidro violeta ----------
        placa(px, py, l.lado, deriva);
        const face = ctx.createLinearGradient(
          px - escala * l.lado * 0.5,
          py - escala * l.lado * 0.4,
          px + escala * l.lado * 0.5,
          py + escala * l.lado * 0.4
        );
        face.addColorStop(0, "rgba(214, 200, 255, 0.94)");
        face.addColorStop(0.32, "rgba(139, 106, 255, 0.9)");
        face.addColorStop(0.72, "rgba(88, 58, 196, 0.92)");
        face.addColorStop(1, "rgba(58, 38, 130, 0.95)");
        ctx.fillStyle = face;
        ctx.fill();
        ctx.strokeStyle = "rgba(226, 216, 255, 0.5)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // ---------- reflexo de estúdio, recortado na face ----------
        ctx.save();
        placa(px, py, l.lado, deriva);
        ctx.clip();
        const luz = ctx.createLinearGradient(
          px - escala * l.lado * 0.6,
          py - escala * l.lado * 0.6,
          px,
          py + escala * l.lado * 0.1
        );
        luz.addColorStop(0, "rgba(255,255,255,0.5)");
        luz.addColorStop(0.55, "rgba(255,255,255,0.06)");
        luz.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = luz;
        ctx.fillRect(px - escala, py - escala, escala * 2, escala * 2);
        ctx.restore();

        /* Traço verde: só na placa do topo, uma barra curta sobre a face.
           É o recebimento — presente e discreto, sem virar farol. */
        if (l.recebimento) {
          ctx.save();
          placa(px, py, l.lado, deriva);
          ctx.clip();
          const larg = escala * l.lado * 0.34;
          const alt = escala * 0.032;
          const bx = px - larg * 0.15;
          const by = py + escala * l.lado * 0.16;
          const gv = ctx.createLinearGradient(bx - larg, by, bx + larg, by);
          gv.addColorStop(0, "rgba(74, 222, 155, 0)");
          gv.addColorStop(0.5, "rgba(126, 240, 186, 0.92)");
          gv.addColorStop(1, "rgba(74, 222, 155, 0)");
          ctx.fillStyle = gv;
          ctx.beginPath();
          ctx.roundRect(bx - larg / 2, by - alt / 2, larg, alt, alt / 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (vivo && !reduzido) quadro = requestAnimationFrame(render);
    };

    quadro = requestAnimationFrame(render);

    const io = new IntersectionObserver(
      ([e]) => {
        vivo = e.isIntersecting;
        if (vivo && !reduzido) {
          inicio = performance.now();
          cancelAnimationFrame(quadro);
          quadro = requestAnimationFrame(render);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(quadro);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
