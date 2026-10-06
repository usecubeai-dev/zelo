"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarAssinatura, exercerArrependimentoAction } from "./acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import { ARREPENDIMENTO_DIAS } from "@/lib/legal";
import { EMPRESA, mailtoDe } from "@/lib/company";
import a from "../../App.module.css";
import s from "../../Conformidade.module.css";

type Props = {
  /** a conta tem assinatura paga ativa (só então existe o que cancelar) */
  planoPagoAtivo: boolean;
  /** estimativa do fim do período já pago (ISO); `null` quando não dá para calcular */
  fimDoPeriodoIso: string | null;
  /** cancelamento já pedido; `acessoAteIso` null = vale a partir de agora */
  cancelamentoAgendado: { acessoAteIso: string | null } | null;
  /** contratou há menos de 7 dias e ainda não pediu reembolso */
  arrependimento: { ateIso: string; valorCentavos: number } | null;
  /** último pedido de reembolso, para mostrar o andamento */
  pedidoReembolso: { status: string; valorCentavos: number } | null;
};

type Modo = "inicio" | "cancelar" | "desistir";
type Resultado = { tipo: "cancelou"; acessoAteIso: string | null } | { tipo: "desistiu"; valorCentavos: number };

const LIMITE_MOTIVO = 500;
const FUSO = "America/Sao_Paulo";

function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
}

/**
 * Cancelamento da assinatura e direito de arrependimento.
 *
 * Tudo que a tela afirma vem do servidor (`situacaoDeCancelamento`) e a
 * decisão é do servidor: a tela só mostra o que a Server Action aceitaria.
 * Cancelar = parar a cobrança, mantendo o acesso até o fim do período pago.
 * Desistir (<= 7 dias) = plano pago termina na hora + PEDIDO de reembolso —
 * que a equipe analisa. Nunca se promete devolução automática nem imediata.
 *
 * O componente continua montado depois do `router.refresh()` (a página o
 * renderiza também quando já há cancelamento ou pedido), então o desfecho
 * não some e o foco não se perde.
 */
