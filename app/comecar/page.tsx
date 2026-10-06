import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import ComecarForm from "./ComecarForm";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { formatarCentavos } from "@/lib/dinheiro";
import { NOTA_TAXA, PRECO_POR_PLANO_CENTAVOS, TEXTO_TAXA } from "@/lib/plano";
import s from "./Comecar.module.css";

export const metadata: Metadata = {
  title: "Começar",
  description:
    "Dê o primeiro passo com a Zelo e comece a organizar suas cobranças recorrentes no Pix Automático.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/comecar" },
};

export default function Comecar() {
  return (
    <div className={s.pagina}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>
      </header>

      <main className={s.corpo}>
        <div className={s.inner}>
          <span className={s.kicker}>Começar</span>

          <h1 className={s.titulo}>Comece a receber sem precisar cobrar.</h1>

          <p className={s.lead}>
            Comece no plano Grátis, a partir de {formatarCentavos(PRECO_POR_PLANO_CENTAVOS.gratis)}, ou escolha um
            plano pago a partir de {formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)} por mês
            para organizar suas cobranças de um jeito simples para começar e preparado para crescer.
          </p>
          {/* a taxa por Pix recebido aparece junto de qualquer preço, nunca só depois */}
          <p className={s.taxa}>
            <strong>{TEXTO_TAXA}.</strong> {NOTA_TAXA}
          </p>

          {/* quem sabe se existe destino é o SERVIDOR. Passar isso como
              prop mantém o aviso do formulário verdadeiro nos dois estados —
              sem essa checagem, a frase "nada é enviado" viraria mentira no
              dia em que o banco fosse ligado. */}
          <ComecarForm destinoConfigurado={supabaseConfigurado()} />

          <div className={s.volta}>
            <Link href="/#como-funciona" className={s.btnGhost}>
              Ver como a Zelo funciona <ArrowRight />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
