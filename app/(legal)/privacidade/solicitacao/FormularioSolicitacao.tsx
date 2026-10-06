"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ROTULO_SOLICITACAO, TIPOS_SOLICITACAO } from "@/lib/solicitacao-tipos";
import { enviarSolicitacaoTitular } from "./acoes";
import s from "../../Legal.module.css";

const LIMITE_MENSAGEM = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Campo = "tipo" | "email" | "nome" | "mensagem";
type Erros = Partial<Record<Campo, string>>;
const ORDEM: readonly Campo[] = ["tipo", "email", "nome", "mensagem"];

/**
 * Formulário público (sem login) de pedido do titular. A validação daqui é
 * conveniência — o servidor valida tudo de novo. O campo `site` é uma isca
 * para robôs: invisível e fora da ordem de tabulação, precisa ir vazio.
 */
export default function FormularioSolicitacao() {
  const [tipo, setTipo] = useState("");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [site, setSite] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const focoPendente = useRef<Campo | null>(null);
  const blocoSucesso = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(`sol-${campo}`)?.focus();
    focoPendente.current = null;
  }, [erros]);

  /* O formulário some e a confirmação entra no lugar: o foco vai para ela,
     senão quem usa teclado/leitor de tela fica num botão que não existe mais. */
  useEffect(() => {
    if (enviado) blocoSucesso.current?.focus();
  }, [enviado]);

  const limpar = (campo: Campo) => {
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando) return;
    setErroGeral(null);

    const achados: Erros = {};
    if (!(TIPOS_SOLICITACAO as readonly string[]).includes(tipo)) achados.tipo = "Escolha o tipo de pedido.";
    if (!EMAIL.test(email.trim().toLowerCase())) achados.email = "Informe um e-mail válido.";
    if (nome.trim().length > 120) achados.nome = "Nome muito longo.";
    if (mensagem.trim().length > LIMITE_MENSAGEM) {
      achados.mensagem = `Mensagem muito longa (máximo ${LIMITE_MENSAGEM} caracteres).`;
    }
    focoPendente.current = ORDEM.find((c) => achados[c]) ?? null;
    setErros(achados);
    if (focoPendente.current) return;

    setEnviando(true);
    try {
      const r = await enviarSolicitacaoTitular({ tipo, email, nome, mensagem, site });
      if (!r.ok) {
        if (r.erros && Object.keys(r.erros).length > 0) {
          focoPendente.current = ORDEM.find((c) => r.erros?.[c]) ?? null;
          setErros(r.erros);
        }
        if (r.mensagem) setErroGeral(r.mensagem);
        return;
      }
      setEnviado(true);
    } catch {
      setErroGeral("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div ref={blocoSucesso} tabIndex={-1} className={s.sucesso} role="status" aria-live="polite">
        <h2 className={s.sucessoTitulo}>Pedido recebido</h2>
        <p className={s.sucessoTexto}>Pedido recebido. Vamos responder ao e-mail informado.</p>
      </div>
    );
  }

  const temErro = Object.values(erros).some(Boolean) || Boolean(erroGeral);

  return (
    <form className={s.formulario} noValidate onSubmit={enviar}>
      <div className={s.erroGeral} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <div className={s.campo}>
        <label className={s.campoRotulo} htmlFor="sol-tipo">
          Tipo de pedido
        </label>
        <select
          id="sol-tipo"
          name="tipo"
          className={s.entrada}
          value={tipo}
          aria-invalid={Boolean(erros.tipo)}
          aria-describedby={erros.tipo ? "sol-tipo-erro" : undefined}
          onChange={(e) => {
            setTipo(e.target.value);
            limpar("tipo");
          }}
        >
          <option value="">Selecione…</option>
          {TIPOS_SOLICITACAO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_SOLICITACAO[t]}
            </option>
          ))}
        </select>
        {erros.tipo && (
          <p id="sol-tipo-erro" className={s.erroCampo}>
            {erros.tipo}
          </p>
        )}
      </div>

      <div className={s.campo}>
        <label className={s.campoRotulo} htmlFor="sol-email">
          E-mail para resposta
        </label>
        <input
          id="sol-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className={s.entrada}
          value={email}
          aria-invalid={Boolean(erros.email)}
          aria-describedby={erros.email ? "sol-email-erro" : "sol-email-dica"}
          onChange={(e) => {
            setEmail(e.target.value);
            limpar("email");
          }}
        />
        {erros.email ? (
          <p id="sol-email-erro" className={s.erroCampo}>
            {erros.email}
          </p>
        ) : (
          <p id="sol-email-dica" className={s.dicaCampo}>
            Use o e-mail cadastrado no Zelo ou o que consta nos dados que você quer consultar.
          </p>
        )}
      </div>

      <div className={s.campo}>
        <label className={s.campoRotulo} htmlFor="sol-nome">
          Nome <span className={s.opcional}>(opcional)</span>
        </label>
        <input
          id="sol-nome"
          name="nome"
          autoComplete="name"
          className={s.entrada}
          value={nome}
          maxLength={160}
          aria-invalid={Boolean(erros.nome)}
          aria-describedby={erros.nome ? "sol-nome-erro" : undefined}
          onChange={(e) => {
            setNome(e.target.value);
            limpar("nome");
          }}
        />
        {erros.nome && (
          <p id="sol-nome-erro" className={s.erroCampo}>
            {erros.nome}
          </p>
        )}
      </div>

      <div className={s.campo}>
        <label className={s.campoRotulo} htmlFor="sol-mensagem">
          Mensagem <span className={s.opcional}>(opcional)</span>
        </label>
        <textarea
          id="sol-mensagem"
          name="mensagem"
          className={s.entrada}
          value={mensagem}
          aria-invalid={Boolean(erros.mensagem)}
          aria-describedby={erros.mensagem ? "sol-mensagem-erro" : "sol-mensagem-contador"}
          onChange={(e) => {
            setMensagem(e.target.value);
            limpar("mensagem");
          }}
        />
        {erros.mensagem && (
          <p id="sol-mensagem-erro" className={s.erroCampo}>
            {erros.mensagem}
          </p>
        )}
        <span id="sol-mensagem-contador" className={s.contador}>
          {mensagem.length} / {LIMITE_MENSAGEM}
        </span>
      </div>

      {/* campo-isca: pessoas não veem nem alcançam por teclado; robôs preenchem */}
      <div className={s.isca} aria-hidden="true">
        <label htmlFor="sol-site">Não preencha este campo</label>
        <input
          id="sol-site"
          name="site"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={site}
          onChange={(e) => setSite(e.target.value)}
        />
      </div>

      <button type="submit" className={s.enviar} disabled={enviando} aria-busy={enviando}>
        {enviando && <span className={s.spinner} aria-hidden="true" />}
        {enviando ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
