"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { solicitarAutorizacaoPixAcao } from "./acoes";
import s from "../../App.module.css";
import e from "../cobrancas/Envio.module.css";

/**
 * "Preparar para enviar": cria a autorização (idempotente) e recarrega a tela,
 * que passa a mostrar "Enviar para o cliente". Quando não for possível, diz por
 * quê em linguagem de gente, sem código nem termo técnico.
 */
export default function PrepararAutorizacao({ recorrenciaId }: { recorrenciaId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const preparar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await solicitarAutorizacaoPixAcao(recorrenciaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem || "Não conseguimos preparar agora. Tente novamente em instantes.");
      return;
    }
    router.refresh();
  };

  return (
    <div className={e.envio}>
      <div className={e.envioPrincipal}>
        <button type="button" className={s.botao} style={{ minHeight: 56, fontSize: "1.05rem" }} onClick={preparar} disabled={ocupado}>
          {ocupado ? "Preparando…" : "Preparar para enviar ao cliente"}
        </button>
      </div>
      {erro && (
        <p role="alert" className={s.erroCampo} style={{ marginTop: 0 }}>
          {erro}
        </p>
      )}
    </div>
  );
}
