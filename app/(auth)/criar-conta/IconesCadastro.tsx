/**
 * Ícones exclusivos da tela de cadastro — mesmo padrão de
 * `app/(app)/app/Icones.tsx` (SVG inline, sem biblioteca, stroke 1.75,
 * 20×20, sem fill): olho/olho-cortado (mostrar/ocultar senha) e cadeado
 * (linha de confiança). Não vivem em `Icones.tsx` porque aquele arquivo é
 * do produto autenticado (`/app`), não das telas de conta.
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

export function IconeOlho(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function IconeOlhoCortado(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.68A10.6 10.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.44 4.28M7.26 7.24C4.52 8.9 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.2 0 2.27-.25 3.22-.66" />
      <path d="M9.68 9.68a2.75 2.75 0 0 0 3.88 3.9" />
    </svg>
  );
}

export function IconeCadeado(props: IconeProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
