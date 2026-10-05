"use client";

import { useState } from "react";
import { useReveal, useRevealEach } from "@/lib/useReveal";
import { formatarCentavos } from "@/lib/dinheiro";
import { PRECO_POR_PLANO_CENTAVOS, TAXA_DE_RECEBIMENTO_CENTAVOS } from "@/lib/plano";
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
    a: `Sim. São três planos, que mudam conforme quantos clientes ativos e cobranças por mês você precisa: ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}, ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.profissional)} e ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.premium)} por mês, mais uma taxa de recebimento de ${formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por pagamento recebido. A assinatura começa quando o primeiro pagamento é confirmado.`,
  },
  {
    q: "Como começo a usar?",
    a: "Você cria sua conta, escolhe o plano e paga a primeira mensalidade. Assim que o pagamento é confirmado, sua conta é liberada automaticamente e você já pode cadastrar clientes e organizar suas cobranças.",
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
