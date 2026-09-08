"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alternarArquivamentoServico } from "./acoes";
import s from "../../App.module.css";

export default function AcoesServico({ id, arquivado }: { id: string; arquivado: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await alternarArquivamentoServico(id, !arquivado);
    setOcupado(false);
    if (!r.ok) {
      setErro("mensagem" in r ? r.mensagem : "Não conseguimos alterar agora.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <button type="button" className={s.botaoSec} onClick={alternar} disabled={ocupado}>
        {ocupado ? "Salvando…" : arquivado ? "Reativar" : "Arquivar"}
      </button>
      {erro && (
        <span role="alert" className={s.erroCampo} style={{ marginTop: 0 }}>
          {erro}
        </span>
      )}
    </>
  );
}
