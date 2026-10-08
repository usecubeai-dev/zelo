import { Suspense } from "react";
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
import { rotuloAcao } from "@/lib/atividade";
import {
  ROTULO_ACAO_COBRANCA,
  ROTULO_FORMA,
  ROTULO_RECUPERACAO,
  diasDeAtraso,
  estadoDeRecuperacao,
  recomendacao,
  textoEncargos,
  valorAtualizado,
  type TipoAcaoCobranca,
} from "@/lib/recuperacao";
import { acoesDasCobrancas, encargosDaCobranca } from "@/lib/core/recuperacao-dados";
import { tempoRelativo } from "@/lib/atividade";
import AcoesCobranca from "../AcoesCobranca";
import CobrancaCriada from "../CobrancaCriada";
import ProximoPasso from "../ProximoPasso";
import e from "../Envio.module.css";
import BlocoRecuperacao from "./BlocoRecuperacao";
import WhatsappCobranca, { WhatsappPreparando } from "./WhatsappCobranca";
import s from "../../../App.module.css";

export const metadata = { title: "Cobrança" };

const CLASSE: Record<string, string> = {
  pendente: s.sitPendente,
  enviada: s.sitEnviada,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
  estornada: s.sitEstornada,
};

export default async function FichaCobranca({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string }>;
}) {
  const { id } = await params;
  const { criada } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("cobrancas")
    .select("*, clientes(id,nome,whatsapp,email)")
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

  /* Timeline real (Fase 12) — "não inventar etapas": a lista vem do
     próprio log de auditoria (`log_acoes_financeiras`), que já registra
     cada transição de verdade que aconteceu com esta cobrança ou (se
     Pix Automático) com a instrução do ciclo. "Criada" é o único item
     sintético — não é auditado à parte, mas `criado_em` é uma coluna
     real, não um valor inventado. */
  const { data: instrucao } = await supabase
    .from("instrucoes_pagamento")
    .select("id, status, refusal_reason")
    .eq("cobranca_id", cobranca.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const idsParaTimeline = [cobranca.id, instrucao?.id].filter(Boolean) as string[];
  const { data: eventos } = await supabase
    .from("log_acoes_financeiras")
    .select("id, acao, criado_em")
    .eq("empresa_id", empresaId)
    .in("entidade_id", idsParaTimeline)
    .order("criado_em", { ascending: true });

  /* Ações de recuperação (WhatsApp aberto, link copiado, negociada): vêm da
     tabela própria — registros reais do que o profissional fez. */
  const { data: acoesRec } = await supabase
    .from("acoes_cobranca")
    .select("id, tipo, criado_em")
    .eq("empresa_id", empresaId)
    .eq("cobranca_id", cobranca.id)
    .order("criado_em", { ascending: true });
  const mapaAcoes = await acoesDasCobrancas(supabase, empresaId, [cobranca.id]);
  const ultimaAcao = mapaAcoes.get(cobranca.id);

  const timeline = [
    { id: "criada", rotulo: "Cobrança criada", quando: cobranca.criado_em },
    ...(eventos ?? []).map((e) => ({ id: e.id, rotulo: rotuloAcao(e.acao), quando: e.criado_em })),
    ...(acoesRec ?? []).map((a) => ({ id: `ac-${a.id}`, rotulo: ROTULO_ACAO_COBRANCA[a.tipo as TipoAcaoCobranca] ?? a.tipo, quando: a.criado_em })),
  ].sort((x, y) => (x.quando < y.quando ? -1 : x.quando > y.quando ? 1 : 0));

  const encargos = encargosDaCobranca(cobranca);
  const textoDosEncargos = textoEncargos(encargos);
  const atualizado = valorAtualizado({ valorCentavos: cobranca.valor_centavos, venceEm: cobranca.vence_em, hoje, encargos });
  const estadoRec = estadoDeRecuperacao(cobranca, Boolean(ultimaAcao?.temContato), hoje);
  const emAtraso = estadoRec === "vencida" || estadoRec === "em_recuperacao" || estadoRec === "negociada";

  const prazo =
    sit === "paga"
      ? `Paga em ${
          cobranca.pago_em
            ? new Date(cobranca.pago_em).toLocaleDateString("pt-BR")
            : "—"
        }`
      : sit === "estornada"
        ? `Estornada em ${
            cobranca.estornado_em
              ? new Date(cobranca.estornado_em).toLocaleDateString("pt-BR")
              : "—"
          }`
        : sit === "cancelada"
        ? "Cancelada"
        : dias === 0
          ? "Vence hoje"
          : dias > 0
            ? `Vence em ${dias} dia${dias > 1 ? "s" : ""}`
            : `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`;

  const aberta = cobranca.status === "pendente" || cobranca.status === "enviada";
  const logoDepoisDeCriar = criada === "1" && aberta;
  const formaEscolhe = cobranca.forma_pagamento === "cliente_escolhe";

  /* O bloco "enviar para o cliente" — o mesmo para todo estado em aberto. */
  const blocoEnviar =
    aberta && cobranca.clientes ? (
      <Suspense fallback={<WhatsappPreparando />}>
        <WhatsappCobranca
          empresaId={empresaId}
          cobrancaId={cobranca.id}
          cobranca={{
            valor_centavos: cobranca.valor_centavos,
            vence_em: cobranca.vence_em,
            asaas_payment_id: cobranca.asaas_payment_id,
            asaas_sync_status: cobranca.asaas_sync_status,
          }}
          cliente={{
            id: cobranca.clientes.id,
            nome: cobranca.clientes.nome,
            whatsapp: cobranca.clientes.whatsapp ?? null,
            email: cobranca.clientes.email ?? null,
          }}
        />
      </Suspense>
    ) : null;

  return (
    <>
      <header className={s.cabecalho}>
        <Link href="/app/cobrancas" className={s.voltarLink}>
          ← Cobranças
        </Link>
        <h1 className={s.titulo}>{cobranca.descricao}</h1>
      </header>

      {logoDepoisDeCriar && (
        <CobrancaCriada
          cliente={cobranca.clientes?.nome ?? "—"}
          detalhe={formatarCentavos(cobranca.valor_centavos)}
          vencimento={`Vencimento: ${formatarData(cobranca.vence_em)}`}
        />
      )}

      {/* A COBRANÇA: quem, quanto, quando e em que pé está — antes de qualquer ação */}
      <section className={`${s.cobrancaHero} ${emAtraso ? s.cobrancaHeroAtraso : ""}`} aria-label="Resumo da cobrança">
        <div className={s.cobrancaHeroPrincipal}>
          <span className={s.numeroRotulo}>Cobrança para</span>
          <span className={s.cobrancaHeroCliente}>
            {cobranca.clientes?.nome ?? "—"}
            {cobranca.clientes && (
              <Link href={`/app/clientes/${cobranca.clientes.id}`} className={s.faixaLink}>
                Ver cliente
              </Link>
            )}
          </span>
          <span className={s.cobrancaHeroValor}>{formatarCentavos(cobranca.valor_centavos)}</span>
        </div>
        <div className={s.cobrancaHeroLado}>
          <span className={`${s.etiqueta} ${s.etiquetaGrande} ${CLASSE[sit]}`}>{ROTULO_SITUACAO[sit]}</span>
          <span className={s.cobrancaHeroData}>
            <span className={s.numeroRotulo}>Vencimento</span>
            <strong>{formatarData(cobranca.vence_em)}</strong>
          </span>
          <span className={s.numeroSub}>{prazo}</span>
        </div>
      </section>

      {/* PRÓXIMO PASSO: uma única ação principal, conforme o estado da cobrança */}
      {aberta && !emAtraso && (
        <ProximoPasso
          titulo={cobranca.status === "enviada" ? "Aguardando o pagamento do cliente" : "Enviar para o cliente"}
          texto={
            cobranca.status === "enviada"
              ? "Você já enviou esta cobrança. Se precisar, envie de novo."
              : formaEscolhe
                ? "Seu cliente recebe o link e escolhe como pagar: Pix, boleto ou cartão."
                : "Seu cliente recebe o link e paga por Pix."
          }
        >
          {blocoEnviar}
        </ProximoPasso>
      )}
      {aberta && emAtraso && (
        <ProximoPasso
          tom="atraso"
          titulo="Recuperar cobrança"
          texto={recomendacao(estadoRec, diasDeAtraso(cobranca.vence_em, hoje)) ?? "Essa cobrança está atrasada."}
        >
          {blocoEnviar}
          <BlocoRecuperacao
            cobrancaId={cobranca.id}
            recomendacao={
              cobranca.negociada_em
                ? "Marcada como negociada: ela sai da frente da fila de atraso."
                : "Combinou um novo prazo ou pagamento com o cliente? Marque como negociada para tirá-la da fila de atraso."
            }
            estadoRotulo={ROTULO_RECUPERACAO[estadoRec]}
            negociada={Boolean(cobranca.negociada_em)}
            ultimaAcao={
              ultimaAcao ? `${ROTULO_ACAO_COBRANCA[ultimaAcao.tipo as TipoAcaoCobranca] ?? ultimaAcao.tipo} · ${tempoRelativo(ultimaAcao.em, new Date())}` : null
            }
            valorAtualizadoTexto={
              atualizado.aplicou
                ? `Com os encargos, cerca de ${formatarCentavos(atualizado.totalCentavos)} (estimativa para boleto; o valor final é calculado no momento do pagamento).`
                : null
            }
          />
        </ProximoPasso>
      )}
      {cobranca.status === "paga" && (
        <ProximoPasso tom="ok" titulo="Recebimento confirmado" texto={`${formatarCentavos(cobranca.valor_pago_centavos ?? cobranca.valor_centavos)} — ${prazo.toLowerCase()}.`}>
          <div className={e.envioSecundarias}>
            <Link href="/app/recebimentos" className={s.botao}>
              Ver recebimento
            </Link>
          </div>
        </ProximoPasso>
      )}
      {cobranca.status === "cancelada" && <ProximoPasso tom="neutro" titulo="Cobrança cancelada" texto="Esta cobrança não será mais cobrada do cliente." />}
      {cobranca.status === "estornada" && <ProximoPasso tom="neutro" titulo="Cobrança estornada" texto="O valor desta cobrança foi devolvido ao cliente." />}

      <dl className={s.detalhesLista}>
        <div>
          <dt>Forma de pagamento</dt>
          <dd>{ROTULO_FORMA[formaEscolhe ? "cliente_escolhe" : "pix"]}</dd>
          {textoDosEncargos && <dd className={s.numeroSub}>Se atrasar: {textoDosEncargos}</dd>}
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{cobranca.recorrencia_id ? "Recorrente" : "Única"}</dd>
        </div>
        {cobranca.valor_estornado_centavos != null && (
          <div>
            <dt>Valor estornado</dt>
            <dd>{formatarCentavos(cobranca.valor_estornado_centavos)}</dd>
          </div>
        )}
        {emAtraso && atualizado.aplicou && (
          <div>
            <dt>Valor atualizado (estimativa)</dt>
            <dd>{formatarCentavos(atualizado.totalCentavos)}</dd>
            <dd className={s.numeroSub}>{atualizado.diasAtraso} dia{atualizado.diasAtraso !== 1 ? "s" : ""} de atraso, boleto</dd>
          </div>
        )}
      </dl>

      {/* Ações SECUNDÁRIAS (editar, cancelar, registrar pagamento…): depois da ação principal */}
      <div className={e.grupoSecundario} role="group" aria-label="Mais ações da cobrança">
        <AcoesCobranca id={cobranca.id} status={cobranca.status} temPaymentAsaas={!!cobranca.asaas_payment_id} />
      </div>

      {cobranca.recorrencia_id && (
        <div className={s.acoes}>
          <Link href={`/app/recorrencias/${cobranca.recorrencia_id}`} className={s.faixaLink}>
            Ver recorrência
          </Link>
        </div>
      )}

      {instrucao?.status === "REFUSED" && (
        <div className={`${s.avisoConexao} ${s.avisoConexaoPerigo}`}>
          {instrucao.refusal_reason ? (
            <details>
              <summary style={{ cursor: "pointer" }}>Débito automático recusado — ver motivo</summary>
              <p style={{ marginTop: 8 }}>Motivo informado pelo parceiro de pagamentos: {instrucao.refusal_reason}</p>
            </details>
          ) : (
            <span>Débito automático recusado.</span>
          )}
        </div>
      )}

      <div className={s.bloco} style={{ marginTop: 26 }}>
        <h3 className={s.blocoTitulo}>Histórico</h3>
        <div className={s.atividadeLista}>
          {timeline.map((ev) => (
            <div key={ev.id} className={s.atividadeItem}>
              <span className={s.atividadeTexto}>{ev.rotulo}</span>
              <span className={s.atividadeQuando}>
                {new Date(ev.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
