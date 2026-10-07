"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BotaoWhatsapp from "../cobrancas/[id]/BotaoWhatsapp";
import BotaoCopiarLink from "../cobrancas/BotaoCopiarLink";
import BotaoEmailCobranca, { type EstadoEmail } from "../cobrancas/BotaoEmailCobranca";
import { enviarAutorizacaoPorEmail } from "./acoesEnvio";
import { sincronizarAutorizacaoPixAcao } from "./acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import { normalizarWhatsappBr, primeiroNome, urlWhatsApp } from "@/lib/whatsapp";
import s from "../../App.module.css";
import e from "../cobrancas/Envio.module.css";

type Props = {
  recorrenciaId: string;
  autorizacaoId: string;
  clienteId: string;
  nomeCliente: string;
  whatsapp: string | null;
  valorCentavos: number;
  diaVencimento: number;
  estadoEmail: EstadoEmail;
};

/**
 * "Enviar para o cliente" da cobrança automática: o cliente recebe o link, faz
 * o primeiro pagamento e autoriza as próximas cobranças. O link é montado aqui
 * (depende do endereço do site que o navegador está usando); WhatsApp, copiar
 * e e-mail são os MESMOS botões do resto do produto. Nada é enviado sozinho.
 * "Atualizar status" só PERGUNTA ao servidor — nunca marca a autorização como
 * concluída.
 */
export default function EnviarAutorizacao({ recorrenciaId, autorizacaoId, clienteId, nomeCliente, whatsapp, valorCentavos, diaVencimento, estadoEmail }: Props) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setLink(`${window.location.origin}/autorizar/${autorizacaoId}`);
  }, [autorizacaoId]);

  const numero = normalizarWhatsappBr(whatsapp);
  const mensagem = link
    ? `${primeiroNome(nomeCliente) ? `Oi ${primeiroNome(nomeCliente)}!` : "Olá!"} Autorize sua cobrança automática de ${formatarCentavos(valorCentavos).replace(/ /g, " ")} por mês (todo dia ${diaVencimento}): ${link}`
    : "";
  const whatsappHref = numero && link ? urlWhatsApp(numero, mensagem) : null;

  const atualizar = async () => {
    setVerificando(true);
    setAviso(null);
    const r = await sincronizarAutorizacaoPixAcao(autorizacaoId, recorrenciaId);
    setVerificando(false);
    setAviso(r.ok ? (r.status === "ACTIVE" ? "Autorização confirmada." : "Ainda aguardando o cliente autorizar.") : r.mensagem);
    router.refresh();
  };

  return (
    <div className={e.envio}>
      <div className={e.envioPrincipal}>
        {whatsappHref ? (
          <BotaoWhatsapp href={whatsappHref} grande local="enviar-autorizacao" />
        ) : (
          <p className={e.nota}>
            {link ? "Este cliente não tem um WhatsApp válido cadastrado. " : "Preparando o link… "}
            {link && (
              <a className={s.linkTabela} href={`/app/clientes/${clienteId}/editar`}>
                Corrigir o cadastro do cliente
              </a>
            )}
          </p>
        )}
      </div>
      <div className={e.envioSecundarias}>
        {link && <BotaoCopiarLink href={link} />}
        <BotaoEmailCobranca
          cobrancaId={autorizacaoId}
          estado={estadoEmail}
          clienteId={clienteId}
          aoEnviar={() => enviarAutorizacaoPorEmail(recorrenciaId)}
        />
      </div>
      <div className={e.envioSecundarias}>
        <button type="button" className={s.botaoSec} onClick={atualizar} disabled={verificando}>
          {verificando ? "Atualizando…" : "Atualizar status"}
        </button>
        <span className={e.nota} role="status" aria-live="polite">
          {aviso ?? "Quando o cliente autorizar, a cobrança automática fica ativa."}
        </span>
      </div>
    </div>
  );
}
