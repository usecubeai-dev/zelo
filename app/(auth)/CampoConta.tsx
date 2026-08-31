"use client";

import s from "./Auth.module.css";

/**
 * Campo das telas de conta. Um componente só para os quatro formulários —
 * label ligada, `aria-invalid`, `aria-describedby` e a dica ficam corretos
 * em todos sem depender de ninguém lembrar.
 */
export function CampoConta({
  id,
  label,
  erro,
  dica,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  erro?: string;
  dica?: string;
  onChange: (valor: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "onChange">) {
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descrito = [erro ? idErro : null, dica ? idDica : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={s.campo}>
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        name={id}
        aria-invalid={Boolean(erro)}
        aria-describedby={descrito || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {erro && (
        <p id={idErro} className={s.erro}>
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className={s.dica}>
          {dica}
        </p>
      )}
    </div>
  );
}
