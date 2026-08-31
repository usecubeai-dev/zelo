import s from "../../App.module.css";

/** Esqueleto com a forma da lista: barra de busca e linhas de tabela. */
export default function CarregandoClientes() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando clientes…</span>
      <div className={s.cabecalho}>
        <div className={`${s.esqueleto} ${s.esqueletoTitulo}`} />
        <div className={`${s.esqueleto} ${s.esqueletoTexto}`} />
      </div>
      <div className={`${s.esqueleto} ${s.esqueletoBarra}`} />
      <div className={s.tabelaEnvolve}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${s.esqueleto} ${s.esqueletoLinha}`} />
        ))}
      </div>
    </div>
  );
}
