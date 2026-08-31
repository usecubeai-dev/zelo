"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";
import c from "./Commercial.module.css";
import s from "./Automation.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * A mesma rotina lida duas vezes: à esquerda em ciclo fechado — manual, e
 * por isso recomeça —, à direita em linha — configurada uma vez, e por isso
 * termina em dinheiro. A copy é a que já existia; o que mudou é a forma.
 */
const ANTES = ["Cobrar", "Lembrar", "Esperar", "Conferir", "Cobrar de novo"];
const DEPOIS = ["Configurar", "Automatizar", "Acompanhar", "Receber"];

/* Regra cromática: violeta onde a Zelo age, verde onde o dinheiro chega.
   São os dois únicos pontos de cor da seção — todo o resto é grafite. */
const AUTOMATIZAR = DEPOIS.indexOf("Automatizar");
const RECEBER = DEPOIS.length - 1;

export default function Automation() {
  const ref = useReveal<HTMLElement>();
  const parRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced !== false) return;
    const el = parRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const antes = q("[data-antes]")[0];
      const antesPassos = q("[data-antes-passo]");
      const antesTracos = q("[data-antes-traco]");
      const retorno = q("[data-retorno]")[0];
      const seta = q("[data-retorno-seta]")[0];
      const energiaPassagem = q("[data-passagem-energia]")[0];
      const noPassagem = q("[data-passagem-no]")[0];
      const depoisPassos = q("[data-depois-passo]");
      const depoisEnergias = q("[data-depois-energia]");
      const anelAuto = q("[data-anel=auto]")[0];
      const anelOk = q("[data-anel=ok]")[0];
      const notaAntes = q("[data-nota=antes]")[0];
      const notaDepois = q("[data-nota=depois]")[0];

      /* As duas colunas já são verticais nos dois formatos; quem muda de
         eixo é a passagem entre elas — horizontal quando estão lado a lado,
         vertical quando empilham. Sem isto a linha não desenha no mobile. */
      const estreito = window.matchMedia("(max-width: 760px)").matches;
      const eixoPassagem = estreito ? "scaleY" : "scaleX";

      /* Repouso definido aqui e não no CSS: se o script não rodar, a seção
         nasce inteira e legível em vez de invisível esperando uma timeline. */
      antesPassos.forEach((p, i) =>
        /* cada tarefa chega de um lado diferente: o manual não tem eixo */
        gsap.set(p, { opacity: 0, y: 14, x: i % 2 === 0 ? -14 : 14 })
      );
      gsap.set(antesTracos, { scaleY: 0 });
      gsap.set(retorno, { scaleY: 0, opacity: 0 });
      gsap.set(seta, { opacity: 0, scale: 0.6 });
      gsap.set(energiaPassagem, { [eixoPassagem]: 0 });
      gsap.set(noPassagem, { scale: 0, opacity: 0 });
      /* o "depois" fica em fantasma, não ausente: no desktop as duas colunas
         são vistas juntas, e esconder uma deixaria meia composição vazia */
      gsap.set(depoisPassos, { opacity: 0.16, y: 8 });
      gsap.set(depoisEnergias, { scaleY: 0 });
      gsap.set([anelAuto, anelOk], { scale: 0.5, opacity: 0 });
      gsap.set([notaAntes, notaDepois], { opacity: 0, y: 8 });

      /* UM ScrollTrigger para a seção inteira. Com scrub, é o scroll do
         visitante que empurra a rotina manual até ela se fechar em ciclo, e
         depois puxa a versão automática até o verde. */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 82%",
          end: "bottom 62%",
          scrub: 0.8,
        },
      });

      /* 1. as tarefas manuais chegam uma a uma e o traço entre elas cresce */
      antesPassos.forEach((p, i) => {
        const t = i * 0.62;
        tl.to(p, { opacity: 1, x: 0, y: 0, duration: 0.8, ease: "power2.out" }, t);
        if (antesTracos[i]) {
          tl.to(antesTracos[i], { scaleY: 1, duration: 0.5, ease: "none" }, t + 0.45);
        }
      });

      /* 2. o ciclo se fecha: "cobrar de novo" volta para "cobrar" */
      tl.to(notaAntes, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 2.9)
        .to(retorno, { scaleY: 1, opacity: 1, duration: 0.8, ease: "power2.out" }, 3.0)
        .to(seta, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, 3.6);

      /* 3. o antes perde importância e a passagem acontece */
      tl.to(antes, { opacity: 0.4, y: 6, duration: 1, ease: "power2.inOut" }, 3.9)
        .to(energiaPassagem, { [eixoPassagem]: 1, duration: 1, ease: "none" }, 4.0)
        .to(noPassagem, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, 4.8);

      /* 4. o depois acende em linha, e a energia percorre sem interrupção */
      depoisPassos.forEach((p, i) => {
        const t = 5.1 + i * 0.62;
        tl.to(p, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, t);
        if (depoisEnergias[i]) {
          tl.to(depoisEnergias[i], { scaleY: 1, duration: 0.7, ease: "none" }, t + 0.45);
        }
      });

      /* 5. os dois pontos que importam: a automação e o dinheiro */
      tl.to(
        anelAuto,
        { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" },
        5.1 + AUTOMATIZAR * 0.62
      )
        .to(
          anelOk,
          { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" },
          5.1 + RECEBER * 0.62
        )
        .to(
          notaDepois,
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          5.1 + RECEBER * 0.62 + 0.3
        );
    }, parRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section className={`${c.section} ${c.dark}`} ref={ref} id="automacao">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            A mudança
          </span>
          <h2 data-reveal className={c.title}>
            Pare de cobrar. Comece a receber.
          </h2>
          <p data-reveal className={c.lead}>
            Não é sobre trocar de ferramenta. É sobre tirar a cobrança da sua
            rotina — e o ciclo que sobra é mais curto.
          </p>
        </div>

        {/* a transformação: ciclo fechado à esquerda, linha à direita.
            As colunas não usam data-reveal de propósito — quem é dono da
            opacidade e do transform delas é a timeline acima. */}
        <div className={s.par} ref={parRef}>
          <div data-antes className={`${s.coluna} ${s.antes}`}>
            <span className={s.rotulo}>Antes</span>

            <div className={s.trilha}>
              {/* o colchete que devolve a última tarefa para a primeira */}
              <span data-retorno className={s.retorno} aria-hidden="true" />
              <span data-retorno-seta className={s.retornoSeta} aria-hidden="true" />

              <ul className={s.ciclo}>
                {ANTES.map((p, i) => (
                  <li key={p} data-antes-passo className={s.passo}>
                    <span className={s.no} aria-hidden="true" />
                    <span className={s.passoTexto}>{p}</span>
                    {i < ANTES.length - 1 && (
                      <i data-antes-traco className={s.traco} aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <p data-nota="antes" className={s.nota}>
              Um ciclo que recomeça todo mês, com você dentro.
            </p>
          </div>

          {/* a passagem: um traço que preenche de um lado ao outro */}
          <div className={s.passagem} aria-hidden="true">
            <i className={s.passagemTrilho}>
              <i data-passagem-energia className={s.passagemEnergia} />
            </i>
            <i data-passagem-no className={s.passagemNo} />
          </div>

          <div data-depois className={`${s.coluna} ${s.depois}`}>
            <span className={s.rotulo}>Depois</span>

            <div className={s.trilha}>
              <ul className={s.ciclo}>
                {DEPOIS.map((p, i) => (
                  <li
                    key={p}
                    data-depois-passo
                    className={
                      i === RECEBER
                        ? `${s.passo} ${s.passoOk}`
                        : i === AUTOMATIZAR
                          ? `${s.passo} ${s.passoAuto}`
                          : s.passo
                    }
                  >
                    <span className={s.no} aria-hidden="true">
                      {i === AUTOMATIZAR && <i data-anel="auto" className={s.anel} />}
                      {i === RECEBER && (
                        <i data-anel="ok" className={`${s.anel} ${s.anelOk}`} />
                      )}
                    </span>
                    <span className={s.passoTexto}>{p}</span>
                    {i < DEPOIS.length - 1 && (
                      <i className={s.trilho} aria-hidden="true">
                        <i
                          data-depois-energia
                          className={
                            i === DEPOIS.length - 2
                              ? `${s.energia} ${s.energiaOk}`
                              : s.energia
                          }
                        />
                      </i>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <p data-nota="depois" className={s.nota}>
              Você entra uma vez, no começo. O resto acontece.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
