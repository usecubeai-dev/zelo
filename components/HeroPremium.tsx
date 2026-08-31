import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { CTA_HREF } from "@/lib/cta";
import { EVENTOS } from "@/lib/analytics";
import { ArrowRight } from "./icons";
import HeroObjeto from "./HeroObjeto";
import s from "./HeroPremium.module.css";

/**
 * Hero premium — composição de vitrine.
 *
 * A estrutura segue a linguagem da referência aprovada: cortina de luz
 * vertical ao fundo, uma moldura arredondada que contém a cena inteira,
 * navegação dentro dela, texto à esquerda e o objeto protagonista sobre um
 * pedestal à direita.
 *
 * O que NÃO veio da referência: o objeto (lá é um cofre; aqui é um sólido
 * abstrato próprio), a paleta, a tipografia e todo o conteúdo. Nada de
 * marca alheia foi reproduzido.
 *
 * O objeto é desenhado em canvas. Se um render externo aparecer em
 * `public/hero-zelo.*`, ele assume o pedestal sem alteração de código.
 */

const NOMES_ACEITOS = ["hero-zelo.avif", "hero-zelo.webp", "hero-zelo.png", "hero-zelo.jpg"];

function assetDoHero(): string | null {
  const publico = path.join(process.cwd(), "public");
  for (const nome of NOMES_ACEITOS) {
    if (fs.existsSync(path.join(publico, nome))) return `/${nome}`;
  }
  return null;
}

const NAV = [
  { rotulo: "Como funciona", alvo: "#como-funciona" },
  { rotulo: "Benefícios", alvo: "#beneficios" },
  { rotulo: "Preço", alvo: "#preco" },
  { rotulo: "FAQ", alvo: "#faq" },
];

export default function HeroPremium() {
  const asset = assetDoHero();

  return (
    <section className={s.cena}>
      {/* Cortina de luz: feixes verticais que sobem do fundo. É o que dá a
          profundidade atrás da moldura — sem isso ela flutua sobre um
          fundo chapado. */}
      <div className={s.cortina} aria-hidden="true" />
      <div className={s.brilhoFundo} aria-hidden="true" />

      <div className={s.moldura}>
        <header className={s.nav}>
          <Link href="/" className={s.marca} aria-label="Zelo — início">
            <Image
              src="/marca/zelo-lockup.png"
              alt="Zelo"
              width={1114}
              height={304}
              priority
              className={s.marcaImg}
            />
          </Link>

          <nav className={s.navLinks} aria-label="Navegação">
            {NAV.map((n) => (
              <a key={n.alvo} href={`/${n.alvo}`} className={s.navLink}>
                {n.rotulo}
              </a>
            ))}
          </nav>

          <Link
            href={CTA_HREF}
            className={s.navCta}
            data-evt={EVENTOS.ctaStart}
            data-evt-local="hero-nav"
          >
            Começar agora
          </Link>
        </header>

        <div className={s.conteudo}>
          <div className={s.texto}>
            <span className={s.selo}>
              <span className={s.seloPonto} aria-hidden="true" />
              Cobrança recorrente no Pix Automático
            </span>

            <h1 className={s.titulo}>
              Pare de cobrar.
              <br />
              <span className={s.tituloDestaque}>Comece a receber.</span>
            </h1>

            <p className={s.subtexto}>
              Automatize suas cobranças recorrentes e receba sem precisar
              lembrar seus clientes todo mês.
            </p>

            <div className={s.acoes}>
              <Link
                href={CTA_HREF}
                className={s.ctaPrimario}
                data-evt={EVENTOS.ctaStart}
                data-evt-local="hero-premium"
              >
                Criar minha primeira cobrança
                <ArrowRight />
              </Link>
              <a
                href="/#como-funciona"
                className={s.ctaSecundario}
                data-evt={EVENTOS.ctaDemo}
                data-evt-local="hero-premium"
              >
                Ver como funciona
              </a>
            </div>
          </div>

          {/* Palco: objeto flutuando + pedestal. O pedestal é CSS puro —
              elipse de topo, corpo cilíndrico e queda para o escuro. */}
          <div className={s.palco}>
            <div className={s.objeto}>
              {asset ? (
                <Image
                  src={asset}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 900px) 90vw, 46vw"
                  className={s.objetoImg}
                />
              ) : (
                <HeroObjeto />
              )}
            </div>

            <div className={s.pedestal} aria-hidden="true">
              <div className={s.pedestalTopo} />
              <div className={s.pedestalCorpo} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
