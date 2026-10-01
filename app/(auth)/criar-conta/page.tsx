import type { Metadata } from "next";
import Link from "next/link";
import FormularioCadastro from "./FormularioCadastro";
import { formatarCentavos } from "@/lib/dinheiro";
import { PRECO_POR_PLANO_CENTAVOS } from "@/lib/plano";
import c from "./Cadastro.module.css";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Zelo e comece 30 dias grátis.",
  robots: { index: false, follow: true },
};

export default function CriarConta() {
  return (
    <>
      <h1 className={c.titulo}>Crie sua conta</h1>
      <p className={c.lead}>Comece a organizar seus recebimentos com o Zelo.</p>
      <span className={c.oferta}>
        <span className={c.ofertaPonto} aria-hidden="true" />
        30 dias grátis · a partir de {formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês · sem cartão
      </span>

      <FormularioCadastro />

      <div className={c.rodape}>
        <span>
          Já tem uma conta?{" "}
          <Link href="/entrar" className={c.link}>
            Entrar
          </Link>
        </span>
      </div>
    </>
  );
}
