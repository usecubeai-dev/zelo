import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { ehAdministradorZelo } from "@/lib/core/influenciadores";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { obterUsoDoPlano } from "@/lib/core/assinatura";
import { obterPagamentoDaAssinatura } from "@/lib/core/pagamento-assinatura";
import type { MensalidadeLinha } from "@/lib/core/mensalidade";
import { fimDoPeriodoPago, situacaoDeCancelamento } from "@/lib/core/cancelamento";
import {
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  descricaoDoLimite,
  normalizarPlano,
  planoPago,
  type Plano,
} from "@/lib/plano";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData as formatarDataISO } from "@/lib/cobranca";
import { PLANOS_DA_TELA } from "@/lib/checkout";
import RodapeEmpresa from "@/components/RodapeEmpresa";
import AssinaturaFluxo from "./AssinaturaFluxo";
import CancelarAssinatura from "./CancelarAssinatura";
import s from "../../App.module.css";
import c from "./Assinatura.module.css";

export const metadata = { title: "Assinatura" };

/** Mesmo canal de contato já publicado na página de preços ("Falar com a gente"). */
const CONTATO = "mailto:usecube.ai@gmail.com";

const BLOQUEIO_TEXTO =
  "cadastrar novos clientes, cobranças ou recorrências fica bloqueado — o que já existe continua acessível para consulta e edição.";

const FUSO = "America/Sao_Paulo";

