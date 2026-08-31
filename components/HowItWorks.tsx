"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";
import { Check, Zap } from "./icons";
import c from "./Commercial.module.css";
import s from "./HowItWorks.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * O fluxo, na ordem em que a coisa realmente acontece: o cliente autoriza
 * ANTES de a Zelo processar, e a cobrança automática é consequência, não
 * causa. É a mesma história do hero, aqui explicada passo a passo.
 */
const FLUXO = [
  { t: "Cliente", d: "quer pagar todo mês" },
  { t: "Autoriza", d: "o Pix Automático, no banco dele", destaque: true },
  { t: "Zelo", d: "recebe e processa", nucleo: true },
  { t: "Cobrança automática", d: "a cada ciclo, sozinha" },
  { t: "Você recebe", d: "sem cobrar ninguém", ok: true },
];

const PASSOS = [
  {
    n: "01",
    t: "Crie a cobrança",
    d: "Defina o cliente, o valor e a recorrência. Uma vez só.",
  },
  {
    n: "02",
    t: "O cliente autoriza",
    d: "A autorização do Pix Automático acontece no aplicativo do banco dele.",
  },
  {
    n: "03",
    t: "A Zelo automatiza",
    d: "As cobranças seguintes acontecem sozinhas, sem você lembrar ninguém.",
  },
  {
    n: "04",
    t: "Você recebe",
    d: "O pagamento confirmado entra no fluxo que você definiu.",
  },
];

export default function HowItWorks() {
  const ref = useReveal<HTMLElement>();
  const fluxoRef = useRef<HTMLOListElement>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = fluxoRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const nos = q("[data-no]");
      const marcas = q("[data-marca]");
      const textos = q("[data-texto]");
      const preenches = q("[data-preenche]");

      /* No mobile o fluxo é uma coluna e os conectores ficam verticais:
         o eixo do preenchimento precisa acompanhar, senão a energia não
         percorre nada. */
      const estreito = window.matchMedia("(max-width: 700px)").matches;
      const eixo = estreito ? "scaleY" : "scaleX";

      /* Estado de repouso definido por JS, não por CSS: assim, se o script
         não rodar (ou em reduced motion), o fluxo nasce inteiro e legível
         em vez de ficar invisível esperando uma timeline. */
      gsap.set(nos, { opacity: 0.32 });
      gsap.set(marcas, { scale: 0.92 });
      gsap.set(preenches, { [eixo]: 0 });

      /* UM ScrollTrigger para a seção. Com scrub, é o scroll do visitante
         que empurra a energia de uma etapa para a próxima. */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 76%",
          end: "bottom 58%",
          scrub: 0.7,
        },
      });

      nos.forEach((no, i) => {
        const t = i * 2;
        /* a etapa acende */
        tl.to(no, { opacity: 1, duration: 0.8, ease: "power2.out" }, t)
          .to(marcas[i], { scale: 1, duration: 0.8, ease: "back.out(2)" }, t)
          .fromTo(
            textos[i],
            { y: 6 },
            { y: 0, duration: 0.8, ease: "power2.out" },
            t
          );

        /* a energia percorre até a próxima */
        if (preenches[i]) {
          tl.to(
            preenches[i],
            { [eixo]: 1, duration: 1.2, ease: "none" },
            t + 0.8
          );
        }
      });
    }, fluxoRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section className={`${c.section} ${c.raised}`} ref={ref} id="como-funciona">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Como a Zelo resolve
          </span>
          <h2 data-reveal className={c.title}>
            Você configura uma vez. A Zelo cuida do resto.
          </h2>
        </div>

        {/* o fluxo: cada etapa acende quando a energia chega nela */}
        <ol className={s.fluxo} ref={fluxoRef}>
          {FLUXO.map((f, i) => (
            <li
              key={f.t}
              data-no
              className={
                f.ok ? `${s.no} ${s.noOk}` : f.destaque ? `${s.no} ${s.noDestaque}` : s.no
              }
            >
              <span
                data-marca
                className={
                  f.nucleo
                    ? `${s.marca} ${s.marcaNucleo}`
                    : f.ok
                      ? `${s.marca} ${s.marcaOk}`
                      : f.destaque
                        ? `${s.marca} ${s.marcaDestaque}`
                        : s.marca
                }
              >
                {f.nucleo ? <Zap /> : f.ok ? <Check stroke="currentColor" /> : null}
              </span>

              <span data-texto className={s.noTexto}>
                <b>{f.t}</b>
                <small>{f.d}</small>
              </span>

              {i < FLUXO.length - 1 && (
                <span className={s.traco} aria-hidden="true">
                  <i
                    data-preenche
                    className={i === FLUXO.length - 2 ? `${s.preenche} ${s.preencheOk}` : s.preenche}
                  />
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className={s.passos}>
          {PASSOS.map((p) => (
            <div key={p.n} data-reveal className={s.passo}>
              <span className={c.num}>{p.n}</span>
              <h3 className={c.cellTitle}>{p.t}</h3>
              <p className={c.cellText}>{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
