"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";
import c from "./Commercial.module.css";
import s from "./CommercialProblem.module.css";

gsap.registerPlugin(ScrollTrigger);

/** Nenhuma estatística: só a rotina que quem cobra na mão reconhece. */
const DORES = [
  {
    t: "Cobrar cliente por cliente",
    d: "Todo mês, a mesma lista. Você lembra de um, esquece de outro.",
  },
  {
    t: "Mandar lembrete atrás de lembrete",
    d: "A primeira mensagem raramente resolve. A segunda é constrangedora.",
  },
  {
    t: "Conferir quem pagou",
    d: "Extrato de um lado, planilha do outro, e a dúvida no meio.",
  },
  {
    t: "Correr atrás de atraso",
    d: "O pagamento que não veio vira tarefa sua, não do cliente.",
  },
  {
    t: "Manter uma planilha viva",
    d: "Um controle paralelo que só existe porque a cobrança é manual.",
  },
  {
    t: "Perder tempo no que não é seu trabalho",
    d: "Nada disso é o serviço que você presta — mas ocupa o seu dia.",
  },
];

/** As quatro tarefas que se repetem. É o ciclo, não uma lista. */
const CICLO = ["Cobrar", "Lembrar", "Acompanhar", "Conferir"];

export default function CommercialProblem() {
  const ref = useReveal<HTMLElement>();
  const cicloRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = cicloRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const itens = q("[data-tarefa]");
      const traco = q("[data-traco]")[0];
      const peso = q("[data-peso]")[0];
      const volta = q("[data-volta]")[0];

      /* no mobile a trilha vira coluna e o traço fica vertical: o eixo do
         crescimento tem que acompanhar, senão a linha não desenha */
      const estreito = window.matchMedia("(max-width: 760px)").matches;
      const eixo = estreito ? "scaleY" : "scaleX";

      /* Um ScrollTrigger só para a seção inteira. Com scrub, quem dita o
         ritmo é o dedo do visitante: as tarefas se acumulam na velocidade
         em que ele rola, e é o acúmulo que produz a sensação de peso. */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 78%",
          end: "bottom 62%",
          scrub: 0.8,
        },
      });

      /* o traço que liga as tarefas cresce por baixo delas */
      tl.fromTo(
        traco,
        { [eixo]: 0 },
        { [eixo]: 1, duration: 4, ease: "none" },
        0
      );

      /* uma tarefa de cada vez: chega, assenta, e continua ali */
      itens.forEach((item, i) => {
        tl.fromTo(
          item,
          { opacity: 0, y: 18, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 1, ease: "power2.out" },
          i * 0.95
        );
      });

      /* o fecho: as quatro juntas pesam. Descem um pouco, perdem brilho, e
         a sombra embaixo cresce — sem nenhum texto dizendo "é cansativo". */
      tl.to(itens, { y: 7, opacity: 0.72, duration: 1.2, ease: "power2.inOut" }, 4.1)
        .fromTo(peso, { opacity: 0, scaleX: 0.7 }, { opacity: 1, scaleX: 1, duration: 1.4 }, 4.1)
        .fromTo(volta, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1 }, 4.6);
    }, cicloRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section className={`${c.section} ${c.dark}`} ref={ref} id="problema">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            O problema
          </span>
          <h2 data-reveal className={c.title}>
            Receber não deveria dar tanto trabalho.
          </h2>
          <p data-reveal className={c.lead}>
            Quem cobra todo mês conhece a rotina: a cobrança vira um segundo
            trabalho, sem salário e sem fim.
          </p>
        </div>

        {/* o ciclo: cobrar → lembrar → acompanhar → conferir */}
        <div className={s.ciclo} ref={cicloRef}>
          <span className={s.cicloRotulo}>Todo mês</span>

          <div className={s.trilha}>
            <span data-traco className={s.traco} aria-hidden="true" />
            <ol className={s.tarefas}>
              {CICLO.map((t, i) => (
                <li key={t} data-tarefa className={s.tarefa}>
                  <span className={s.tarefaNum}>{String(i + 1).padStart(2, "0")}</span>
                  {t}
                </li>
              ))}
            </ol>
            <span data-peso className={s.peso} aria-hidden="true" />
          </div>

          <span data-volta className={s.volta}>
            e no mês seguinte, tudo de novo.
          </span>
        </div>

        <div data-reveal className={`${c.grid} ${c.grid3}`}>
          {DORES.map((d) => (
            <div key={d.t} className={c.cell}>
              <h3 className={c.cellTitle}>{d.t}</h3>
              <p className={c.cellText}>{d.d}</p>
            </div>
          ))}
        </div>

        {/* prepara a próxima seção sem entregar a solução */}
        <p data-reveal className={s.ponte}>
          Existe outro jeito de fazer isso.
        </p>
      </div>
    </section>
  );
}
