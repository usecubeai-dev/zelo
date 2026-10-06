"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RodapeEmpresa from "@/components/RodapeEmpresa";
import s from "./Auth.module.css";
import c from "./criar-conta/Cadastro.module.css";

const BENEFICIOS = [
  "Cobranças organizadas",
  "Recorrências automáticas",
  "Visão clara dos recebimentos",
];

/**
 * Casca das telas de conta. Chrome mínimo de propósito: uma tela de login
 * com menu completo é convite para o visitante sair sem entrar. O único
 * caminho é a marca, de volta para a home.
 *
 * Cliente (não servidor) só por causa do `usePathname` abaixo: o cadastro
 * (`/criar-conta`) ganhou uma casca própria (duas colunas, painel de
 * marca) pedida explicitamente para ESSA tela. `entrar`, `recuperar-senha`
 * e `nova-senha` caem no primeiro retorno, idêntico ao que já existia —
 * nenhuma classe de `Auth.module.css` foi tocada nesta mudança, então as
 * três continuam pixel a pixel como estavam.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname !== "/criar-conta") {
    return (
      <div className={`${s.pagina} zelo-produto`}>
        <header className={s.topo}>
          <Link href="/" className={s.marca}>
            <span className={s.marcaPonto} aria-hidden="true" />
            Zelo
          </Link>
        </header>
        <main className={s.corpo}>
          <div className={s.cartao}>{children}</div>
        </main>
        <RodapeEmpresa variante="claro" compacto />
      </div>
    );
  }

  return (
    <div className={`${c.pagina} zelo-produto`}>
      <aside className={c.branding} aria-label="Por que usar a Zelo">
        <div className={c.brandingLinhas} aria-hidden="true" />
        <span className={`${c.forma} ${c.forma1}`} aria-hidden="true" />
        <span className={`${c.forma} ${c.forma2}`} aria-hidden="true" />
        <span className={`${c.forma} ${c.forma3}`} aria-hidden="true" />
        <div className={c.miniCards} aria-hidden="true">
          <div className={c.miniCard}>
            <span className={c.miniCardPonto} />
            <div className={c.miniCardBarra} />
            <div className={c.miniCardBarra} />
          </div>
          <div className={c.miniCard}>
            <div className={c.miniCardBarra} />
            <div className={c.miniCardBarra} />
          </div>
        </div>

        <Link href="/" className={c.marcaClara}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>

        <div className={c.brandingConteudo}>
          <p className={c.headline}>Pare de cobrar.
            <br />
            Comece a receber.
          </p>
          <p className={c.subcopy}>
            Organize suas cobranças, acompanhe seus recebimentos e tenha mais
            controle do seu negócio.
          </p>
          <ul className={c.beneficios}>
            {BENEFICIOS.map((b) => (
              <li key={b}>
                <span className={c.beneficioIcone} aria-hidden="true">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className={c.formArea}>
        <header className={c.formTopo}>
          <Link href="/" className={c.marcaClara}>
            <span className={s.marcaPonto} aria-hidden="true" />
            Zelo
          </Link>
        </header>
        <main className={c.formMain}>
          <div className={c.cartao}>{children}</div>
        </main>
        {/* linha discreta ao final: a identificação da empresa não compete com o formulário */}
        <RodapeEmpresa variante="claro" compacto />
      </div>
    </div>
  );
}
