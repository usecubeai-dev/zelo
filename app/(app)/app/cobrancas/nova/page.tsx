import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { COBRANCA_VAZIA, hojeISO } from "@/lib/cobranca";
import { COLUNAS_PREFERENCIAS, percentualParaCampo, preferenciasDaEmpresa } from "@/lib/recuperacao";
import FormularioCobranca from "../FormularioCobranca";
import s from "../../../App.module.css";

export const metadata = { title: "Nova cobrança" };

/** Uma semana à frente — prazo curto o bastante pra não passar despercebido, longo o bastante pra não vencer sozinho. Só um ponto de partida: o campo continua editável. */
function vencimentoPadrao(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return hojeISO(d);
}

export default async function NovaCobranca({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string }>;
}) {
  const { cliente_id = "" } = await searchParams;
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

  const { data: servicosData } = await supabase
    .from("servicos")
    .select("id,nome,valor_centavos")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome");
  const servicos = servicosData ?? [];

  /* padrões da empresa (forma de pagamento, multa, juros) — só o PONTO DE
     PARTIDA de uma cobrança nova; dá para mudar cobrança por cobrança, e
     cobrança que já existe nunca é alterada por mudar o padrão. */
  const { data: linhaEmpresa } = await supabase.from("empresas").select(COLUNAS_PREFERENCIAS).eq("id", empresaId).maybeSingle();
  const prefs = preferenciasDaEmpresa(linhaEmpresa as Record<string, unknown> | null);

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

  const inicial = {
    ...COBRANCA_VAZIA,
    cliente_id: clientes.some((c) => c.id === cliente_id) ? cliente_id : "",
    vence_em: vencimentoPadrao(),
    forma_pagamento: prefs.forma,
    multa: prefs.forma === "cliente_escolhe" ? percentualParaCampo(prefs.encargos.multaPct) : "",
    juros: prefs.forma === "cliente_escolhe" ? percentualParaCampo(prefs.encargos.jurosPctMes) : "",
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Nova cobrança avulsa</h1>
        <p className={s.subtitulo}>
          Cobrança pontual, só desta vez — não se repete sozinha. Para cobrar todo mês automaticamente, use{" "}
          <Link href="/app/recorrencias/nova" className={s.linkTabela}>
            cobrança automática
          </Link>
          .
        </p>
      </header>
      <FormularioCobranca clientes={clientes} servicos={servicos} inicial={inicial} />
    </>
  );
}
