"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavegacaoApp from "./NavegacaoApp";
import FeedbackProvider from "./Feedback";
import BotaoSair from "./BotaoSair";
import {
  IconeAdicionar,
  IconeClientes,
  IconeCobrancas,
  IconeConfiguracoes,
  IconeFechar,
  IconeMenu,
  IconeNotificacoes,
  IconeVisaoGeral,
  IconeAssinatura,
} from "./Icones";
import s from "../App.module.css";

/**
 * Casca da área logada — UMA navegação, três formas:
 *  - desktop (≥1024px): barra lateral completa, sempre à vista;
 *  - tablet (701–1023px): coluna de ícones (não rouba 240px de um iPad em
 *    pé) que expande por cima do conteúdo ao tocar em "Menu";
 *  - celular (≤700px): menu em gaveta + barra de atalhos embaixo, com a
 *    ação principal ("Nova cobrança") no centro. Nada de faixa horizontal
 *    escondendo itens fora da tela.
 * O cabeçalho é o mesmo em todas as páginas: contexto, ação principal,
 * notificações e conta.
 */

const CONTEXTOS: { prefixo: string; rotulo: string }[] = [
  { prefixo: "/app/admin/influenciadores", rotulo: "Influenciadores" },
  { prefixo: "/app/admin/solicitacoes", rotulo: "Solicitações" },
  { prefixo: "/app/negocio", rotulo: "Meu negócio" },
  { prefixo: "/app/clientes", rotulo: "Clientes" },
  { prefixo: "/app/cobrancas", rotulo: "Cobranças" },
  { prefixo: "/app/inadimplencia", rotulo: "Em atraso" },
  { prefixo: "/app/recorrencias", rotulo: "Recorrências" },
  { prefixo: "/app/servicos", rotulo: "Serviços" },
  { prefixo: "/app/recebimentos", rotulo: "Recebimentos" },
  { prefixo: "/app/assinatura", rotulo: "Assinatura" },
  { prefixo: "/app/configuracoes", rotulo: "Configurações" },
  { prefixo: "/app/notificacoes", rotulo: "Notificações" },
];

function contextoDe(caminho: string): string {
  if (caminho === "/app") return "Visão geral";
  return CONTEXTOS.find((c) => caminho.startsWith(c.prefixo))?.rotulo ?? "Zelo";
}

/* A ação principal do cabeçalho só aparece onde a página ainda não tem a sua:
   a Visão geral e as Cobranças já têm "Nova cobrança" no próprio corpo. */
const COM_ACAO_PRINCIPAL = new Set([
  "/app/negocio",
  "/app/clientes",
  "/app/recorrencias",
  "/app/servicos",
  "/app/recebimentos",
  "/app/inadimplencia",
]);

type Props = {
  administrador: boolean;
  naoLidas: number;
  empresaNome: string;
  email: string;
  /** faixa de aviso da conta (teste/pagamento), já montada no servidor */
  faixa: ReactNode;
  children: ReactNode;
};

