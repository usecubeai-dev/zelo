import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import FormularioCobranca from "../FormularioCobranca";
import s from "../../../App.module.css";

export const metadata = { title: "Nova cobrança" };

export default async function NovaCobranca() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  /* só clientes ativos: cobrar alguém arquivado é quase sempre engano, e a
     Server Action recusa mesmo se a opção chegasse aqui */
  const { data } = await supabase
    .from("clientes")
    .select("id,nome")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome");

  const clientes = data ?? [];

  if (clientes.length === 0) {
    return (
      <>
        <header className={s.cabecalho}>
          <h1 className={s.titulo}>Nova cobrança</h1>
        </header>
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Cadastre um cliente primeiro</h2>
          <p className={s.vazioTexto}>
            Toda cobrança pertence a um cliente. Cadastre quem você cobra e
            volte aqui.
          </p>
          <div className={s.acoes} style={{ justifyContent: "center" }}>
            <Link href="/app/clientes/novo" className={s.botao}>Cadastrar cliente</Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Nova cobrança</h1>
        <p className={s.subtitulo}>Cobrança única. Recorrência vem na próxima etapa.</p>
      </header>
      <FormularioCobranca clientes={clientes} />
    </>
  );
}
