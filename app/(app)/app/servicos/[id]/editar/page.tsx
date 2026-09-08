import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Servico, servicoParaFormulario } from "@/lib/servico";
import FormularioServico from "../../FormularioServico";
import s from "../../../../App.module.css";

export const metadata = { title: "Editar serviço" };

export default async function EditarServico({
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
    .from("servicos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!data) notFound();
  const servico = data as Servico;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Editar serviço</h1>
        <p className={s.subtitulo}>{servico.nome}</p>
      </header>
      <FormularioServico id={servico.id} inicial={servicoParaFormulario(servico)} />
    </>
  );
}
