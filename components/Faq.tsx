"use client";

import { useState } from "react";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { formatarCentavos } from "@/lib/dinheiro";
import {
  NOME_DO_PLANO,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  descricaoDoLimite,
} from "@/lib/plano";
import c from "./Commercial.module.css";
import s from "./Faq.module.css";

/* ============================================================
   `pendente: true` marca resposta que depende de decisão de produto ainda
   não tomada. Nada aqui afirma preço, prazo, app, cancelamento, segurança
   ou detalhe bancário que não esteja estabelecido no projeto.
   Para publicar: escrever a resposta e remover a flag.
   ============================================================ */
/* O tipo é explícito porque nenhuma pergunta está pendente hoje: sem ele, o
   TypeScript infere `{ q, a }` e o `p.pendente` do JSX deixa de compilar —
   foi o que quebrou o build em 26/08. O mecanismo de pendência continua de
   pé para a próxima resposta que depender de decisão comercial. */
const PERGUNTAS: { q: string; a: string; pendente?: boolean }[] = [
  {
    q: "O que é a Zelo?",
    a: "A Zelo automatiza cobranças recorrentes no Pix Automático. Você cria a cobrança uma vez, o cliente autoriza, e os ciclos seguintes acontecem sem você precisar cobrar de novo.",
  },
  {
    q: "Como funciona o Pix Automático?",
    a: "O seu cliente autoriza a cobrança recorrente uma única vez, dentro do aplicativo do banco dele. A partir daí, cada ciclo é debitado automaticamente, no valor e na data que você definiu.",
  },
  {
    q: "Preciso cobrar meus clientes manualmente?",
    a: "Não — é exatamente o que a Zelo tira da sua rotina. Depois da autorização, você não precisa mandar lembrete nem perguntar se o pagamento saiu.",
  },
  {
    q: "Para quais tipos de negócio a Zelo serve?",
    a: "Para quem recebe de forma recorrente: mensalidade, plano, assinatura ou pacote. Se a cobrança se repete todo mês, a Zelo faz sentido.",
  },
  {
    q: "Existe mensalidade?",
    /* Tudo vem de `lib/plano.ts`: preço e limite nunca são digitados aqui. */
    a: `Depende do tamanho da sua carteira. O plano ${NOME_DO_PLANO.gratis} é permanente, sem mensalidade e sem prazo, e vai ${descricaoDoLimite("gratis").toLowerCase()}. Os planos pagos são ${NOME_DO_PLANO.essencial} (${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês, ${descricaoDoLimite("essencial").toLowerCase()}), ${NOME_DO_PLANO.negocio} (${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.negocio)}/mês, ${descricaoDoLimite("negocio").toLowerCase()}) e ${NOME_DO_PLANO.escola} (${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.escola)}/mês, ${descricaoDoLimite("escola").toLowerCase()}). Em todos os planos, inclusive no Grátis, há uma taxa de ${formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por Pix recebido.`,
  },
  {
    q: "Como começo a usar?",
    a: "Você cria sua conta e escolhe o plano. No Grátis, a conta é liberada na hora. Nos planos pagos, ela é liberada automaticamente assim que o pagamento da primeira mensalidade é confirmado. Depois disso, você já pode cadastrar clientes e organizar suas cobranças.",
  },
];

export default function Faq() {
  const ref = useReveal<HTMLElement>();
  /* deslocamento 0: os itens dividem borda, e um transform levaria a borda
     do item junto, invadindo o seguinte */
  const listaRef = useRevealEach<HTMLDivElement>(0);
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <section className={`${c.section} ${c.raised}`} ref={ref} id="faq">
      <div className={c.inner}>
        <div className={c.head}>
          <span data-reveal className={c.kicker}>
            Dúvidas
          </span>
          <h2 data-reveal className={c.title}>
            Antes de começar.
          </h2>
        </div>

        <div className={s.lista} ref={listaRef}>
          {PERGUNTAS.map((p, i) => {
            const ativa = aberta === i;
            const idBotao = `faq-p-${i}`;
            const idResposta = `faq-r-${i}`;
            return (
              <div key={p.q} data-reveal-each className={s.item}>
                <button
                  type="button"
                  id={idBotao}
                  className={s.pergunta}
                  aria-expanded={ativa}
                  aria-controls={idResposta}
                  onClick={() => setAberta(ativa ? null : i)}
                >
                  <span>{p.q}</span>
                  <span className={ativa ? `${s.sinal} ${s.sinalAberto}` : s.sinal} />
                </button>
                <div
                  id={idResposta}
                  role="region"
                  aria-labelledby={idBotao}
                  className={ativa ? `${s.corpo} ${s.corpoAberto}` : s.corpo}
                >
                  <div className={s.corpoIn}>
                    <p className={s.resposta}>{p.a}</p>
                    {p.pendente && (
                      <span className={`${c.pendente} ${s.faqPendente}`}>
                        [A DEFINIR]
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
