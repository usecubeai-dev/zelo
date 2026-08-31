"use client";

import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { mensagemDeErroAuth, normalizarEmail, validarEmail } from "@/lib/conta";
import { CampoConta } from "../CampoConta";
import s from "../Auth.module.css";

export default function FormularioRecuperar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    const problema = validarEmail(email);
    setErro(problema);
    if (problema) {
      document.getElementById("email")?.focus();
      return;
    }

    setEnviando(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizarEmail(email),
      { redirectTo: `${window.location.origin}/auth/callback?proximo=/nova-senha` }
    );
    setEnviando(false);

    /* Mesmo em erro mostramos a tela de "enviado", exceto em limite de
       tentativas. Dizer "este e-mail não existe" entrega a atacante a
       lista de quem tem conta. */
    if (error && error.message.toLowerCase().includes("rate limit")) {
      setErroGeral(mensagemDeErroAuth(error.message));
      return;
    }
    setEnviado(true);
  };

  if (enviado) {
    return (
      <section className={s.sucesso} role="status" aria-live="polite">
        <span className={s.sucessoMarca} aria-hidden="true">✓</span>
        <h2>Link enviado</h2>
        <p>
          Se existir uma conta com <strong>{normalizarEmail(email)}</strong>,
          o link para criar uma nova senha chega em instantes.
        </p>
      </section>
    );
  }

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!erroGeral}>
        {erroGeral ?? ""}
      </div>
      <CampoConta
        id="email"
        label="E-mail"
        type="email"
        inputMode="email"
        value={email}
        erro={erro}
        autoComplete="email"
        onChange={(v) => { setEmail(v); setErro(undefined); setErroGeral(null); }}
      />
      <button className={s.enviar} type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
