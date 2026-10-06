import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import type { Empresa } from "@/lib/empresa";
import { normalizarPlano } from "@/lib/plano";
import FormularioCliente from "../FormularioCliente";
import s from "../../../App.module.css";

export const metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  /* o plano vigente é decidido no servidor; o formulário só recebe o resultado */
  const atual = await usuarioAtual();
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  const planoEscola = normalizarPlano(empresa?.plano) === "escola";

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Novo cliente</h1>
        <p className={s.subtitulo}>
          Só o nome é obrigatório. O resto você completa depois.
        </p>
      </header>
      <FormularioCliente planoEscola={planoEscola} />
      <div className={s.acoes}>
        <Link href="/app/clientes" className={s.faixaLink}>← Voltar para clientes</Link>
      </div>
    </>
  );
}
