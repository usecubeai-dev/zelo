import type { ReactNode } from "react";
import e from "./Envio.module.css";

type Props = {
  /** "padrao" (violeta), "atraso" (vermelho), "ok" (verde) ou "neutro" (cinza, sem ação) */
  tom?: "padrao" | "atraso" | "ok" | "neutro";
  titulo: string;
  texto?: string;
  children?: ReactNode;
  id?: string;
};

const CLASSE: Record<NonNullable<Props["tom"]>, string> = {
  padrao: "",
  atraso: e.passoAtraso,
  ok: e.passoOk,
  neutro: e.passoNeutro,
};

/**
 * "Próximo passo" — o padrão visual do produto: UM título dizendo o que fazer
 * agora e UMA ação principal logo abaixo. Ações secundárias e detalhes
 * técnicos ficam fora deste cartão.
 */
export default function ProximoPasso({ tom = "padrao", titulo, texto, children, id = "proximo-passo" }: Props) {
  return (
    <section className={`${e.passo} ${CLASSE[tom]}`} aria-labelledby={`${id}-titulo`}>
      <div>
        <p className={e.passoRotulo}>Próximo passo</p>
        <h2 id={`${id}-titulo`} className={e.passoTitulo}>
          {titulo}
        </h2>
        {texto && <p className={e.passoTexto}>{texto}</p>}
      </div>
      {children}
    </section>
  );
}
