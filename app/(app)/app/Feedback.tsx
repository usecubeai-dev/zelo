"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconeFechar } from "./Icones";
import s from "../App.module.css";

/**
 * Feedback visual do produto: toasts (sucesso, erro, aviso, informação) e
 * diálogo de confirmação no lugar do `confirm()` nativo.
 *
 * Fica montado na casca (CascaApp), então um toast disparado antes de uma
 * navegação aparece na página seguinte. Toasts NÃO substituem a mensagem
 * escrita na tela (ela continua sendo o registro acessível do que aconteceu);
 * eles dão a resposta imediata e curta. Erros ficam mais tempo e são
 * anunciados com `role="alert"`.
 */

type Tipo = "sucesso" | "erro" | "aviso" | "info";
type ItemToast = { id: number; tipo: Tipo; texto: string };

export type OpcoesConfirmacao = {
  titulo: string;
  texto?: string;
  /** rótulo do botão que confirma (ex.: "Cancelar autorização") */
  confirmar?: string;
  /** rótulo do botão que desiste */
  voltar?: string;
  /** ação que não tem volta: o botão de confirmar fica vermelho */
  perigo?: boolean;
};

type Contexto = {
  mostrar: (tipo: Tipo, texto: string) => void;
  confirmar: (opcoes: OpcoesConfirmacao) => Promise<boolean>;
};

const Ctx = createContext<Contexto | null>(null);

const DURACAO: Record<Tipo, number> = { sucesso: 4000, info: 4500, aviso: 6000, erro: 7000 };
const LIMITE = 3;

const SIMBOLO: Record<Tipo, string> = { sucesso: "✓", erro: "!", aviso: "!", info: "i" };

/** `toast.sucesso("Link copiado ✅")` — seguro mesmo fora da casca (não faz nada). */
export function useToast() {
  const c = useContext(Ctx);
  return useMemo(
    () => ({
      sucesso: (texto: string) => c?.mostrar("sucesso", texto),
      erro: (texto: string) => c?.mostrar("erro", texto),
      aviso: (texto: string) => c?.mostrar("aviso", texto),
      info: (texto: string) => c?.mostrar("info", texto),
    }),
    [c]
  );
}

/** `if (!(await confirmar({ titulo: "Cancelar?", perigo: true }))) return;` */
export function useConfirmar() {
  const c = useContext(Ctx);
  return useCallback(
    (opcoes: OpcoesConfirmacao) => (c ? c.confirmar(opcoes) : Promise.resolve(true)),
    [c]
  );
}

export default function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ItemToast[]>([]);
  const proximo = useRef(1);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remover = useCallback((id: number) => {
    const t = temporizadores.current.get(id);
    if (t) clearTimeout(t);
    temporizadores.current.delete(id);
    setToasts((lista) => lista.filter((x) => x.id !== id));
  }, []);

  const mostrar = useCallback(
    (tipo: Tipo, texto: string) => {
      const id = proximo.current++;
      setToasts((lista) => [...lista.slice(-(LIMITE - 1)), { id, tipo, texto }]);
      temporizadores.current.set(id, setTimeout(() => remover(id), DURACAO[tipo]));
    },
    [remover]
  );

  useEffect(() => {
    const mapa = temporizadores.current;
    return () => mapa.forEach((t) => clearTimeout(t));
  }, []);

  /* ---------- diálogo de confirmação ---------- */
  const [dialogo, setDialogo] = useState<{ opcoes: OpcoesConfirmacao; resolver: (v: boolean) => void } | null>(null);
  const elemento = useRef<HTMLDialogElement>(null);
  const botaoVoltar = useRef<HTMLButtonElement>(null);

  const confirmar = useCallback(
    (opcoes: OpcoesConfirmacao) => new Promise<boolean>((resolver) => setDialogo({ opcoes, resolver })),
    []
  );

  useEffect(() => {
    const el = elemento.current;
    if (!dialogo || !el) return;
    if (!el.open) el.showModal();
    /* o foco começa em "Voltar": confirmar sem querer (Enter) não destrói nada */
    botaoVoltar.current?.focus();
  }, [dialogo]);

  const responder = (resposta: boolean) => {
    const atual = dialogo;
    if (!atual) return;
    elemento.current?.close();
    setDialogo(null);
    atual.resolver(resposta);
  };

  const valor = useMemo(() => ({ mostrar, confirmar }), [mostrar, confirmar]);

  return (
    <Ctx.Provider value={valor}>
      {children}

      <div className={s.toasts} aria-label="Avisos">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${s.toast} ${s[`toast_${t.tipo}`]}`}
            role={t.tipo === "erro" ? "alert" : "status"}
          >
            <span className={s.toastSimbolo} aria-hidden="true">
              {SIMBOLO[t.tipo]}
            </span>
            <span className={s.toastTexto}>{t.texto}</span>
            <button type="button" className={s.toastFechar} onClick={() => remover(t.id)} aria-label="Fechar aviso">
              <IconeFechar className={s.navIcone} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {dialogo && (
        <dialog
          ref={elemento}
          className={s.dialogo}
          aria-labelledby="dialogo-titulo"
          aria-describedby={dialogo.opcoes.texto ? "dialogo-texto" : undefined}
          onCancel={(ev) => {
            ev.preventDefault();
            responder(false);
          }}
          onClick={(ev) => {
            /* clique no fundo escuro (fora da caixa) desiste */
            if (ev.target === ev.currentTarget) responder(false);
          }}
        >
          <div className={s.dialogoCaixa}>
            <h2 id="dialogo-titulo" className={s.dialogoTitulo}>
              {dialogo.opcoes.titulo}
            </h2>
            {dialogo.opcoes.texto && (
              <p id="dialogo-texto" className={s.dialogoTexto}>
                {dialogo.opcoes.texto}
              </p>
            )}
            <div className={s.dialogoAcoes}>
              <button ref={botaoVoltar} type="button" className={s.botaoSec} onClick={() => responder(false)}>
                {dialogo.opcoes.voltar ?? "Voltar"}
              </button>
              <button
                type="button"
                className={dialogo.opcoes.perigo ? `${s.botao} ${s.botaoPerigoSolido}` : s.botao}
                onClick={() => responder(true)}
              >
                {dialogo.opcoes.confirmar ?? "Confirmar"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </Ctx.Provider>
  );
}
