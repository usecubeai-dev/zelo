"use client";

import { useEffect } from "react";
import s from "../App.module.css";

/**
 * Fronteira de erro do sistema.
 *
 * `digest` é o identificador que o Next gera para o erro no servidor. Ele
 * aparece aqui e no log do servidor, então o usuário pode citá-lo no
 * suporte sem que a mensagem real — que pode conter tabela, coluna ou
 * caminho de arquivo — vaze para a tela.
 */
export default function ErroDoSistema({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erro na rota:", error);
  }, [error]);

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Algo deu errado</h1>
      </header>

      <section className={s.erroRota} role="alert">
        <h2 className={s.erroRotaTitulo}>Não conseguimos carregar esta tela</h2>
        <p className={s.erroRotaTexto}>
          O problema é do nosso lado. Tente de novo — se continuar, seus dados
          seguem seguros e nada foi perdido.
        </p>
        {error.digest && (
          <p className={s.erroRotaCodigo}>Código do erro: {error.digest}</p>
        )}
        <div className={s.acoes}>
          <button type="button" className={s.botao} onClick={reset}>
            Tentar de novo
          </button>
        </div>
      </section>
    </>
  );
}
