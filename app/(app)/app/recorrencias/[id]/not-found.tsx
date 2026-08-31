import Link from "next/link";
import s from "../../../App.module.css";

export default function RecorrenciaNaoEncontrada() {
  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Recorrência não encontrada</h1>
      </header>
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Esta recorrência não existe</h2>
        <p className={s.vazioTexto}>
          Ela pode ter sido encerrada, ou o endereço está errado.
        </p>
        <div className={s.acoes} style={{ justifyContent: "center" }}>
          <Link href="/app/recorrencias" className={s.botao}>
            Ver minhas recorrências
          </Link>
        </div>
      </section>
    </>
  );
}
