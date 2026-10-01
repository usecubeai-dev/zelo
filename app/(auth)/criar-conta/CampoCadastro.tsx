"use client";

import { useState } from "react";
import { IconeOlho, IconeOlhoCortado } from "./IconesCadastro";
import c from "./Cadastro.module.css";

/**
 * Campo de formulário exclusivo da tela de cadastro.
 *
 * Não é `CampoConta` (`../CampoConta.tsx`) com um `className` a mais: esse
 * componente é usado por entrar/recuperar-senha/nova-senha também, e o
 * toggle de mostrar/ocultar senha só foi pedido para o cadastro. Colocar o
 * toggle dentro de `CampoConta` faria o botão de olho aparecer nas outras
 * três telas sem ninguém ter pedido isso — exatamente o tipo de mudança
 * "sem querer" que o README pede pra evitar. Por isso este componente é
 * próprio da pasta `criar-conta/`, mesmo contrato de acessibilidade
 * (label ligada, `aria-invalid`, `aria-describedby`), estilo novo.
 */
export function CampoCadastro({
  id,
  label,
  erro,
  dica,
  onChange,
  revelarSenha,
  type,
  ...input
}: {
  id: string;
  label: string;
  erro?: string;
  dica?: string;
  onChange: (valor: string) => void;
  /** Quando true, o campo nasce `type="password"` e ganha o botão de olho. */
  revelarSenha?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "onChange">) {
  const [mostrar, setMostrar] = useState(false);
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descrito = [erro ? idErro : null, dica ? idDica : null]
    .filter(Boolean)
    .join(" ");
  const tipoFinal = revelarSenha ? (mostrar ? "text" : "password") : type;

  return (
    <div className={c.campo}>
      <label htmlFor={id} className={c.campoLabel}>
        {label}
      </label>
      <div
        className={`${c.campoCaixa} ${erro ? c.campoCaixaErro : ""} ${
          revelarSenha ? c.campoCaixaComOlho : ""
        }`}
      >
        <input
          {...input}
          id={id}
          name={id}
          type={tipoFinal}
          aria-invalid={Boolean(erro)}
          aria-describedby={descrito || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={c.campoInput}
        />
        {revelarSenha && (
          <button
            type="button"
            className={c.campoOlho}
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrar}
          >
            {mostrar ? <IconeOlhoCortado /> : <IconeOlho />}
          </button>
        )}
      </div>
      {erro && (
        <p id={idErro} className={c.campoErroTexto}>
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className={c.campoDica}>
          {dica}
        </p>
      )}
    </div>
  );
}
