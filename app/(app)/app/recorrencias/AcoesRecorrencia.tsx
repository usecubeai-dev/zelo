"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  StatusRecorrencia,
  podeEditarRecorrencia,
  podeEncerrarRecorrencia,
  podePausarRecorrencia,
  podeReativarRecorrencia,
} from "@/lib/recorrencia";
import {
  ResultadoRecorrencia,
  encerrarRecorrencia,
  gerarProximoCiclo,
  pausarRecorrencia,
  reativarRecorrencia,
} from "./acoes";
import s from "../../App.module.css";

export default function AcoesRecorrencia({
  id,
  status,
}: {
  id: string;
  status: StatusRecorrencia;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoEncerramento, setConfirmandoEncerramento] = useState(false);

  const rodar = async (fn: () => Promise<ResultadoRecorrencia>) => {
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
      {status === "ativa" && (
        <button
          type="button"
          className={s.botao}
          disabled={ocupado}
          onClick={() => rodar(() => gerarProximoCiclo(id))}
        >
          {ocupado ? "Gerando…" : "Gerar próxima cobrança"}
        </button>
      )}

      {podeEditarRecorrencia(status) && (
        <Link href={`/app/recorrencias/${id}/editar`} className={s.botaoSec}>
          Editar
        </Link>
      )}

      {podePausarRecorrencia(status) && (
        <button
          type="button"
          className={s.botaoSec}
          disabled={ocupado}
          onClick={() => rodar(() => pausarRecorrencia(id))}
        >
          Pausar
        </button>
      )}

      {podeReativarRecorrencia(status) && (
        <button
          type="button"
          className={s.botaoSec}
          disabled={ocupado}
          onClick={() => rodar(() => reativarRecorrencia(id))}
        >
          Reativar
        </button>
      )}

      {podeEncerrarRecorrencia(status) &&
        (!confirmandoEncerramento ? (
          <button
            type="button"
            className={`${s.botaoSec} ${s.botaoPerigo}`}
            disabled={ocupado}
            onClick={() => setConfirmandoEncerramento(true)}
          >
            Encerrar recorrência
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${s.botaoSec} ${s.botaoPerigo}`}
              disabled={ocupado}
              onClick={() => rodar(() => encerrarRecorrencia(id))}
            >
              Confirmar encerramento
            </button>
            <button
              type="button"
              className={s.botaoSec}
              disabled={ocupado}
              onClick={() => setConfirmandoEncerramento(false)}
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
