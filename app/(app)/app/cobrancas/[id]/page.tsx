import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  CobrancaComCliente,
  ROTULO_SITUACAO,
  diasAte,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { formatarCentavos } from "@/lib/dinheiro";
import AcoesCobranca from "../AcoesCobranca";
import s from "../../../App.module.css";

export const metadata = { title: "Cobrança" };

export default async function FichaCobranca({
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
    .select("*, clientes(id,nome)")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  /* 404 e não "sem permissão": dizer que existe mas é de outra empresa já
     entrega informação sobre dados alheios. */
  if (!data) notFound();
  const cobranca = data as CobrancaComCliente;

  const hoje = hojeISO();
  const sit = situacaoDaCobranca(cobranca, hoje);
  const dias = diasAte(cobranca.vence_em, hoje);

  const prazo =
    sit === "paga"
      ? `Paga em ${
          cobranca.pago_em
            ? new Date(cobranca.pago_em).toLocaleDateString("pt-BR")
            : "—"
        }`
      : sit === "cancelada"
        ? "Cancelada"
        : dias === 0
          ? "Vence hoje"
          : dias > 0
            ? `Vence em ${dias} dia${dias > 1 ? "s" : ""}`
            : `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{cobranca.descricao}</h1>
        <p className={s.subtitulo}>
          {cobranca.clientes?.nome ?? "—"} · {prazo}
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Valor</span>
          <span className={s.numeroValor}>
            {formatarCentavos(cobranca.valor_centavos)}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Vencimento</span>
          <span className={s.numeroValor}>{formatarData(cobranca.vence_em)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>{ROTULO_SITUACAO[sit]}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Tipo</span>
          <span className={s.numeroValor}>
            {cobranca.recorrencia_id ? "Recorrente" : "Única"}
          </span>
        </div>
      </div>

      <div className={s.acoes}>
        <AcoesCobranca id={cobranca.id} status={cobranca.status} />
      </div>

      <div className={s.acoes}>
        <Link href="/app/cobrancas" className={s.faixaLink}>
          ← Voltar para cobranças
        </Link>
        {cobranca.clientes && (
          <Link
            href={`/app/clientes/${cobranca.clientes.id}`}
            className={s.faixaLink}
          >
            Ver cliente
          </Link>
        )}
        {cobranca.recorrencia_id && (
          <Link
            href={`/app/recorrencias/${cobranca.recorrencia_id}`}
            className={s.faixaLink}
          >
            Ver recorrência
          </Link>
        )}
      </div>
    </>
  );
}
