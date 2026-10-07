import { Suspense } from "react";
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
import EnviarAutorizacao from "../EnviarAutorizacao";
import PrepararAutorizacao from "../PrepararAutorizacao";
import CobrancaCriada from "../../cobrancas/CobrancaCriada";
import ProximoPasso from "../../cobrancas/ProximoPasso";
import WhatsappCobranca, { WhatsappPreparando } from "../../cobrancas/[id]/WhatsappCobranca";
import { estadoDoEmailDoCliente } from "@/lib/email/estado";
import e from "../../cobrancas/Envio.module.css";
import AutorizacaoPix from "../AutorizacaoPix";
import CicloInstrucao from "../CicloInstrucao";
import { obterAutorizacaoAtual, obterInstrucaoDaUltimaCobranca } from "../acoes";
import { obterElegibilidadePix } from "@/lib/core/elegibilidade-pix";
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
  estornada: s.sitEstornada,
};

export default async function FichaRecorrencia({
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
  const [recRes, cobRes] = await Promise.all([
    supabase
      .from("recorrencias")
      .select("*, clientes(id,nome,whatsapp,email)")
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
  const autorizacao = rec.status === "ativa" ? await obterAutorizacaoAtual(id) : null;
  const instrucao = autorizacao?.status === "ACTIVE" ? await obterInstrucaoDaUltimaCobranca(id) : null;
  // Fase 21: só importa consultar quando ainda não existe autorização —
  // uma autorização já viva (CREATED/ACTIVE) segue seu próprio ciclo de
  // vida via webhook (AUTHORIZATION_CANCELLED), não é interrompida aqui.
  const pixAutomaticoIndisponivel =
    rec.status === "ativa" && !autorizacao
      ? (await obterElegibilidadePix(empresaId)).status === "INELIGIBLE"
      : false;
  const ultimaCobrancaPaga = cobrancas[0]?.status === "paga";

  const aberta = rec.status === "ativa";
  const logoDepoisDeCriar = criada === "1" && aberta;
  const cliente = rec.clientes;
  const cobrancaEmAberto = cobrancas.find((c) => c.status === "pendente" || c.status === "enviada") ?? null;
  const estadoEmail = estadoDoEmailDoCliente(cliente?.email);
  const autorizacaoAguardando = autorizacao?.status === "CREATED" ? autorizacao : null;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{rec.descricao}</h1>
        <p className={s.subtitulo}>
          {rec.clientes?.nome ?? "—"} · Cobrança todo dia {rec.dia_vencimento}
        </p>
      </header>

      {logoDepoisDeCriar && (
        <CobrancaCriada
          titulo="Recorrência criada"
          cliente={cliente?.nome ?? "—"}
          detalhe={`${formatarCentavos(rec.valor_centavos)} por mês`}
          vencimento={`Todo dia ${rec.dia_vencimento}`}
        />
      )}

      {/* PRÓXIMO PASSO: o profissional não precisa entender autorização, sincronização ou
          geração de ciclo — só o que fazer agora para o cliente poder pagar. */}
      {aberta && autorizacao?.status === "ACTIVE" && (
        <ProximoPasso
          tom="ok"
          titulo="Cobrança automática ativa"
          texto="Seu cliente autorizou. As próximas cobranças são geradas e cobradas todo mês, sem você precisar fazer nada."
        />
      )}
      {aberta && autorizacaoAguardando && cliente && (
        <ProximoPasso
          titulo="Enviar para o cliente"
          texto={`${cliente.nome.split(" ")[0]} precisa autorizar a cobrança automática. Envie o link: ele faz o primeiro pagamento e autoriza as próximas cobranças de uma vez.`}
        >
          <EnviarAutorizacao
            recorrenciaId={rec.id}
            autorizacaoId={autorizacaoAguardando.id}
            clienteId={cliente.id}
            nomeCliente={cliente.nome}
            whatsapp={cliente.whatsapp ?? null}
            valorCentavos={rec.valor_centavos}
            diaVencimento={rec.dia_vencimento}
            estadoEmail={estadoEmail}
          />
        </ProximoPasso>
      )}
      {aberta && !autorizacao?.status && !pixAutomaticoIndisponivel && (
        <ProximoPasso titulo="Preparar a cobrança automática" texto="Em um clique deixamos tudo pronto para você enviar ao cliente.">
          <PrepararAutorizacao recorrenciaId={rec.id} />
        </ProximoPasso>
      )}
      {aberta && autorizacao && autorizacao.status !== "ACTIVE" && autorizacao.status !== "CREATED" && (
        <ProximoPasso titulo="Preparar uma nova autorização" texto="A autorização anterior não está mais valendo. Prepare outra para enviar ao cliente.">
          <PrepararAutorizacao recorrenciaId={rec.id} />
        </ProximoPasso>
      )}
      {aberta && !autorizacao && pixAutomaticoIndisponivel && cobrancaEmAberto && cliente && (
        <ProximoPasso
          titulo="Enviar para o cliente"
          texto="A cobrança automática não está disponível no momento. Enquanto isso, envie o link de pagamento desta cobrança: seu cliente escolhe como pagar."
        >
          <Suspense fallback={<WhatsappPreparando />}>
            <WhatsappCobranca
              empresaId={empresaId}
              cobrancaId={cobrancaEmAberto.id}
              cobranca={{
                valor_centavos: cobrancaEmAberto.valor_centavos,
                vence_em: cobrancaEmAberto.vence_em,
                asaas_payment_id: cobrancaEmAberto.asaas_payment_id,
                asaas_sync_status: cobrancaEmAberto.asaas_sync_status,
              }}
              cliente={{ id: cliente.id, nome: cliente.nome, whatsapp: cliente.whatsapp ?? null, email: cliente.email ?? null }}
            />
          </Suspense>
        </ProximoPasso>
      )}

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

      <div className={e.grupoSecundario} role="group" aria-label="Mais ações da recorrência">
        <AcoesRecorrencia id={rec.id} status={rec.status} />
      </div>

      {/* Detalhes da autorização: ficam à mão, mas fora do caminho principal */}
      {rec.status === "ativa" && (
        <details className={e.opcoesPagamento} style={{ marginTop: 16 }}>
          <summary>Detalhes da cobrança automática</summary>
          <div className={e.opcoesPagamentoCorpo}>
            <AutorizacaoPix
              recorrenciaId={rec.id}
              valorCentavos={rec.valor_centavos}
              diaVencimento={rec.dia_vencimento}
              autorizacaoInicial={autorizacao}
              pixAutomaticoIndisponivel={pixAutomaticoIndisponivel}
            />
          </div>
        </details>
      )}

      {instrucao && (
        <CicloInstrucao recorrenciaId={rec.id} instrucao={instrucao} cobrancaPaga={ultimaCobrancaPaga} />
      )}

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
                      <td data-label="Descrição">
                        <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                          {c.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca} data-label="Vencimento">{formatarData(c.vence_em)}</td>
                      <td className={s.valorCelula} data-label="Valor">
                        {formatarCentavos(c.valor_centavos)}
                      </td>
                      <td data-label="Situação">
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
