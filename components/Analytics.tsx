"use client";

import { useEffect } from "react";
import Script from "next/script";
import { EVENTOS, track, type Evento } from "@/lib/analytics";
import { CTA_HREF } from "@/lib/cta";

/**
 * Google Analytics + Microsoft Clarity, ambos opcionais.
 *
 * Sem a variável de ambiente correspondente, o <Script> nem é renderizado —
 * zero requisição, zero custo de performance, build não quebra. Nenhuma
 * dependência npm: `next/script` já faz o carregamento diferido.
 *
 * Os cliques de CTA são capturados por UM listener delegado no documento,
 * lendo `data-evt`. Isso evita espalhar onClick por componentes — inclusive
 * pelos que estão congelados.
 */
export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const origem = e.target as HTMLElement | null;
      const alvo = origem?.closest<HTMLElement>("[data-evt]");
      if (alvo) {
        const evento = alvo.dataset.evt as Evento | undefined;
        if (!evento) return;
        track(evento, { local: alvo.dataset.evtLocal ?? "desconhecido" });
        return;
      }

      /* Os CTAs do hero e do capítulo 5 vivem em Stage.tsx e StaticStory.tsx,
         que são congelados e por isso não podem receber `data-evt`. Sem este
         atalho, o primeiro e mais visível CTA da página não aparecia em
         nenhum relatório. Reconhecemos pelo destino, não pelo atributo. */
      const link = origem?.closest<HTMLAnchorElement>("a[href]");
      /* link dentro de <nav> é navegação, não CTA: sem esta guarda, os itens
         "Como funciona" do header e do rodapé inflariam o cta_demo */
      if (!link || link.closest("nav")) return;

      const destino = link.getAttribute("href");
      if (destino === CTA_HREF || destino === "#comecar") {
        track(EVENTOS.ctaStart, { local: "cena" });
      } else if (destino === "#como-funciona") {
        track(EVENTOS.ctaDemo, { local: "cena" });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('js',new Date());
gtag('config','${gaId}');`}
          </Script>
        </>
      )}

      {clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  );
}

/** Reexportado para quem for instrumentar o cadastro quando ele existir. */
export { EVENTOS, track };
