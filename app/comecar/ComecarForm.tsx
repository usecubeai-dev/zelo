"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { EVENTOS, track } from "@/lib/analytics";
import {
  CampoLead,
  ErrosLead,
  LEAD_VAZIO,
  Lead,
  ResultadoLead,
  ROTULOS,
  normalizarLead,
  primeiroCampoInvalido,
  registrarLead,
  validarLead,
} from "@/lib/lead";
import s from "./Comecar.module.css";

/**
 * O formulário não conhece as regras do lead — elas vivem em `lib/lead.ts`,
 * porque o servidor vai precisar das mesmas quando o cadastro existir.
 * Aqui fica só o que é de interface: estado, foco, erro e resultado.
 */
export default function ComecarForm({
  destinoConfigurado = false,
}: {
  /** vem do servidor: existe banco ligado para receber este lead? */
  destinoConfigurado?: boolean;
}) {
  const [campos, setCampos] = useState<Lead>(LEAD_VAZIO);
  const [erros, setErros] = useState<ErrosLead>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLead | null>(null);
  const iniciou = useRef(false);
  const focoPendente = useRef<CampoLead | null>(null);
  const tituloSucesso = useRef<HTMLHeadingElement>(null);

  /* o foco vai para o primeiro campo inválido só depois de o React ter
     pintado os erros — antes disso o aria-describedby ainda não existe */
  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(campo)?.focus();
    focoPendente.current = null;
  }, [erros]);

  useEffect(() => {
    if (resultado) tituloSucesso.current?.focus();
  }, [resultado]);

  /* uma vez só por sessão: é a entrada no funil, não cada tecla */
  const marcarInicio = () => {
    if (iniciou.current) return;
    iniciou.current = true;
    track(EVENTOS.signupStart, { local: "formulario-comecar" });
  };

  const atualizar = (campo: CampoLead, valor: string) => {
    marcarInicio();
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    setErroEnvio(null);
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    marcarInicio();

    setErroEnvio(null);
    const encontrados = validarLead(campos);
    focoPendente.current = primeiroCampoInvalido(encontrados);
    setErros(encontrados);
    if (focoPendente.current) return;

    setEnviando(true);
    const r = await registrarLead(normalizarLead(campos));
    setEnviando(false);

    /* O servidor revalidou e recusou. Só acontece se alguém contornar o
       formulário, mas se acontecer o visitante precisa ver por quê. */
    if (r.estado === "invalido") {
      focoPendente.current = primeiroCampoInvalido(r.erros);
      setErros(r.erros);
      return;
    }

    /* Falha de rede ou do destino: o formulário CONTINUA preenchido, para a
       pessoa só tentar de novo em vez de digitar tudo outra vez. */
    if (r.estado === "erro") {
      setErroEnvio(r.mensagem);
      return;
    }

    /* `lead_captured`, NÃO `signup_complete`. O lead está no banco, mas
       nenhuma conta foi criada e nenhuma assinatura começou — chamar
       isso de cadastro concluído infla a conversão e faz a decisão de
       tráfego sair de um número falso. `signup_complete` só entra quando a
       conta existir de fato.

       Em `nao-configurado` nada saiu do navegador, então nada dispara. */
    if (r.estado === "registrado") {
      track(EVENTOS.leadCaptured, { local: "formulario-comecar" });
    }

    setResultado(r);
  };

  if (resultado) {
    const registrado = resultado.estado === "registrado";
    return (
      <section
        className={s.sucesso}
        aria-labelledby="sucesso-titulo"
        role="status"
        aria-live="polite"
      >
        <span className={s.sucessoMarca} aria-hidden="true">
          ✓
        </span>
        <h2 id="sucesso-titulo" ref={tituloSucesso} tabIndex={-1}>
          {registrado
            ? "Cadastro recebido."
            : "Dados prontos para o próximo passo."}
        </h2>
        <p>
          {registrado
            ? "Em breve entramos em contato para criar sua conta e você escolher o plano."
            : "Seus dados foram validados neste navegador e ainda não foram enviados. A criação da conta e a escolha do plano serão conectadas aqui quando o cadastro seguro estiver configurado."}
        </p>
      </section>
    );
  }

  const temErro = Object.keys(erros).length > 0 || Boolean(erroEnvio);
  const mensagemGeral =
    erroEnvio ?? "Revise os campos destacados antes de continuar.";

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      {/* aria-live no contêiner e não na mensagem: assim o leitor de tela
          anuncia quando o texto aparece, e não só quando o nó já existia */}
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!temErro}>
        {temErro ? mensagemGeral : ""}
      </div>

      <div className={s.campos}>
        <Campo
          id="nome"
          value={campos.nome}
          error={erros.nome}
          autoComplete="name"
          onFocus={marcarInicio}
          onChange={(valor) => atualizar("nome", valor)}
        />
        <Campo
          id="whatsapp"
          type="tel"
          inputMode="tel"
          value={campos.whatsapp}
          error={erros.whatsapp}
          autoComplete="tel"
          onFocus={marcarInicio}
          onChange={(valor) => atualizar("whatsapp", valor)}
        />
        <Campo
          id="email"
          type="email"
          inputMode="email"
          largo
          value={campos.email}
          error={erros.email}
          autoComplete="email"
          onFocus={marcarInicio}
          onChange={(valor) => atualizar("email", valor)}
        />
      </div>

      <p className={s.aviso}>
        {destinoConfigurado
          ? "Pedimos só o necessário para falar com você. Usamos seus dados apenas para criar sua conta e apresentar os planos."
          : "Pedimos só o necessário para falar com você. Nesta etapa seus dados ficam somente neste navegador: nada é enviado, nenhuma conta é criada e nenhuma assinatura começa até o cadastro seguro estar configurado."}
      </p>

      <button className={s.enviar} type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Quero começar"}
      </button>
    </form>
  );
}

function Campo({
  id,
  error,
  largo,
  onChange,
  ...input
}: {
  id: CampoLead;
  error?: string;
  /** ocupa a linha inteira da grade — o e-mail é o campo mais longo */
  largo?: boolean;
  onChange: (valor: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "onChange">) {
  const errorId = `${id}-erro`;
  return (
    <div className={largo ? `${s.campo} ${s.campoLargo}` : s.campo}>
      <label htmlFor={id}>{ROTULOS[id]}</label>
      <input
        {...input}
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(evento) => onChange(evento.target.value)}
      />
      {error && (
        <p id={errorId} className={s.erro}>
          {error}
        </p>
      )}
    </div>
  );
}
