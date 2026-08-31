"use client";

import Link from "next/link";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { ArrowRight, Check } from "./icons";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import c from "./Commercial.module.css";
import s from "./Pricing.module.css";

/* Decisão comercial do owner em 26/08/2026. Não há outros planos, descontos
   ou cobrança anual autorizados. */
const PRECO: {
  valor: string | null;
  unidade: string | null;
  /* O teste grátis é a entrada sem risco — a razão mais forte para clicar.
     Fica em campo próprio, e não dentro da observação, porque como nota de
     rodapé cinza ele desaparecia ao lado do valor. */
  trial: string | null;
  observacao: string | null;
} = {
  valor: "R$ 29,90",
  unidade: "por mês depois do teste",
  trial: "14 dias grátis",
  observacao: "Simples para começar, preparado para crescer.",
};

/** Itens que decorrem do produto já definido — não são promessa comercial. */
const INCLUSO = [
  "Cobranças recorrentes no Pix Automático",
  "Autorização feita pelo cliente no banco dele",
  "Cobrança automática a cada ciclo",
  "Acompanhamento das cobranças e dos pagamentos",
];

export default function Pricing() {
  const ref = useReveal<HTMLElement>();
  /* clareza: a oferta inteira entra em ordem de leitura, e não de DOM —
     selo, valor, unidade, observação, o que está incluso e, por último, o
     CTA. Os números no `data-reveal-each` existem por causa disso: no
     markup o botão vem antes da lista, mas ele precisa chegar depois.
     A escala de 0,96 é a mesma para todos; quem ganha destaque é o valor,
     porque é o maior elemento e a escala aparece mais nele. */
  const ofertaRef = useRevealEach<HTMLDivElement>({
    y: 14,
    scale: 0.96,
    stagger: 0.09,
  });
  const definido = PRECO.valor !== null;

  return (
    <section className={`${c.section} ${c.raised}`} ref={ref} id="preco">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Preço
          </span>
          <h2 data-reveal className={c.title}>
            Quanto custa usar a Zelo?
          </h2>
        </div>

        <div className={s.oferta} ref={ofertaRef}>
          <div className={s.valorLado}>
            {definido ? (
              <>
                {PRECO.trial && (
                  <span data-reveal-each="1" className={s.trial}>
                    {PRECO.trial}
                  </span>
                )}
                <span data-reveal-each="2" className={s.valor}>
                  {PRECO.valor}
                </span>
                {PRECO.unidade && (
                  <span data-reveal-each="3" className={s.unidade}>
                    {PRECO.unidade}
                  </span>
                )}
              </>
            ) : (
              <>
                <span data-reveal-each="2" className={c.pendente}>
                  [DEFINIR PREÇO]
                </span>
                <p data-reveal-each="3" className={s.aviso}>
                  O modelo de cobrança da Zelo ainda está sendo definido. Assim
                  que fechar, o valor aparece aqui.
                </p>
              </>
            )}
            {PRECO.observacao && (
              <p data-reveal-each="4" className={s.obs}>
                {PRECO.observacao}
              </p>
            )}

            {/* 9 e não 5: no markup o CTA vem antes da lista, mas na leitura
                ele é o último passo — decidir depois de saber o que vem junto */}
            <div data-reveal-each="9" className={c.ctaRow}>
              <Link
                className={c.btnPrimary}
                href={CTA_HREF}
                data-evt={EVENTOS.ctaStart}
                data-evt-local="preco"
              >
                Começar agora <ArrowRight />
              </Link>
            </div>
          </div>

          <div className={s.inclusoLado}>
            <span data-reveal-each="5" className={s.inclusoTitulo}>
              O que está incluso
            </span>
            <ul className={s.lista}>
              {INCLUSO.map((i) => (
                <li key={i} data-reveal-each="6">
                  <Check stroke="currentColor" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
