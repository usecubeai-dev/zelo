"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BEAT, SCROLL_LENGTH } from "@/lib/scene";
import s from "./JourneyProgress.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * As cinco etapas da jornada inteira da página — não só do Stage.
 * As quatro primeiras leem fronteiras que já existem em lib/scene.ts
 * (nenhuma constante nova, nenhum beat alterado). A quinta representa
 * tudo que vem depois do Stage soltar o pin: as seções comerciais.
 */
const STAGES = [
  { label: "Problema" },
  { label: "Como funciona" },
  { label: "Automação" },
  { label: "Recebimento" },
  { label: "Zelo" },
] as const;

function stageIndexFor(scrollY: number, stagePx: number): number {
  if (scrollY >= stagePx) return 4;
  const beat = (scrollY / stagePx) * BEAT.end;
  if (beat < BEAT.fraseRecua) return 0;
  if (beat < BEAT.capituloDois) return 1;
  if (beat < BEAT.capituloTres) return 2;
  return 3;
}

export default function JourneyProgress() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        { isDesktop: "(min-width: 861px)", isMobile: "(max-width: 860px)" },
        (context) => {
          const { isMobile } = context.conditions as { isMobile: boolean };
          const stagePx = isMobile ? SCROLL_LENGTH.mobile : SCROLL_LENGTH.desktop;

          const st = ScrollTrigger.create({
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
              const y = self.scroll();
              /* só aparece depois que o visitante começa a rolar de verdade —
                 a primeira tela do hero fica limpa, sem nada competindo com ela */
              const intro = Math.min(1, Math.max(0, (y - 60) / 260));
              el.style.opacity = String(intro);
              setActive((prev) => {
                const next = stageIndexFor(y, stagePx);
                return next === prev ? prev : next;
              });
            },
          });

          return () => st.kill();
        }
      );
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  if (reduced !== false) return null;

  return (
    <div className={s.progress} ref={root} aria-hidden="true">
      <span className={s.track} />
      <ul className={s.dots}>
        {STAGES.map((stage, i) => (
          <li key={stage.label} className={i === active ? `${s.dot} ${s.dotActive}` : s.dot} />
        ))}
      </ul>
    </div>
  );
}
