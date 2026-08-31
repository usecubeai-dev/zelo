import HeroPremium from "@/components/HeroPremium";
import SmoothScroll from "@/components/SmoothScroll";
import SiteFooter from "@/components/SiteFooter";
import CommercialProblem from "@/components/CommercialProblem";
import HowItWorks from "@/components/HowItWorks";
import Automation from "@/components/Automation";
import Benefits from "@/components/Benefits";
import WhoItsFor from "@/components/WhoItsFor";
import Pricing from "@/components/Pricing";
import Trust from "@/components/Trust";
import Faq from "@/components/Faq";
import ClosingCta from "@/components/ClosingCta";

/**
 * Hero Premium promovido a principal (31/08/2026, autorização explícita do
 * owner, ciente do trade-off): a cena antiga (`Stage.tsx`) era hero E os
 * capítulos 1–5 fundidos num timeline só de 286 beats — trocar o hero
 * significa perder os capítulos junto, não só a primeira tela. `Stage.tsx`
 * continua no repositório, intocado, e a versão anterior desta página
 * está no histórico do Git.
 *
 * `SiteHeader` saiu: o `HeroPremium` tem nav própria dentro da moldura.
 * Mantê-los juntos duplicava a navegação. Conhecido: da metade da página
 * pra baixo não há mais cabeçalho fixo — ausente também em `/preview/hero`
 * antes desta troca, e não meio de acesso a `/comecar` continua disponível
 * pela nav do hero e pelos CTAs de cada seção.
 */
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <main>
        <HeroPremium />
        {/* ---------------- jornada comercial ----------------
            Cada seção responde uma pergunta diferente do funil:
            problema → solução → como → transformação → ganho → serve pra mim
            → confio → quanto custa → dúvidas → como começo. */}
        <CommercialProblem />
        <HowItWorks />
        <Automation />
        <Benefits />
        <WhoItsFor />
        {/* Confiança antes do preço: quem ainda duvida de que a cobrança é
            segura não avalia valor, avalia risco. Invertido, o preço chegava
            antes da objeção estar respondida. */}
        <Trust />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
