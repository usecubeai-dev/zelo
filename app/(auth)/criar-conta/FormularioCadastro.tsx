"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENTOS, track } from "@/lib/analytics";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  CADASTRO_VAZIO,
  DadosCadastro,
  ErrosConta,
  SENHA_MINIMA,
  mensagemDeErroAuth,
  normalizarEmail,
  primeiroErro,
  validarCadastro,
} from "@/lib/conta";
import { CampoConta } from "../CampoConta";
import s from "../Auth.module.css";

/**
 * Criação de conta.
 *
 * A empresa NÃO é criada aqui: quem cria é um trigger em `auth.users`, no
 * banco. Assim ela nasce na mesma transação do usuário e o cliente não tem
 * como pular a etapa nem escolher em qual empresa entrar.
 *
 * Dois desfechos possíveis, porque dependem da configuração do projeto:
 * com confirmação de e-mail ligada, o Supabase devolve usuário SEM sessão
 * e a pessoa precisa clicar no link; sem confirmação, já vem sessão e a
 * pessoa entra direto. Os dois casos são tratados.
 */
export default function FormularioCadastro() {
  const router = useRouter();
  const [dados, setDados] = useState<DadosCadastro>(CADASTRO_VAZIO);
  const [erros, setErros] = useState<ErrosConta>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmePorEmail, setConfirmePorEmail] = useState(false);
  const iniciou = useRef(false);
  const focoPendente = useRef<keyof ErrosConta | null>(null);
  const tituloConfirme = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(campo)?.focus();
    focoPendente.current = null;
  }, [erros]);

  useEffect(() => {
    if (confirmePorEmail) tituloConfirme.current?.focus();
  }, [confirmePorEmail]);

  const marcarInicio = () => {
    if (iniciou.current) return;
    iniciou.current = true;
    track(EVENTOS.signupStart, { local: "criar-conta" });
  };

  const atualizar = (campo: keyof DadosCadastro, valor: string) => {
    marcarInicio();
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    marcarInicio();
    setErroGeral(null);

    const encontrados = validarCadastro(dados);
    focoPendente.current = primeiroErro(encontrados);
    setErros(encontrados);
    if (focoPendente.current) return;

    setEnviando(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email: normalizarEmail(dados.email),
      password: dados.senha,
      options: {
        /* o trigger usa isto para nomear a empresa */
        data: { nome: dados.nome.trim().replace(/\s+/g, " ") },
        emailRedirectTo: `${window.location.origin}/auth/callback?proximo=/app`,
      },
    });
    setEnviando(false);

    if (error) {
      setErroGeral(mensagemDeErroAuth(error.message));
      return;
    }

    /* A conta existe: a empresa e o trial de 14 dias foram criados pelo
       trigger, na mesma transação. `account_created` marca isso.
       `signup_complete` fica para quando a pessoa realmente ENTRAR — sem
       sessão, o cadastro ainda não terminou. */
    track(EVENTOS.accountCreated, { local: "criar-conta" });

    if (!data.session) {
      setConfirmePorEmail(true);
      return;
    }

    track(EVENTOS.signupComplete, { local: "criar-conta" });
    track(EVENTOS.trialStarted, { local: "criar-conta" });
    router.refresh();
    router.push("/app");
  };

  if (confirmePorEmail) {
    return (
      <section className={s.sucesso} role="status" aria-live="polite">
        <span className={s.sucessoMarca} aria-hidden="true">
          ✓
        </span>
        <h2 ref={tituloConfirme} tabIndex={-1}>
          Confirme seu e-mail
        </h2>
        <p>
          Enviamos um link para <strong>{normalizarEmail(dados.email)}</strong>.
          Clique nele para ativar sua conta e começar os 14 dias grátis.
        </p>
      </section>
    );
  }

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <CampoConta
        id="nome"
        label="Seu nome"
        value={dados.nome}
        erro={erros.nome}
        autoComplete="name"
        onFocus={marcarInicio}
        onChange={(v) => atualizar("nome", v)}
      />
      <CampoConta
        id="email"
        label="E-mail"
        type="email"
        inputMode="email"
        value={dados.email}
        erro={erros.email}
        autoComplete="email"
        onFocus={marcarInicio}
        onChange={(v) => atualizar("email", v)}
      />
      <CampoConta
        id="senha"
        label="Senha"
        type="password"
        value={dados.senha}
        erro={erros.senha}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
        autoComplete="new-password"
        onFocus={marcarInicio}
        onChange={(v) => atualizar("senha", v)}
      />

      <button className={s.enviar} type="submit" disabled={enviando}>
        {enviando ? "Criando conta…" : "Criar conta e começar"}
      </button>
    </form>
  );
}
