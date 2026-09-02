"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  solicitarAutorizacaoPixAcao,
  sincronizarAutorizacaoPixAcao,
  cancelarAutorizacaoPixAcao,
} from "./acoes";
import type { AutorizacaoPix as AutorizacaoPixTipo, StatusAutorizacao } from "@/lib/core/autorizacao";
import { formatarCentavos } from "@/lib/dinheiro";
import s from "../../App.module.css";
import cs from "./AutorizacaoPix.module.css";

type Props = {
  recorrenciaId: string;
  valorCentavos: number;
  diaVencimento: number;
  autorizacaoInicial: AutorizacaoPixTipo | null;
};

const TEXTO_ESTADO: Record<StatusAutorizacao, { titulo: string; tom: "neutro" | "atencao" | "sucesso" | "erro" }> = {
  CREATED: { titulo: "Aguardando autorização", tom: "atencao" },
  ACTIVE: { titulo: "Pix Automático ativo", tom: "sucesso" },
  REFUSED: { titulo: "Autorização recusada", tom: "erro" },
  CANCELLED: { titulo: "Autorização cancelada", tom: "neutro" },
  EXPIRED: { titulo: "Autorização expirada", tom: "erro" },
};

export default function AutorizacaoPix({ recorrenciaId, valorCentavos, diaVencimento, autorizacaoInicial }: Props) {
  const router = useRouter();
  const [autorizacao, setAutorizacao] = useState(autorizacaoInicial);
  const [qr, setQr] = useState<{ payload: string | null; encodedImage: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const solicitar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await solicitarAutorizacaoPixAcao(recorrenciaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    setQr({ payload: r.dado.payload, encodedImage: r.dado.encodedImage });
    router.refresh();
  };

  const verificar = async () => {
    if (!autorizacao) return;
    setOcupado(true);
    setErro(null);
    const r = await sincronizarAutorizacaoPixAcao(autorizacao.id, recorrenciaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    router.refresh();
  };

  const cancelar = async () => {
    if (!autorizacao) return;
    if (!confirm("Cancelar a autorização Pix Automático? O cliente precisará autorizar de novo para as próximas cobranças automáticas.")) return;
    setOcupado(true);
    setErro(null);
    const r = await cancelarAutorizacaoPixAcao(autorizacao.id, recorrenciaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    setAutorizacao(null);
    setQr(null);
    router.refresh();
  };

  const copiar = async () => {
    if (!qr?.payload) return;
    try {
      await navigator.clipboard.writeText(qr.payload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard — sem problema, o payload já está visível pra copiar manualmente.
    }
  };

  // Nenhuma autorização ainda — tela "Antes".
  if (!autorizacao) {
    return (
      <section className={cs.cartao} data-tom="neutro">
        <div>
          <h3 className={cs.titulo}>Autorizar cobrança automática (Pix Automático)</h3>
          <p className={cs.detalhe}>
            {formatarCentavos(valorCentavos)}/mês · vencimento todo dia {diaVencimento}. O cliente fará o primeiro
            pagamento e autorizará as próximas cobranças automaticamente.
          </p>
          {erro && <p className={cs.erro}>{erro}</p>}
          <button type="button" className={s.botao} onClick={solicitar} disabled={ocupado}>
            {ocupado ? "Gerando…" : "Gerar autorização"}
          </button>
        </div>
      </section>
    );
  }

  const texto = TEXTO_ESTADO[autorizacao.status];

  return (
    <section className={cs.cartao} data-tom={texto.tom}>
      <span className={cs.selo} aria-hidden="true" />
      <div className={cs.corpo}>
        <h3 className={cs.titulo}>{texto.titulo}</h3>

        {autorizacao.status === "CREATED" && (
          <>
            <p className={cs.detalhe}>
              O cliente precisa concluir o primeiro pagamento e autorizar as próximas cobranças.
            </p>
            {qr?.payload && (
              <div className={cs.qrBloco}>
                {qr.encodedImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${qr.encodedImage}`}
                    alt="QR Code Pix para o primeiro pagamento"
                    className={cs.qrImagem}
                  />
                )}
                <button type="button" className={s.botaoSec} onClick={copiar}>
                  {copiado ? "Copiado!" : "Copiar código Pix"}
                </button>
              </div>
            )}
            {erro && <p className={cs.erro}>{erro}</p>}
            <div className={s.acoes}>
              <button type="button" className={s.botaoSec} onClick={verificar} disabled={ocupado}>
                {ocupado ? "Verificando…" : "Verificar status agora"}
              </button>
              <button type="button" className={s.botaoSec} onClick={cancelar} disabled={ocupado}>
                Cancelar autorização
              </button>
            </div>
          </>
        )}

        {autorizacao.status === "ACTIVE" && (
          <>
            <p className={cs.detalhe}>
              {formatarCentavos(valorCentavos)}/mês · próxima cobrança gerada automaticamente pela recorrência.
            </p>
            {erro && <p className={cs.erro}>{erro}</p>}
            <button type="button" className={s.botaoSec} onClick={cancelar} disabled={ocupado}>
              {ocupado ? "Cancelando…" : "Cancelar autorização"}
            </button>
          </>
        )}

        {autorizacao.status === "REFUSED" && (
          <p className={cs.detalhe}>
            O cliente não concluiu o primeiro pagamento a tempo. Gere uma nova autorização quando quiser tentar de
            novo.
          </p>
        )}

        {autorizacao.status === "EXPIRED" && (
          <p className={cs.detalhe}>O prazo desta autorização acabou. Gere uma nova autorização para continuar.</p>
        )}

        {autorizacao.status === "CANCELLED" && (
          <p className={cs.detalhe}>Esta autorização foi cancelada. Gere uma nova quando quiser reativar o Pix Automático.</p>
        )}

        {(autorizacao.status === "REFUSED" || autorizacao.status === "EXPIRED" || autorizacao.status === "CANCELLED") && (
          <button
            type="button"
            className={s.botao}
            onClick={() => {
              setAutorizacao(null);
              setQr(null);
            }}
          >
            Gerar nova autorização
          </button>
        )}
      </div>
    </section>
  );
}
