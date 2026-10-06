"use client";

import { FormEvent, useState } from "react";
import { excluirConta } from "./acoes";
import { RETENCAO_FISCAL_ROTULO } from "@/lib/legal";
import a from "../../App.module.css";
import s from "../../Conformidade.module.css";

/* O servidor confere de novo (`PALAVRA_DE_CONFIRMACAO`, em lib/core/exclusao-conta.ts,
   que é só de servidor); aqui o literal serve apenas para habilitar o botão. */
const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

const EXPORTACOES = [
  { tipo: "clientes", rotulo: "Baixar clientes (CSV)" },
  { tipo: "cobrancas", rotulo: "Baixar cobranças (CSV)" },
  { tipo: "recebimentos", rotulo: "Baixar recebimentos (CSV)" },
] as const;

/**
 * Exclusão da conta — zona de perigo, só para o dono.
 *
 * A tela diz o que acontece, na ordem em que importa: antes, a pessoa pode
 * baixar os dados; depois, digita a palavra de confirmação (botão desabilitado
 * até bater). O prazo de guarda fiscal vem de `RETENCAO_FISCAL_ROTULO`: se o
 * prazo ainda não foi definido, aparece `[PREENCHER]` — nunca um número
 * inventado.
 */
export default function ExcluirConta() {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluida, setExcluida] = useState(false);

  const confere = texto.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confere || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await excluirConta(texto);
      if (!r.ok) {
        setErro(r.mensagem);
        setOcupado(false);
        return;
      }
      /* A sessão já foi encerrada pelo servidor: navegação completa (não
         `router.push`) para a landing, sem estado do app sobrando. O botão
         continua desabilitado até a página trocar. */
      setExcluida(true);
      window.location.href = "/";
    } catch {
      setErro("Não foi possível excluir agora. Tente novamente em instantes.");
      setOcupado(false);
    }
  };

  return (
    <section className={`${a.bloco} ${a.blocoPerigo} ${s.secao}`} aria-labelledby="excluir-titulo">
      <h2 id="excluir-titulo" className={s.estadoTitulo}>
        Excluir conta
      </h2>
      <p className={s.secaoTexto}>
        Excluir a conta é permanente. Veja o que acontece antes de continuar:
      </p>
      <ul className={s.lista}>
        <li>A assinatura paga é cancelada e a cobrança é interrompida.</li>
        <li>
          Os dados pessoais são anonimizados: nome, e-mail e telefone dos seus clientes, entre outros.
        </li>
        <li>
          Cobranças, pagamentos, assinaturas, taxas e comissões ficam guardados por obrigação legal pelo prazo de{" "}
          <strong>{RETENCAO_FISCAL_ROTULO}</strong>.
        </li>
        <li>O acesso à conta é bloqueado.</li>
      </ul>

      <h3 className={s.passoPergunta} style={{ marginTop: 20 }}>
        Antes de excluir, baixe seus dados
      </h3>
      <div className={s.exportacoes}>
        {EXPORTACOES.map((x) => (
          <a key={x.tipo} className={`${a.botaoSec} ${s.botaoGrande}`} href={`/app/exportar?tipo=${x.tipo}`} download>
            {x.rotulo}
          </a>
        ))}
      </div>

      <form onSubmit={enviar} noValidate className={s.passoConfirma} style={{ marginTop: 20 }}>
        <div className={`${a.campoApp} ${s.campoConfirmacao}`}>
          <label htmlFor="excluir-confirmacao">
            Para confirmar, digite <strong>{PALAVRA_DE_CONFIRMACAO}</strong>
          </label>
          <input
            id="excluir-confirmacao"
            name="confirmacao"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={texto}
            disabled={ocupado}
            aria-describedby="excluir-erro"
            onChange={(e) => {
              setTexto(e.target.value);
              setErro(null);
            }}
          />
        </div>

        <div id="excluir-erro" className={a.erroForm} role="alert" aria-live="assertive" hidden={!erro}>
          {erro}
        </div>
        <div className={a.sucessoForm} role="status" aria-live="polite" hidden={!excluida}>
          {excluida ? "Conta excluída. Levando você para a página inicial…" : ""}
        </div>

        <div className={s.acoesLinha}>
          <button
            type="submit"
            className={s.botaoPerigoCheio}
            disabled={!confere || ocupado}
            aria-busy={ocupado}
          >
            {ocupado && <span className={s.spinner} aria-hidden="true" />}
            {ocupado ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </div>
      </form>
    </section>
  );
}
