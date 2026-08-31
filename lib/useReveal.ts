"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * Revelação de entrada das seções comerciais.
 *
 * Usa IntersectionObserver, NÃO ScrollTrigger. Motivo medido: cada
 * ScrollTrigger é reavaliado a todo evento de scroll, inclusive enquanto o
 * visitante ainda está na cena pinada — oito deles custavam ~2fps no
 * desktop. O IntersectionObserver não roda por quadro e se desliga sozinho
 * depois de disparar.
 *
 * Marque os filhos com `data-reveal` na ordem em que devem entrar.
 * Em prefers-reduced-motion nada anima e o conteúdo já nasce visível.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = ref.current;
    if (!el) return;

    const alvos = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!alvos.length) return;

    gsap.set(alvos, { opacity: 0, y: 22 });

    const io = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting) return;
        io.disconnect();
        gsap.to(alvos, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.07,
          ease: "power2.out",
          overwrite: true,
        });
      },
      { rootMargin: "0px 0px -18% 0px" }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      gsap.set(alvos, { clearProps: "opacity,transform" });
    };
  }, [reduced]);

  return ref;
}

/**
 * Movimento de entrada das seções comerciais, item a item — cada um
 * disparado pela **própria** posição.
 *
 * `useReveal` observa a seção inteira: quando ela entra, tudo anima de uma
 * vez. Numa grade de seis itens isso significa que as células de baixo já
 * terminaram de animar antes de o visitante chegar nelas — o movimento
 * acontece fora da vista e não ajuda ninguém a ler. Aqui cada item é
 * observado sozinho e só entra quando aparece de fato.
 *
 * Continua sendo IntersectionObserver, não ScrollTrigger, pela mesma razão
 * medida de sempre: não custa nada por quadro e se desliga sozinho. A página
 * tem 5 ScrollTriggers, todos nas seções narrativas, e este arquivo existe
 * justamente para o resto não precisar de mais nenhum.
 *
 * Marque os itens com `data-reveal-each`. Dê um número ao atributo
 * (`data-reveal-each="3"`) quando a ordem de leitura não for a ordem do DOM
 * — é o caso do Preço, onde o CTA vem antes da lista no markup mas precisa
 * entrar por último.
 *
 * Ao terminar, cada item ganha `data-revelado="true"`. É o gancho para um
 * destaque de uma vez só em CSS, sem nenhum loop.
 */
export type OpcoesReveal = {
  /** quanto o item sobe ao entrar. `0` para listas que dividem borda: ali o
      transform levaria a borda do item junto, invadindo o seguinte. */
  y?: number;
  /** deslocamento lateral ALTERNADO, para a entrada não ficar mecânica.
      No mobile ele é cortado pela metade — movimento lateral em tela
      estreita lê como tremor, não como intenção. */
  x?: number;
  /** escala inicial. Muito pouco: 0,96 já lê como "assenta". */
  scale?: number;
  duration?: number;
  stagger?: number;
};

export function useRevealEach<T extends HTMLElement>(
  opcoes: number | OpcoesReveal = 16
) {
  const ref = useRef<T>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  const cfg: Required<OpcoesReveal> = {
    y: 16,
    x: 0,
    scale: 1,
    duration: 0.7,
    stagger: 0.06,
    ...(typeof opcoes === "number" ? { y: opcoes } : opcoes),
  };
  const { y, x, scale, duration, stagger } = cfg;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = ref.current;
    if (!el) return;

    const alvos = Array.from(
      el.querySelectorAll<HTMLElement>("[data-reveal-each]")
    );
    if (!alvos.length) return;

    /* ordem de leitura: o número do atributo quando existe, senão o DOM */
    const ordem = new Map<HTMLElement, number>();
    alvos.forEach((t, i) => {
      const bruto = t.dataset.revealEach;
      ordem.set(t, bruto ? Number(bruto) : i);
    });

    const estreito = window.matchMedia("(max-width: 760px)").matches;
    const lateral = estreito ? x / 2 : x;

    alvos.forEach((t, i) =>
      gsap.set(t, {
        opacity: 0,
        y,
        scale,
        x: lateral ? (i % 2 === 0 ? -lateral : lateral) : 0,
      })
    );

    const io = new IntersectionObserver(
      (entradas) => {
        const chegaram = entradas
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0));
        if (!chegaram.length) return;
        chegaram.forEach((t) => io.unobserve(t));
        gsap.to(chegaram, {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          duration,
          stagger,
          ease: "power2.out",
          overwrite: true,
          onComplete() {
            chegaram.forEach((t) => t.setAttribute("data-revelado", "true"));
          },
        });
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    alvos.forEach((t) => io.observe(t));

    return () => {
      io.disconnect();
      gsap.set(alvos, { clearProps: "opacity,transform" });
      alvos.forEach((t) => t.removeAttribute("data-revelado"));
    };
  }, [reduced, y, x, scale, duration, stagger]);

  return ref;
}
