"use client";

import { useReveal, useRevealEach } from "@/lib/useReveal";
import c from "./Commercial.module.css";
import s from "./Trust.module.css";

/* ============================================================
   Nenhuma alegação de segurança, certificação, banco parceiro ou
   conformidade regulatória é feita aqui — nada disso está definido no
   projeto, e inventar seria uma alegação regulatória falsa.
   Os itens abaixo descrevem apenas COMO O PRODUTO FUNCIONA, o que já está
   estabelecido. Os espaços marcados como pendentes ficam prontos para
   receber a informação verdadeira quando ela existir.
   ============================================================ */
const FATOS = [
  {
    t: "A autorização é do cliente",
    d: "Quem autoriza a cobrança recorrente é o próprio cliente, dentro do aplicativo do banco dele.",
  },
  {
    t: "Uma cobrança por ciclo",
    d: "A recorrência segue o valor e a data que você definiu ao criar a cobrança.",
  },
  {
    t: "Você acompanha tudo",
    d: "As cobranças e os pagamentos ficam visíveis para você, sem planilha paralela.",
  },
  /* Autorizado pelo proprietário em 26/08/2026: comunicar pagamento seguro.
     A frase descreve o MECANISMO, que já está estabelecido no produto — não
     cita banco parceiro, certificação nem conformidade. */
  {
    t: "Pagamento seguro",
    d: "A cobrança acontece pelo Pix Automático, dentro do sistema bancário: a autorização fica no aplicativo do banco do seu cliente, não com a Zelo.",
  },
];

const PENDENTES = [
  "Infraestrutura de pagamento",
  "Conformidade regulatória",
  "Parceiros e integrações",
];

export default function Trust() {
  const ref = useReveal<HTMLElement>();
  /* segurança: sem escala e sem quique. Os fatos sobem pouco, devagar e
     em intervalo largo — o que transmite solidez é a ausência de
     elasticidade, não a quantidade de movimento. */
  const gradeRef = useRevealEach<HTMLDivElement>({
    y: 12,
    duration: 0.9,
    stagger: 0.1,
  });

  return (
    <section className={`${c.section} ${c.dark}`} ref={ref} id="confianca">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Confiança
          </span>
          <h2 data-reveal className={c.title}>
            Seu negócio no controle.
          </h2>
          <p data-reveal className={c.lead}>
            A Zelo organiza a cobrança, mas a decisão continua sendo de quem
            paga e de quem recebe.
          </p>
        </div>

        {/* quem se move é o conteúdo, não a célula: as divisórias da grade
            são o gap de 1px aparecendo, e uma célula que translada abre
            uma fresta na linha */}
        <div className={`${c.grid} ${c.grid2}`} ref={gradeRef}>
          {FATOS.map((f) => (
            <div key={f.t} className={c.cell}>
              <div data-reveal-each>
                <h3 className={c.cellTitle}>{f.t}</h3>
                <p className={c.cellText}>{f.d}</p>
              </div>
            </div>
          ))}
        </div>

        <div data-reveal className={s.reservado}>
          <span className={s.reservadoTitulo}>A publicar quando confirmado</span>
          <p className={c.lead}>
            A infraestrutura de pagamento será configurada antes que os
            pagamentos sejam processados. Informações sobre parceiros,
            certificações e conformidade só serão publicadas quando confirmadas.
          </p>
          <ul className={s.chips}>
            {PENDENTES.map((p) => (
              <li key={p} className={c.pendente}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
