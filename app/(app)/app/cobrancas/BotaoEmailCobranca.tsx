"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviarCobrancaPorEmail } from "./acoesEnvio";
import s from "../../App.module.css";
import e from "./Envio.module.css";

export type EstadoEmail = "disponivel" | "sem_email" | "nao_configurado";

type ResultadoSimples = { ok: boolean; mensagem: string };

/**
 * "Enviar por e-mail" — um clique manda o e-mail ao cliente com o link de
 * pagamento. O envio é decidido e feito no servidor; aqui só se mostra o
 * resultado. Quando o e-mail não está disponível, o motivo aparece escrito em
 * vez de o botão sumir ("não esconda o problema").
 */
export default function BotaoEmailCobranca({
  cobrancaId,
  estado,
  clienteId,
  aoEnviar,
}: {
  /** identifica o botão (ids de acessibilidade); também é a cobrança do envio padrão */
  cobrancaId: string;
  estado: EstadoEmail;
  clienteId?: string;
  /** envio alternativo (ex.: o e-mail da autorização de uma recorrência). Padrão: e-mail da cobrança */
  aoEnviar?: () => Promise<ResultadoSimples>;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const enviar = async () => {
    setEnviando(true);
    setResultado(null);
    const r = await (aoEnviar ? aoEnviar() : enviarCobrancaPorEmail(cobrancaId));
    setEnviando(false);
    setResultado({ ok: r.ok, mensagem: r.mensagem });
    if (r.ok) router.refresh();
  };

  const indisponivel = estado !== "disponivel";

  return (
    <span className={e.emailBloco}>
      <button type="button" className={s.botaoSec} onClick={enviar} disabled={enviando || indisponivel} aria-describedby={`email-status-${cobrancaId}`}>
        {enviando ? "Enviando…" : "Enviar por e-mail"}
      </button>
      <span
        id={`email-status-${cobrancaId}`}
        className={`${e.emailStatus} ${resultado?.ok ? e.emailOk : resultado ? e.emailErro : ""}`}
        role="status"
        aria-live="polite"
      >
        {resultado
          ? resultado.mensagem
          : estado === "nao_configurado"
            ? "E-mail ainda não configurado."
            : estado === "sem_email"
              ? "Cliente sem e-mail cadastrado."
              : ""}
      </span>
      {estado === "sem_email" && clienteId && (
        <a className={s.linkTabela} href={`/app/clientes/${clienteId}/editar`}>
          Adicionar e-mail
        </a>
      )}
    </span>
  );
}
