"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "../App.module.css";
import {
  IconeVisaoGeral,
  IconeNegocio,
  IconeClientes,
  IconeServicos,
  IconeCobrancas,
  IconeVencido,
  IconeRecebimentos,
  IconeRecorrencias,
  IconeAssinatura,
  IconeConfiguracoes,
  IconeInfluenciadores,
  IconeSolicitacoes,
} from "./Icones";

/* Dois grupos, mesma navegação de sempre — nenhuma rota mudou, nenhum
   item foi escondido. "Principal" é o que sustenta o uso diário
   (cadastrar cliente, cobrar, acompanhar recorrência); "Mais" é
   configuração e consulta menos frequente. */
const PRINCIPAL = [
  { rotulo: "Visão geral", href: "/app", Icone: IconeVisaoGeral },
  { rotulo: "Meu negócio", href: "/app/negocio", Icone: IconeNegocio },
  { rotulo: "Clientes", href: "/app/clientes", Icone: IconeClientes },
  { rotulo: "Cobranças", href: "/app/cobrancas", Icone: IconeCobrancas },
  { rotulo: "Em atraso", href: "/app/inadimplencia", Icone: IconeVencido },
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
const ADMIN = [
  { rotulo: "Influenciadores", href: "/app/admin/influenciadores", Icone: IconeInfluenciadores },
  { rotulo: "Solicitações", href: "/app/admin/solicitacoes", Icone: IconeSolicitacoes },
];

export default function NavegacaoApp({
  administrador = false,
  aoNavegar,
}: {
  administrador?: boolean;
  /** chamado ao tocar num item — a casca usa para fechar o menu no celular/tablet */
  aoNavegar?: () => void;
}) {
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
        title={rotulo}
        onClick={aoNavegar}
      >
        <Icone className={s.navIcone} aria-hidden="true" />
        {/* no tablet o menu vira uma coluna de ícones: o rótulo some da tela
            mas continua no nome acessível do link */}
        <span className={s.itemRotulo}>{rotulo}</span>
      </Link>
    );
  };

  return (
    <nav className={s.nav} aria-label="Navegação do sistema">
      {PRINCIPAL.map(item)}
      <span className={s.navSecaoRotulo}>Mais</span>
      {MAIS.map(item)}
      {administrador && (
        <>
          <span className={s.navSecaoRotulo}>Administração</span>
          {ADMIN.map(item)}
        </>
      )}
    </nav>
  );
}
