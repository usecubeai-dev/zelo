import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { aceiteVigente } from "@/lib/core/aceite-legal";
import RodapeEmpresa from "@/components/RodapeEmpresa";
import FormularioAceite from "./FormularioAceite";
import s from "../Conformidade.module.css";

export const metadata: Metadata = {
  title: "Aceite dos Termos",
  robots: { index: false, follow: false },
};

/**
 * Aceite dos Termos e da Política para quem ainda não aceitou a versão
 * vigente (conta antiga, ou os documentos mudaram). Fica FORA do layout de
 * /app de propósito: esse layout redireciona para cá, e dentro dele seria
 * um laço. Por isso a página tem a própria moldura (tokens `zelo-produto`).
 */
export default async function Aceite() {
  const atual = await usuarioAtual();
  if (!atual) redirect("/entrar?de=/aceite");
  if (await aceiteVigente(atual.user.id)) redirect("/app");

  return (
    <div className={`${s.pagina} zelo-produto`}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>
      </header>
      <main className={s.corpoCentral}>
        <FormularioAceite />
      </main>
      <RodapeEmpresa variante="claro" compacto />
    </div>
  );
}
