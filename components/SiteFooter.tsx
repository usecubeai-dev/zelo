"use client";

import Image from "next/image";
import { irPara } from "@/lib/lenis";
import s from "./SiteFooter.module.css";

/* ============================================================
   Dados reais da empresa — CNPJ fornecido pelo proprietário em
   10/09/2026, substituindo o MEI usado provisoriamente antes: esta é
   uma Sociedade Empresária Limitada (LTDA), com CNAE 62.02-3-00
   (desenvolvimento e licenciamento de programas de computador
   customizáveis) entre suas atividades cadastradas — resolve o
   impedimento de MEI para SaaS identificado na auditoria de 10/09/2026.
   Nome empresarial e CNPJ exatamente como registrados na Receita
   Federal. E-mail de contato continua o definido pelo proprietário
   (não o e-mail cadastral do CNPJ).
   ============================================================ */
const EMPRESA: {
  email: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
} = {
  email: "usecube.ai@gmail.com",
  razaoSocial: "GOGOMOB TECNOLOGIA BR LTDA",
  cnpj: "48.443.579/0001-93",
};

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
          {EMPRESA.email ? (
            <a href={`mailto:${EMPRESA.email}`} className={s.colLink}>
              {EMPRESA.email}
            </a>
          ) : (
            <span className={s.colPendente}>
              E-mail <i>a definir</i>
            </span>
          )}
        </div>
      </div>

      <div className={s.base}>
        <span>© 2026 Zelo. Todos os direitos reservados.</span>
        {EMPRESA.razaoSocial && EMPRESA.cnpj && (
          <span className={s.juridico}>
            {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj}
          </span>
        )}
      </div>
    </footer>
  );
}
