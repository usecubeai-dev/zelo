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

  const { data: servicosData } = await supabase
    .from("servicos")
    .select("id,nome,valor_centavos")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome");
  const servicos = servicosData ?? [];

  const inicial = {
    ...RECORRENCIA_VAZIA,
    cliente_id: clientes.some((c) => c.id === cliente_id) ? cliente_id : "",
    inicia_em: hojeISO(),
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Nova cobrança automática</h1>
        <p className={s.subtitulo}>
          Configure uma vez e a Zelo cobra esse cliente todo mês sozinha — o cliente autoriza uma vez, você não
          precisa lembrar de cobrar de novo.
        </p>
      </header>

      <FormularioRecorrencia clientes={clientes} servicos={servicos} inicial={inicial} />
    </>
  );
}
