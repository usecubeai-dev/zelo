import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Cliente, paraFormulario } from "@/lib/cliente";
import FormularioCliente from "../../FormularioCliente";
import s from "../../../../App.module.css";

export const metadata = { title: "Editar cliente" };

export default async function EditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!data) notFound();
  const cliente = data as Cliente;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Editar cliente</h1>
        <p className={s.subtitulo}>{cliente.nome}</p>
      </header>
      <FormularioCliente id={cliente.id} inicial={paraFormulario(cliente)} />
    </>
  );
}
