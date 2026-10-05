"use client";

import { useEffect, useRef, useState } from "react";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

/**
 * Copia um texto para a área de transferência e avisa que copiou.
 *
 * `navigator.clipboard` só existe em contexto seguro (https/localhost); no
 * resto cai no `execCommand`, para o botão nunca ficar mudo. O aviso vai
 * num `aria-live` — quem usa leitor de tela ouve "Copiado" sem perder o
 * foco do botão.
 */
export default function BotaoCopiar({
  texto,
  rotulo = "Copiar link",
  rotuloCopiado = "Link copiado",
  aria,
}: {
  texto: string;
  rotulo?: string;
  rotuloCopiado?: string;
  /** rótulo acessível mais específico (ex.: "Copiar link de Fulano") */
  aria?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copiar = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = texto;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand("copy");
        document.body.removeChild(area);
      } catch {
        ok = false;
      }
    }
    setCopiado(ok);
    setFalhou(!ok);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopiado(false);
      setFalhou(false);
    }, 2200);
  };

  return (
    <>
      <button type="button" className={`${s.botaoSec} ${a.botaoCompacto}`} onClick={copiar} aria-label={aria ?? rotulo}>
        {copiado ? "Copiado ✓" : rotulo}
      </button>
      <span className={s.somenteLeitor} role="status" aria-live="polite">
        {copiado ? rotuloCopiado : falhou ? "Não foi possível copiar" : ""}
      </span>
    </>
  );
}
