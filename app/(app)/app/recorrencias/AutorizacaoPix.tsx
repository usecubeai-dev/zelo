"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  solicitarAutorizacaoPixAcao,
  sincronizarAutorizacaoPixAcao,
  cancelarAutorizacaoPixAcao,
} from "./acoes";
import type { AutorizacaoPix as AutorizacaoPixTipo, StatusAutorizacao } from "@/lib/core/autorizacao";
import { formatarCentavos } from "@/lib/dinheiro";
import { track, EVENTOS } from "@/lib/analytics";
import s from "../../App.module.css";
import cs from "./AutorizacaoPix.module.css";

type Props = {
  recorrenciaId: string;
  valorCentavos: number;
  diaVencimento: number;
  autorizacaoInicial: AutorizacaoPixTipo | null;
  /** Fase 21: `true` quando o Asaas já confirmou que esta conta está
      inelegível para Pix Automático agora — calculado no servidor
      (`lib/core/elegibilidade-pix.ts`), nunca aqui. */
  pixAutomaticoIndisponivel?: boolean;
};

const TEXTO_ESTADO: Record<StatusAutorizacao, { titulo: string; tom: "neutro" | "atencao" | "sucesso" | "erro" }> = {
  CREATED: { titulo: "Aguardando autorização", tom: "atencao" },
  ACTIVE: { titulo: "Pix Automático ativo", tom: "sucesso" },
  REFUSED: { titulo: "Autorização recusada", tom: "erro" },
  CANCELLED: { titulo: "Autorização cancelada", tom: "neutro" },
  EXPIRED: { titulo: "Autorização expirada", tom: "erro" },
};

