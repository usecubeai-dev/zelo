"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { passoAtual, passosDoTutorial, type EntradaDoTutorial } from "@/lib/core/tutorial-cobranca";
import s from "../App.module.css";
import t from "./Tutorial.module.css";

const CHAVE = "zelo_tutorial_primeira_cobranca_v1";

/**
 * "Vamos fazer sua primeira cobrança?" — curto, dispensável e adaptado ao que a
 * conta já tem (conta de recebimentos, cliente, cobrança).
 *
 * - `cartao`: aparece como um cartão no fluxo da página (nunca por cima do
 *   formulário). "Começar" abre os 5 passos; "Agora não" dispensa — a escolha
 *   fica só neste navegador, e se o armazenamento estiver bloqueado o cartão
 *   apenas volta na próxima visita.
 * - `pagina`: a versão sempre aberta, usada na página de Ajuda (é por onde se
 *   reabre o tutorial).
 */
export default function TutorialPrimeiraCobranca({ modo, ...entrada }: EntradaDoTutorial & { modo: "cartao" | "pagina" }) {
  const [dispensado, setDispensado] = useState(false);
  const [aberto, setAberto] = useState(modo === "pagina");
  const [pronto, setPronto] = useState(modo === "pagina");

  useEffect(() => {
    if (modo === "pagina") return;
    try {
      if (window.localStorage.getItem(CHAVE) === "fechado") setDispensado(true);
    } catch {
      /* sem armazenamento: o cartão continua disponível */
    }
    setPronto(true);
  }, [modo]);

  if (!pronto || dispensado) return null;

  const passos = passosDoTutorial(entrada);
  const atual = passoAtual(passos);

  const dispensar = () => {
    setDispensado(true);
    try {
      window.localStorage.setItem(CHAVE, "fechado");
    } catch {
      /* sem armazenamento */
    }
  };

  return (
    <section className={t.cartao} aria-labelledby="tutorial-titulo" data-modo={modo}>
      <div className={t.cabeca}>
        <div>
          <h2 id="tutorial-titulo" className={t.titulo}>
            {modo === "pagina" ? "Como fazer sua primeira cobrança" : "Vamos fazer sua primeira cobrança?"}
          </h2>
          {!aberto && <p className={t.sub}>São 5 passos rápidos. Mostramos só o que falta para a sua conta.</p>}
        </div>
        {!aberto && (
          <div className={t.botoes}>
            <button type="button" className={s.botao} onClick={() => setAberto(true)}>
              Começar
            </button>
            <button type="button" className={s.botaoSec} onClick={dispensar}>
              Agora não
            </button>
          </div>
        )}
      </div>

      {aberto && (
        <>
          <ol className={t.passos}>
            {passos.map((p, i) => (
              <li key={p.id} className={t.passo} data-feito={p.feito ? "true" : "false"} data-atual={p.id === atual ? "true" : "false"}>
                <span className={t.numero} aria-hidden="true">
                  {p.feito ? "✓" : i + 1}
                </span>
                <div className={t.corpo}>
                  <strong className={t.passoTitulo}>
                    {p.titulo}
                    {p.feito && <span className={t.feito}> · feito</span>}
                  </strong>
                  <p className={t.passoTexto}>{p.texto}</p>
                  {p.id === atual && p.acao && (
                    <Link href={p.acao.href} className={s.botao}>
                      {p.acao.rotulo}
                    </Link>
                  )}
                  {p.id !== atual && !p.feito && p.acao && (
                    <Link href={p.acao.href} className={t.link}>
                      {p.acao.rotulo}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {modo === "cartao" && (
            <div className={t.rodape}>
              <button type="button" className={t.linkBotao} onClick={dispensar}>
                Fechar este guia
              </button>
              <span className={t.nota}>Você reabre quando quiser em Ajuda, no menu da sua conta.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
