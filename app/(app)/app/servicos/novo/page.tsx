import Link from "next/link";
import FormularioServico from "../FormularioServico";
import s from "../../../App.module.css";

export const metadata = { title: "Novo serviço" };

export default function NovoServico() {
  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Novo serviço</h1>
        <p className={s.subtitulo}>
          O que você vende — nome, tipo e valor. Depois você associa a um cliente na hora de cobrar.
        </p>
      </header>
      <FormularioServico />
      <div className={s.acoes}>
        <Link href="/app/servicos" className={s.faixaLink}>← Voltar para serviços</Link>
      </div>
    </>
  );
}
