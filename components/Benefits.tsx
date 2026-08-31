"use client";

import { useReveal, useRevealEach } from "@/lib/useReveal";
import c from "./Commercial.module.css";

/**
 * Seis benefícios, todos derivados do que o produto já faz — nenhuma
 * métrica, porcentagem ou resultado financeiro é afirmado.
 */
const BENEFICIOS = [
  {
    t: "Menos cobrança manual",
    d: "O trabalho repetitivo de lembrar cliente por cliente sai da sua rotina.",
  },
  {
    t: "Mais previsibilidade",
    d: "Um processo estruturado para o que hoje depende da sua memória.",
  },
  {
    t: "Automação de verdade",
    d: "Depois da autorização, o ciclo seguinte acontece sem você fazer nada.",
  },
  {
    t: "Acompanhamento claro",
    d: "Você vê o que foi cobrado e o que foi pago, sem planilha paralela.",
  },
  {
    t: "Melhor para o cliente",
    d: "Ele autoriza uma vez e não precisa lembrar de pagar todo mês.",
  },
  {
    t: "Mais tempo para o negócio",
    d: "Menos tempo cobrando. Mais tempo no serviço que você presta.",
  },
];

export default function Benefits() {
  const ref = useReveal<HTMLElement>();
  /* organização: as células assentam na grade — sobem um pouco e crescem
     de 0,97 para 1. O stagger um pouco maior que o padrão é o que faz ler
     como "uma de cada vez", e não como bloco. */
  const gradeRef = useRevealEach<HTMLDivElement>({
    y: 18,
    scale: 0.97,
    stagger: 0.08,
  });

  return (
    <section className={`${c.section} ${c.raised}`} ref={ref} id="beneficios">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Benefícios
          </span>
          <h2 data-reveal className={c.title}>
            O que muda no seu mês.
          </h2>
        </div>

        {/* Quem se move é o conteúdo da célula, nunca a célula: as divisórias
            da grade são o gap de 1px aparecendo por trás, e uma célula que
            translada abre uma fresta na linha. */}
        <div className={`${c.grid} ${c.grid3}`} ref={gradeRef}>
          {BENEFICIOS.map((b) => (
            <div key={b.t} className={c.cell}>
              <div data-reveal-each>
                <h3 className={c.cellTitle}>{b.t}</h3>
                <p className={c.cellText}>{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
