"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "../App.module.css";
import {
  IconeVisaoGeral,
  IconeClientes,
  IconeServicos,
  IconeCobrancas,
  IconeRecebimentos,
  IconeRecorrencias,
  IconeAssinatura,
  IconeConfiguracoes,
} from "./Icones";

const ITENS = [
  { rotulo: "Visão geral", href: "/app", Icone: IconeVisaoGeral },
  { rotulo: "Clientes", href: "/app/clientes", Icone: IconeClientes },
  { rotulo: "Serviços", href: "/app/servicos", Icone: IconeServicos },
  { rotulo: "Cobranças", href: "/app/cobrancas", Icone: IconeCobrancas },
  { rotulo: "Recebimentos", href: "/app/recebimentos", Icone: IconeRecebimentos },
  { rotulo: "Recorrências", href: "/app/recorrencias", Icone: IconeRecorrencias },
  { rotulo: "Assinatura", href: "/app/assinatura", Icone: IconeAssinatura },
  { rotulo: "Configurações", href: "/app/configuracoes", Icone: IconeConfiguracoes },
];

export default function NavegacaoApp() {
  const caminho = usePathname();

  return (
    <nav className={s.nav} aria-label="Navegação do sistema">
      {ITENS.map(({ rotulo, href, Icone }) => {
        /* "/app" só é ativo exato; o resto casa por prefixo, para a ficha
           de um cliente manter "Clientes" destacado */
        const ativo =
          href === "/app" ? caminho === "/app" : caminho.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={ativo ? `${s.item} ${s.itemAtivo}` : s.item}
            aria-current={ativo ? "page" : undefined}
          >
            <Icone className={s.navIcone} aria-hidden="true" />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
