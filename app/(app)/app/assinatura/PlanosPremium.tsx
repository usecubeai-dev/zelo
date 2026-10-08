"use client";

import {
  FRASE_DO_PLANO,
  PLANOS_DA_TELA,
  RECURSOS_DOS_PLANOS,
  comparacaoDosPlanos,
  textoDoLimite,
} from "@/lib/checkout";
import { NOME_DO_PLANO, PLANO_EM_DESTAQUE, PRECO_POR_PLANO_CENTAVOS, Plano, TEXTO_TAXA } from "@/lib/plano";
import { formatarCentavos } from "@/lib/dinheiro";
import AvisoTaxa from "@/components/AvisoTaxa";
import c from "./Checkout.module.css";

type Props = {
  /** plano atual da pessoa, para marcar "Seu plano atual" no cartão correspondente */
  planoVigente?: Plano | null;
  /** só o administrador do Zelo: mostra o plano de teste numa área interna, FORA dos planos comerciais */
  incluirPlanoDeTeste?: boolean;
  podeAssinar: boolean;
  aoEscolher: (plano: Plano) => void;
};

/**
 * A vitrine: SÓ Essencial, Negócio e Escola, com o Negócio (no meio) em
 * destaque. O Grátis não é oferecido (continua no backend, para as contas que
 * já estão nele) e o plano de teste (R$ 5) nunca entra nesta grade.
 *
 * Hoje os planos têm os mesmos recursos; o que muda é o limite de clientes —
 * os cartões e a comparação dizem só isso. Os preços vêm de `lib/plano.ts`
 * (servidor); o cliente só envia QUAL plano quer.
 */
export default function PlanosPremium({ planoVigente = null, incluirPlanoDeTeste = false, podeAssinar, aoEscolher }: Props) {
  const linhas = comparacaoDosPlanos();
  const clientes = linhas[0];
  const recursosComuns = linhas.slice(1);

  return (
    <section className={c.vitrine} aria-label="Planos">
      <div className={c.grade}>
        {PLANOS_DA_TELA.map((p) => {
          const destaque = p === PLANO_EM_DESTAQUE;
          const ehAtual = planoVigente === p;
          return (
            <article key={p} className={`${c.card} ${destaque ? c.cardDestaque : ""}`} data-plano={p} data-destaque={destaque ? "true" : "false"}>
              {destaque && <span className={c.selo}>Mais escolhido</span>}
              <div className={c.cardTopo}>
                <h3 className={c.cardNome}>{NOME_DO_PLANO[p]}</h3>
                <p className={c.cardFrase}>{FRASE_DO_PLANO[p]}</p>
              </div>

              <p className={c.preco}>
                <span className={`${c.precoValor} tnum`}>{formatarCentavos(PRECO_POR_PLANO_CENTAVOS[p])}</span>
                <span className={c.precoPeriodo}>/mês</span>
              </p>

              <p className={c.limite}>{textoDoLimite(p)}</p>
              <p className={c.taxa}>{TEXTO_TAXA}</p>

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
                  {ehAtual ? "Seu plano atual" : `Escolher ${NOME_DO_PLANO[p]}`}
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
          Compare os planos
        </h3>
        <p className={c.comparacaoNota}>Todos incluem os mesmos recursos. O que muda é quantos clientes você pode ter.</p>

        {/* telas largas: tabela limpa */}
        <table className={c.tabela}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Recurso</span>
              </th>
              {PLANOS_DA_TELA.map((p) => (
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
                  <td key={PLANOS_DA_TELA[i]} className={PLANOS_DA_TELA[i] === PLANO_EM_DESTAQUE ? c.colunaDestaque : undefined}>
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

        {/* celular: blocos, sem rolagem lateral */}
        <div className={c.comparacaoBlocos}>
          <div className={c.blocoComp}>
            <h4 className={c.blocoCompTitulo}>{clientes.rotulo}</h4>
            <dl className={c.blocoCompLista}>
              {PLANOS_DA_TELA.map((p, i) => (
                <div key={p} className={c.blocoCompLinha}>
                  <dt>{NOME_DO_PLANO[p]}</dt>
                  <dd>
                    <strong>{String(clientes.valores[i])}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={c.blocoComp}>
            <h4 className={c.blocoCompTitulo}>Em todos os planos</h4>
            <ul className={c.recursos}>
              {recursosComuns.map((l) => (
                <li key={l.rotulo}>
                  <span className={c.check} aria-hidden="true">
                    ✓
                  </span>
                  {l.rotulo}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {incluirPlanoDeTeste && (
        <aside className={c.internoAdmin} aria-label="Uso interno do administrador">
          <p className={c.internoRotulo}>Uso interno · só administradores do Zelo</p>
          <article className={c.internoCard} data-plano="teste">
            <div>
              <h3 className={c.internoNome}>{NOME_DO_PLANO.teste}</h3>
              <p className={c.cardFrase}>Valida o pagamento real ponta a ponta. Não é um plano comercial.</p>
            </div>
            <button
              type="button"
              className={`${c.botaoGrande} ${c.botaoContorno} ${c.internoBotao}`}
              disabled={!podeAssinar}
              onClick={() => aoEscolher("teste")}
              aria-label={`Escolher o plano ${NOME_DO_PLANO.teste} (uso interno)`}
            >
              Usar plano de teste
            </button>
          </article>
        </aside>
      )}
    </section>
  );
}
