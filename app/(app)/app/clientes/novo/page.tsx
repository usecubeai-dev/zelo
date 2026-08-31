import Link from "next/link";
import FormularioCliente from "../FormularioCliente";
import s from "../../../App.module.css";

export const metadata = { title: "Novo cliente" };

export default function NovoCliente() {
  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Novo cliente</h1>
        <p className={s.subtitulo}>
          Só o nome é obrigatório. O resto você completa depois.
        </p>
      </header>
      <FormularioCliente />
      <div className={s.acoes}>
        <Link href="/app/clientes" className={s.faixaLink}>← Voltar para clientes</Link>
      </div>
    </>
  );
}
