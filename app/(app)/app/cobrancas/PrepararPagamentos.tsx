"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { prepararPagamentosPendentes } from "./acoesEnvio";
import { useToast } from "../Feedback";
import s from "../../App.module.css";
import e from "./Envio.module.css";

/**
 * "Preparar pagamentos": ação EXPLÍCITA da pessoa para as cobranças que ficaram
 * salvas sem link (por exemplo, criadas antes de a conta de recebimentos estar
 * pronta). Usa o mesmo preparo idempotente de sempre — não duplica nada — e
 * mostra o resultado real, com a causa quando falha.
 */
export default function PrepararPagamentos({ quantidade }: { quantidade: number }) {
  const router = useRouter();
  const toast = useToast();
  const [trabalhando, setTrabalhando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string; acao?: { rotulo: string; href: string } | null } | null>(null);

  const preparar = async () => {
    setTrabalhando(true);
    setResultado(null);
    try {
      const r = await prepararPagamentosPendentes();
      setResultado(r);
      if (r.ok && r.preparadas > 0) toast.sucesso(r.mensagem);
      router.refresh();
    } catch {
      setResultado({ ok: false, mensagem: "Não conseguimos acessar o serviço de pagamentos agora. Tente novamente em instantes." });
    } finally {
      setTrabalhando(false);
    }
  };

  return (
    <div className={e.preparoLote}>
      <button type="button" className={s.botao} onClick={preparar} disabled={trabalhando} aria-busy={trabalhando}>
        {trabalhando ? "Preparando…" : quantidade > 1 ? `Preparar ${quantidade} pagamentos` : "Preparar pagamento"}
      </button>
      {resultado && (
        <p role={resultado.ok ? "status" : "alert"} className={resultado.ok ? e.nota : s.erroCampo}>
          {resultado.mensagem}{" "}
          {resultado.acao && (
            <Link href={resultado.acao.href} className={s.linkTabela}>
              {resultado.acao.rotulo}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
