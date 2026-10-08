import type { ReactNode } from "react";
import s from "../App.module.css";

/**
 * Cabeçalho de página: título, apoio e a AÇÃO PRINCIPAL à direita. Todas as
 * listas usam este mesmo cabeçalho — cada página não inventa o seu.
 */
export default function PageHeader({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className={s.cabecalho}>
      <div className={s.cabecalhoLinha}>
        <div>
          <h1 className={s.titulo}>{titulo}</h1>
          {subtitulo && <p className={s.subtitulo}>{subtitulo}</p>}
        </div>
        {acoes && <div className={s.cabecalhoAcoes}>{acoes}</div>}
      </div>
    </header>
  );
}
