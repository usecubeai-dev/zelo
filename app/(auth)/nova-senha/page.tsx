import type { Metadata } from "next";
import FormularioNovaSenha from "./FormularioNovaSenha";
import s from "../Auth.module.css";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
};

export default function NovaSenha() {
  return (
    <>
      <h1 className={s.titulo}>Criar nova senha</h1>
      <p className={s.lead}>Escolha uma senha nova para sua conta.</p>
      <FormularioNovaSenha />
    </>
  );
}
