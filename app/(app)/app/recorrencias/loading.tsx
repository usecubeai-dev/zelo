import s from "../../App.module.css";

export default function CarregandoRecorrencias() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando recorrências…</span>
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
