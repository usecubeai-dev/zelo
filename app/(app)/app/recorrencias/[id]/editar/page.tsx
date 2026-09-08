import { notFound, redirect } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  Recorrencia,
  podeEditarRecorrencia,
} from "@/lib/recorrencia";
import FormularioRecorrencia, { OpcaoCliente } from "../../FormularioRecorrencia";
import s from "../../../../App.module.css";

export const metadata = { title: "Editar recorrência" };

export default async function EditarRecorrencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) redirect(`/entrar?de=/app/recorrencias/${id}/editar`);

  const supabase = await supabaseServer();
  const [recRes, cliRes, servRes] = await Promise.all([
    supabase
      .from("recorrencias")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("clientes")
      .select("id,nome")
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .order("nome"),
    supabase
      .from("servicos")
      .select("id,nome,valor_centavos")
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .order("nome"),
  ]);

  if (!recRes.data) notFound();
  const rec = recRes.data as Recorrencia;

  if (!podeEditarRecorrencia(rec.status)) {
    redirect(`/app/recorrencias/${id}`);
  }

  const clientes = (cliRes.data ?? []) as OpcaoCliente[];
  const servicos = servRes.data ?? [];

  const inicial = {
    cliente_id: rec.cliente_id,
    servico_id: rec.servico_id ?? "",
    descricao: rec.descricao,
    valor: (rec.valor_centavos / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    }),
    dia_vencimento: String(rec.dia_vencimento),
    inicia_em: rec.inicia_em,
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Editar recorrência</h1>
        <p className={s.subtitulo}>
          Altere as informações do acordo. Cobranças já geradas não serão alteradas.
        </p>
      </header>

      <FormularioRecorrencia
        id={rec.id}
        clientes={clientes}
        servicos={servicos}
        inicial={inicial}
      />
    </>
  );
}
