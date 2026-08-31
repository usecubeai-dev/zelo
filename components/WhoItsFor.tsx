"use client";

import { useReveal, useRevealEach } from "@/lib/useReveal";
import c from "./Commercial.module.css";
import s from "./WhoItsFor.module.css";

/**
 * A lista é ilustrativa, não uma restrição: o critério real é a recorrência,
 * e é isso que a última linha da seção diz.
 *
 * Os sete primeiros perfis são os originais, aprovados. Os demais vieram da
 * lista de exemplos do ZELO_AUTONOMOUS_PLAN (TASK 02) — são do proprietário,
 * não inventados aqui. "Negócios recorrentes" fica por último de propósito:
 * é o guarda-chuva que recolhe quem não se viu nos anteriores.
 */
const PERFIS = [
  "Academias",
  "Estúdios",
  "Clínicas",
  "Escolas e cursos",
  "Profissionais autônomos",
  "Consultorias",
  "Agências",
  "Prestadores de serviço",
  "Serviços de manutenção",
  "Clubes",
  "Associações",
  "Empresas de assinatura",
  "SaaS",
  "Negócios recorrentes",
];

export default function WhoItsFor() {
  const ref = useReveal<HTMLElement>();
  /* identificação: os perfis chegam de lados alternados para a lista não
     entrar como fileira mecânica — é um varredor de reconhecimento, o
     visitante procurando o dele. Deslocamento curto e sem escala. */
  const perfisRef = useRevealEach<HTMLUListElement>({
    y: 10,
    x: 14,
    stagger: 0.05,
  });

  return (
    <section className={`${c.section} ${c.dark}`} ref={ref} id="para-quem">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Para quem é a Zelo
          </span>
          <h2 data-reveal className={c.title}>
            Feita para quem precisa receber todos os meses.
          </h2>
          {/* Posicionamento definido pelo proprietário em 26/08/2026: o foco
              é o pequeno, mas a lista não fecha a porta para quem é maior. */}
          <p data-reveal className={c.lead}>
            O foco é quem toca o próprio negócio — autônomos, prestadores de
            serviço e pequenos empreendedores. Simples para começar, preparada
            para crescer junto com o seu negócio.
          </p>
        </div>

        {/* cada perfil entra quando chega de fato à vista: numa lista de
            reconhecimento, o que conta é o visitante ter tempo de achar o
            dele — não a lista inteira piscar de uma vez */}
        <ul className={s.perfis} ref={perfisRef}>
          {PERFIS.map((p) => (
            <li key={p} data-reveal-each className={s.perfil}>
              {p}
            </li>
          ))}
        </ul>

        <p data-reveal className={s.criterio}>
          A lista não é uma regra. Se você cobra de forma recorrente, a Zelo
          pode fazer sentido para o seu negócio.
        </p>
      </div>
    </section>
  );
}
