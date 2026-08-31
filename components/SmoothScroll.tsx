"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registrarLenis } from "@/lib/lenis";

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

    return () => {
      gsap.ticker.remove(raf);
      registrarLenis(null);
      lenis.destroy();
    };
  }, []);

  return null;
}
