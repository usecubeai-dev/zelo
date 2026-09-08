"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sincronizarInstrucaoAcao } from "./acoes";
import type { InstrucaoPagamento, StatusInstrucao } from "@/lib/core/instrucao-pagamento";
import { formatarData } from "@/lib/cobranca";
import s from "../../App.module.css";

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
  const [verificado, setVerificado] = useState(false);

  if (!instrucao) return null;

  // Pagamento é confirmado só pela cobrança (webhook de pagamento) — nunca pelo status da instrução.
  if (cobrancaPaga) {
    return (
      <section className={s.cartaoSelo} data-tom="sucesso">
        <span className={s.seloLateral} aria-hidden="true" />
        <div className={s.cartaoCorpo}>
          <h3 className={s.cartaoTitulo}>✓ Recebido</h3>
          <p className={s.cartaoDetalhe}>O pagamento deste ciclo foi confirmado.</p>
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
    setVerificado(true);
    setTimeout(() => setVerificado(false), 2500);
    router.refresh();
  };

  return (
    <section className={s.cartaoSelo} data-tom={texto.tom}>
      <span className={s.seloLateral} aria-hidden="true" />
      <div className={s.cartaoCorpo}>
        <h3 className={s.cartaoTitulo}>{texto.titulo}</h3>

        {instrucao.due_date && (instrucao.status === "AWAITING_REQUEST" || instrucao.status === "SCHEDULED") && (
          <p className={s.cartaoDetalhe}>Débito previsto para {formatarData(instrucao.due_date)}.</p>
        )}

        {instrucao.status === "REFUSED" && (
          <>
            <p className={s.cartaoDetalhe}>
              O banco do cliente recusou o débito automático. Pode ser saldo insuficiente, limite ou a autorização
              não estar mais válida para essa transação.
            </p>
            {instrucao.refusal_reason && !verMotivo && (
              <button type="button" className={s.botaoSec} onClick={() => setVerMotivo(true)}>
                Ver motivo
              </button>
            )}
            {verMotivo && instrucao.refusal_reason && <p className={s.cartaoDetalhe}>Motivo informado pelo parceiro de pagamentos: {instrucao.refusal_reason}</p>}
          </>
        )}

        {instrucao.status === "CANCELLED" && (
          <p className={s.cartaoDetalhe}>Esta instrução foi cancelada. A cobrança deste ciclo não será processada por Pix Automático.</p>
        )}

        {instrucao.status === "DONE" && (
          <p className={s.cartaoDetalhe}>O parceiro de pagamentos confirmou o processamento da instrução — aguardando a confirmação final do pagamento.</p>
        )}

        {erro && <p className={s.cartaoErro}>{erro}</p>}

        {(instrucao.status === "AWAITING_REQUEST" || instrucao.status === "SCHEDULED") && (
          <>
            <button type="button" className={s.botaoSec} onClick={verificar} disabled={ocupado}>
              {ocupado ? "Verificando…" : "Verificar status agora"}
            </button>
            <p className={s.cartaoConfirmacao} role="status" aria-live="polite" hidden={!verificado}>
              {verificado ? "Verificado agora — sem mudança no status." : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
