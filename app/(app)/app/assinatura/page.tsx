import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { obterUsoDoPlano } from "@/lib/core/assinatura";
import { obterLinkDePagamentoPendente } from "@/lib/core/assinatura-zelo";
import type { MensalidadeLinha } from "@/lib/core/mensalidade";
import {
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  ehPlano,
  type Plano,
} from "@/lib/plano";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData as formatarDataISO } from "@/lib/cobranca";
import SeletorDePlano from "./SeletorDePlano";
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
    supabase.from("empresas").select("asaas_subscription_id, documento").eq("id", empresa.id).maybeSingle(),
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

  /* Cobrança em aberto só faz sentido onde existe pagamento a fazer. Conta
     ativa não precisa de link; cancelada teve a assinatura removida. */
  const podeTerCobrancaAberta = status === "pendente" || status === "trial" || status === "inadimplente";
  const linkPendente =
    podeTerCobrancaAberta && pagamentoDisponivel ? await obterLinkDePagamentoPendente(subscriptionId) : null;

  const planoDaEmpresa: Plano | null = ehPlano(empresa.plano) ? empresa.plano : null;
  /* conta `pendente` sem assinatura criada ainda tem o plano padrão do
     banco — isso NÃO é uma escolha da pessoa, então não é mostrado como tal */
  const planoMostrado: Plano | null = planoDaEmpresa && (status !== "pendente" || subscriptionId) ? planoDaEmpresa : null;

  const metadata = (atual.user.user_metadata ?? {}) as { plano_escolhido?: unknown };
  const planoDaUrl = primeiro(params.plano);
  const planoInicial: Plano = ehPlano(planoDaUrl)
    ? planoDaUrl
    : planoMostrado && subscriptionId
      ? planoMostrado
      : ehPlano(metadata.plano_escolhido)
        ? metadata.plano_escolhido
        : PLANO_EM_DESTAQUE;

  const cobrancaEmAberto =
    linkPendente && planoDaEmpresa ? { plano: planoDaEmpresa, linkPagamento: linkPendente } : null;

  const mostraUso = planoMostrado !== null && status !== "cancelada" && status !== "pendente";
  const uso = mostraUso && planoMostrado ? await obterUsoDoPlano(empresa.id, planoMostrado) : null;

  const precisaEscolher =
    status === "pendente" ||
    status === "trial" ||
    status === "cancelada" ||
    (status === "inadimplente" && !cobrancaEmAberto);

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
    uso && uso.limiteClientes > 0 ? Math.min(100, Math.round((uso.clientesAtivos / uso.limiteClientes) * 100)) : 0;
  const percentUsoCobrancas =
    uso && uso.limiteCobrancasMes > 0
      ? Math.min(100, Math.round((uso.cobrancasNoMes / uso.limiteCobrancasMes) * 100))
      : 0;

  const tituloSeletor =
    status === "cancelada"
      ? "Assinar novamente"
      : status === "inadimplente"
        ? "Regularizar o pagamento"
        : status === "trial"
          ? "Assine para continuar"
          : "Escolha seu plano";
  const rotuloBotao = status === "cancelada" ? "Gerar nova cobrança" : "Gerar cobrança";

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Assinatura</h1>
        <p className={s.subtitulo}>
          {planoMostrado
            ? `${formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoMostrado])} por mês.`
            : `Planos a partir de ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)} por mês.`}{" "}
          Taxa de recebimento: {TAXA} por pagamento recebido.
        </p>
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
            {planoMostrado ? formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoMostrado]) : "—"}
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
            Pix, boleto ou cartão, na fatura que geramos para você.
          </li>
          <li>
            <strong>Conta liberada</strong>
            Assim que o pagamento é confirmado, automaticamente.
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

      {status === "ativa" && (
        <section className={`${s.bloco} ${c.estado}`}>
          <h2 className={s.blocoTitulo}>Assinatura ativa</h2>
          <p className={c.estadoTexto}>
            Sua assinatura está em dia{atualizadaEm ? ` desde ${atualizadaEm}` : ""}.
            {uso ? ` O plano ${uso.nomePlano} permite até ${uso.limiteClientes} clientes ativos e ${uso.limiteCobrancasMes} cobranças por mês.` : ""}
          </p>
        </section>
      )}

      {/* ---------- escolha / pagamento ---------- */}

      {(precisaEscolher || cobrancaEmAberto) && (
        <SeletorDePlano
          planoInicial={planoInicial}
          documentoInicial={documento}
          podeAssinar={podeAssinar}
          pagamentoDisponivel={pagamentoDisponivel}
          cobrancaEmAberto={cobrancaEmAberto}
          tituloSeletor={tituloSeletor}
          rotuloBotao={rotuloBotao}
        />
      )}

      {/* ---------- uso do plano ---------- */}

      {uso && (
        <section className={s.bloco} style={{ marginBottom: 26 }}>
          <h2 className={s.blocoTitulo}>Uso do plano — {uso.nomePlano}</h2>
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
          <div className={s.medidorLinha} style={{ marginTop: 14 }}>
            <span>Cobranças criadas este mês</span>
            <span>
              {uso.cobrancasNoMes} / {uso.limiteCobrancasMes}
            </span>
          </div>
          <div className={s.medidor}>
            <div
              className={s.medidorPreenchido}
              data-perto={percentUsoCobrancas >= 80 ? "true" : "false"}
              style={{ width: `${percentUsoCobrancas}%` }}
            />
          </div>
        </section>
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
                      {ehPlano(m.plano) ? NOME_DO_PLANO[m.plano] : m.plano}
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
    </>
  );
}
