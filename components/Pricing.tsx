"use client";

import Link from "next/link";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { ArrowRight, Check } from "./icons";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import c from "./Commercial.module.css";
import s from "./Pricing.module.css";

/* ============================================================
   Condição especial de lançamento — decisão comercial do owner.

   Isto é APRESENTAÇÃO. Nenhum destes valores é cobrado: não há plano no
   banco, no Asaas nem em lugar nenhum do backend. Quando a cobrança
   existir, é aqui que ela vai buscar o preço — não o contrário.

   Sobre a promoção: o texto não cita quantidade de vagas nem prazo,
   porque nenhum dos dois foi definido. Prometer escassez que não se
   controla é o tipo de urgência que vira desmentido na semana seguinte.
   ============================================================ */
type Plano = {
  nome: string;
  limite: string;
  de: string;
  por: string;
  porPagamento: string;
  destaque?: boolean;
};

const PLANOS: Plano[] = [
  {
    nome: "Essencial",
    limite: "Até 20 clientes ativos",
    de: "R$ 29,90",
    por: "R$ 14,90",
    porPagamento: "R$ 0,99 por pagamento",
  },
  {
    nome: "Profissional",
    limite: "Até 50 clientes ativos",
    de: "R$ 49,90",
    por: "R$ 29,90",
    porPagamento: "R$ 0,69 por pagamento",
    destaque: true,
  },
  {
    nome: "Premium",
    limite: "Até 150 clientes ativos",
    de: "R$ 99,90",
    por: "R$ 59,90",
    porPagamento: "R$ 0,49 por pagamento",
  },
];

/** Vale para os três. Decorre do produto — não é promessa nova. */
const INCLUSO = [
  "Cobranças recorrentes no Pix Automático",
  "Autorização feita pelo cliente no banco dele",
  "Cobrança automática a cada ciclo",
  "Acompanhamento das cobranças e dos pagamentos",
];

const TRIAL = "14 dias grátis";

export default function Pricing() {
  const ref = useReveal<HTMLElement>();
  /* Os cards entram em ordem de leitura. O do meio é o que queremos que
     seja lido primeiro, mas entrar fora de ordem chamaria atenção pelo
     movimento em vez do conteúdo — o destaque fica no desenho, não na
     animação. */
  const gradeRef = useRevealEach<HTMLDivElement>({
    y: 14,
    scale: 0.97,
    stagger: 0.08,
  });

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
          <p data-reveal className={s.selo}>
            Condição especial de lançamento
          </p>
        </div>

        <div className={s.grade} ref={gradeRef}>
          {PLANOS.map((p, i) => (
            <div
              key={p.nome}
              data-reveal-each={String(i + 1)}
              className={p.destaque ? `${s.plano} ${s.destaque}` : s.plano}
            >
              {p.destaque && <span className={s.fita}>Mais escolhido</span>}

              <span className={s.nome}>{p.nome}</span>
              <span className={s.limite}>{p.limite}</span>

              <div className={s.precoBloco}>
                {/* O "de" precisa ser lido como preço antigo por quem enxerga
                    e por quem ouve: risco visual não chega ao leitor de tela,
                    por isso o <s> junto do rótulo escondido. */}
                <s className={s.de}>
                  <span className="sr-only">De </span>
                  {p.de}
                </s>
                <span className={s.por}>
                  <span className="sr-only">Por </span>
                  {p.por}
                </span>
                <span className={s.mes}>/mês</span>
              </div>

              <span className={s.porPagamento}>{p.porPagamento}</span>
              <span className={s.trial}>{TRIAL}</span>

              <Link
                className={p.destaque ? `${c.btnPrimary} ${s.ctaFim}` : s.btnPlano}
                href={CTA_HREF}
                data-evt={EVENTOS.ctaStart}
                data-evt-local={`preco-${p.nome.toLowerCase()}`}
              >
                Começar agora <ArrowRight />
              </Link>
            </div>
          ))}
        </div>

        <div data-reveal className={s.inclusoTodos}>
          <span className={s.inclusoTitulo}>Em todos os planos</span>
          <ul className={s.lista}>
            {INCLUSO.map((i) => (
              <li key={i}>
                <Check stroke="currentColor" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
