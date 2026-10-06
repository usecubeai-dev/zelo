"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENTOS, track } from "@/lib/analytics";
import type { Plano } from "@/lib/plano";
import { criarConta } from "./acoes";
import {
  CADASTRO_VAZIO,
  DadosCadastro,
  ErrosConta,
  SENHA_MINIMA,
  normalizarEmail,
  validarCadastro,
} from "@/lib/conta";
import { CampoCadastro } from "./CampoCadastro";
import { IconeCadeado } from "./IconesCadastro";
import s from "./Cadastro.module.css";

/* O aceite não é um campo de texto de `lib/conta`; ganha tipo próprio aqui. */
type ErrosFormulario = ErrosConta & { aceite?: string };
type CampoComErro = keyof ErrosFormulario;
const ORDEM_DOS_CAMPOS: readonly CampoComErro[] = ["nome", "email", "senha", "aceite"];

const MENSAGEM_ACEITE = "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.";

/**
 * Criação de conta.
 *
 * Quem cria a conta é a Server Action `criarConta` (signUp + prova do aceite
 * dos Termos), nunca o navegador: assim o aceite é exigido no SERVIDOR e não
 * dá para criar conta pulando o checkbox.
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
export default function FormularioCadastro({
  indicacao,
  planoEscolhido,
}: {
  /** código de indicação (só formato) vindo do link ou do cookie; o servidor valida de verdade */
  indicacao: string | null;
  /** plano escolhido na página de preços, já validado no servidor */
  planoEscolhido: Plano | null;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosCadastro>(CADASTRO_VAZIO);
  const [aceite, setAceite] = useState(false); // DESMARCADO por padrão: aceite precisa ser ato ativo
  const [erros, setErros] = useState<ErrosFormulario>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmePorEmail, setConfirmePorEmail] = useState(false);
  const iniciou = useRef(false);
  const focoPendente = useRef<CampoComErro | null>(null);
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

    const encontrados: ErrosFormulario = validarCadastro(dados);
    if (!aceite) encontrados.aceite = MENSAGEM_ACEITE;
    focoPendente.current = ORDEM_DOS_CAMPOS.find((c) => encontrados[c]) ?? null;
    setErros(encontrados);
    if (focoPendente.current) return;

    setEnviando(true);
    let resultado: Awaited<ReturnType<typeof criarConta>>;
    try {
      resultado = await criarConta({
        nome: dados.nome,
        email: dados.email,
        senha: dados.senha,
        aceite,
        ref: indicacao,
        plano: planoEscolhido,
      });
    } catch {
      setEnviando(false);
      setErroGeral("Não conseguimos concluir agora. Tente de novo em instantes.");
      return;
    }
    setEnviando(false);

    if (!resultado.ok) {
      if (resultado.erros && Object.keys(resultado.erros).length > 0) {
        focoPendente.current = ORDEM_DOS_CAMPOS.find((c) => resultado.erros?.[c]) ?? null;
        setErros(resultado.erros);
      }
      if (resultado.mensagem) setErroGeral(resultado.mensagem);
      return;
    }

    /* A conta existe: a empresa (pendente de pagamento) foi criada pelo
       trigger, na mesma transação. `account_created` marca isso.
       `signup_complete` fica para quando a pessoa realmente ENTRAR — sem
       sessão, o cadastro ainda não terminou. */
    track(EVENTOS.accountCreated, { local: "criar-conta" });

    if (resultado.precisaConfirmarEmail) {
      setConfirmePorEmail(true);
      return;
    }

    track(EVENTOS.signupComplete, { local: "criar-conta" });
    /* Sem confirmação de e-mail a sessão já existe; o vínculo da indicação
       foi feito dentro de `criarConta`. */
    router.refresh();
    router.push("/app/assinatura");
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
          Clique nele para ativar sua conta e escolher seu plano.
        </p>
      </section>
    );
  }

  const temErro = Object.values(erros).some(Boolean) || Boolean(erroGeral);

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <CampoCadastro
        id="nome"
        label="Seu nome"
        value={dados.nome}
        erro={erros.nome}
        autoComplete="name"
        onFocus={marcarInicio}
        onChange={(v) => atualizar("nome", v)}
      />
      <CampoCadastro
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
      <CampoCadastro
        id="senha"
        label="Senha"
        revelarSenha
        value={dados.senha}
        erro={erros.senha}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
        autoComplete="new-password"
        onFocus={marcarInicio}
        onChange={(v) => atualizar("senha", v)}
      />

      <div className={s.aceite}>
        <label className={s.aceiteRotulo} htmlFor="aceite">
          <input
            id="aceite"
            name="aceite"
            type="checkbox"
            className={s.aceiteCaixa}
            checked={aceite}
            aria-invalid={Boolean(erros.aceite)}
            aria-describedby={erros.aceite ? "aceite-erro" : undefined}
            onChange={(e) => {
              marcarInicio();
              setAceite(e.target.checked);
              setErros((a) => ({ ...a, aceite: undefined }));
              setErroGeral(null);
            }}
          />
          <span>
            Li e aceito os{" "}
            <a href="/termos" target="_blank" rel="noopener" className={s.aceiteLink}>
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener" className={s.aceiteLink}>
              Política de Privacidade
            </a>
            .
          </span>
        </label>
        {erros.aceite && (
          <p id="aceite-erro" className={s.campoErroTexto}>
            {erros.aceite}
          </p>
        )}
      </div>

      <button className={s.enviar} type="submit" disabled={enviando} aria-busy={enviando}>
        {enviando && <span className={s.spinner} aria-hidden="true" />}
        {enviando ? "Criando sua conta…" : "Criar minha conta"}
      </button>

      <p className={s.confianca}>
        <IconeCadeado aria-hidden="true" width={16} height={16} />
        Seus dados são protegidos e sua conta pode ser acessada com segurança.
      </p>
    </form>
  );
}
