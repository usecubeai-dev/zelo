"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SENHA_MINIMA, mensagemDeErroAuth, validarSenha } from "@/lib/conta";
import { CampoConta } from "../CampoConta";
import s from "../Auth.module.css";

export default function FormularioNovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  /* Chegar aqui sem sessão significa link expirado ou acesso direto —
     precisa ficar explícito, senão a pessoa digita a senha nova e recebe
     um erro sem sentido. */
  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setTemSessao(Boolean(data.user)));
  }, []);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    const problema = validarSenha(senha);
    setErro(problema);
    if (problema) {
      document.getElementById("senha")?.focus();
      return;
    }

    setEnviando(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: senha });
    setEnviando(false);

    if (error) {
      setErroGeral(mensagemDeErroAuth(error.message));
      return;
    }
    router.refresh();
    router.push("/app");
  };

  if (temSessao === false) {
    return (
      <div className={s.aviso} role="status">
        Este link não é mais válido. Peça um novo em{" "}
        <a href="/recuperar-senha" className={s.link}>recuperar senha</a>.
      </div>
    );
  }

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!erroGeral}>
        {erroGeral ?? ""}
      </div>
      <CampoConta
        id="senha"
        label="Nova senha"
        type="password"
        value={senha}
        erro={erro}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
        autoComplete="new-password"
        onChange={(v) => { setSenha(v); setErro(undefined); setErroGeral(null); }}
      />
      <button className={s.enviar} type="submit" disabled={enviando || temSessao === null}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
