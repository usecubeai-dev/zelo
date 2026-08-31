import Link from "next/link";
import s from "../../../App.module.css";

export default function CobrancaNaoEncontrada() {
  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Cobrança não encontrada</h1>
      </header>
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Esta cobrança não existe</h2>
        <p className={s.vazioTexto}>
          Ela pode ter sido removida, ou o endereço está errado.
        </p>
        <div className={s.acoes} style={{ justifyContent: "center" }}>
          <Link href="/app/cobrancas" className={s.botao}>
            Ver minhas cobranças
          </Link>
        </div>
      </section>
    </>
  );
}
