"use client";

import Link from "next/link";
import { useRevealEach } from "@/lib/useReveal";
import { ArrowRight } from "./icons";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import s from "./ClosingCta.module.css";

/**
 * Fechamento: repete a tese do hero como decisão, não como informação nova.
 * O CTA continua apontando para CTA_HREF — o destino real depende do
 * cadastro, que ainda não existe (ver lib/cta.ts).
 */
export default function ClosingCta() {
  /* ação: a seção monta de cima para baixo e o CTA é o último a chegar —
     o botão só aparece depois de a promessa estar inteira na tela. Stagger
     largo de propósito: aqui a pressa trabalha contra. */
  const ref = useRevealEach<HTMLElement>({
    y: 20,
    scale: 0.97,
    duration: 0.8,
    stagger: 0.13,
  });

  return (
    <section className={s.section} ref={ref} id="comecar-agora">
      <div className={s.inner}>
        <span data-reveal-each className={s.brandName}>
          Zelo
        </span>
        <p data-reveal-each className={s.brandLine}>
          Você trabalha. A Zelo cobra.
        </p>
        <h2 data-reveal-each className={s.headline}>
          Pare de cobrar.
          <br />
          Comece a receber.
        </h2>
        <p data-reveal-each className={s.sub}>
          Configure a cobrança recorrente uma vez e deixe o Pix Automático
          fazer o resto, todo mês.
        </p>
        <div data-reveal-each className={s.ctaRow}>
          <Link
            className={s.btnPrimary}
            href={CTA_HREF}
            data-evt={EVENTOS.ctaStart}
            data-evt-local="fechamento"
          >
            Começar agora <ArrowRight />
          </Link>
          <a
            className={s.btnGhost}
            href="#como-funciona"
            data-evt={EVENTOS.ctaDemo}
            data-evt-local="fechamento"
          >
            Ver como funciona
          </a>
        </div>
      </div>
    </section>
  );
}
