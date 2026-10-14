"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BotaoWhatsapp from "./[id]/BotaoWhatsapp";
import BotaoCopiarLink from "./BotaoCopiarLink";
import BotaoEmailCobranca, { type EstadoEmail } from "./BotaoEmailCobranca";
import { prepararPagamentoDaCobranca } from "./acoesEnvio";
import type { AvisoRecebimentos } from "@/lib/core/recebimentos";
import s from "../../App.module.css";
import e from "./Envio.module.css";

/**
 * - `ok`: há link de pagamento — as formas de enviar aparecem.
 * - `sem_pagamento`: a cobrança está salva no Zelo, mas o pagamento ainda não foi preparado.
 * - `preparando`: o pagamento existe, mas o link ainda não pôde ser lido.
 * - `leitura_falhou`: não deu para falar com o serviço de pagamentos agora.
 */
export type EstadoLink = "ok" | "sem_pagamento" | "preparando" | "leitura_falhou";

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
  /** o que a conta de recebimentos permite agora (vem do servidor) */
  conta: AvisoRecebimentos;
  /** a última tentativa de preparar este pagamento falhou (não tentamos de novo sozinhos) */
  ultimaTentativaFalhou: boolean;
};

/**
 * "Enviar para o cliente": WhatsApp (principal), copiar link e e-mail — mas SÓ
 * quando existe um link de pagamento válido. Sem link, nenhum botão de envio
 * aparece (nenhum deles poderia funcionar): a tela diz a causa real e oferece a
 * única ação que resolve — conectar/ver a conta, ou "Preparar pagamento".
 *
 * "Preparar pagamento" é idempotente no servidor (nunca cria um segundo
 * pagamento) e devolve o resultado real da tentativa. Quando a conta está
 * pronta e esta cobrança nunca foi tentada, UMA tentativa é feita ao abrir —
 * sem laço: se falhar, a pessoa vê o motivo e decide.
 */
export default function BlocoEnviar({
  cobrancaId,
  whatsappHref,
  semTelefone,
  clienteId,
  link,
  estadoLink,
  estadoEmail,
  conta,
  ultimaTentativaFalhou,
}: Props) {
  const router = useRouter();
  const [trabalhando, setTrabalhando] = useState(false);
  const [resultado, setResultado] = useState<{ mensagem: string; acao?: { rotulo: string; href: string } | null } | null>(null);
  const tentouAoAbrir = useRef(false);

  const preparar = async () => {
    setTrabalhando(true);
    setResultado(null);
    try {
      const r = await prepararPagamentoDaCobranca(cobrancaId);
      if (!r.pronto && r.mensagem) setResultado({ mensagem: r.mensagem, acao: r.acao });
      router.refresh();
    } catch {
      setResultado({ mensagem: "Não conseguimos acessar o serviço de pagamentos agora. Tente novamente em instantes." });
    } finally {
      setTrabalhando(false);
    }
  };

  const tentarAoAbrir = estadoLink === "sem_pagamento" && conta.podeGerarLink && !ultimaTentativaFalhou;
  useEffect(() => {
    if (!tentarAoAbrir || tentouAoAbrir.current) return;
    tentouAoAbrir.current = true;
    void preparar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentarAoAbrir]);

  return (
    <div className={e.envio}>
      {!link && (
        <div className={e.aviso} role="status" data-tom={estadoLink === "sem_pagamento" && !conta.podeGerarLink ? conta.tom : "neutro"}>
          {estadoLink === "sem_pagamento" && conta.podeGerarLink && (
            <>
              <strong>O pagamento ainda não foi preparado.</strong>{" "}
              {trabalhando
                ? "Preparando o pagamento…"
                : ultimaTentativaFalhou
                  ? "A última tentativa não deu certo. Tente de novo."
                  : "Prepare agora para gerar o link e poder enviar ao cliente."}
              <div className={e.avisoAcoes}>
                <button type="button" className={s.botao} onClick={preparar} disabled={trabalhando} aria-busy={trabalhando}>
                  {trabalhando ? "Preparando…" : "Preparar pagamento"}
                </button>
              </div>
            </>
          )}

          {estadoLink === "sem_pagamento" && !conta.podeGerarLink && (
            <>
              <strong>{conta.titulo}.</strong> {conta.texto} A cobrança está salva; o link de pagamento vem depois.
              <div className={e.avisoAcoes}>
                {conta.acao && (
                  <Link href={conta.acao.href} className={s.botao}>
                    {conta.acao.rotulo}
                  </Link>
                )}
                {conta.podeTentar && (
                  <button type="button" className={s.botaoSec} onClick={preparar} disabled={trabalhando} aria-busy={trabalhando}>
                    {trabalhando ? "Tentando…" : "Tentar preparar mesmo assim"}
                  </button>
                )}
              </div>
            </>
          )}

          {estadoLink === "preparando" && (
            <>
              O pagamento foi criado, mas o link ainda não está disponível. Atualize em alguns segundos.
              <div className={e.avisoAcoes}>
                <button type="button" className={s.botaoSec} onClick={preparar} disabled={trabalhando}>
                  {trabalhando ? "Atualizando…" : "Atualizar"}
                </button>
              </div>
            </>
          )}

          {estadoLink === "leitura_falhou" && (
            <>
              Não conseguimos acessar o serviço de pagamentos agora. Sua cobrança continua salva.
              <div className={e.avisoAcoes}>
                <button type="button" className={s.botaoSec} onClick={preparar} disabled={trabalhando}>
                  {trabalhando ? "Tentando…" : "Tentar de novo"}
                </button>
              </div>
            </>
          )}

          {resultado && (
            <p role="alert" className={s.erroCampo} style={{ marginTop: 8 }}>
              {resultado.mensagem}{" "}
              {resultado.acao && (
                <Link href={resultado.acao.href} className={s.linkTabela}>
                  {resultado.acao.rotulo}
                </Link>
              )}
            </p>
          )}
        </div>
      )}

      {/* Cliente sem WhatsApp válido: o aviso vale com ou sem link — é um problema do cadastro, não do pagamento */}
      {!whatsappHref && semTelefone && (
        <p className={e.nota}>
          Este cliente não tem um WhatsApp válido cadastrado.{" "}
          <Link href={`/app/clientes/${clienteId}/editar`} className={s.linkTabela}>
            Corrigir o cadastro do cliente
          </Link>
        </p>
      )}

      {/* Com link: as três formas de enviar. Sem link, nenhuma delas poderia funcionar — não aparecem. */}
      {link && (
        <>
          {whatsappHref && (
            <div className={e.envioPrincipal}>
              <BotaoWhatsapp href={whatsappHref} cobrancaId={cobrancaId} local="enviar-para-cliente" grande />
            </div>
          )}

          <div className={e.envioSecundarias}>
            <BotaoCopiarLink href={link} cobrancaId={cobrancaId} />
            <BotaoEmailCobranca cobrancaId={cobrancaId} estado={estadoEmail} clienteId={clienteId} />
          </div>
        </>
      )}
    </div>
  );
}
