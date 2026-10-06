"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BotaoWhatsapp from "./[id]/BotaoWhatsapp";
import BotaoCopiarLink from "./BotaoCopiarLink";
import { marcarComoNegociada, reabrirNegociacao } from "./acoesRecuperacao";
import s from "../../App.module.css";
import c from "../Recuperacao.module.css";

type Props = {
  cobrancaId: string;
  /** link `wa.me` pronto, ou `null` quando falta telefone/link */
  whatsappHref: string | null;
  /** por que o WhatsApp não está disponível (só quando `whatsappHref` é null) */
  semTelefone?: boolean;
  semLink?: boolean;
  clienteId?: string;
  /** link público de pagamento válido, ou `null` */
  link: string | null;
  /** regra de lembrete (fila "lembretes de hoje") */
  regra?: string;
  negociada: boolean;
  /** texto do botão que abre as opções */
  rotulo?: string;
  local?: string;
  /** canal preferido da empresa: com "link", copiar o link vem primeiro */
  canal?: "whatsapp" | "link";
};

/**
 * "Recuperar cobrança": abre as opções — WhatsApp, copiar link, abrir a
 * cobrança, marcar como negociada. NADA é enviado sozinho: o WhatsApp só
 * abre com a mensagem pronta e quem aperta Enviar é o profissional.
 */
export default function PainelRecuperar({
  cobrancaId,
  whatsappHref,
  semTelefone,
  semLink,
  clienteId,
  link,
  regra,
  negociada,
  rotulo = "Recuperar cobrança",
  local = "central-atraso",
  canal = "whatsapp",
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idPainel = `recuperar-${cobrancaId}`;

  const alternarNegociacao = async () => {
    setOcupado(true);
    setErro(null);
    const r = negociada ? await reabrirNegociacao(cobrancaId) : await marcarComoNegociada(cobrancaId);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    router.refresh();
  };

  return (
    <div className={c.painel}>
      <button
        type="button"
        className={s.botao}
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((v) => !v)}
      >
        {rotulo}
      </button>

      {aberto && (
        <div id={idPainel} className={c.painelAberto} role="group" aria-label="Opções para recuperar esta cobrança">
          <div className={c.painelOpcoes} style={canal === "link" ? { flexDirection: "row" } : undefined}>
            {canal === "link" && link && <BotaoCopiarLink href={link} cobrancaId={cobrancaId} regra={regra} />}
            {whatsappHref ? (
              <BotaoWhatsapp href={whatsappHref} cobrancaId={cobrancaId} regra={regra} local={local} />
            ) : (
              <p className={c.nota}>
                {semTelefone && "Este cliente não tem um WhatsApp válido cadastrado. "}
                {semLink && "A cobrança ainda não tem link de pagamento. "}
                {semTelefone && clienteId && (
                  <Link href={`/app/clientes/${clienteId}/editar`} className={s.linkTabela}>
                    Corrigir o cadastro
                  </Link>
                )}
              </p>
            )}
            {canal !== "link" && link && <BotaoCopiarLink href={link} cobrancaId={cobrancaId} regra={regra} />}
            <Link href={`/app/cobrancas/${cobrancaId}`} className={s.botaoSec}>
              Abrir cobrança
            </Link>
            <button type="button" className={s.botaoSec} disabled={ocupado} onClick={alternarNegociacao}>
              {negociada ? "Reabrir (não está mais negociada)" : "Marcar como negociada"}
            </button>
          </div>
          {erro && (
            <p role="alert" className={s.erroCampo}>
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
