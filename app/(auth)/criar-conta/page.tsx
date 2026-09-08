import type { Metadata } from "next";
import Link from "next/link";
import FormularioCadastro from "./FormularioCadastro";
import { formatarCentavos } from "@/lib/dinheiro";
import { PRECO_POR_PLANO_CENTAVOS } from "@/lib/plano";
import s from "../Auth.module.css";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Zelo e comece 30 dias grátis.",
  robots: { index: false, follow: true },
};

export default function CriarConta() {
  return (
    <>
      <h1 className={s.titulo}>Crie sua conta</h1>
      <p className={s.lead}>
        30 dias grátis. Depois, a partir de {formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)} por mês. Sem cartão para começar.
      </p>

      <FormularioCadastro />

      <div className={s.rodape}>
        <span>
          Já tem conta?{" "}
          <Link href="/entrar" className={s.link}>
            Entrar
          </Link>
        </span>
      </div>
    </>
  );
}
