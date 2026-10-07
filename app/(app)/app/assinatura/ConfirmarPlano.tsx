"use client";

import { useEffect, useRef } from "react";
import { RECURSOS_DOS_PLANOS, textoDoLimite } from "@/lib/checkout";
import { NOME_DO_PLANO, PRECO_POR_PLANO_CENTAVOS, Plano, TAXA_DE_RECEBIMENTO_CENTAVOS, planoPago } from "@/lib/plano";
import { formatarCentavos } from "@/lib/dinheiro";
import AvisoTaxa from "@/components/AvisoTaxa";
import c from "./Checkout.module.css";

type Props = {
  plano: Plano;
  /** o botão principal está trabalhando (ativando o Grátis) */
  ocupado: boolean;
  erro: string | null;
  aoContinuar: () => void;
  aoAlterar: () => void;
};

/**
 * "Você escolheu o Negócio": a pessoa entende o que está contratando ANTES de ver
 * qualquer campo de pagamento. Nada é cobrado aqui.
 */
export default function ConfirmarPlano({ plano, ocupado, erro, aoContinuar, aoAlterar }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const pago = planoPago(plano);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <section className={c.confirma} aria-labelledby="titulo-confirmacao">
      <div className={`${c.painel} ${c.painelDestaque}`}>
        <h2 id="titulo-confirmacao" ref={titulo} tabIndex={-1} className={c.confirmaTitulo}>
          Você escolheu o {NOME_DO_PLANO[plano]}
        </h2>
        <p className={c.confirmaPreco}>
          <strong className="tnum">{pago ? `${formatarCentavos(PRECO_POR_PLANO_CENTAVOS[plano])}/mês` : "R$ 0, sem mensalidade"}</strong>
        </p>
        <p className={c.confirmaPreco}>{textoDoLimite(plano)}</p>

        <p className={c.blocoTitulo}>Seu plano inclui</p>
        <ul className={c.recursos}>
          {RECURSOS_DOS_PLANOS.map((r) => (
            <li key={r}>
              <span className={c.check} aria-hidden="true">
                ✓
              </span>
              {r}
            </li>
          ))}
        </ul>

        <p className={c.blocoTitulo}>Taxa por Pix recebido</p>
        <div className={c.linhaTaxa}>
          <span>
            <strong className="tnum">{formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)}</strong> por Pix recebido
          </span>
          <span>só quando o Pix é de fato recebido</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <AvisoTaxa somenteNota />
        </div>

        {erro && (
          <p role="alert" className={c.erro} style={{ marginTop: 14 }}>
            {erro}
          </p>
        )}

        <div className={c.acoesLinha}>
          <button type="button" className={c.botaoGrande} onClick={aoContinuar} disabled={ocupado}>
            {ocupado ? (
              <>
                <span className={c.girando} aria-hidden="true" /> Ativando…
              </>
            ) : pago ? (
              "Continuar para pagamento"
            ) : (
              "Ativar plano Grátis"
            )}
          </button>
          <button type="button" className={c.linkSecundario} onClick={aoAlterar} disabled={ocupado}>
            Alterar plano
          </button>
        </div>
      </div>
    </section>
  );
}
