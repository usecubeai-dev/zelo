"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { atualizarStatusAutorizacaoPublicaAcao } from "./acoes";
import type { AutorizacaoPublica } from "@/lib/core/autorizacao-pix";
import { formatarCentavos } from "@/lib/dinheiro";
import { track, EVENTOS } from "@/lib/analytics";
import { CTA_HREF } from "@/lib/cta";
import s from "../Autorizar.module.css";

const TEXTO_ESTADO: Record<AutorizacaoPublica["status"], { titulo: string; tom: "atencao" | "sucesso" | "erro" }> = {
  CREATED: { titulo: "Autorize o pagamento automático", tom: "atencao" },
  ACTIVE: { titulo: "Autorização concluída", tom: "sucesso" },
  REFUSED: { titulo: "Este link não está mais disponível", tom: "erro" },
  CANCELLED: { titulo: "Este link não está mais disponível", tom: "erro" },
  EXPIRED: { titulo: "Este link não está mais disponível", tom: "erro" },
};

export default function AutorizarCliente({
  autorizacaoId,
  dado,
}: {
  autorizacaoId: string;
  dado: AutorizacaoPublica;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(dado.status);
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const texto = TEXTO_ESTADO[status];

  const copiar = async () => {
    if (!dado.payload) return;
    setErroCopia(false);
    try {
      await navigator.clipboard.writeText(dado.payload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard — mostra o código em texto pra copiar na mão.
      setErroCopia(true);
    }
  };

  const atualizar = async () => {
    setAtualizando(true);
    setErro(null);
    const r = await atualizarStatusAutorizacaoPublicaAcao(autorizacaoId);
    setAtualizando(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    setStatus(r.status);
    router.refresh();
  };

  return (
    <section className={s.cartao} data-tom={texto.tom} aria-live="polite">
      <h1 className={s.titulo}>{texto.titulo}</h1>
      <p className={s.contexto}>Cobrança de {dado.empresaNome}</p>

      {status === "CREATED" && (
        <>
          <p className={s.texto}>
            {dado.descricao} — feche o primeiro pagamento abaixo pelo app do seu banco para autorizar as próximas
            cobranças automaticamente. Depois disso você não precisa fazer mais nada todo mês.
          </p>

          <div className={s.valor}>
            <span className={s.valorNumero}>{formatarCentavos(dado.valorCentavos)}</span>
            <span className={s.valorLegenda}>por mês · vencimento todo dia {dado.diaVencimento}</span>
          </div>

          {dado.encodedImage || dado.payload ? (
            <div className={s.qrBloco}>
              {dado.encodedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${dado.encodedImage}`}
                  alt="QR Code Pix para o primeiro pagamento"
                  className={s.qrImagem}
                />
              )}
              <p className={s.qrAjuda}>Abra o app do seu banco, escolha pagar com Pix e escaneie o código.</p>
              {dado.payload && (
                <button type="button" className={s.botaoSec} onClick={copiar}>
                  {copiado ? "Copiado!" : "Copiar código Pix"}
                </button>
              )}
              {erroCopia && dado.payload && (
                <input
                  type="text"
                  readOnly
                  value={dado.payload}
                  aria-label="Código Pix copia-e-cola"
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "0.78rem",
                    borderRadius: 6,
                    border: "1px solid var(--border-strong)",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                  }}
                />
              )}
            </div>
          ) : (
            <p className={s.texto}>Não foi possível carregar o código agora. Toque em atualizar para tentar de novo.</p>
          )}

          {erro && <p className={s.erro}>{erro}</p>}

          <div className={s.acoes}>
            <button type="button" className={s.botaoSec} onClick={atualizar} disabled={atualizando}>
              {atualizando ? "Verificando…" : "Já paguei, atualizar"}
            </button>
          </div>
        </>
      )}

      {status === "ACTIVE" && (
        <>
          <p className={s.texto}>
            Tudo certo — a partir de agora, a cobrança de {formatarCentavos(dado.valorCentavos)}/mês para{" "}
            {dado.empresaNome} é feita automaticamente, todo dia {dado.diaVencimento}. Você não precisa fazer mais nada.
          </p>

          {/* Fase 23 — CTA de aquisição, só depois da confirmação de
              sucesso (nunca antes, nunca atrapalha o fluxo de pagamento).
              Não revela nada do profissional/cliente além do que a tela
              já mostrava acima. */}
          <div className={s.ctaAquisicao}>
            <p className={s.ctaAquisicaoTexto}>Quer oferecer cobrança recorrente para os seus próprios clientes?</p>
            <a
              href={CTA_HREF}
              className={s.ctaAquisicaoLink}
              onClick={() => track(EVENTOS.authorizationCtaClick)}
            >
              Conheça o Zelo →
            </a>
          </div>
        </>
      )}

      {(status === "REFUSED" || status === "CANCELLED" || status === "EXPIRED") && (
        <p className={s.texto}>Peça um novo link de autorização a {dado.empresaNome}.</p>
      )}

      <p className={s.rodape}>Pagamento processado com segurança pelo parceiro financeiro do Zelo.</p>
    </section>
  );
}
