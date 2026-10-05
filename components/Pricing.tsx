"use client";

import Link from "next/link";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { ArrowRight, Check } from "./icons";
import { EVENTOS } from "@/lib/analytics";
import { formatarCentavos } from "@/lib/dinheiro";
import {
  LIMITE_DE_CLIENTES,
  LIMITE_DE_COBRANCAS_MENSAL,
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  type Plano,
} from "@/lib/plano";
import c from "./Commercial.module.css";
import s from "./Pricing.module.css";

/* ============================================================
   Pricing oficial — aprovado pelo proprietário. Fonte única dos
   números é `lib/plano.ts` (mesma que o app autenticado usa em
   `/app/assinatura`): esta seção só formata, nunca redeclara valor.

   Não existe mês grátis: quem assina paga a mensalidade e a conta é
   liberada quando o primeiro pagamento é confirmado. Por isso nenhum CTA
   fala em "grátis" ou "teste".

   "Personalizado" não é um `Plano` de banco — é sob consulta, fora do
   fluxo de self-service, por isso não tem `data-evt`/CTA de cadastro,
   só um link de contato.
   ============================================================ */
type CardPlano = {
  chave: Plano;
  nome: string;
  limite: string;
  precoCentavos: number;
  destaque: boolean;
};

const PLANOS: CardPlano[] = (["essencial", "profissional", "premium"] as const).map((chave) => ({
  chave,
  nome: NOME_DO_PLANO[chave],
  limite: `Até ${LIMITE_DE_CLIENTES[chave]} clientes ativos · ${LIMITE_DE_COBRANCAS_MENSAL[chave]} cobranças/mês`,
  precoCentavos: PRECO_POR_PLANO_CENTAVOS[chave],
  destaque: chave === PLANO_EM_DESTAQUE,
}));

const PERSONALIZADO = {
  nome: "Personalizado",
  limite: `Acima de ${LIMITE_DE_CLIENTES.premium} clientes ou ${LIMITE_DE_COBRANCAS_MENSAL.premium} cobranças/mês`,
  preco: "Sob consulta",
};

/** Vale para os três planos com preço fixo. Decorre do produto — não é promessa nova. */
const INCLUSO = [
  "Cobranças recorrentes no Pix Automático",
  "Autorização feita pelo cliente no banco dele",
  "Cobrança automática a cada ciclo",
  "Acompanhamento das cobranças e dos pagamentos",
];

const TAXA = formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS);

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
          <p data-reveal className={s.sub}>
            Você escolhe o plano pelo tamanho da sua carteira de clientes. A
            assinatura começa quando o primeiro pagamento é confirmado.
          </p>
        </div>

        <div className={s.grade} ref={gradeRef}>
          {PLANOS.map((p, i) => (
            <div
              key={p.chave}
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

              {/* a taxa aparece em CADA card, colada ao preço: quem compara
                  planos precisa ver o custo completo sem rolar até o rodapé */}
              <span className={s.taxaCard}>+ {TAXA} por recebimento</span>

              <Link
                className={p.destaque ? `${c.btnPrimary} ${s.ctaFim}` : `${s.btnSec} ${s.ctaFim}`}
                href={`/criar-conta?plano=${p.chave}`}
                data-evt={EVENTOS.ctaStart}
                data-evt-local={`preco-${p.chave}`}
              >
                {p.destaque ? "Começar agora" : "Assinar"} <ArrowRight />
              </Link>
            </div>
          ))}

          <div data-reveal-each={String(PLANOS.length + 1)} className={s.plano}>
            <span className={s.nome}>{PERSONALIZADO.nome}</span>
            <span className={s.limite}>{PERSONALIZADO.limite}</span>

            <div className={`${s.precoBloco} ${s.precoSolo}`}>
              <span className={s.por}>{PERSONALIZADO.preco}</span>
            </div>

            <a className={`${s.btnSec} ${s.ctaFim}`} href="mailto:usecube.ai@gmail.com">
              Falar com a gente <ArrowRight />
            </a>
          </div>
        </div>

        {/* Faixa da taxa: o modelo é mensalidade + taxa por recebimento, e a
            segunda metade não pode ficar escondida num rodapé miúdo. */}
        <div data-reveal className={s.faixaTaxa}>
          <span className={s.faixaTaxaValor}>{TAXA}</span>
          <p>
            <strong>por recebimento, em todos os planos.</strong> Cobrada
            apenas quando um pagamento dos seus clientes é recebido, somada à
            mensalidade do plano.
          </p>
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
