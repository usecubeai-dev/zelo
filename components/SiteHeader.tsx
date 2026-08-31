"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { irPara } from "@/lib/lenis";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import { ArrowRight } from "./icons";
import s from "./SiteHeader.module.css";

const NAV = [
  { rotulo: "Como funciona", alvo: "#como-funciona" },
  { rotulo: "Benefícios", alvo: "#beneficios" },
  { rotulo: "Preço", alvo: "#preco" },
  { rotulo: "FAQ", alvo: "#faq" },
];

export default function SiteHeader() {
  const [solido, setSolido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const sentinela = useRef<HTMLDivElement>(null);
  const botaoMenu = useRef<HTMLButtonElement>(null);

  /* O estado sólido vem de um IntersectionObserver sobre uma sentinela no
     topo — não de um listener de scroll. Custo zero por quadro, que é o que
     protege os ~58fps da cena pinada. */
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo) return;
    const io = new IntersectionObserver(
      ([e]) => setSolido(!e.isIntersecting),
      { threshold: 0 }
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  /* Menu mobile: Esc fecha e o foco volta para o botão que o abriu. */
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botaoMenu.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  const navegar = (e: React.MouseEvent<HTMLAnchorElement>, alvo: string) => {
    e.preventDefault();
    setAberto(false);
    irPara(alvo);
  };

  return (
    <>
      <div ref={sentinela} className={s.sentinela} aria-hidden="true" />

      <header
        className={solido ? `${s.header} ${s.solido}` : s.header}
        data-aberto={aberto ? "true" : "false"}
      >
        <div className={s.barra}>
          {/* era href="#topo", uma âncora que não existe em lugar nenhum: o
              clique só funcionava porque o onClick abaixo intercepta. Sem
              JavaScript, ou ao abrir em nova aba, não levava a lugar nenhum.
              "/" é o topo desta página com ou sem script. */}
          <a
            href="/"
            className={s.marca}
            onClick={(e) => {
              e.preventDefault();
              setAberto(false);
              irPara("body");
            }}
            aria-label="Zelo — ir para o topo"
          >
            {/* Lockup oficial. `priority` porque ele está acima da dobra:
                sem isso o header abre sem marca no primeiro quadro. */}
            <Image
              src="/marca/zelo-lockup.png"
              alt="Zelo"
              width={1114}
              height={304}
              priority
              className={s.marcaImg}
            />
          </a>

          <nav className={s.nav} aria-label="Navegação principal">
            {NAV.map((n) => (
              <a
                key={n.alvo}
                href={n.alvo}
                className={s.link}
                onClick={(e) => navegar(e, n.alvo)}
              >
                {n.rotulo}
              </a>
            ))}
          </nav>

          <Link
            className={s.cta}
            href={CTA_HREF}
            data-evt={EVENTOS.ctaStart}
            data-evt-local="header"
          >
            Começar agora <ArrowRight />
          </Link>

          <button
            ref={botaoMenu}
            type="button"
            className={s.hamburger}
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            onClick={() => setAberto((v) => !v)}
          >
            <span className={s.hamburgerLinha} />
            <span className={s.hamburgerLinha} />
          </button>
        </div>

        <div id="menu-mobile" className={s.painel} hidden={!aberto}>
          <nav className={s.painelNav} aria-label="Navegação principal (mobile)">
            {NAV.map((n) => (
              <a
                key={n.alvo}
                href={n.alvo}
                className={s.painelLink}
                onClick={(e) => navegar(e, n.alvo)}
              >
                {n.rotulo}
              </a>
            ))}
          </nav>
          <Link
            className={s.painelCta}
            href={CTA_HREF}
            data-evt={EVENTOS.ctaStart}
            data-evt-local="header-mobile"
            onClick={() => setAberto(false)}
          >
            Começar agora <ArrowRight />
          </Link>
        </div>
      </header>
    </>
  );
}
