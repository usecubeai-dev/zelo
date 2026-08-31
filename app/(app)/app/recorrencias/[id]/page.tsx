import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  ROTULO_STATUS_RECORRENCIA,
  RecorrenciaComCliente,
} from "@/lib/recorrencia";
import {
  Cobranca,
  ROTULO_SITUACAO,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { formatarCentavos } from "@/lib/dinheiro";
import AcoesRecorrencia from "../AcoesRecorrencia";
import s from "../../../App.module.css";

export const metadata = { title: "Recorrência" };

const CLASSE_STATUS: Record<string, string> = {
  ativa: s.sitPaga,
  pausada: s.sitVencida,
  encerrada: s.sitCancelada,
};

const CLASSE_COBRANCA: Record<string, string> = {
  pendente: s.sitPendente,
  enviada: s.sitEnviada,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
};

export default async function FichaRecorrencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  const [recRes, cobRes] = await Promise.all([
    supabase
      .from("recorrencias")
      .select("*, clientes(id,nome)")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("cobrancas")
      .select("*")
      .eq("recorrencia_id", id)
      .eq("empresa_id", empresaId)
      .order("vence_em", { ascending: false }),
  ]);

  if (!recRes.data) notFound();
  const rec = recRes.data as RecorrenciaComCliente;
  const cobrancas = (cobRes.data ?? []) as Cobranca[];
  const hoje = hojeISO();

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{rec.descricao}</h1>
        <p className={s.subtitulo}>
          {rec.clientes?.nome ?? "—"} · Cobrança todo dia {rec.dia_vencimento}
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Valor mensal</span>
          <span className={s.numeroValor}>
            {formatarCentavos(rec.valor_centavos)}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Vencimento</span>
          <span className={s.numeroValor}>Todo dia {rec.dia_vencimento}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Início</span>
          <span className={s.numeroValor}>{formatarData(rec.inicia_em)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>
            <span className={`${s.etiqueta} ${CLASSE_STATUS[rec.status] || ""}`}>
              {ROTULO_STATUS_RECORRENCIA[rec.status]}
            </span>
          </span>
        </div>
      </div>

      <div className={s.acoes}>
        <AcoesRecorrencia id={rec.id} status={rec.status} />
      </div>

      <div style={{ marginTop: 32 }}>
        <div className={s.barraTopo}>
          <h2 className={s.vazioTitulo}>Cobranças geradas ({cobrancas.length})</h2>
        </div>

        {cobrancas.length === 0 ? (
          <section className={s.vazio}>
            <p className={s.vazioTexto}>Nenhuma cobrança gerada para esta recorrência ainda.</p>
          </section>
        ) : (
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const sit = situacaoDaCobranca(c, hoje);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                          {c.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca}>{formatarData(c.vence_em)}</td>
                      <td className={s.valorCelula}>
                        {formatarCentavos(c.valor_centavos)}
                      </td>
                      <td>
                        <span className={`${s.etiqueta} ${CLASSE_COBRANCA[sit]}`}>
                          {ROTULO_SITUACAO[sit]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={s.acoes} style={{ marginTop: 24 }}>
        <Link href="/app/recorrencias" className={s.faixaLink}>
          ← Voltar para recorrências
        </Link>
        {rec.clientes && (
          <Link
            href={`/app/clientes/${rec.clientes.id}`}
            className={s.faixaLink}
          >
            Ver cliente
          </Link>
        )}
      </div>
    </>
  );
}
