"use client";

import { useEffect, useRef, useState } from "react";
import { registrarAcaoCobranca } from "./acoesRecuperacao";
import c from "../Recuperacao.module.css";

/**
 * "Copiar link" — copia o link público de pagamento que já existe. NÃO cria
 * cobrança nem muda nada: só põe o texto na área de transferência (para colar
 * no WhatsApp, Instagram, Telegram, e-mail…) e deixa um registro leve.
 */
export default function BotaoCopiarLink({ href, cobrancaId, regra }: { href: string; cobrancaId?: string; regra?: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  const copiar = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(href);
      ok = true;
    } catch {
      // alguns navegadores/ambientes bloqueiam a API: tenta o caminho antigo
      try {
        const area = document.createElement("textarea");
        area.value = href;
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
    setEstado(ok ? "copiado" : "falhou");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("parado"), 4000);
    if (ok && cobrancaId) void registrarAcaoCobranca(cobrancaId, "link_copiado", regra ?? null).catch(() => {});
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      <button type="button" className={c.copiar} onClick={copiar}>
        Copiar link
      </button>
      <span className={`${c.status} ${estado === "copiado" ? c.statusOk : ""}`} role="status" aria-live="polite">
        {estado === "copiado" ? "Link copiado." : estado === "falhou" ? "Não consegui copiar. Selecione o link e copie na mão." : ""}
      </span>
    </span>
  );
}
