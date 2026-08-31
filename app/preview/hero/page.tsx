import type { Metadata } from "next";
import HeroPremium from "@/components/HeroPremium";

/**
 * Vitrine do Hero novo, isolada.
 *
 * O Hero antigo — a cena presa ao scroll — continua intacto em `/`. Os dois
 * não convivem na mesma página: um substitui o outro, e essa é uma decisão
 * de produto que ainda não foi tomada. Até lá, esta rota permite avaliar o
 * novo sem desmontar o que já está aprovado.
 *
 * `noindex` porque é peça de trabalho, não página do site.
 */
export const metadata: Metadata = {
  title: "Prévia do Hero",
  robots: { index: false, follow: false },
};

export default function PreviaHero() {
  return (
    <>
      <main>
        <HeroPremium />
      </main>
    </>
  );
}
