import type { Metadata } from "next";
import Link from "next/link";
import FormularioRecuperar from "./FormularioRecuperar";
import s from "../Auth.module.css";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
};

export default function RecuperarSenha() {
  return (
    <>
      <h1 className={s.titulo}>Recuperar senha</h1>
      <p className={s.lead}>
        Informe seu e-mail e enviamos um link para você criar uma nova senha.
      </p>
      <FormularioRecuperar />
      <div className={s.rodape}>
        <Link href="/entrar" className={s.link}>
          Voltar para entrar
        </Link>
      </div>
    </>
  );
}
