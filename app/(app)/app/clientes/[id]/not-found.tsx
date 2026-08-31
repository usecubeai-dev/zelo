import Link from "next/link";
import s from "../../../App.module.css";

/**
 * Cliente inexistente OU de outra empresa — a mensagem é a mesma de
 * propósito. Dizer "existe, mas você não pode ver" já entrega informação
 * sobre dados de outra empresa.
 */
export default function ClienteNaoEncontrado() {
  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Cliente não encontrado</h1>
      </header>
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Este cliente não existe</h2>
        <p className={s.vazioTexto}>
          Ele pode ter sido excluído, ou o endereço está errado.
        </p>
        <div className={s.acoes} style={{ justifyContent: "center" }}>
          <Link href="/app/clientes" className={s.botao}>
            Ver meus clientes
          </Link>
        </div>
      </section>
    </>
  );
}