export default function CascaApp({ administrador, naoLidas, empresaNome, email, faixa, children }: Props) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const perfil = useRef<HTMLDetailsElement>(null);

  const fechar = useCallback(() => setAberto(false), []);

  /* trocou de página: fecha o menu e o menu da conta */
  useEffect(() => {
    setAberto(false);
    if (perfil.current) perfil.current.open = false;
  }, [caminho]);

  /* com o menu aberto: Esc fecha, a página de trás não rola e o foco vai para "Fechar" */
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botaoFechar.current?.focus();
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setAberto(false);
        botaoMenu.current?.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  /* menu da conta: fecha ao clicar fora ou com Esc */
  useEffect(() => {
    const fora = (ev: MouseEvent) => {
      const el = perfil.current;
      if (el?.open && ev.target instanceof Node && !el.contains(ev.target)) el.open = false;
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && perfil.current?.open) {
        perfil.current.open = false;
        perfil.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("click", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, []);

  const ativo = (href: string) => (href === "/app" ? caminho === "/app" : caminho.startsWith(href));
  const inicial = (empresaNome.trim().charAt(0) || "Z").toUpperCase();
  const rotuloSino = naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações";

  return (
    <FeedbackProvider>
      <a href="#conteudo-principal" className={s.linkPular}>
        Pular para o conteúdo
      </a>

      {/* cortina atrás do menu aberto (tablet e celular) */}
      <div className={s.cortina} data-aberto={aberto} onClick={fechar} aria-hidden="true" />

      <div className={s.colunaLateral}>
        <aside id="menu-lateral" className={s.lateral} data-aberto={aberto}>
          <div className={s.lateralTopo}>
            <Link href="/app" className={s.marca}>
              <span className={s.marcaPonto} aria-hidden="true" />
              <span className={s.marcaTexto}>Zelo</span>
            </Link>
            <button ref={botaoFechar} type="button" className={s.fecharMenu} onClick={fechar} aria-label="Fechar menu">
              <IconeFechar className={s.navIcone} aria-hidden="true" />
            </button>
          </div>

          <NavegacaoApp administrador={administrador} aoNavegar={fechar} />

          <div className={s.rodapeLateral}>
            <span className={s.avatarEmpresa} aria-hidden="true">
              {inicial}
            </span>
            <span className={s.usuario}>
              <span className={s.usuarioNome}>{empresaNome}</span>
              <span className={s.usuarioEmail}>{email}</span>
            </span>
          </div>
        </aside>
      </div>

      <div className={s.coluna}>
        <header className={s.topo}>
          <button
            ref={botaoMenu}
            type="button"
            className={s.botaoMenu}
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-lateral"
          >
            <IconeMenu className={s.navIcone} aria-hidden="true" />
            <span className={s.botaoMenuRotulo}>Menu</span>
          </button>

          <Link href="/app" className={s.marcaTopo}>
            <span className={s.marcaPonto} aria-hidden="true" />
            Zelo
          </Link>

          <span className={s.topoContexto}>{contextoDe(caminho)}</span>

          <div className={s.topoAcoes}>
            {COM_ACAO_PRINCIPAL.has(caminho) && (
              <Link href="/app/cobrancas/nova" className={`${s.botao} ${s.botaoPequeno} ${s.topoCta}`}>
                <IconeAdicionar className={s.navIcone} aria-hidden="true" />
                Nova cobrança
              </Link>
            )}

            <Link href="/app/notificacoes" className={s.sino} aria-label={rotuloSino} title="Notificações">
              <IconeNotificacoes className={s.navIcone} aria-hidden="true" />
              {naoLidas > 0 && (
                <span className={s.contadorNotificacoes} aria-hidden="true">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </Link>

            <details ref={perfil} className={s.perfil}>
              <summary className={s.perfilBotao} aria-label="Menu da conta">
                <span className={s.avatarEmpresa} aria-hidden="true">
                  {inicial}
                </span>
              </summary>
              <div className={s.perfilPainel}>
                <div className={s.perfilCabeca}>
                  <span className={s.perfilNome}>{empresaNome}</span>
                  <span className={s.perfilEmail}>{email}</span>
                </div>
                <Link href="/app/configuracoes" className={s.perfilItem}>
                  <IconeConfiguracoes className={s.navIcone} aria-hidden="true" />
                  Configurações
                </Link>
                <Link href="/app/assinatura" className={s.perfilItem}>
                  <IconeAssinatura className={s.navIcone} aria-hidden="true" />
                  Assinatura
                </Link>
                <BotaoSair variante="texto" />
              </div>
            </details>
          </div>
        </header>

        <main id="conteudo-principal" className={s.conteudo}>
          {faixa}
          {children}
        </main>
      </div>

      {/* celular: atalhos embaixo, ação principal no centro */}
      <nav className={s.barraInferior} aria-label="Atalhos">
        <Link href="/app" className={s.atalho} aria-current={ativo("/app") ? "page" : undefined} data-ativo={ativo("/app")}>
          <IconeVisaoGeral className={s.atalhoIcone} aria-hidden="true" />
          Início
        </Link>
        <Link
          href="/app/cobrancas"
          className={s.atalho}
          aria-current={ativo("/app/cobrancas") ? "page" : undefined}
          data-ativo={ativo("/app/cobrancas")}
        >
          <IconeCobrancas className={s.atalhoIcone} aria-hidden="true" />
          Cobranças
        </Link>
        <Link href="/app/cobrancas/nova" className={s.atalhoNovo} aria-label="Nova cobrança">
          <IconeAdicionar className={s.atalhoIconeNovo} aria-hidden="true" />
        </Link>
        <Link
          href="/app/clientes"
          className={s.atalho}
          aria-current={ativo("/app/clientes") ? "page" : undefined}
          data-ativo={ativo("/app/clientes")}
        >
          <IconeClientes className={s.atalhoIcone} aria-hidden="true" />
          Clientes
        </Link>
        <button type="button" className={s.atalho} onClick={() => setAberto(true)} aria-controls="menu-lateral" aria-expanded={aberto}>
          <IconeMenu className={s.atalhoIcone} aria-hidden="true" />
          Menu
        </button>
      </nav>
    </FeedbackProvider>
  );
}
