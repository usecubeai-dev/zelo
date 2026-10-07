"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EstadoPagamento, TEXTO_DO_ESTADO } from "@/lib/checkout";
import { atualizarPagamentoDaAssinatura } from "../acoesPagamento";
import c from "../Checkout.module.css";

const INTERVALO_MS = 3500;
const TENTATIVAS = 12;

/**
 * Para onde a pessoa volta depois de pagar na página segura. Enquanto o
 * servidor não confirmar, a mensagem é "Estamos confirmando seu pagamento…" —
 * NUNCA "pagamento confirmado" só porque a pessoa voltou. A cada consulta o
 * servidor pergunta ao parceiro de pagamentos o estado atual.
 */
export default function RetornoPagamento() {
  const [estado, setEstado] = useState<EstadoPagamento | "sem_pagamento">("processando");
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desistiu, setDesistiu] = useState(false);
  const tentativas = useRef(0);
  const titulo = useRef<HTMLHeadingElement>(null);

  const consultar = useCallback(async () => {
    setConsultando(true);
    setErro(null);
    try {
      const r = await atualizarPagamentoDaAssinatura();
      if (!r.ok) {
        setErro("Não conseguimos atualizar agora. Tente novamente em instantes.");
        return;
      }
      setEstado(r.estado);
    } catch {
      setErro("Não conseguimos atualizar agora. Tente novamente em instantes.");
    } finally {
      setConsultando(false);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  useEffect(() => {
    if (estado !== "processando" && estado !== "aguardando") return;
    const id = setInterval(() => {
      tentativas.current += 1;
      if (tentativas.current >= TENTATIVAS) {
        clearInterval(id);
        setDesistiu(true);
        return;
      }
      consultar();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [estado, consultar]);

  useEffect(() => {
    if (estado === "pago") titulo.current?.focus();
  }, [estado]);

  if (estado === "pago") {
    return (
      <section className={c.sucesso} role="status" aria-live="polite">
        <span className={c.sucessoIcone} aria-hidden="true">
          ✓
        </span>
        <h2 ref={titulo} tabIndex={-1} className={c.sucessoTitulo}>
          {TEXTO_DO_ESTADO.pago.titulo}
        </h2>
        <p className={c.sucessoPlano}>{TEXTO_DO_ESTADO.pago.descricao}</p>
        <div className={c.sucessoAcoes}>
          <Link href="/app" className={`${c.botaoGrande} ${c.botaoSucesso}`}>
            Ir para meu painel
          </Link>
          <a className={c.linkSecundario} href="/app/assinatura">
            Ver minha assinatura
          </a>
        </div>
      </section>
    );
  }

  const texto = estado === "sem_pagamento" ? null : TEXTO_DO_ESTADO[estado === "aguardando" && !desistiu ? "processando" : estado];

  return (
    <section className={c.painel} aria-labelledby="titulo-retorno">
      <div className={c.estado} data-tom={texto?.tom ?? "neutro"} role="status" aria-live="polite">
        {!desistiu && estado !== "falhou" && <span className={c.pulso} aria-hidden="true" />}
        <div>
          <h2 id="titulo-retorno" className={c.estadoTitulo}>
            {estado === "sem_pagamento" ? "Não encontramos um pagamento em andamento" : (texto?.titulo ?? "")}
          </h2>
          <p className={c.estadoTexto}>
            {estado === "sem_pagamento"
              ? "Volte aos planos para escolher e assinar."
              : desistiu
                ? "Ainda não recebemos a confirmação. Se você já pagou, ela pode levar alguns minutos. Você pode atualizar de novo ou ver o pagamento."
                : (texto?.descricao ?? "")}
          </p>
        </div>
      </div>
      {erro && (
        <p role="alert" className={c.erro} style={{ marginTop: 10 }}>
          {erro}
        </p>
      )}
      <div className={c.acoesPagamento} style={{ marginTop: 16 }}>
        <button type="button" className={`${c.botaoGrande} ${c.botaoContorno}`} onClick={consultar} disabled={consultando}>
          {consultando ? "Atualizando…" : "Atualizar status"}
        </button>
        <Link href="/app/assinatura" className={c.linkSecundario}>
          Ver pagamento
        </Link>
      </div>
    </section>
  );
}
