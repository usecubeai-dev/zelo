/**
 * Ícones da navegação do produto — SVG inline, sem biblioteca.
 *
 * Não existia nenhum ícone no sistema autenticado antes disso (nem
 * lib instalada, nem SVG solto): 7 itens de menu eram só texto. Um
 * conjunto pequeno, desenhado à mão (stroke 1.75, 20×20, sem fill),
 * é mais barato que instalar um pacote de ícones pra sete símbolos e
 * evita puxar um estilo visual que não é o nosso.
 */

import type { SVGProps } from "react";

type IconeProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconeVisaoGeral(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </svg>
  );
}

export function IconeNegocio(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20.5h16" />
      <rect x="5.5" y="12" width="3.2" height="6.5" rx="1" />
      <rect x="10.4" y="7.5" width="3.2" height="11" rx="1" />
      <rect x="15.3" y="4" width="3.2" height="14.5" rx="1" />
    </svg>
  );
}

export function IconeClientes(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c0-3.3 2.46-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M15.5 14.75c2.5.35 4 2.35 4 5.25" />
      <path d="M14.25 4.9a3.25 3.25 0 0 1 0 6.2" />
    </svg>
  );
}

export function IconeCobrancas(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5l-2-1.5V3.5Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  );
}

export function IconeServicos(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 3.5h6.5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-.44 1.06l-8 8a1.5 1.5 0 0 1-2.12 0l-6-6a1.5 1.5 0 0 1 0-2.12l8-8A1.5 1.5 0 0 1 11 3.5Z" />
      <circle cx="15.25" cy="8.25" r="1.35" />
    </svg>
  );
}

export function IconeRecebimentos(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M15.5 14.5h3" />
    </svg>
  );
}

export function IconeRecorrencias(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </svg>
  );
}

export function IconeAssinatura(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="M3 9.5h18" />
      <path d="M7 14h4" />
    </svg>
  );
}

export function IconeConfiguracoes(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3" />
    </svg>
  );
}

export function IconeNotificacoes(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.2 1.5 5.5H4.5c0-.3 1.5-1.5 1.5-5.5Z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
    </svg>
  );
}

/* Os quatro ícones abaixo (recebido/a receber/processando/vencido) seguem o
   mesmo traço dos ícones de navegação — usados só nos cartões de resumo
   financeiro do dashboard, como reforço visual do que cada número
   significa (não decoração: cada um some de contexto no `aria-hidden`). */
export function IconeRecebido(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3 10.7 14.5 15.5 9.3" />
    </svg>
  );
}

export function IconeAReceber(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.6 2.1" />
    </svg>
  );
}

export function IconeProcessando(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5L19 8.3" />
      <path d="M19 4.3v4h-4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.5L5 15.7" />
      <path d="M5 19.7v-4h4" />
    </svg>
  );
}

export function IconeVencido(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 21 19.5H3L12 3.5Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17" r="0.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeSair(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15.5 16.5 20 12l-4.5-4.5" />
      <path d="M20 12H9.5" />
    </svg>
  );
}

/** Megafone — só aparece no menu do administrador (Influenciadores). */
export function IconeInfluenciadores(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10v4a1 1 0 0 0 1 1h2.5l6 4V5l-6 4H5a1 1 0 0 0-1 1Z" />
      <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M19.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

/** Solicitações de titular de dados (LGPD) — documento com escudo, só no menu do administrador. */
export function IconeSolicitacoes(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h8l4 4v13H6Z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12.5h6" />
      <path d="M9 16h4" />
    </svg>
  );
}
