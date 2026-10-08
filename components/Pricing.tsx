"use client";

import Link from "next/link";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { ArrowRight, Check } from "./icons";
import { EVENTOS } from "@/lib/analytics";
import { formatarCentavos } from "@/lib/dinheiro";
import { PLANOS_DA_TELA } from "@/lib/checkout";
import {
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  NOTA_TAXA,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  TEXTO_TAXA,
  descricaoDoLimite,
  planoPago,
  type Plano,
} from "@/lib/plano";
import c from "./Commercial.module.css";
import s from "./Pricing.module.css";

/* ============================================================
   Pricing oficial — tabela decidida pelo proprietário. Fonte única dos
   números é `lib/plano.ts` (a mesma que o app autenticado usa em
   `/app/assinatura`): esta seção só formata, nunca redeclara valor.

   O plano Grátis é PERMANENTE: não é teste, não tem prazo e não é "primeiro
   mês grátis". Por isso "Grátis" só aparece aqui como NOME do plano, nunca
   como promoção. Já os planos pagos são liberados quando o primeiro
   pagamento é confirmado.

   Não existe plano "sob consulta": a Escola é ilimitada, então não sobra
   faixa para negociar fora do self-service.
   ============================================================ */
type CardPlano = {
  chave: Plano;
  nome: string;
  limite: string;
  precoCentavos: number;
  pago: boolean;
  destaque: boolean;
};

const PLANOS: CardPlano[] = PLANOS_DA_TELA.map((chave) => ({
  chave,
  nome: NOME_DO_PLANO[chave],
  limite: descricaoDoLimite(chave),
  precoCentavos: PRECO_POR_PLANO_CENTAVOS[chave],
  pago: planoPago(chave),
  destaque: chave === PLANO_EM_DESTAQUE,
}));

/** Vale para todos os planos: decorre do produto, não é promessa nova. */
const INCLUSO = [
  "Cobranças recorrentes no Pix Automático",
  "Autorização feita pelo cliente no banco dele",
  "Cobrança automática a cada ciclo",
  "Acompanhamento das cobranças e dos pagamentos",
];

const TAXA = formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS);

function rotuloDoCta(p: CardPlano): string {
  return p.destaque ? "Começar agora" : "Assinar";
}

export default function Pricing() {
  const ref = useReveal<HTMLElement>();
  /* Os cards entram em ordem de leitura. O destaque é desenhado (borda,
     fundo, fita), não animado: entrar fora de ordem chamaria atenção pelo
     movimento em vez do conteúdo. */
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
            Escolha o plano pelo tamanho da sua carteira de clientes. O plano
            é liberado quando o primeiro pagamento é confirmado.
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
              </div>
              {/* linha sob o preço, com altura de duas linhas em todos os
                  cards: a frase do Grátis pode quebrar na coluna estreita e,
                  sem a reserva, a taxa e o botão sairiam de alinhamento */}
              <span className={s.obsPreco}>por mês · mensalidade fixa</span>

              {/* a taxa aparece em CADA card, colada ao preço: quem compara
                  planos precisa ver o custo completo sem rolar até o rodapé */}
              <span className={s.taxaCard}>{TEXTO_TAXA}</span>

              <Link
                className={p.destaque ? `${c.btnPrimary} ${s.ctaFim}` : `${s.btnSec} ${s.ctaFim}`}
                href={`/criar-conta?plano=${p.chave}`}
                data-evt={EVENTOS.ctaStart}
                data-evt-local={`preco-${p.chave}`}
              >
                {rotuloDoCta(p)} <ArrowRight />
              </Link>
            </div>
          ))}
        </div>

        {/* Faixa da taxa: o modelo é mensalidade + taxa por Pix recebido, e a
            segunda metade não pode ficar escondida num rodapé miúdo. */}
        <div data-reveal className={s.faixaTaxa}>
          <span className={s.faixaTaxaValor}>{TAXA}</span>
          <p>
            <strong>por Pix recebido, em todos os planos.</strong>{" "}
            {NOTA_TAXA} Somada à mensalidade do plano.
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
