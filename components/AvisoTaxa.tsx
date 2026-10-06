import { NOTA_TAXA, TEXTO_TAXA } from "@/lib/plano";
import s from "./AvisoTaxa.module.css";

/**
 * A taxa de recebimento e a nota que a acompanha, nas telas do produto onde
 * há preço (assinatura, checkout, cadastro). As frases vêm de `lib/plano.ts`
 * — nunca digitadas aqui — para o texto não divergir entre telas.
 *
 * `semNota`: só o valor da taxa (para colar em cada card de plano); a nota
 * aparece uma vez junto do grupo de cards.
 */
export default function AvisoTaxa({
  semNota = false,
  somenteNota = false,
  className,
}: {
  semNota?: boolean;
  somenteNota?: boolean;
  className?: string;
}) {
  const classe = [s.aviso, className].filter(Boolean).join(" ");
  return (
    <p className={classe}>
      {!somenteNota && <strong className={s.taxa}>{TEXTO_TAXA}</strong>}
      {!semNota && <span className={s.nota}>{NOTA_TAXA}</span>}
    </p>
  );
}
