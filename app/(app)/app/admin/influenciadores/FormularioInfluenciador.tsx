"use client";

import { FormEvent, useRef, useState } from "react";
import { criarInfluenciadorAction } from "../acoes";
import BotaoCopiar from "./BotaoCopiar";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

/**
 * "Novo influenciador". O código é opcional: vazio, o servidor gera um
 * automático. A lista de baixo atualiza sozinha porque a action revalida a
 * rota; aqui só mostramos o link recém-criado para copiar na hora.
 */
export default function FormularioInfluenciador() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ nome: string; codigo: string; link: string } | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setCriado(null);

    if (nome.trim().length < 2) {
      setErro("Informe o nome do influenciador.");
      campoNome.current?.focus();
      return;
    }

    setEnviando(true);
    try {
      const r = await criarInfluenciadorAction(nome.trim(), email.trim(), codigo.trim());
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      if ("influenciador" in r && r.influenciador && r.link) {
        setCriado({ nome: r.influenciador.nome, codigo: r.influenciador.codigo, link: r.link });
      }
      setNome("");
      setEmail("");
      setCodigo("");
    } catch {
      setErro("Não foi possível criar agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className={`${s.bloco} ${a.secao}`} aria-labelledby="novo-influenciador">
      <h2 id="novo-influenciador" className={s.blocoTitulo}>
        Novo influenciador
      </h2>

      <form className={a.formulario} onSubmit={enviar} noValidate>
        <div className={s.campoApp}>
          <label htmlFor="inf-nome">Nome</label>
          <input
            id="inf-nome"
            ref={campoNome}
            value={nome}
            autoComplete="off"
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={erro && nome.trim().length < 2 ? true : undefined}
          />
        </div>
        <div className={s.campoApp}>
          <label htmlFor="inf-email">E-mail (opcional)</label>
          <input
            id="inf-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={s.campoApp}>
          <label htmlFor="inf-codigo">Código (opcional)</label>
          <input
            id="inf-codigo"
            value={codigo}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            aria-describedby="inf-codigo-dica"
          />
          <span id="inf-codigo-dica" className={s.dicaCampo}>
            Vazio gera um código automático. 4 a 20 letras ou números.
          </span>
        </div>
        <div className={a.formularioAcao}>
          <button type="submit" className={`${s.botao} ${a.botaoGrande}`} disabled={enviando} aria-busy={enviando}>
            {enviando ? "Criando…" : "Criar influenciador"}
          </button>
        </div>
      </form>

      <div className={a.erro} role="alert" hidden={!erro}>
        {erro}
      </div>

      {criado && (
        <div className={a.criado} role="status">
          <p>
            <strong>{criado.nome}</strong> criado com o código <code>{criado.codigo}</code>. Link de indicação:
          </p>
          <div className={a.linkLinha}>
            <code className={a.linkTexto}>{criado.link}</code>
            <BotaoCopiar texto={criado.link} aria={`Copiar link de ${criado.nome}`} />
          </div>
        </div>
      )}
    </section>
  );
}
