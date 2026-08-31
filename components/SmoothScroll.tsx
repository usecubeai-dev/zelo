"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OFFSET_HEADER, registrarLenis } from "@/lib/lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis dirige o scroll; o ScrollTrigger lê a posição do Lenis em vez da
 * nativa. Sem esse casamento, cena pinada e scroll suave brigam e a narrativa
 * treme. Em prefers-reduced-motion o Lenis nem sobe — o scroll fica nativo.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      touchMultiplier: 1.4,
    });

    lenis.on("scroll", ScrollTrigger.update);

    /* as âncoras do header precisam falar com o Lenis; sem isto o salto
       nativo do href="#id" briga com o scroll suave. Nada mais muda. */
    registrarLenis(lenis);

    /* handle de desenvolvimento: permite posicionar a narrativa em um ponto
       exato do scroll para inspeção. Não existe em produção. */
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    /* Deep link por hash (`/#preco` vindo de fora, ou um F5 na página).
       O salto nativo do navegador acontece antes daqui e é perdido: o
       Lenis assume o scroll a partir do zero, e o ScrollTrigger ainda vai
       recalcular a cena pinada — que mede ~20.600px e desloca todas as
       seções seguintes. Reposicionar antes desse cálculo levaria a uma
       coordenada que deixa de existir um quadro depois, e o visitante
       cairia no hero.

       Por isso: refresh primeiro, posição depois. `immediate` porque um
       deep link deve chegar no destino, não animar 20 mil pixels na cara
       de quem acabou de abrir o link. */
    let cancelado = false;
    const alvoInicial = window.location.hash;

    if (alvoInicial.length > 1) {
      /* Um único quadro não basta. Em carga fria o alvo é medido antes de
         a cena pinada existir, e o destino calculado deixa de valer no
         quadro seguinte — foi assim que `/#preco` continuou caindo no
         hero. A posição só é confiável quando para de mudar, então
         reposicionamos enquanto ela se mover, com teto de tempo para não
         sequestrar o scroll de quem já começou a rolar. */
      /* `refresh()` roda UMA vez: ele mesmo restaura a posição de scroll,
         então chamá-lo em loop desfaz o posicionamento que acabou de ser
         feito — foi o que manteve o visitante no hero mesmo depois de
         acertar o destino.

         Depois dele, reposicionamos em alguns momentos espaçados. Fontes
         e imagens que entram após a hidratação ainda mudam a altura das
         seções, e uma única tentativa acerta um alvo que se move. Para
         assim que o destino está na janela. */
      const TENTATIVAS = [0, 250, 800, 1600];

      const posicionar = () => {
        if (cancelado) return;
        const el = document.querySelector<HTMLElement>(alvoInicial);
        if (!el) return true;

        const topo = el.getBoundingClientRect().top;
        if (Math.abs(topo - OFFSET_HEADER) < 60) return true; // já chegou

        lenis.scrollTo(el, { offset: -OFFSET_HEADER, immediate: true });
        return false;
      };

      const iniciar = () => {
        if (cancelado) return;
        ScrollTrigger.refresh();
        TENTATIVAS.forEach((ms) => setTimeout(posicionar, ms));
      };

      if (document.readyState === "complete") requestAnimationFrame(iniciar);
      else window.addEventListener("load", () => requestAnimationFrame(iniciar), { once: true });
    }

    return () => {
      cancelado = true;
      gsap.ticker.remove(raf);
      registrarLenis(null);
      lenis.destroy();
    };
  }, []);

  return null;
}
