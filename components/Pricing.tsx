"use client";

import Link from "next/link";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { ArrowRight, Check } from "./icons";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import { formatarCentavos } from "@/lib/dinheiro";
import { PRECO_POR_PLANO_CENTAVOS, TAXA_DE_RECEBIMENTO_CENTAVOS } from "@/lib/plano";
import c from "./Commercial.module.css";
import s from "./Pricing.module.css";

/* ============================================================
   Pricing oficial — aprovado pelo proprietário. Fonte única dos
   números é `lib/plano.ts` (mesma que o app autenticado usa em
   `/app/assinatura`): esta seção só formata, nunca redeclara valor.

   "Personalizado" não é um `Plano` de banco — é sob consulta, fora do
   fluxo de self-service, por isso não tem `data-evt`/CTA de cadastro,
   só um link de contato.
   ============================================================ */
type CardPlano = {
  nome: string;
  limite: string;
  precoCentavos: number;
  destaque?: boolean;
};

const PLANOS: CardPlano[] = [
  { nome: "Essencial", limite: "Até 30 clientes ativos · 50 cobranças/mês", precoCentavos: PRECO_POR_PLANO_CENTAVOS.essencial },
  { nome: "Profissional", limite: "Até 100 clientes ativos · 200 cobranças/mês", precoCentavos: PRECO_POR_PLANO_CENTAVOS.profissional, destaque: true },
  { nome: "Zelo Pro", limite: "Até 300 clientes ativos · 600 cobranças/mês", precoCentavos: PRECO_POR_PLANO_CENTAVOS.premium },
];

const PERSONALIZADO = {
  nome: "Personalizado",
  limite: "Acima de 300 clientes ou 600 cobranças/mês",
  preco: "Sob consulta",
};

/** Vale para os três planos com preço fixo. Decorre do produto — não é promessa nova. */
const INCLUSO = [
  "Cobranças recorrentes no Pix Automático",
  "Autorização feita pelo cliente no banco dele",
  "Cobrança automática a cada ciclo",
  "Acompanhamento das cobranças e dos pagamentos",
];

const TRIAL = "30 dias grátis";
const TAXA_RECEBIMENTO_TEXTO = `Taxa de recebimento: ${formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por pagamento recebido`;

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
                <span className={s.por}>{formatarCentavos(p.precoCentavos)}</span>
                <span className={s.mes}>/mês</span>
              </div>

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

          <div data-reveal-each={String(PLANOS.length + 1)} className={s.plano}>
            <span className={s.nome}>{PERSONALIZADO.nome}</span>
            <span className={s.limite}>{PERSONALIZADO.limite}</span>

            <div className={s.precoBloco}>
              <span className={s.por}>{PERSONALIZADO.preco}</span>
            </div>

            <a className={s.btnPlano} href="mailto:usecube.ai@gmail.com">
              Falar com a gente <ArrowRight />
            </a>
          </div>
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
          <p className={s.taxaRecebimento}>{TAXA_RECEBIMENTO_TEXTO}</p>
        </div>
      </div>
    </section>
  );
}