/** Timestamp (com hora) → "DD/MM/AAAA" no fuso do Brasil. */
function formatarMomento(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

function formatarDiaMes(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
}

/** Nome do plano gravado na mensalidade (pode ser o identificador antigo). */
function nomeDoPlanoGravado(valor: string): string {
  const plano = normalizarPlano(valor);
  return plano ? NOME_DO_PLANO[plano] : valor;
}

const ROTULO_MENSALIDADE: Record<MensalidadeLinha["status"], string> = {
  pendente: "Aguardando pagamento",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

const CLASSE_MENSALIDADE: Record<MensalidadeLinha["status"], string> = {
  pendente: s.sitPendente,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
  estornada: s.sitEstornada,
};

/** `?plano=` pode vir repetido; vale o primeiro. */
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Só os três planos da vitrine podem vir pré-selecionados (URL ou cadastro). O Grátis é legado, nunca uma oferta. */
const naVitrine = (v: unknown): v is (typeof PLANOS_DA_TELA)[number] =>
  typeof v === "string" && (PLANOS_DA_TELA as readonly string[]).includes(v);

export default async function Assinatura({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string | string[] }>;
}) {
  const params = await searchParams;
  const atual = await usuarioAtual();
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  if (!atual || !empresa) return null;

  const situacao = situacaoDaConta(empresa);
  const { status } = situacao;
  const podeAssinar = atual.membro?.papel === "dono";
  const pagamentoDisponivel = getAsaasConfiguration().isConfigured;
  /* plano de teste (R$ 5): só o administrador do Zelo o vê; `assinarPlano` confere de novo no servidor */
  const incluirPlanoDeTeste = podeAssinar && (await ehAdministradorZelo(atual.user.id));

  /* Leitura pelo cliente com RLS: o dono lê a própria empresa e os membros
     leem as próprias mensalidades — nenhum dado de outra conta chega aqui. */
  const supabase = await supabaseServer();
  const [{ data: dadosEmpresa }, { data: linhas }] = await Promise.all([
    supabase
      .from("empresas")
      .select("asaas_subscription_id, documento, plano_escolhido")
      .eq("id", empresa.id)
      .maybeSingle(),
    supabase
      .from("mensalidades")
      .select("id, plano, valor_centavos, status, vencimento, pago_em, eh_primeira, ambiente, criada_em")
      .eq("empresa_id", empresa.id)
      .order("criada_em", { ascending: false })
      .limit(24),
  ]);
  const subscriptionId = (dadosEmpresa?.asaas_subscription_id as string | null) ?? null;
  const documento = (dadosEmpresa?.documento as string | null) ?? "";
  const mensalidades = (linhas ?? []) as MensalidadeLinha[];

  /* `empresas.plano` é o plano VIGENTE (pode estar gravado com o nome antigo,
     por isso passa por `normalizarPlano`); `plano_escolhido` é o plano pago que
     a pessoa escolheu e ainda não pagou. */
  const planoVigente = normalizarPlano(empresa.plano);
  const escolhido = normalizarPlano(dadosEmpresa?.plano_escolhido);
  const escolhidoPago = escolhido && planoPago(escolhido) ? escolhido : null;

  /* Conta ATIVA no Grátis: já está liberada e pode contratar um plano pago.
     É o único estado ativo em que ainda existe o que escolher. */
  const ativaNoGratis = status === "ativa" && planoVigente === "gratis";

  /* Cobrança em aberto só faz sentido onde existe pagamento a fazer. Conta
     ativa paga não precisa de link; cancelada teve a assinatura removida; a
     ativa no Grátis só tem cobrança quando já escolheu um plano pago. */
  const podeTerCobrancaAberta =
    status === "pendente" ||
    status === "trial" ||
    status === "inadimplente" ||
    (ativaNoGratis && escolhidoPago !== null && subscriptionId !== null);
  /* Pagamento da mensalidade em andamento (Pix, link seguro, estado). Só o
     dono vê, e quem decide o estado é o servidor — a tela só mostra. */
  const resultadoPagamento =
    podeAssinar && podeTerCobrancaAberta && pagamentoDisponivel && subscriptionId
      ? await obterPagamentoDaAssinatura(empresa.id)
      : null;
  const pagamentoEmAberto = resultadoPagamento?.ok ? resultadoPagamento.pagamento : null;

  /* Plano mostrado. Conta `pendente` ainda tem o plano padrão do banco — isso
     NÃO é uma escolha da pessoa; vale só o `plano_escolhido` (quando já
     existe assinatura gerada). */
  const planoMostrado: Plano | null =
    status === "pendente" ? (escolhidoPago && subscriptionId ? escolhidoPago : null) : planoVigente;

  const metadata = (atual.user.user_metadata ?? {}) as { plano_escolhido?: unknown };
  const planoDaUrl = primeiro(params.plano);
  const planoDoCadastro = naVitrine(metadata.plano_escolhido) ? metadata.plano_escolhido : null;
  const candidato: Plano = naVitrine(planoDaUrl)
    ? planoDaUrl
    : escolhidoPago && naVitrine(escolhidoPago)
      ? escolhidoPago
      : planoMostrado && naVitrine(planoMostrado) && subscriptionId
        ? planoMostrado
        : (planoDoCadastro ?? PLANO_EM_DESTAQUE);
  const planoInicial: Plano = candidato;

  /* Cancelamento/arrependimento: só o dono vê. Lido no servidor — a tela não
     decide prazo nem elegibilidade, só mostra o que o servidor aceitaria. */
  const cancelamento = podeAssinar ? await situacaoDeCancelamento(empresa.id) : null;
  const ultimaPaga = mensalidades
    .filter((m) => m.status === "paga" && m.pago_em)
    .sort((x, y) => new Date(y.pago_em as string).getTime() - new Date(x.pago_em as string).getTime())[0];
  const fimDoPeriodo = ultimaPaga ? fimDoPeriodoPago(ultimaPaga.vencimento, ultimaPaga.pago_em) : null;

  const mostraUso = planoMostrado !== null && status !== "cancelada" && status !== "pendente";
  const uso = mostraUso && planoMostrado ? await obterUsoDoPlano(empresa.id, planoMostrado) : null;

  const precisaEscolher =
    status === "pendente" ||
    status === "trial" ||
    status === "cancelada" ||
    (status === "inadimplente" && !pagamentoEmAberto) ||
    ativaNoGratis;

  const atualizadaEm = formatarMomento(empresa.assinatura_atualizada_em);
  const testeAte = formatarMomento(empresa.trial_termina_em);

  const percentUso =
    uso && uso.limiteClientes !== null && uso.limiteClientes > 0
      ? Math.min(100, Math.round((uso.clientesAtivos / uso.limiteClientes) * 100))
      : 0;
  const noLimite = uso !== null && uso.limiteClientes !== null && uso.clientesAtivos >= uso.limiteClientes;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Assinatura</h1>
        <p className={s.subtitulo}>Seu plano, seus pagamentos e o que está incluído.</p>
      </header>

      {/* Plano atual: um cartão pequeno, separado dos planos à venda. Só existe
          quando há um plano de verdade (conta ativa, em atraso ou suspensa) —
          conta pendente/em acesso anterior não tem plano contratado. */}
      {planoMostrado && (status === "ativa" || status === "inadimplente" || status === "suspensa") && (
        <section className={c.planoAtual} aria-labelledby="plano-atual-rotulo">
          <div className={c.planoAtualCorpo}>
            <p id="plano-atual-rotulo" className={c.planoAtualRotulo}>
              Seu plano atual
            </p>
            <h2 className={c.planoAtualNome}>{NOME_DO_PLANO[planoMostrado]}</h2>
            <p className={c.planoAtualDetalhe}>
              {planoPago(planoMostrado) ? (
                <>
                  <strong className="tnum">{formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoMostrado])}/mês</strong>
                  <span aria-hidden="true"> · </span>
                </>
              ) : (
                <>
                  <strong>Sem mensalidade</strong>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              {descricaoDoLimite(planoMostrado)}
            </p>
            <p className={c.planoAtualMeta}>
              {status === "ativa" ? "Assinatura ativa" : status === "inadimplente" ? "Pagamento pendente" : "Assinatura suspensa"}
              {atualizadaEm ? ` · desde ${atualizadaEm}` : ""}
              {planoMostrado === "gratis" ? " · plano mantido da sua conta" : ""}
            </p>
          </div>
          <span className={`${s.etiqueta} ${status === "ativa" ? s.sitPaga : s.sitVencida}`}>
            {status === "ativa" ? "Plano atual" : status === "inadimplente" ? "Em atraso" : "Suspensa"}
          </span>
        </section>
      )}

      {/* ---------- o que aconteceu com a conta ---------- */}

      {status === "trial" && situacao.carenciaLegada && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Seu acesso atual</h2>
          <p className={c.estadoTexto}>
            Sua conta segue liberada até {formatarDiaMes(empresa.trial_termina_em)}, com tudo funcionando normalmente.
            Depois dessa data, escolha um dos planos abaixo.
          </p>
        </section>
      )}

      {status === "trial" && !situacao.carenciaLegada && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Acesso anterior encerrado</h2>
          <p className={c.estadoTexto}>
            Terminou em {testeAte}. Escolha um dos planos abaixo. Enquanto isso,{" "}
            {BLOQUEIO_TEXTO}
          </p>
        </section>
      )}

      {status === "inadimplente" && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Pagamento pendente</h2>
          <p className={c.estadoTexto}>
            Não conseguimos confirmar o pagamento da sua assinatura{atualizadaEm ? ` desde ${atualizadaEm}` : ""}.
            Enquanto isso, {BLOQUEIO_TEXTO} Assim que o pagamento for confirmado, sua conta volta a ficar liberada
            automaticamente.
          </p>
        </section>
      )}

      {status === "suspensa" && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Assinatura suspensa</h2>
          <p className={c.estadoTexto}>
            Sua assinatura está suspensa{atualizadaEm ? ` desde ${atualizadaEm}` : ""}. Enquanto isso, {BLOQUEIO_TEXTO}{" "}
            Para regularizar, <a className={s.linkTabela} href={CONTATO}>fale com a gente</a>.
          </p>
        </section>
      )}

      {status === "cancelada" && (
        <section className={`${s.bloco} ${s.blocoPerigo} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Assinatura cancelada</h2>
          <p className={c.estadoTexto}>
            Cancelada{atualizadaEm ? ` em ${atualizadaEm}` : ""}. Desde então, {BLOQUEIO_TEXTO} Para voltar a usar o
            Zelo, escolha um plano e assine de novo.
          </p>
        </section>
      )}

      {podeAssinar &&
        planoMostrado === "gratis" &&
        uso &&
        uso.limiteClientes !== null &&
        uso.clientesAtivos > uso.limiteClientes && (
          <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`} role="note">
            <h2 className={s.blocoTitulo}>Acima do limite do plano Grátis</h2>
            <p className={c.estadoTexto}>
              Você tem {uso.clientesAtivos} clientes e o plano Grátis permite até {uso.limiteClientes}. Nada foi
              apagado; só não é possível cadastrar novos clientes até ficar abaixo do limite — ou contrate um plano.
            </p>
          </section>
        )}

      {/* ---------- escolha / pagamento ---------- */}

      {/* Seletor e uso ficam sempre nesta ordem no DOM, dentro do mesmo
          contêiner: assim, ao ativar o Grátis, o `router.refresh()` não
          remonta o seletor e a confirmação continua na tela. Visualmente, na
          conta ativa no Grátis o uso vem ANTES do "contrate um plano"
          (`usoAntes`, via `order`). */}
      <div className={c.corpo}>
        {(precisaEscolher || pagamentoEmAberto) && (
          <AssinaturaFluxo
            planoInicial={planoInicial}
            iniciarNaConfirmacao={naVitrine(planoDaUrl) || (status === "pendente" && planoDoCadastro !== null)}
            documentoInicial={documento}
            podeAssinar={podeAssinar}
            pagamentoDisponivel={pagamentoDisponivel}
            pagamentoEmAberto={pagamentoEmAberto}
            contaLiberada={ativaNoGratis}
            planoVigente={planoMostrado}
            incluirPlanoDeTeste={incluirPlanoDeTeste}
          />
        )}

        {/* ---------- uso do plano ---------- */}

        {uso && (
          <section className={`${s.bloco} ${c.uso} ${ativaNoGratis ? c.usoAntes : ""}`}>
            <h2 className={s.blocoTitulo}>Uso do plano — {uso.nomePlano}</h2>
            {uso.limiteClientes === null ? (
              /* Escola: não há limite, então não há barra — uma barra "cheia
                 ou vazia" sugeriria um teto que não existe */
              <p className={c.estadoTexto}>
                {uso.clientesAtivos} {uso.clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"} · ilimitado
              </p>
            ) : (
              <>
                <div className={s.medidorLinha}>
                  <span>Clientes ativos</span>
                  <span>
                    {uso.clientesAtivos} / {uso.limiteClientes}
                  </span>
                </div>
                <div className={s.medidor}>
                  <div
                    className={s.medidorPreenchido}
                    data-perto={percentUso >= 80 ? "true" : "false"}
                    style={{ width: `${percentUso}%` }}
                  />
                </div>
                {noLimite && (
                  <p className={`${c.estadoTexto} ${c.usoNota}`}>
                    {ativaNoGratis
                      ? "Você chegou ao limite do plano Grátis. Para cadastrar mais clientes, contrate um plano."
                      : `Você chegou ao limite do plano ${uso.nomePlano}.`}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* ---------- cancelar / desistir (só o dono) ---------- */}

      {cancelamento && (
        <CancelarAssinatura
          planoPagoAtivo={cancelamento.planoPagoAtivo}
          fimDoPeriodoIso={fimDoPeriodo ? fimDoPeriodo.toISOString() : null}
          cancelamentoAgendado={
            cancelamento.cancelamentoAgendado ? { acessoAteIso: cancelamento.cancelamentoAgendado.acessoAte } : null
          }
          arrependimento={
            cancelamento.arrependimento
              ? { ateIso: cancelamento.arrependimento.ateIso, valorCentavos: cancelamento.arrependimento.valorCentavos }
              : null
          }
          pedidoReembolso={
            cancelamento.ultimoPedidoReembolso
              ? { status: cancelamento.ultimoPedidoReembolso.status, valorCentavos: cancelamento.ultimoPedidoReembolso.valorCentavos }
              : null
          }
        />
      )}

      {/* ---------- histórico ---------- */}

      {mensalidades.length > 0 && (
        <section className={c.historico} aria-labelledby="historico-titulo">
          <h2 id="historico-titulo" className={c.historicoTitulo}>
            Suas mensalidades
          </h2>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th>Pago em</th>
                </tr>
              </thead>
              <tbody>
                {mensalidades.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Plano">
                      {nomeDoPlanoGravado(m.plano)}
                      {m.ambiente === "sandbox" && <span className={c.etiquetaTeste}>teste</span>}
                    </td>
                    <td className={s.celulaFraca} data-label="Vencimento">
                      {m.vencimento ? formatarDataISO(m.vencimento) : "—"}
                    </td>
                    <td className={s.valorCelula} data-label="Valor">
                      {formatarCentavos(m.valor_centavos)}
                    </td>
                    <td data-label="Situação">
                      <span className={`${s.etiqueta} ${CLASSE_MENSALIDADE[m.status]}`}>
                        {ROTULO_MENSALIDADE[m.status]}
                      </span>
                    </td>
                    <td className={s.celulaFraca} data-label="Pago em">
                      {formatarMomento(m.pago_em) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* quem contrata precisa saber com quem está contratando e como falar com a empresa */}
      <div className={c.rodapeEmpresa}>
        <RodapeEmpresa variante="claro" compacto semRecuoLateral />
      </div>
    </>
  );
}
