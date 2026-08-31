import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { RECORRENCIA_VAZIA } from "@/lib/recorrencia";
import { hojeISO } from "@/lib/cobranca";
import FormularioRecorrencia, { OpcaoCliente } from "../FormularioRecorrencia";
import s from "../../../App.module.css";

export const metadata = { title: "Nova recorrência" };

export default async function NovaRecorrencia({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string }>;
}) {
  const { cliente_id = "" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) redirect("/entrar?de=/app/recorrencias/nova");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("clientes")
    .select("id,nome")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome");

  const clientes = (data ?? []) as OpcaoCliente[];

  if (clientes.length === 0) {
    return (
      <section className={s.vazio}>
        <h1 className={s.vazioTitulo}>Cadastre um cliente primeiro</h1>
        <p className={s.vazioTexto}>
          Toda recorrência pertence a um cliente. Comece cadastrando quem você cobra.
        </p>
        <div className={s.acoes} style={{ justifyContent: "center" }}>
          <Link href="/app/clientes/novo" className={s.botao}>
            Cadastrar cliente
          </Link>
          <Link href="/app/recorrencias" className={s.botaoSec}>
            Voltar
          </Link>
        </div>
      </section>
    );
  }

  const inicial = {
    ...RECORRENCIA_VAZIA,
    cliente_id: clientes.some((c) => c.id === cliente_id) ? cliente_id : "",
    inicia_em: hojeISO(),
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Nova recorrência</h1>
        <p className={s.subtitulo}>
          Configure uma cobrança periódica automática para seu cliente.
        </p>
      </header>

      <FormularioRecorrencia clientes={clientes} inicial={inicial} />
    </>
  );
}
