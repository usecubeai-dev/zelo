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
  IconeInfluenciadores,
} from "./Icones";

/* Dois grupos, mesma navegação de sempre — nenhuma rota mudou, nenhum
   item foi escondido. "Principal" é o que sustenta o uso diário
   (cadastrar cliente, cobrar, acompanhar recorrência); "Mais" é
   configuração e consulta menos frequente. Separar visualmente reduz
   quantas opções competem por atenção de uma vez (achado da auditoria de
   complexidade, 11/09/2026) sem tirar nada do alcance de um clique. */
const PRINCIPAL = [
  { rotulo: "Visão geral", href: "/app", Icone: IconeVisaoGeral },
  { rotulo: "Clientes", href: "/app/clientes", Icone: IconeClientes },
  { rotulo: "Cobranças", href: "/app/cobrancas", Icone: IconeCobrancas },
  { rotulo: "Recorrências", href: "/app/recorrencias", Icone: IconeRecorrencias },
];

const MAIS = [
  { rotulo: "Serviços", href: "/app/servicos", Icone: IconeServicos },
  { rotulo: "Recebimentos", href: "/app/recebimentos", Icone: IconeRecebimentos },
  { rotulo: "Assinatura", href: "/app/assinatura", Icone: IconeAssinatura },
  { rotulo: "Configurações", href: "/app/configuracoes", Icone: IconeConfiguracoes },
];

/* Só administradores do Zelo. O item é conveniência: quem manda é a
   checagem refeita na página e nas actions de /app/admin — esconder o link
   nunca é a proteção. */
const ADMIN = { rotulo: "Influenciadores", href: "/app/admin/influenciadores", Icone: IconeInfluenciadores };

export default function NavegacaoApp({ administrador = false }: { administrador?: boolean }) {
  const caminho = usePathname();

  const item = ({ rotulo, href, Icone }: (typeof PRINCIPAL)[number]) => {
    /* "/app" só é ativo exato; o resto casa por prefixo, para a ficha
       de um cliente manter "Clientes" destacado */
    const ativo = href === "/app" ? caminho === "/app" : caminho.startsWith(href);
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
  };

  return (
    <nav className={s.nav} aria-label="Navegação do sistema">
      {PRINCIPAL.map(item)}
      <span className={s.navSecaoRotulo}>Mais</span>
      {MAIS.map(item)}
      {administrador && item(ADMIN)}
    </nav>
  );
}