export default function CancelarAssinatura({
  planoPagoAtivo,
  fimDoPeriodoIso,
  cancelamentoAgendado,
  arrependimento,
  pedidoReembolso,
}: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("inicio");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const painelConfirma = useRef<HTMLDivElement>(null);
  const regiaoStatus = useRef<HTMLDivElement>(null);
  const focarStatus = useRef(false);

  /* Abrir o passo 2 leva o foco para ele: o botão que foi clicado sumiu. */
  useEffect(() => {
    if (modo !== "inicio") painelConfirma.current?.focus();
  }, [modo]);

  useEffect(() => {
    if (resultado && focarStatus.current) {
      regiaoStatus.current?.focus();
      focarStatus.current = false;
    }
  }, [resultado]);

  const abrir = (proximo: Modo) => {
    setErro(null);
    setMotivo("");
    setModo(proximo);
  };

  const confirmar = async (tipo: "cancelar" | "desistir") => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    const valorDesistencia = arrependimento?.valorCentavos ?? 0;
    try {
      const r =
        tipo === "cancelar" ? await cancelarAssinatura(motivo.trim() || undefined) : await exercerArrependimentoAction(motivo.trim() || undefined);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      focarStatus.current = true;
      setModo("inicio");
      setResultado(
        tipo === "cancelar"
          ? { tipo: "cancelou", acessoAteIso: r.acessoAte }
          : { tipo: "desistiu", valorCentavos: valorDesistencia }
      );
      /* A conta mudou no servidor: atualiza a página (faixas, uso, plano). */
      router.refresh();
    } catch {
      setErro("Não foi possível concluir agora. Tente novamente em instantes.");
    } finally {
      setOcupado(false);
    }
  };

  /* ---------- o que mostrar, em ordem ---------- */

  const cancelouAgora = resultado?.tipo === "cancelou" ? resultado : null;
  const mostrarCancelado = Boolean(cancelamentoAgendado) || cancelouAgora !== null;
  const acessoAteIso = cancelamentoAgendado ? cancelamentoAgendado.acessoAteIso : (cancelouAgora?.acessoAteIso ?? null);

  const desistiuAgora = resultado?.tipo === "desistiu" ? resultado : null;
  const pedido = pedidoReembolso ?? (desistiuAgora ? { status: "pendente", valorCentavos: desistiuAgora.valorCentavos } : null);

  const podeDesistir = !resultado && arrependimento !== null && planoPagoAtivo;
  const podeCancelar = !resultado && planoPagoAtivo && !cancelamentoAgendado;

  if (!mostrarCancelado && !pedido && !podeDesistir && !podeCancelar) return null;

  const emailSuporte = mailtoDe(EMPRESA.emailSuporte);

  return (
    <div className={s.secao}>
      {/* ---------- andamento: cancelado / pedido de reembolso ---------- */}
      {(mostrarCancelado || pedido) && (
        <div ref={regiaoStatus} tabIndex={-1} className={s.regiaoStatus} role="status" aria-live="polite">
          {mostrarCancelado && (
            <section className={`${a.bloco} ${a.blocoAviso}`} style={{ marginBottom: 16 }} aria-labelledby="cancelada-titulo">
              <h2 id="cancelada-titulo" className={s.estadoTitulo}>
                Assinatura cancelada
              </h2>
              <p className={s.secaoTexto}>
                {acessoAteIso ? (
                  <>
                    Seu acesso continua até <strong>{diaMes(acessoAteIso)}</strong>, o fim do período pago. Depois disso
                    sua conta passa ao plano Grátis.
                  </>
                ) : (
                  <>Cancelada a partir de agora. Sua conta passa ao plano Grátis.</>
                )}{" "}
                Você não será cobrado de novo e nenhum dado é apagado.
              </p>
            </section>
          )}

          {pedido && (
            <section className={a.bloco} style={{ marginBottom: 16 }} aria-labelledby="reembolso-titulo">
              <h2 id="reembolso-titulo" className={s.estadoTitulo}>
                {pedido.status === "processado"
                  ? "Reembolso solicitado ao parceiro de pagamentos"
                  : pedido.status === "recusado"
                    ? "Pedido de reembolso recusado"
                    : "Pedido de reembolso em análise"}
              </h2>
              <p className={s.secaoTexto}>
                {pedido.status === "processado" ? (
                  <>
                    O estorno de {formatarCentavos(pedido.valorCentavos)} foi solicitado ao parceiro de pagamentos. O
                    prazo para o valor aparecer depende do seu banco ou cartão.
                  </>
                ) : pedido.status === "recusado" ? (
                  <>
                    O pedido de reembolso de {formatarCentavos(pedido.valorCentavos)} foi recusado. Fale com o suporte
                    {emailSuporte ? (
                      <>
                        :{" "}
                        <a className={s.linkTexto} href={emailSuporte}>
                          {EMPRESA.emailSuporte}
                        </a>
                        .
                      </>
                    ) : (
                      "."
                    )}
                  </>
                ) : (
                  <>
                    Recebemos seu pedido de reembolso de {formatarCentavos(pedido.valorCentavos)}. Nossa equipe vai
                    analisá-lo — nenhum valor é devolvido automaticamente.
                  </>
                )}
              </p>
            </section>
          )}
        </div>
      )}

      {/* ---------- arrependimento (até 7 dias) ---------- */}
      {podeDesistir && arrependimento && (
        <section className={`${a.bloco} ${s.arrependimento}`} style={{ marginBottom: 16 }} aria-labelledby="arrependimento-titulo">
          <h2 id="arrependimento-titulo" className={s.estadoTitulo}>
            Desistir da contratação
          </h2>
          <p className={s.secaoTexto}>
            Você contratou há menos de {ARREPENDIMENTO_DIAS} dias: pode desistir e pedir o reembolso integral de{" "}
            <strong>{formatarCentavos(arrependimento.valorCentavos)}</strong> até{" "}
            <strong>{diaMes(arrependimento.ateIso)}</strong> (CDC, art. 49).
          </p>
          <ul className={s.lista}>
            <li>O plano pago termina na hora e sua conta passa ao plano Grátis.</li>
            <li>
              O reembolso é um <strong>pedido</strong>: a equipe analisa e, se for aprovado, solicita o estorno ao
              parceiro de pagamentos. Não é automático nem imediato.
            </li>
          </ul>

          {modo === "desistir" ? (
            <div ref={painelConfirma} tabIndex={-1} className={s.passoConfirma}>
              <p className={s.passoPergunta}>Desistir agora e pedir o reembolso?</p>
              <CampoMotivo id="motivo-desistir" valor={motivo} onChange={setMotivo} disabled={ocupado} />
              <Erro texto={erro} />
              <div className={s.acoesLinha}>
                <button
                  type="button"
                  className={`${a.botao} ${s.botaoGrande}`}
                  disabled={ocupado}
                  aria-busy={ocupado}
                  onClick={() => confirmar("desistir")}
                >
                  {ocupado && <span className={s.spinner} aria-hidden="true" />}
                  {ocupado ? "Enviando…" : "Confirmar desistência e pedido"}
                </button>
                <button
                  type="button"
                  className={`${a.botaoSec} ${s.botaoGrande}`}
                  disabled={ocupado}
                  onClick={() => abrir("inicio")}
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className={s.acoesLinha} style={{ marginTop: 16 }}>
              <button type="button" className={`${a.botao} ${s.botaoGrande}`} onClick={() => abrir("desistir")}>
                Desistir e pedir reembolso
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---------- cancelar assinatura ---------- */}
      {podeCancelar && (
        <section className={a.bloco} aria-labelledby="cancelar-titulo">
          <h2 id="cancelar-titulo" className={s.estadoTitulo}>
            Cancelar assinatura
          </h2>
          <p className={s.secaoTexto}>
            Você não será cobrado de novo.{" "}
            {fimDoPeriodoIso ? (
              <>
                O acesso continua até <strong>{diaMes(fimDoPeriodoIso)}</strong> (fim do período pago) e depois sua
                conta passa ao plano Grátis; nenhum dado é apagado.
              </>
            ) : (
              <>
                O acesso continua até o fim do período pago e depois sua conta passa ao plano Grátis; nenhum dado é
                apagado.
              </>
            )}
          </p>

          {modo === "cancelar" ? (
            <div ref={painelConfirma} tabIndex={-1} className={s.passoConfirma}>
              <p className={s.passoPergunta}>Cancelar a assinatura?</p>
              <CampoMotivo id="motivo-cancelar" valor={motivo} onChange={setMotivo} disabled={ocupado} />
              <Erro texto={erro} />
              <div className={s.acoesLinha}>
                <button
                  type="button"
                  className={`${a.botaoSec} ${a.botaoPerigo} ${s.botaoGrande}`}
                  disabled={ocupado}
                  aria-busy={ocupado}
                  onClick={() => confirmar("cancelar")}
                >
                  {ocupado && <span className={`${s.spinner} ${s.spinnerEscuro}`} aria-hidden="true" />}
                  {ocupado ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
                <button
                  type="button"
                  className={`${a.botaoSec} ${s.botaoGrande}`}
                  disabled={ocupado}
                  onClick={() => abrir("inicio")}
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className={s.acoesLinha} style={{ marginTop: 16 }}>
              <button
                type="button"
                className={`${a.botaoSec} ${a.botaoPerigo} ${s.botaoGrande}`}
                onClick={() => abrir("cancelar")}
              >
                Cancelar assinatura
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CampoMotivo({
  id,
  valor,
  onChange,
  disabled,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className={a.campoApp}>
      <label htmlFor={id}>
        Motivo <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opcional)</span>
      </label>
      <textarea
        id={id}
        name="motivo"
        rows={3}
        maxLength={LIMITE_MOTIVO}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 76 }}
      />
      <span className={a.dicaCampo}>Ajuda a melhorar o Zelo. Não é necessário para concluir.</span>
    </div>
  );
}

/* Região de erro sempre no DOM (e `role="alert"`): o leitor de tela anuncia
   a mensagem quando ela aparece, sem o foco sair do botão. */
function Erro({ texto }: { texto: string | null }) {
  return (
    <div className={a.erroForm} role="alert" aria-live="assertive" hidden={!texto}>
      {texto}
    </div>
  );
}
