import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { obterUsoDoPlano } from "@/lib/core/assinatura";
import { obterLinkDePagamentoPendente } from "@/lib/core/assinatura-zelo";
import type { MensalidadeLinha } from "@/lib/core/mensalidade";
import { fimDoPeriodoPago, situacaoDeCancelamento } from "@/lib/core/cancelamento";
import {
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  descricaoDoLimite,
  ehPlano,
  normalizarPlano,
  planoPago,
  type Plano,
} from "@/lib/plano";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData as formatarDataISO } from "@/lib/cobranca";
import AvisoTaxa from "@/components/AvisoTaxa";
import RodapeEmpresa from "@/components/RodapeEmpresa";
import SeletorDePlano from "./SeletorDePlano";
import CancelarAssinatura from "./CancelarAssinatura";
import s from "../../App.module.css";
import c from "./Assinatura.module.css";

export const metadata = { title: "Assinatura" };

/** Mesmo canal de contato já publicado na página de preços ("Falar com a gente"). */
const CONTATO = "mailto:usecube.ai@gmail.com";

const BLOQUEIO_TEXTO =
  "cadastrar novos clientes, cobranças ou recorrências fica bloqueado — o que já existe continua acessível para consulta e edição.";

const TAXA = formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS);

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
  const linkPendente =
    podeTerCobrancaAberta && pagamentoDisponivel ? await obterLinkDePagamentoPendente(subscriptionId) : null;

  /* Plano mostrado. Conta `pendente` ainda tem o plano padrão do banco — isso
     NÃO é uma escolha da pessoa; vale só o `plano_escolhido` (quando já
     existe assinatura gerada). */
  const planoMostrado: Plano | null =
    status === "pendente" ? (escolhidoPago && subscriptionId ? escolhidoPago : null) : planoVigente;

  /* qual plano a cobrança em aberto está cobrando: o escolhido ou — se já
     houve primeiro pagamento (inadimplente) — o vigente, desde que pago */
  const planoDaCobranca: Plano | null =
    escolhidoPago ?? (planoVigente && planoPago(planoVigente) ? planoVigente : null);
  const cobrancaEmAberto =
    linkPendente && planoDaCobranca ? { plano: planoDaCobranca, linkPagamento: linkPendente } : null;

  /* O servidor recusa o Grátis para quem está com pagamento atrasado ou
     suspensa, e a conta que já está no Grátis só tem planos pagos a contratar. */
  const apenasPagos = ativaNoGratis || status === "inadimplente" || status === "suspensa";

  const metadata = (atual.user.user_metadata ?? {}) as { plano_escolhido?: unknown };
  const planoDaUrl = primeiro(params.plano);
  const candidato: Plano = ehPlano(planoDaUrl)
    ? planoDaUrl
    : escolhido
      ? escolhido
      : planoMostrado && planoPago(planoMostrado) && subscriptionId
        ? planoMostrado
        : ehPlano(metadata.plano_escolhido)
          ? metadata.plano_escolhido
          : PLANO_EM_DESTAQUE;
  const planoInicial: Plano = apenasPagos && !planoPago(candidato) ? PLANO_EM_DESTAQUE : candidato;

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
    (status === "inadimplente" && !cobrancaEmAberto) ||
    ativaNoGratis;

  const atualizadaEm = formatarMomento(empresa.assinatura_atualizada_em);
  const testeAte = formatarMomento(empresa.trial_termina_em);

  const rotuloSituacao =
    status === "trial"
      ? situacao.carenciaLegada
        ? "Teste anterior"
        : "Teste encerrado"
      : {
          pendente: "Aguardando pagamento",
          ativa: "Ativa",
          inadimplente: "Pagamento pendente",
          cancelada: "Cancelada",
          suspensa: "Suspensa",
        }[status];

  const classeSituacao =
    status === "ativa"
      ? `${s.etiqueta} ${s.sitPaga}`
      : status === "cancelada"
        ? `${s.etiqueta} ${s.sitEstornada}`
        : status === "trial" && situacao.carenciaLegada
          ? s.etiqueta
          : `${s.etiqueta} ${s.sitVencida}`;

  const percentUso =
    uso && uso.limiteClientes !== null && uso.limiteClientes > 0
      ? Math.min(100, Math.round((uso.clientesAtivos / uso.limiteClientes) * 100))
      : 0;
  const noLimite = uso !== null && uso.limiteClientes !== null && uso.clientesAtivos >= uso.limiteClientes;

  const tituloSeletor = ativaNoGratis
    ? "Quer mais clientes? Contrate um plano"
    : status === "cancelada"
      ? "Escolher um plano novamente"
      : status === "inadimplente"
        ? "Regularizar o pagamento"
        : status === "trial"
          ? "Escolha um plano para continuar"
          : "Escolha seu plano";
  const rotuloBotao = status === "cancelada" ? "Gerar nova cobrança" : "Gerar cobrança";

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Assinatura</h1>
        <p className={s.subtitulo}>
          {planoMostrado
            ? planoPago(planoMostrado)
              ? `${formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoMostrado])} por mês.`
              : "Plano Grátis, sem mensalidade."
            : `Comece no plano Grátis ou escolha um plano a partir de ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)} por mês.`}
        </p>
        {/* taxa e nota logo abaixo do preço: ninguém descobre o custo por Pix só no checkout */}
        <AvisoTaxa className={c.avisoTaxaCabecalho} />
      </header>

      {/* Conta ainda não paga: situação, plano e mensalidade seriam três
          "—"; a faixa de aviso e os passos abaixo já dizem o que importa. */}
      {status !== "pendente" && (
      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>
            <span className={classeSituacao}>{rotuloSituacao}</span>
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Plano</span>
          <span className={s.numeroValor}>{planoMostrado ? NOME_DO_PLANO[planoMostrado] : "A escolher"}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Mensalidade</span>
          <span className={s.numeroValor}>
            {planoMostrado
              ? planoPago(planoMostrado)
                ? formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoMostrado])
                : "Sem mensalidade"
              : "—"}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>
            {status === "trial" ? (situacao.carenciaLegada ? "Teste até" : "Teste terminou em") : "Última mudança"}
          </span>
          <span className={s.numeroValor}>
            {status === "trial" ? (testeAte ?? "—") : (atualizadaEm ?? "—")}
          </span>
        </div>
      </div>
      )}

      {/* ---------- o que aconteceu com a conta ---------- */}

      {status === "pendente" && (
        <ol className={c.passos} aria-label="Como funciona">
          <li>
            <strong>Escolha o plano</strong>
            Pelo tamanho da sua carteira de clientes.
          </li>
          <li>
            <strong>Pague a primeira mensalidade</strong>
            Só nos planos pagos: Pix, boleto ou cartão, na fatura que geramos para você. O plano Grátis não tem
            pagamento.
          </li>
          <li>
            <strong>Conta liberada</strong>
            Nos planos pagos, assim que o pagamento é confirmado, automaticamente. No Grátis, na hora.
          </li>
        </ol>
      )}

      {status === "trial" && situacao.carenciaLegada && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Período de teste anterior</h2>
          <p className={c.estadoTexto}>
            Período de teste anterior até {formatarDiaMes(empresa.trial_termina_em)} — assine para continuar. Até lá
            você segue usando o Zelo normalmente.
          </p>
        </section>
      )}

      {status === "trial" && !situacao.carenciaLegada && (
        <section className={`${s.bloco} ${s.blocoAviso} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Período de teste anterior encerrado</h2>
          <p className={c.estadoTexto}>
            Terminou em {testeAte}. Enquanto a assinatura não for paga, {BLOQUEIO_TEXTO}
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

      {ativaNoGratis && (
        <section className={`${s.bloco} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Plano Grátis ativo</h2>
          <p className={c.estadoTexto}>
            Você está no plano Grátis{atualizadaEm ? ` desde ${atualizadaEm}` : ""}: sem mensalidade e sem prazo — ele
            não expira. {descricaoDoLimite("gratis")}, com {TAXA} por Pix recebido.
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

      {status === "ativa" && !ativaNoGratis && (
        <section className={`${s.bloco} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Assinatura ativa</h2>
          <p className={c.estadoTexto}>
            Sua assinatura está em dia{atualizadaEm ? ` desde ${atualizadaEm}` : ""}.
            {uso
              ? uso.limiteClientes === null
                ? ` O plano ${uso.nomePlano} não tem limite de clientes.`
                : ` O plano ${uso.nomePlano} permite até ${uso.limiteClientes} clientes ativos.`
              : ""}
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
        {(precisaEscolher || cobrancaEmAberto) && (
          <SeletorDePlano
            planoInicial={planoInicial}
            documentoInicial={documento}
            podeAssinar={podeAssinar}
            pagamentoDisponivel={pagamentoDisponivel}
            cobrancaEmAberto={cobrancaEmAberto}
            tituloSeletor={tituloSeletor}
            rotuloBotao={rotuloBotao}
            apenasPagos={apenasPagos}
            contaLiberada={ativaNoGratis}
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
