"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarAceiteAction } from "./acoes";
import a from "../App.module.css";
import s from "../Conformidade.module.css";

const MENSAGEM_ACEITE = "Para continuar, aceite os Termos de Uso e a Política de Privacidade.";

/**
 * Cartão de aceite. O checkbox nasce DESMARCADO: aceitar é um ato ativo, e a
 * Server Action também recusa `false` — o cliente só poupa a ida ao servidor.
 */
export default function FormularioAceite() {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caixa = useRef<HTMLInputElement>(null);
  const focarCaixa = useRef(false);

  /* Foco no checkbox quando o erro é de aceite: quem usa teclado ou leitor
     de tela precisa cair no campo que falta, não ficar no botão. */
  useEffect(() => {
    if (erro && focarCaixa.current) {
      caixa.current?.focus();
      focarCaixa.current = false;
    }
  }, [erro]);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando) return;

    if (!aceito) {
      focarCaixa.current = true;
      setErro(MENSAGEM_ACEITE);
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const r = await registrarAceiteAction(true);
      if (!r.ok) {
        setErro(r.mensagem);
        setEnviando(false);
        return;
      }
      /* Mantém "enviando" ligado: a navegação já começou e o botão não deve
         reabilitar antes de a tela trocar. */
      router.push("/app");
      router.refresh();
    } catch {
      setErro("Não foi possível registrar agora. Tente novamente em instantes.");
      setEnviando(false);
    }
  };

  return (
    <section className={s.cartaoCentral} aria-labelledby="aceite-titulo">
      <h1 id="aceite-titulo" className={s.tituloCentral}>
        Antes de continuar
      </h1>
      <p className={s.textoCentral}>
        Para usar o Zelo é preciso aceitar os Termos de Uso e a Política de Privacidade na versão atual. Se você já
        usava o Zelo, eles foram atualizados desde o seu último acesso. Leia os documentos e confirme abaixo.
      </p>

      <form noValidate onSubmit={enviar}>
        <label className={s.aceiteRotulo} htmlFor="aceite">
          <input
            ref={caixa}
            id="aceite"
            name="aceite"
            type="checkbox"
            className={s.aceiteCaixa}
            checked={aceito}
            aria-invalid={erro === MENSAGEM_ACEITE}
            aria-describedby={erro ? "aceite-erro" : undefined}
            onChange={(e) => {
              setAceito(e.target.checked);
              setErro(null);
            }}
          />
          <span>
            Li e aceito os{" "}
            <a href="/termos" target="_blank" rel="noopener" className={s.linkTexto}>
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener" className={s.linkTexto}>
              Política de Privacidade
            </a>
            .
          </span>
        </label>

        {/* região viva sempre presente: o leitor de tela anuncia o erro quando ele aparece */}
        <div id="aceite-erro" className={a.erroForm} style={{ marginTop: 14 }} role="alert" aria-live="assertive" hidden={!erro}>
          {erro}
        </div>

        <div className={s.acoesCentral}>
          <button type="submit" className={`${a.botao} ${s.botaoGrande}`} disabled={enviando} aria-busy={enviando}>
            {enviando && <span className={s.spinner} aria-hidden="true" />}
            {enviando ? "Registrando…" : "Aceitar e continuar"}
          </button>
        </div>
      </form>

      {/* Sair por POST (mesma regra de BotaoSair): logout via GET deixa um site
          qualquer derrubar a sessão. Aqui com texto, porque o botão de ícone
          da barra lateral não existe nesta tela. */}
      <form action="/auth/sair" method="post" className={s.acoesCentral} style={{ marginTop: 10 }}>
        <button type="submit" className={`${a.botaoSec} ${s.botaoGrande}`}>
          Sair
        </button>
      </form>
    </section>
  );
}
