"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarComoNegociada, reabrirNegociacao } from "../acoesRecuperacao";
import s from "../../../App.module.css";
import c from "../../Recuperacao.module.css";

type Props = {
  cobrancaId: string;
  /** a frase de recomendação, já escolhida pelo servidor (ex.: "Essa cobrança está atrasada.") */
  recomendacao: string;
  /** o estado atual, só para o leitor de tela e o selo */
  estadoRotulo: string;
  negociada: boolean;
  /** última ação registrada, já formatada ("WhatsApp aberto · há 2h"), ou `null` */
  ultimaAcao: string | null;
  /** o que o valor atualizado mostra, ou `null` quando não há encargos */
  valorAtualizadoTexto: string | null;
};

/**
 * Destaque da cobrança em atraso: a recomendação ("Essa cobrança está
 * atrasada."), a última ação e o botão de marcar como negociada. O envio
 * (WhatsApp) e o "Copiar link" ficam na barra de ações da própria ficha — aqui
 * só se acompanha. Marcar como negociada NÃO muda nada financeiro: só tira a
 * cobrança da frente da fila e é reversível.
 */
export default function BlocoRecuperacao({ cobrancaId, recomendacao, estadoRotulo, negociada, ultimaAcao, valorAtualizadoTexto }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = async () => {
    setOcupado(true);
    setErro(null);
    const r = negociada ? await reabrirNegociacao(cobrancaId) : await marcarComoNegociada(cobrancaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    router.refresh();
  };

  return (
    <section className={`${c.faixaAtraso} ${negociada ? c.faixaAtencao : ""}`} aria-labelledby={`recuperacao-${cobrancaId}`}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <p id={`recuperacao-${cobrancaId}`} style={{ margin: 0 }}>
          {recomendacao}
        </p>
        <span className={c.atualizado}>
          {estadoRotulo}
          {ultimaAcao ? ` · Última ação: ${ultimaAcao}` : " · Nenhuma ação registrada ainda"}
        </span>
        {valorAtualizadoTexto && <span className={c.atualizado}>{valorAtualizadoTexto}</span>}
      </div>
      <button type="button" className={s.botaoSec} disabled={ocupado} onClick={alternar}>
        {negociada ? "Reabrir (não está mais negociada)" : "Marcar como negociada"}
      </button>
      {erro && (
        <p role="alert" className={s.erroCampo} style={{ flexBasis: "100%" }}>
          {erro}
        </p>
      )}
    </section>
  );
}
