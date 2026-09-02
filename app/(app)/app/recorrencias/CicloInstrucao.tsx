"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sincronizarInstrucaoAcao } from "./acoes";
import type { InstrucaoPagamento, StatusInstrucao } from "@/lib/core/instrucao-pagamento";
import { formatarData } from "@/lib/cobranca";
import s from "../../App.module.css";
import cs from "./AutorizacaoPix.module.css";

type Props = {
  recorrenciaId: string;
  instrucao: InstrucaoPagamento | null;
  cobrancaPaga: boolean;
};

const TEXTO: Record<StatusInstrucao, { titulo: string; tom: "neutro" | "atencao" | "sucesso" | "erro" }> = {
  AWAITING_REQUEST: { titulo: "Instrução aguardando processamento", tom: "atencao" },
  SCHEDULED: { titulo: "Débito agendado no banco do cliente", tom: "atencao" },
  DONE: { titulo: "Instrução processada", tom: "sucesso" },
  REFUSED: { titulo: "Instrução recusada", tom: "erro" },
  CANCELLED: { titulo: "Instrução cancelada", tom: "neutro" },
};

export default function CicloInstrucao({ recorrenciaId, instrucao, cobrancaPaga }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verMotivo, setVerMotivo] = useState(false);

  if (!instrucao) return null;

  // Pagamento é confirmado só pela cobrança (webhook de pagamento) — nunca pelo status da instrução.
  if (cobrancaPaga) {
    return (
      <section className={cs.cartao} data-tom="sucesso">
        <span className={cs.selo} aria-hidden="true" />
        <div className={cs.corpo}>
          <h3 className={cs.titulo}>✓ Recebido</h3>
          <p className={cs.detalhe}>O pagamento deste ciclo foi confirmado.</p>
        </div>
      </section>
    );
  }

  const texto = TEXTO[instrucao.status];

  const verificar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await sincronizarInstrucaoAcao(instrucao.id, recorrenciaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    router.refresh();
  };

  return (
    <section className={cs.cartao} data-tom={texto.tom}>
      <span className={cs.selo} aria-hidden="true" />
      <div className={cs.corpo}>
        <h3 className={cs.titulo}>{texto.titulo}</h3>

        {instrucao.due_date && (instrucao.status === "AWAITING_REQUEST" || instrucao.status === "SCHEDULED") && (
          <p className={cs.detalhe}>Débito previsto para {formatarData(instrucao.due_date)}.</p>
        )}

        {instrucao.status === "REFUSED" && (
          <>
            <p className={cs.detalhe}>
              O banco do cliente recusou o débito automático. Pode ser saldo insuficiente, limite ou a autorização
              não estar mais válida para essa transação.
            </p>
            {instrucao.refusal_reason && !verMotivo && (
              <button type="button" className={s.botaoSec} onClick={() => setVerMotivo(true)}>
                Ver motivo
              </button>
            )}
            {verMotivo && instrucao.refusal_reason && <p className={cs.detalhe}>Motivo informado pelo Asaas: {instrucao.refusal_reason}</p>}
          </>
        )}

        {instrucao.status === "CANCELLED" && (
          <p className={cs.detalhe}>Esta instrução foi cancelada. A cobrança deste ciclo não será processada por Pix Automático.</p>
        )}

        {instrucao.status === "DONE" && (
          <p className={cs.detalhe}>O Asaas confirmou o processamento da instrução — aguardando a confirmação final do pagamento.</p>
        )}

        {erro && <p className={cs.erro}>{erro}</p>}

        {(instrucao.status === "AWAITING_REQUEST" || instrucao.status === "SCHEDULED") && (
          <button type="button" className={s.botaoSec} onClick={verificar} disabled={ocupado}>
            {ocupado ? "Verificando…" : "Verificar status agora"}
          </button>
        )}
      </div>
    </section>
  );
}
