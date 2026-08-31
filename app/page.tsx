import Stage from "@/components/Stage";
import SmoothScroll from "@/components/SmoothScroll";
import JourneyProgress from "@/components/JourneyProgress";
import SiteHeader from "@/components/SiteHeader";
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

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <SiteHeader />
      <JourneyProgress />
      <main>
        <h1 className="sr-only">
          Zelo — pare de cobrar, comece a receber. Cobranças recorrentes
          automáticas via Pix Automático.
        </h1>
        <Stage />
        {/* ---------------- jornada comercial, fora da cena pinada ----------------
            Cada seção responde uma pergunta diferente do funil:
            problema → solução → como → transformação → ganho → serve pra mim
            → quanto custa → posso confiar → dúvidas → como começo. */}
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
