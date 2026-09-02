"use client";

import { useRouter } from "next/navigation";
import { marcarNotificacaoLidaAcao } from "./acoes";
import s from "../../App.module.css";

type Props = {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: "baixa" | "media" | "alta";
  lida: boolean;
  link: string | null;
  quando: string;
};

const CLASSE_PRIORIDADE: Record<Props["prioridade"], string> = {
  baixa: s.sitPendente,
  media: s.sitVencida,
  alta: s.sitEstornada,
};

/**
 * Uma notificação — clicar marca como lida (se ainda não estava) e
 * navega pro contexto (`link`), quando existir. Mesmo padrão de
 * Server Action + client component já usado em `AcoesCobranca.tsx`.
 */
export default function NotificacaoItem({ id, titulo, mensagem, prioridade, lida, link, quando }: Props) {
  const router = useRouter();

  const abrir = async () => {
    if (!lida) await marcarNotificacaoLidaAcao(id);
    if (link) router.push(link);
    else router.refresh();
  };

  return (
    <button
      type="button"
      onClick={abrir}
      className={s.notificacaoItem}
      data-lida={lida ? "true" : "false"}
      aria-label={lida ? titulo : `${titulo} (não lida)`}
    >
      {!lida && <span className={s.notificacaoPonto} aria-hidden="true" />}
      <span className={s.notificacaoCorpo}>
        <span className={s.notificacaoTopo}>
          <span className={s.notificacaoTitulo}>{titulo}</span>
          <span className={`${s.etiqueta} ${CLASSE_PRIORIDADE[prioridade]}`}>{prioridade}</span>
        </span>
        <span className={s.notificacaoMensagem}>{mensagem}</span>
        <span className={s.atividadeQuando}>{quando}</span>
      </span>
    </button>
  );
}
