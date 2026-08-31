import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FormularioLogin from "./FormularioLogin";
import s from "../Auth.module.css";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta Zelo.",
  robots: { index: false, follow: true },
};

export default function Entrar() {
  return (
    <>
      <h1 className={s.titulo}>Entrar</h1>
      <p className={s.lead}>Acesse suas cobranças e seus clientes.</p>

      {/* useSearchParams exige Suspense em página estática */}
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>

      <div className={s.rodape}>
        <Link href="/recuperar-senha" className={s.link}>
          Esqueci minha senha
        </Link>
        <span>
          Não tem conta?{" "}
          <Link href="/criar-conta" className={s.link}>
            Criar conta
          </Link>
        </span>
      </div>
    </>
  );
}
