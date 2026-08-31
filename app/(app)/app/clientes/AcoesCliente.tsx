"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alternarArquivamento, excluirCliente } from "./acoes";
import s from "../../App.module.css";

/**
 * Arquivar é a ação normal; excluir é a exceção.
 *
 * Cliente com cobrança paga não pode sumir — o histórico financeiro
 * perderia o pagador. Por isso arquivar vem primeiro e sem confirmação
 * (é reversível), e excluir pede confirmação explícita.
 */
export default function AcoesCliente({
  id,
  arquivado,
}: {
  id: string;
  arquivado: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const arquivar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await alternarArquivamento(id, !arquivado);
    setOcupado(false);
    if (!r.ok) {
      setErro("mensagem" in r ? r.mensagem : "Não conseguimos alterar agora.");
      return;
    }
    router.refresh();
  };

  const excluir = async () => {
    setOcupado(true);
    setErro(null);
    const r = await excluirCliente(id);
    setOcupado(false);
    if (!r.ok) {
      setErro("mensagem" in r ? r.mensagem : "Não conseguimos excluir agora.");
      return;
    }
    router.push("/app/clientes");
    router.refresh();
  };

  return (
    <>
      <button type="button" className={s.botaoSec} onClick={arquivar} disabled={ocupado}>
        {arquivado ? "Reativar" : "Arquivar"}
      </button>

      {!confirmando ? (
        <button
          type="button"
          className={`${s.botaoSec} ${s.botaoPerigo}`}
          onClick={() => setConfirmando(true)}
          disabled={ocupado}
        >
          Excluir
        </button>
      ) : (
        <>
          <button
            type="button"
            className={`${s.botaoSec} ${s.botaoPerigo}`}
            onClick={excluir}
            disabled={ocupado}
          >
            {ocupado ? "Excluindo…" : "Confirmar exclusão"}
          </button>
          <button
            type="button"
            className={s.botaoSec}
            onClick={() => setConfirmando(false)}
            disabled={ocupado}
          >
            Cancelar
          </button>
        </>
      )}

      {erro && (
        <span role="alert" className={s.erroCampo} style={{ marginTop: 0 }}>
          {erro}
        </span>
      )}
    </>
  );
}
