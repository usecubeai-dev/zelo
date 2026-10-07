"use client";

import { useEffect, useState } from "react";
import s from "../../App.module.css";
import e from "./Envio.module.css";

const CHAVE = "zelo_guia_cobranca_v1";

/**
 * Guia curto, só na primeira vez: os quatro passos de uma cobrança. Não é um
 * tutorial, não bloqueia nada e some com "Entendi" (a escolha fica só neste
 * navegador). Se o armazenamento do navegador estiver bloqueado, o guia
 * simplesmente continua aparecendo — nunca quebra a tela.
 */
export default function GuiaPrimeiraCobranca() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE) !== "1") setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  if (!visivel) return null;

  const entendi = () => {
    setVisivel(false);
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento: o guia só volta na próxima visita */
    }
  };

  return (
    <aside className={e.guia} aria-label="Como funciona uma cobrança">
      <p className={e.guiaTitulo}>Sua primeira cobrança, em 4 passos</p>
      <ol className={e.guiaLista}>
        <li>
          <strong>Escolha o cliente</strong>
        </li>
        <li>
          <strong>Informe valor e vencimento</strong>
        </li>
        <li>
          <strong>Envie para o cliente</strong> (WhatsApp, link ou e-mail)
        </li>
        <li>
          <strong>Acompanhe o pagamento</strong>
        </li>
      </ol>
      <button type="button" className={s.botaoSec} onClick={entendi}>
        Entendi
      </button>
    </aside>
  );
}
