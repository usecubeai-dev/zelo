import { notFound, redirect } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Cobranca, hojeISO, podeEditar } from "@/lib/cobranca";
import FormularioCobranca from "../../FormularioCobranca";
import s from "../../../../App.module.css";

export const metadata = { title: "Editar cobrança" };

export default async function EditarCobranca({
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
    .from("cobrancas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!data) notFound();
  const cobranca = data as Cobranca;

  /* Paga ou cancelada não se edita, e a tela nem abre: deixar a pessoa
     preencher um formulário que a ação vai recusar no fim é desperdício
     do tempo dela. */
  if (!podeEditar(cobranca.status)) redirect(`/app/cobrancas/${id}`);

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id,nome")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome");

  const hoje = hojeISO();

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Editar cobrança</h1>
        <p className={s.subtitulo}>{cobranca.descricao}</p>
      </header>
      <FormularioCobranca
        id={cobranca.id}
        clientes={clientes ?? []}
        /* se já está vencida, o piso é a data original — senão corrigir a
           descrição de uma cobrança atrasada ficaria impossível */
        pisoData={cobranca.vence_em < hoje ? cobranca.vence_em : hoje}
        inicial={{
          cliente_id: cobranca.cliente_id,
          descricao: cobranca.descricao,
          valor: (cobranca.valor_centavos / 100).toFixed(2).replace(".", ","),
          vence_em: cobranca.vence_em,
        }}
      />
    </>
  );
}