export default function AutorizacaoPix({
  recorrenciaId,
  valorCentavos,
  diaVencimento,
  autorizacaoInicial,
  pixAutomaticoIndisponivel = false,
}: Props) {
  const router = useRouter();
  const [autorizacao, setAutorizacao] = useState(autorizacaoInicial);
  const [qr, setQr] = useState<{ payload: string | null; encodedImage: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [linkTexto, setLinkTexto] = useState("");
  const [erroLink, setErroLink] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const jaContouAtiva = useRef(false);

  /* Dispara uma vez por sessão de componente quando o status chega a
     ACTIVE — não por ação do usuário aqui (a ativação vem do webhook,
     depois do cliente autorizar do lado dele), mas é a primeira vez que
     ESTA tela sabe disso, o que é o que a métrica quer capturar. Guard
     por ref: sem ele, todo re-render com status ACTIVE dispararia de
     novo o mesmo evento. */
  useEffect(() => {
    if (autorizacao?.status === "ACTIVE" && !jaContouAtiva.current) {
      jaContouAtiva.current = true;
      track(EVENTOS.pixAuthorizationCompleted);
    }
  }, [autorizacao?.status]);

  /* Calculado no cliente (depende de `window.location.origin`) e mostrado
     sempre visível — não confiar só no botão de copiar: o navegador pode
     negar a permissão de clipboard (aconteceu neste mesmo ambiente ao
     testar), e sem um texto pra selecionar manualmente o profissional
     ficaria sem nenhuma forma de obter o link. */
  useEffect(() => {
    if (autorizacao) {
      setLinkTexto(`${window.location.origin}/autorizar/${autorizacao.id}`);
    }
  }, [autorizacao?.id]);

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
    track(EVENTOS.pixAuthorizationStarted);
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
    /* Quando o status não muda (cliente ainda não autorizou), `router.refresh()`
       sozinho não dá nenhum sinal de que o clique funcionou — a tela fica
       visualmente idêntica. `verificado` cobre esse caso específico. */
    setVerificado(true);
    setTimeout(() => setVerificado(false), 2500);
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

  const copiarLink = async () => {
    if (!linkTexto) return;
    setErroLink(false);
    try {
      await navigator.clipboard.writeText(linkTexto);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard: o campo com o link continua visível
      // logo abaixo do botão pra selecionar e copiar manualmente.
      setErroLink(true);
    }
  };

  // Nenhuma autorização ainda, e o Asaas já confirmou que esta conta não
  // pode usar Pix Automático agora — Fase 21, "UX do fallback": nunca
  // mostra o botão nesse caso (evita a pessoa gerar QR/link pra um
  // caminho que a própria conta não pode concluir), nunca menciona Asaas,
  // endpoint ou código de erro.
  if (!autorizacao && pixAutomaticoIndisponivel) {
    return (
      <section className={s.cartaoSelo} data-tom="atencao">
        <div>
          <h3 className={s.cartaoTitulo}>Seu Pix Automático não está disponível no momento.</h3>
          <p className={s.cartaoDetalhe}>
            Você ainda pode continuar cobrando seus clientes usando Pix comum, com lembretes automáticos — crie uma
            cobrança avulsa normalmente. Vamos avisar quando o Pix Automático estiver disponível novamente.
          </p>
        </div>
      </section>
    );
  }

  // Nenhuma autorização ainda — tela "Antes".
  if (!autorizacao) {
    return (
      <section className={s.cartaoSelo} data-tom="neutro">
        <div>
          <h3 className={s.cartaoTitulo}>Autorizar cobrança automática (Pix Automático)</h3>
          <p className={s.cartaoDetalhe}>
            {formatarCentavos(valorCentavos)}/mês · vencimento todo dia {diaVencimento}. O cliente fará o primeiro
            pagamento e autorizará as próximas cobranças automaticamente.
          </p>
          {erro && <p className={s.cartaoErro}>{erro}</p>}
          <button type="button" className={s.botao} onClick={solicitar} disabled={ocupado}>
            {ocupado ? "Gerando…" : "Gerar autorização"}
          </button>
        </div>
      </section>
    );
  }

  const texto = TEXTO_ESTADO[autorizacao.status];

  return (
    <section className={s.cartaoSelo} data-tom={texto.tom}>
      <span className={s.seloLateral} aria-hidden="true" />
      <div className={s.cartaoCorpo}>
        <h3 className={s.cartaoTitulo}>{texto.titulo}</h3>

        {autorizacao.status === "CREATED" && (
          <>
            <p className={s.cartaoDetalhe}>
              Envie o link abaixo para o seu cliente. Nele, o cliente conclui o primeiro pagamento e autoriza as
              próximas cobranças automaticamente — nada disso acontece aqui no seu painel.
            </p>
            <button type="button" className={s.botao} onClick={copiarLink} disabled={!linkTexto}>
              {linkCopiado ? "Link copiado!" : "Copiar link para enviar ao cliente"}
            </button>
            {linkTexto && (
              <input
                type="text"
                readOnly
                value={linkTexto}
                aria-label="Link de autorização para o cliente"
                onFocus={(e) => e.currentTarget.select()}
                className={cs.campoLink}
              />
            )}
            {erroLink && (
              <p className={s.cartaoErro} style={{ marginTop: 4 }}>
                Não conseguimos copiar automaticamente — toque no campo acima, selecione e copie o link manualmente.
              </p>
            )}
            {qr?.payload && (
              <div className={cs.qrBloco} style={{ marginTop: 14 }}>
                <p className={s.cartaoDetalhe} style={{ margin: 0 }}>
                  Prefere mostrar o QR direto pra ele? Também funciona:
                </p>
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
            {erro && <p className={s.cartaoErro}>{erro}</p>}
            <div className={s.acoes}>
              <button type="button" className={s.botaoSec} onClick={verificar} disabled={ocupado}>
                {ocupado ? "Verificando…" : "Verificar status agora"}
              </button>
              <button type="button" className={s.botaoSec} onClick={cancelar} disabled={ocupado}>
                Cancelar autorização
              </button>
            </div>
            <p className={s.cartaoConfirmacao} role="status" aria-live="polite" hidden={!verificado}>
              {verificado ? "Verificado agora — sem mudança no status." : ""}
            </p>
          </>
        )}

        {autorizacao.status === "ACTIVE" && (
          <>
            <p className={s.cartaoDetalhe}>
              {formatarCentavos(valorCentavos)}/mês · próxima cobrança gerada automaticamente pela recorrência.
            </p>
            {erro && <p className={s.cartaoErro}>{erro}</p>}
            <button type="button" className={s.botaoSec} onClick={cancelar} disabled={ocupado}>
              {ocupado ? "Cancelando…" : "Cancelar autorização"}
            </button>
          </>
        )}

        {autorizacao.status === "REFUSED" && (
          <p className={s.cartaoDetalhe}>
            O cliente não concluiu o primeiro pagamento a tempo. Gere uma nova autorização quando quiser tentar de
            novo.
          </p>
        )}

        {autorizacao.status === "EXPIRED" && (
          <p className={s.cartaoDetalhe}>O prazo desta autorização acabou. Gere uma nova autorização para continuar.</p>
        )}

        {autorizacao.status === "CANCELLED" && (
          <p className={s.cartaoDetalhe}>Esta autorização foi cancelada. Gere uma nova quando quiser reativar o Pix Automático.</p>
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
