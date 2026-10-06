"use client";

import Image from "next/image";
import { irPara } from "@/lib/lenis";
import RodapeEmpresa from "./RodapeEmpresa";
import s from "./SiteFooter.module.css";

/* Razão social, CNPJ, endereço e canais de atendimento vêm de `EMPRESA`
   (lib/company.ts) via <RodapeEmpresa/>. O e-mail abaixo é só o contato que
   o proprietário já tinha definido para a coluna "Contato" — enquanto
   `EMPRESA.emailSuporte` for [PREENCHER], ele continua sendo o único canal
   real da página; quando o e-mail de suporte for preenchido, esta coluna
   passa a usá-lo e a constante sai. */
const EMAIL_CONTATO_ATUAL = "usecube.ai@gmail.com";

/** Âncoras internas — todas funcionam hoje. */
const PRODUTO = [
  { rotulo: "Como funciona", alvo: "#como-funciona" },
  { rotulo: "Benefícios", alvo: "#beneficios" },
  { rotulo: "Preço", alvo: "#preco" },
  { rotulo: "FAQ", alvo: "#faq" },
];

/** Páginas que ainda não existem: renderizadas como pendentes, não como
    links quebrados que levariam a 404. */
const EMPRESA_LINKS = ["Sobre", "Contato"];

/** Estas já existem como estrutura — é o conteúdo jurídico que está
    pendente. Viram link de verdade; o aviso de "documento em elaboração"
    fica na própria página, onde quem abre consegue ler. */
const LEGAL_LINKS = [
  { rotulo: "Termos de uso", href: "/termos" },
  { rotulo: "Política de privacidade", href: "/privacidade" },
  { rotulo: "Solicitação de titular de dados", href: "/privacidade/solicitacao" },
];

export default function SiteFooter() {
  const navegar = (e: React.MouseEvent<HTMLAnchorElement>, alvo: string) => {
    e.preventDefault();
    irPara(alvo);
  };

  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.marcaCol}>
          <span className={s.marca}>
            <Image
              src="/marca/zelo-lockup.png"
              alt="Zelo"
              width={1114}
              height={304}
              className={s.marcaImg}
            />
          </span>
          <p className={s.posicionamento}>
            Cobrança recorrente no Pix Automático. Você trabalha, a Zelo cobra.
          </p>
        </div>

        <nav className={s.col} aria-label="Produto">
          <h2 className={s.colTitulo}>Produto</h2>
          {PRODUTO.map((l) => (
            <a
              key={l.alvo}
              href={l.alvo}
              className={s.colLink}
              onClick={(e) => navegar(e, l.alvo)}
            >
              {l.rotulo}
            </a>
          ))}
        </nav>

        <div className={s.col}>
          <h2 className={s.colTitulo}>Empresa</h2>
          {EMPRESA_LINKS.map((l) => (
            <span key={l} className={s.colPendente}>
              {l} <i>a definir</i>
            </span>
          ))}
        </div>

        <div className={s.col}>
          <h2 className={s.colTitulo}>Legal</h2>
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={s.colLink}>
              {l.rotulo}
            </a>
          ))}
        </div>

        <div className={s.col}>
          <h2 className={s.colTitulo}>Contato</h2>
          <a href={`mailto:${EMAIL_CONTATO_ATUAL}`} className={s.colLink}>
            {EMAIL_CONTATO_ATUAL}
          </a>
        </div>
      </div>

      <RodapeEmpresa variante="escuro" />

      <div className={s.base}>
        <span>© 2026 Zelo. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}
