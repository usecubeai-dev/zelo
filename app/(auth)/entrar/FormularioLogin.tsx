"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EVENTOS, track } from "@/lib/analytics";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  ErrosConta,
  caminhoInternoSeguro,
  mensagemDeErroAuth,
  normalizarEmail,
  validarEmail,
} from "@/lib/conta";
import { CampoConta } from "../CampoConta";
import s from "../Auth.module.css";

export default function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  /* para onde o proxy queria levar antes de exigir login. `?de=` é
     controlado pelo visitante na URL, não só pelo proxy — precisa do
     mesmo guard contra caminho externo usado em app/auth/callback/route.ts,
     senão um link malicioso redireciona quem acabou de logar para fora. */
  const proximo = caminhoInternoSeguro(parametros.get("de"));

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<ErrosConta>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const focoPendente = useRef<keyof ErrosConta | null>(null);

  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(campo)?.focus();
    focoPendente.current = null;
  }, [erros]);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);

    /* No login a validação é mínima de propósito: senha antiga pode ser
       mais curta que a regra atual, e recusá-la aqui deixaria a pessoa
       trancada para fora sem entender por quê. */
    const erroEmail = validarEmail(email);
    const encontrados: ErrosConta = {};
    if (erroEmail) encontrados.email = erroEmail;
    if (!senha) encontrados.senha = "Informe sua senha.";
    focoPendente.current = encontrados.email ? "email" : encontrados.senha ? "senha" : null;
    setErros(encontrados);
    if (focoPendente.current) return;

    setEnviando(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizarEmail(email),
      password: senha,
    });
    setEnviando(false);

    if (error) {
      setErroGeral(mensagemDeErroAuth(error.message));
      return;
    }

    track(EVENTOS.signupComplete, { local: "entrar" });
    router.refresh();
    router.push(proximo);
  };

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <CampoConta
        id="email"
        label="E-mail"
        type="email"
        inputMode="email"
        value={email}
        erro={erros.email}
        autoComplete="email"
        onChange={(v) => {
          setEmail(v);
          setErros((a) => ({ ...a, email: undefined }));
          setErroGeral(null);
        }}
      />
      <CampoConta
        id="senha"
        label="Senha"
        type="password"
        value={senha}
        erro={erros.senha}
        autoComplete="current-password"
        onChange={(v) => {
          setSenha(v);
          setErros((a) => ({ ...a, senha: undefined }));
          setErroGeral(null);
        }}
      />

      <button className={s.enviar} type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
