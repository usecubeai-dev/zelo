"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "../App.module.css";

const ITENS = [
  { rotulo: "Visão geral", href: "/app" },
  { rotulo: "Clientes", href: "/app/clientes" },
  { rotulo: "Cobranças", href: "/app/cobrancas" },
  { rotulo: "Recebimentos", href: "/app/recebimentos" },
  { rotulo: "Recorrências", href: "/app/recorrencias" },
  { rotulo: "Assinatura", href: "/app/assinatura" },
  { rotulo: "Configurações", href: "/app/configuracoes" },
];

export default function NavegacaoApp() {
  const caminho = usePathname();

  return (
    <nav className={s.nav} aria-label="Navegação do sistema">
      {ITENS.map((i) => {
        /* "/app" só é ativo exato; o resto casa por prefixo, para a ficha
           de um cliente manter "Clientes" destacado */
        const ativo =
          i.href === "/app" ? caminho === "/app" : caminho.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={ativo ? `${s.item} ${s.itemAtivo}` : s.item}
            aria-current={ativo ? "page" : undefined}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
