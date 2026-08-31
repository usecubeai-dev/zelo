import s from "../App.module.css";

/**
 * Carregamento padrão de qualquer tela do sistema.
 *
 * O esqueleto tem a forma do cabeçalho + um bloco: quando o conteúdo real
 * chega, ele ocupa mais ou menos o mesmo espaço e a tela não salta. Um
 * spinner centralizado não informa nada e ainda deixa o layout pular.
 */
export default function Carregando() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className={s.cabecalho}>
        <div className={`${s.esqueleto} ${s.esqueletoTitulo}`} />
        <div className={`${s.esqueleto} ${s.esqueletoTexto}`} />
      </div>
      <div className={`${s.esqueleto} ${s.esqueletoCaixa}`} />
    </div>
  );
}
