"use client";

import {
  FRASE_DO_PLANO,
  PLANOS_DA_TELA,
  RECURSOS_DOS_PLANOS,
  comparacaoDosPlanos,
  textoDoLimite,
} from "@/lib/checkout";
import { NOME_DO_PLANO, PLANO_EM_DESTAQUE, PRECO_POR_PLANO_CENTAVOS, Plano, TEXTO_TAXA, planoPago } from "@/lib/plano";
import { formatarCentavos } from "@/lib/dinheiro";
import AvisoTaxa from "@/components/AvisoTaxa";
import c from "./Checkout.module.css";

type Props = {
  /** plano atual da pessoa, para marcar "Seu plano" */
  planoVigente?: Plano | null;
  /** esconde o Grátis (conta que já está no Grátis, ou atrasada) */
  apenasPagos: boolean;
  /** só o administrador do Zelo: acrescenta o plano de teste ao fim da lista */
  incluirPlanoDeTeste?: boolean;
  podeAssinar: boolean;
  aoEscolher: (plano: Plano) => void;
};

/**
 * Tela de planos: 4 cards, o NEGÓCIO em destaque, taxa por Pix à vista em todos
 * e uma comparação curta e verdadeira (hoje todos os planos têm os mesmos
 * recursos; o que muda é o limite de clientes).
 */
export default function PlanosPremium({ planoVigente = null, apenasPagos, incluirPlanoDeTeste = false, podeAssinar, aoEscolher }: Props) {
  const planos: Plano[] = [...PLANOS_DA_TELA.filter((p) => !(apenasPagos && !planoPago(p)))];
  if (incluirPlanoDeTeste) planos.push("teste");
  const linhas = comparacaoDosPlanos();
  const colunas = PLANOS_DA_TELA;

  return (
    <section className={c.raiz} aria-labelledby="titulo-planos">
      <header className={c.cabecalho}>
        <h2 id="titulo-planos" className={c.titulo}>
          Escolha o plano ideal para o seu negócio
        </h2>
        <p className={c.subtitulo}>Comece simples. Cresça sem complicação.</p>
      </header>

      <div className={c.grade}>
        {planos.map((p) => {
          const destaque = p === PLANO_EM_DESTAQUE;
          const pago = planoPago(p);
          const ehAtual = planoVigente === p;
          return (
            <article key={p} className={`${c.card} ${destaque ? c.cardDestaque : ""}`} data-plano={p} data-destaque={destaque ? "true" : "false"}>
              {destaque && <span className={c.selo}>Mais escolhido</span>}
              <div>
                <h3 className={c.cardNome}>{NOME_DO_PLANO[p]}</h3>
                <p className={c.cardFrase}>{FRASE_DO_PLANO[p]}</p>
              </div>

              <p className={c.preco}>
                <span className={`${c.precoValor} tnum`}>{pago ? formatarCentavos(PRECO_POR_PLANO_CENTAVOS[p]) : "R$ 0"}</span>
                <span className={c.precoPeriodo}>{pago ? "/mês" : "sem mensalidade"}</span>
              </p>

              <span className={c.limite}>{textoDoLimite(p)}</span>

              <p className={c.taxa}>
                <strong>{TEXTO_TAXA}</strong>
              </p>

              <ul className={c.recursos} aria-label={`O que o plano ${NOME_DO_PLANO[p]} inclui`}>
                {RECURSOS_DOS_PLANOS.map((r) => (
                  <li key={r}>
                    <span className={c.check} aria-hidden="true">
                      ✓
                    </span>
                    {r}
                  </li>
                ))}
              </ul>

              <div className={c.cardCta}>
                <button
                  type="button"
                  className={`${c.botaoGrande} ${destaque ? "" : c.botaoContorno}`}
                  disabled={!podeAssinar || ehAtual}
                  onClick={() => aoEscolher(p)}
                  aria-label={ehAtual ? `${NOME_DO_PLANO[p]} é o seu plano atual` : `Escolher o plano ${NOME_DO_PLANO[p]}`}
                >
                  {ehAtual ? "Seu plano atual" : "Escolher plano"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!podeAssinar && (
        <p className={c.dica} role="note">
          Só o responsável pela conta pode escolher ou mudar o plano.
        </p>
      )}

      <AvisoTaxa somenteNota />

      <section className={c.comparacao} aria-labelledby="titulo-comparacao">
        <h3 id="titulo-comparacao" className={c.comparacaoTitulo}>
          Compare em poucos segundos
        </h3>
        <p className={c.comparacaoNota}>Todos os planos incluem os mesmos recursos. O que muda é quantos clientes você pode ter.</p>
        <table className={c.tabela}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Recurso</span>
              </th>
              {colunas.map((p) => (
                <th key={p} scope="col" className={p === PLANO_EM_DESTAQUE ? c.colunaDestaque : undefined}>
                  {NOME_DO_PLANO[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                {l.valores.map((v, i) => (
                  <td key={colunas[i]} className={colunas[i] === PLANO_EM_DESTAQUE ? c.colunaDestaque : undefined}>
                    {v === true ? (
                      <>
                        <span className={c.check} aria-hidden="true">
                          ✓
                        </span>
                        <span className="sr-only">Incluído</span>
                      </>
                    ) : v === false ? (
                      <span aria-label="Não incluído">—</span>
                    ) : (
                      <strong>{v}</strong>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
