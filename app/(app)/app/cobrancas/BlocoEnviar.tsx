"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BotaoWhatsapp from "./[id]/BotaoWhatsapp";
import BotaoCopiarLink from "./BotaoCopiarLink";
import BotaoEmailCobranca, { type EstadoEmail } from "./BotaoEmailCobranca";
import { prepararPagamentoDaCobranca } from "./acoesEnvio";
import s from "../../App.module.css";
import e from "./Envio.module.css";

export type EstadoLink = "ok" | "preparando" | "falhou" | "sem_conta";

type Props = {
  cobrancaId: string;
  /** link `wa.me` pronto, ou `null` */
  whatsappHref: string | null;
  semTelefone: boolean;
  clienteId: string;
  /** link público de pagamento válido, ou `null` */
  link: string | null;
  estadoLink: EstadoLink;
  estadoEmail: EstadoEmail;
};

/**
 * As três formas de enviar a cobrança ao cliente — WhatsApp (principal),
 * copiar link e e-mail — e o que fazer quando ainda não há link de pagamento.
 * Reaproveita os mesmos botões de sempre (`BotaoWhatsapp`, `BotaoCopiarLink`);
 * nada aqui envia sozinho nem muda o estado financeiro da cobrança.
 */
export default function BlocoEnviar({ cobrancaId, whatsappHref, semTelefone, clienteId, link, estadoLink, estadoEmail }: Props) {
  const router = useRouter();
  const [atualizando, setAtualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const atualizar = async () => {
    setAtualizando(true);
    setAviso(null);
    const r = await prepararPagamentoDaCobranca(cobrancaId);
    setAtualizando(false);
    if (!r.pronto && r.mensagem) setAviso(r.mensagem);
    router.refresh();
  };

  return (
    <div className={e.envio}>
      {!link && (
        <div className={e.aviso} role="status">
          {estadoLink === "sem_conta" ? (
            <>
              Para gerar o link de pagamento, conecte a sua conta de recebimentos.
              <div className={e.avisoAcoes}>
                <Link href="/app/configuracoes" className={s.botaoSec}>
                  Conectar conta de recebimentos
                </Link>
              </div>
            </>
          ) : estadoLink === "falhou" ? (
            <>
              Não conseguimos preparar o pagamento agora. Tente novamente em instantes.
              <div className={e.avisoAcoes}>
                <button type="button" className={s.botaoSec} onClick={atualizar} disabled={atualizando}>
                  {atualizando ? "Tentando…" : "Tentar de novo"}
                </button>
              </div>
            </>
          ) : (
            <>
              A cobrança foi criada, mas o link de pagamento ainda está sendo preparado. Atualize em alguns segundos.
              <div className={e.avisoAcoes}>
                <button type="button" className={s.botaoSec} onClick={atualizar} disabled={atualizando}>
                  {atualizando ? "Atualizando…" : "Atualizar"}
                </button>
              </div>
            </>
          )}
          {aviso && (
            <p role="alert" className={s.erroCampo} style={{ marginTop: 8 }}>
              {aviso}
            </p>
          )}
        </div>
      )}

      <div className={e.envioPrincipal}>
        {whatsappHref ? (
          <BotaoWhatsapp href={whatsappHref} cobrancaId={cobrancaId} local="enviar-para-cliente" grande />
        ) : (
          semTelefone && (
            <p className={e.nota}>
              Este cliente não tem um WhatsApp válido cadastrado.{" "}
              <Link href={`/app/clientes/${clienteId}/editar`} className={s.linkTabela}>
                Corrigir o cadastro do cliente
              </Link>
            </p>
          )
        )}
      </div>

      <div className={e.envioSecundarias}>
        {link ? (
          <BotaoCopiarLink href={link} cobrancaId={cobrancaId} />
        ) : (
          <span className={e.nota}>O link para copiar aparece quando o pagamento estiver pronto.</span>
        )}
        <BotaoEmailCobranca cobrancaId={cobrancaId} estado={estadoEmail} clienteId={clienteId} />
      </div>
    </div>
  );
}
