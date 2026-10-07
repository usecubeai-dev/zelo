"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  StatusCobranca,
  podeCancelar,
  podeEditar,
  podeMarcarPaga,
} from "@/lib/cobranca";
import {
  ResultadoCobranca,
  cancelarCobranca,
  marcarComoEnviada,
  marcarComoPaga,
  sincronizarStatusCobrancaAcao,
} from "./acoes";
import s from "../../App.module.css";

/**
 * As ações disponíveis dependem do estado, e a tela só mostra o que a
 * Server Action aceitaria. Botão que existe e sempre falha é pior que
 * botão ausente.
 */
export default function AcoesCobranca({
  id,
  status,
  temPaymentAsaas = false,
}: {
  id: string;
  status: StatusCobranca;
  /** Fase 9: só faz sentido oferecer "verificar status agora" pra cobrança já enviada ao Asaas. */
  temPaymentAsaas?: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const rodar = async (fn: () => Promise<ResultadoCobranca>) => {
    setOcupado(true);
    setErro(null);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      setErro("mensagem" in r ? r.mensagem : "Não conseguimos concluir agora.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      {podeEditar(status) && (
        <Link href={`/app/cobrancas/${id}/editar`} className={s.botaoSec}>
          Editar
        </Link>
      )}

      {status === "pendente" && (
        <button
          type="button"
          className={s.botaoSec}
          disabled={ocupado}
          onClick={() => rodar(() => marcarComoEnviada(id))}
        >
          Marcar como enviada
        </button>
      )}

      {temPaymentAsaas && (status === "pendente" || status === "enviada" || status === "paga") && (
        <button
          type="button"
          className={s.botaoSec}
          disabled={ocupado}
          onClick={() => rodar(() => sincronizarStatusCobrancaAcao(id))}
        >
          {ocupado ? "Verificando…" : "Verificar status agora"}
        </button>
      )}

      {podeMarcarPaga(status) && (
        <button
          type="button"
          className={s.botaoSec}
          disabled={ocupado}
          onClick={() => rodar(() => marcarComoPaga(id))}
        >
          {ocupado ? "Registrando…" : "Registrar pagamento"}
        </button>
      )}

      {podeCancelar(status) &&
        (!confirmando ? (
          <button
            type="button"
            className={`${s.botaoSec} ${s.botaoPerigo}`}
            disabled={ocupado}
            onClick={() => setConfirmando(true)}
          >
            Cancelar cobrança
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${s.botaoSec} ${s.botaoPerigo}`}
              disabled={ocupado}
              onClick={() => rodar(() => cancelarCobranca(id))}
            >
              Confirmar cancelamento
            </button>
            <button
              type="button"
              className={s.botaoSec}
              disabled={ocupado}
              onClick={() => setConfirmando(false)}
            >
              Voltar
            </button>
          </>
        ))}

      {erro && (
        <span role="alert" className={s.erroCampo} style={{ marginTop: 0 }}>
          {erro}
        </span>
      )}
    </>
  );
}
