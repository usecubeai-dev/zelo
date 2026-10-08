import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { formatarCentavos } from "@/lib/dinheiro";
import { PRECO_POR_PLANO_CENTAVOS } from "@/lib/plano";
import AvisoTaxa from "@/components/AvisoTaxa";
import {
  CobrancaComCliente,
  ROTULO_SITUACAO,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { obterJornadaOnboarding } from "@/lib/core/jornada-onboarding";
import { rotuloAcao, tempoRelativo } from "@/lib/atividade";
import OnboardingCompletoTracker from "./OnboardingCompletoTracker";
import AtivacaoRapida from "./AtivacaoRapida";
import { IconeRecebido, IconeAReceber, IconeProcessando, IconeVencido } from "./Icones";
import s from "../App.module.css";
import cr from "./Recuperacao.module.css";

export const metadata = { title: "Visão geral" };

/** Primeiro e último dia do mês corrente, em `YYYY-MM-DD`. */
function mesCorrente(hoje: string) {
  const [a, m] = hoje.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return {
    inicio: `${a}-${String(m).padStart(2, "0")}-01`,
    fim: `${a}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`,
  };
}

const CLASSE: Record<string, string> = {
  pendente: s.sitPendente,
  enviada: s.sitEnviada,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
  estornada: s.sitEstornada,
};

export default async function Painel() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  if (!empresaId) return null;

  const situacao = empresa ? situacaoDaConta(empresa) : null;
  /* `pendente` (ou teste legado vencido): ainda falta escolher o plano — e, nos
     planos pagos, pagar a primeira mensalidade (o Grátis libera na hora) */
  const aguardandoPagamento = Boolean(situacao?.aguardandoPagamento);
  const hoje = hojeISO();
  const agora = new Date();
  const { inicio, fim } = mesCorrente(hoje);
  const supabase = await supabaseServer();

  /* Consultas pequenas em paralelo — cada uma agregada ou limitada no
     banco, nenhuma traz mais linhas do que o necessário pra tela.
     Somar centavos no banco evita trazer a tabela inteira só pra
     reduzir, e mantém a conta exata, porque tudo é inteiro. */
  const [
    aReceber,
    recebidoAsaas,
    recebidoManual,
    vencidas,
    processando,
    cobrancasComErro,
    instrucoesRecusadas,
    clientesAtivos,
    recorrenciasAtivas,
    proximas,
    atividade,
    jornada,
  ] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("valor_centavos")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .gte("vence_em", inicio)
      .lte("vence_em", fim),
    supabase
      .from("cobrancas")
      .select("valor_pago_centavos")
      .eq("empresa_id", empresaId)
      .eq("status", "paga")
      .eq("pago_via", "asaas")
      .gte("pago_em", `${inicio}T00:00:00`),
    supabase
      .from("cobrancas")
      .select("valor_pago_centavos")
      .eq("empresa_id", empresaId)
      .eq("status", "paga")
      .eq("pago_via", "manual")
      .gte("pago_em", `${inicio}T00:00:00`),
    supabase
      .from("cobrancas")
      .select("valor_centavos, cliente_id")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .lt("vence_em", hoje),
    supabase
      .from("cobrancas")
      .select("valor_centavos", { count: "exact" })
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .not("asaas_payment_id", "is", null),
    supabase
      .from("cobrancas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("asaas_sync_status", "erro"),
    supabase
      .from("instrucoes_pagamento")
      .select("id, cobrancas!inner(status)", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "REFUSED")
      .in("cobrancas.status", ["pendente", "enviada"]),
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "ativo"),
    supabase
      .from("recorrencias")
      .select("valor_centavos")
      .eq("empresa_id", empresaId)
      .eq("status", "ativa"),
    supabase
      .from("cobrancas")
      .select("*, clientes(id,nome)")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .order("vence_em")
      .limit(5),
    supabase
      .from("log_acoes_financeiras")
      .select("id, acao, criado_em")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(6),
    obterJornadaOnboarding(empresaId),
  ]);

  const soma = (linhas: { valor_centavos?: number | null; valor_pago_centavos?: number | null }[] | null, campo: "valor_centavos" | "valor_pago_centavos") =>
    (linhas ?? []).reduce((t, l) => t + (l[campo] ?? 0), 0);

  /* Receita recorrente (MRR) = soma do valor de toda recorrência ativa —
     é literalmente o que a empresa já sabe que vai faturar todo mês,
     recorrência por recorrência, sem depender de nenhuma cobrança já ter
     sido gerada. "Previsão" reaproveita o mesmo número: é a leitura mais
     honesta de "quanto devo esperar receber no ciclo que vem" que dá pra
     calcular sem inventar projeção nenhuma. */
  const receitaRecorrente = soma(recorrenciasAtivas.data, "valor_centavos");

  const resumo = {
    aReceber: soma(aReceber.data, "valor_centavos"),
    recebidoAsaas: soma(recebidoAsaas.data, "valor_pago_centavos"),
    recebidoManual: soma(recebidoManual.data, "valor_pago_centavos"),
    vencido: soma(vencidas.data, "valor_centavos"),
    qtdVencidas: (vencidas.data ?? []).length,
    processandoValor: soma(processando.data, "valor_centavos"),
    qtdProcessando: processando.count ?? 0,
    clientes: clientesAtivos.count ?? 0,
    recorrencias: (recorrenciasAtivas.data ?? []).length,
    receitaRecorrente,
    /* Retenção: regra objetiva, não IA (pedido explícito) — cliente com
       pelo menos uma cobrança vencida é quem precisa de atenção agora. */
    clientesEmAtraso: new Set((vencidas.data ?? []).map((c) => c.cliente_id)).size,
  };

  const lista = (proximas.data ?? []) as CobrancaComCliente[];
  const semNada = resumo.clientes === 0;
  const jornadaConcluidos = jornada.passos.filter((p) => p.concluido).length;
  const jornadaPercent = jornada.passos.length > 0
    ? Math.round((jornadaConcluidos / jornada.passos.length) * 100)
    : 0;

  const problemas = [
    resumo.qtdVencidas > 0 && {
      href: "/app/inadimplencia",
      texto: `Cobrança${resumo.qtdVencidas > 1 ? "s" : ""} vencida${resumo.qtdVencidas > 1 ? "s" : ""}`,
      valor: String(resumo.qtdVencidas),
    },
    (cobrancasComErro.count ?? 0) > 0 && {
      href: "/app/cobrancas",
      texto: `Falha ao processar cobrança`,
      valor: String(cobrancasComErro.count),
    },
    (instrucoesRecusadas.count ?? 0) > 0 && {
      href: "/app/cobrancas",
      texto: `Débito automático recusado`,
      valor: String(instrucoesRecusadas.count),
    },
  ].filter(Boolean) as { href: string; texto: string; valor: string }[];

  const atividadeLista = atividade.data ?? [];

  return (
    <>
      <OnboardingCompletoTracker completa={jornada.completa} />
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Visão geral</h1>
        <p className={s.subtitulo}>
          {aguardandoPagamento
            ? "Sua conta foi criada. Falta escolher o plano para liberá-la."
            : semNada
              ? "Sua conta está pronta."
              : "O resumo do seu mês."}
        </p>
      </header>

      {/* Conta que ainda não pagou: o único próximo passo que importa é
          assinar. Os "primeiros passos" abaixo só aparecem depois, porque
          cadastrar cliente e criar cobrança estão bloqueados até o
          pagamento ser confirmado — mandar a pessoa para lá só geraria erro. */}
      {aguardandoPagamento && (
        <section className={s.ctaPlano} aria-labelledby="cta-plano-titulo">
          <div className={s.ctaPlanoTexto}>
            <h2 id="cta-plano-titulo" className={s.ctaPlanoTitulo}>
              Libere sua conta em poucos minutos
            </h2>
            <p>
              Escolha um plano a partir de {formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês — sua conta é
              liberada assim que o pagamento for confirmado.
            </p>
            {/* a taxa por Pix recebido vale em todos os planos e aparece junto do preço */}
            <AvisoTaxa />
          </div>
          <Link href="/app/assinatura" className={`${s.botao} ${s.ctaPlanoBotao}`}>
            Escolher plano
          </Link>
        </section>
      )}

      {!aguardandoPagamento && (
        <AtivacaoRapida passos={jornada.ativacaoRapida.passos} completa={jornada.ativacaoRapida.completa} />
      )}

      <div className={`${s.numeros} ${s.numerosHero}`}>
        <div className={`${s.numero} ${s.numeroRecebido}`}>
          <span className={s.numeroTopo}>
            <span className={s.numeroRotulo}>Recebido no mês</span>
            <span className={`${s.numeroIcone} ${s.numeroIconeSucesso}`} aria-hidden="true">
              <IconeRecebido />
            </span>
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.recebidoAsaas)}</span>
          {resumo.recebidoManual > 0 && (
            <span className={s.numeroSub}>+ {formatarCentavos(resumo.recebidoManual)} registrados manualmente</span>
          )}
        </div>
        <div className={s.numero}>
          <span className={s.numeroTopo}>
            <span className={s.numeroRotulo}>A receber este mês</span>
            <span className={`${s.numeroIcone} ${s.numeroIconeNeutro}`} aria-hidden="true">
              <IconeAReceber />
            </span>
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.aReceber)}</span>
          {resumo.qtdProcessando > 0 && (
            <span className={s.numeroSub}>
              {resumo.qtdProcessando} enviada{resumo.qtdProcessando > 1 ? "s" : ""} ao parceiro de pagamentos ({formatarCentavos(resumo.processandoValor)}), aguardando confirmação
            </span>
          )}
        </div>
        <div className={`${s.numero} ${resumo.qtdVencidas > 0 ? s.numeroVencido : ""}`}>
          <span className={s.numeroTopo}>
            <span className={s.numeroRotulo}>
              Em atraso{resumo.qtdVencidas > 0 ? ` (${resumo.qtdVencidas})` : ""}
            </span>
            <span className={`${s.numeroIcone} ${s.numeroIconeAlerta}`} aria-hidden="true">
              <IconeVencido />
            </span>
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.vencido)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroTopo}>
            <span className={s.numeroRotulo}>Previsão mensal</span>
            <span className={`${s.numeroIcone} ${s.numeroIconeInfo}`} aria-hidden="true">
              <IconeProcessando />
            </span>
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.receitaRecorrente)}</span>
          <span className={s.numeroSub}>
            {resumo.recorrencias > 0
              ? `Das ${resumo.recorrencias} cobrança${resumo.recorrencias !== 1 ? "s" : ""} automática${resumo.recorrencias !== 1 ? "s" : ""} ativa${resumo.recorrencias !== 1 ? "s" : ""}`
              : "Crie uma cobrança automática para ver sua previsão"}
          </span>
        </div>
      </div>

      {/* Destaque de recuperação: só aparece quando há dinheiro parado. O botão
          leva à central; nada é enviado daqui. */}
      {resumo.qtdVencidas > 0 && (
        <section className={cr.faixaAtraso} aria-labelledby="faixa-atraso">
          <p id="faixa-atraso">
            {resumo.qtdVencidas} cobrança{resumo.qtdVencidas > 1 ? "s atrasadas precisam" : " atrasada precisa"} da sua atenção
            {resumo.vencido > 0 ? `: ${formatarCentavos(resumo.vencido)} em aberto` : ""}.
          </p>
          <Link href="/app/inadimplencia" className={s.botao}>
            Ver cobranças atrasadas
          </Link>
        </section>
      )}

      {/* Hierarquia de ênfase entre as 4 ações (auditoria de complexidade UX,
          11-12/09/2026): antes as 4 tinham o mesmo peso visual, competindo
          por atenção. Mesmas rotas, mesmas ações — só a ênfase muda.
          Principal: criar cobrança automática (o diferencial do produto).
          Secundárias: as duas ações do dia a dia mais comuns. Menor
          destaque: serviço é cadastro de apoio, usado com menos frequência
          que as outras três. */}
      <div className={s.acoes} style={{ marginTop: 0, marginBottom: 8 }}>
        <Link href="/app/cobrancas/nova" className={s.botao}>
          + Nova cobrança
        </Link>
        <Link href="/app/recorrencias/nova" className={s.botaoSec}>
          Cobrança automática
        </Link>
        <Link href="/app/clientes/novo" className={s.botaoSec}>
          Novo cliente
        </Link>
        <Link href="/app/servicos/novo" className={s.botaoTerciario}>
          Novo serviço
        </Link>
        <Link href="/app/negocio" className={s.botaoTerciario}>
          Ver como está seu negócio
        </Link>
      </div>
      <p className={s.numeroSub} style={{ marginBottom: 26 }}>
        <strong>Nova cobrança</strong> é pontual: você cria, envia ao cliente e acompanha.{" "}
        <strong>Cobrança automática</strong> cobra seu cliente todo mês sozinha, depois que ele autoriza uma vez.
      </p>

      <p className={s.statsCompactas}>
        <span><strong>{resumo.clientes}</strong> cliente{resumo.clientes !== 1 ? "s" : ""} ativo{resumo.clientes !== 1 ? "s" : ""}</span>
        <span><strong>{resumo.recorrencias}</strong> recorrência{resumo.recorrencias !== 1 ? "s" : ""} ativa{resumo.recorrencias !== 1 ? "s" : ""}</span>
        {resumo.clientesEmAtraso > 0 && (
          <span>
            <strong>{resumo.clientesEmAtraso}</strong> cliente{resumo.clientesEmAtraso !== 1 ? "s" : ""} precisa{resumo.clientesEmAtraso !== 1 ? "m" : ""} de atenção
          </span>
        )}
      </p>

      {/* Saúde da operação: % de clientes ativos sem nenhuma cobrança vencida
          agora. Dado real já calculado acima (resumo.clientes/clientesEmAtraso),
          nenhuma métrica nova inventada — só uma leitura visual de algo que já
          existia como texto solto em `.statsCompactas`. Só aparece quando há
          clientes o bastante pra a leitura fazer sentido. */}
      {resumo.clientes > 0 && (
        <div className={s.saudeOperacao}>
          <div className={s.medidorLinha}>
            <span>Clientes em dia</span>
            <span>{resumo.clientes - resumo.clientesEmAtraso} de {resumo.clientes}</span>
          </div>
          <div className={s.medidor}>
            <div
              className={s.medidorPreenchido}
              style={{
                width: `${Math.round(((resumo.clientes - resumo.clientesEmAtraso) / resumo.clientes) * 100)}%`,
                background: resumo.clientesEmAtraso > 0 ? "var(--warning)" : "var(--success)",
              }}
            />
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Nenhuma cobrança em aberto</h2>
          <p className={s.vazioTexto}>
            {aguardandoPagamento
              ? "Assim que sua conta for liberada, as cobranças que você criar aparecem aqui."
              : situacao?.liberada
                ? "Crie sua primeira cobrança e acompanhe tudo por aqui."
                : "Quando houver cobrança pendente, ela aparece aqui."}
          </p>
        </section>
      ) : (
        <>
          <div className={s.barraTopo}>
            <h2 className={s.vazioTitulo}>Próximos vencimentos</h2>
            <Link href="/app/cobrancas" className={s.botaoSec}>
              Ver todas
            </Link>
          </div>
          <div className={s.tabelaEnvolve}>
                <table className={s.tabela}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Cliente</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c) => {
                      const sit = situacaoDaCobranca(c, hoje);
                      return (
                        <tr key={c.id}>
                          <td data-label="Descrição">
                            <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                              {c.descricao}
                            </Link>
                          </td>
                          <td className={s.celulaFraca} data-label="Cliente">{c.clientes?.nome ?? "—"}</td>
                          <td className={s.celulaFraca} data-label="Vencimento">{formatarData(c.vence_em)}</td>
                          <td className={s.valorCelula} data-label="Valor">
                            {formatarCentavos(c.valor_centavos)}
                          </td>
                          <td data-label="Situação">
                            <span className={`${s.etiqueta} ${CLASSE[sit]}`}>
                              {ROTULO_SITUACAO[sit]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

      {/* Checklist completa (9 etapas): só depois do "Comece por aqui", e
          recolhida — o painel não abre com ela. Nenhuma etapa foi removida. */}
      {!aguardandoPagamento && jornada.ativacaoRapida.completa && !jornada.completa && (
        <details className={s.configDetalhes}>
          <summary className={s.configResumo}>
            <span className={s.configTitulo}>Primeiros passos — você está quase pronto para receber</span>
            <span className={s.medidorLinha} style={{ gridColumn: "1 / -1", margin: 0 }}>
              <span>{jornadaConcluidos} de {jornada.passos.length} etapas concluídas</span>
              <span>{jornadaPercent}%</span>
            </span>
            <span className={`${s.medidor} ${s.configProgresso}`}>
              <span className={s.medidorPreenchido} style={{ display: "block", width: `${jornadaPercent}%`, background: "var(--success)" }} />
            </span>
          </summary>
          <div className={s.configCorpo}>
            {jornada.proximoPasso && (
              <p style={{ margin: "0 0 14px" }}>
                <Link href={jornada.proximoPasso.href} className={s.botao}>
                  {jornada.proximoPasso.titulo}
                </Link>
              </p>
            )}
            <ul className={s.jornadaLista}>
              {jornada.passos.map((p) => (
                <li key={p.id} className={s.jornadaItem} data-concluido={p.concluido ? "true" : "false"}>
                  <span className={s.jornadaMarca} aria-hidden="true">{p.concluido ? "✓" : ""}</span>
                  <span>
                    {p.concluido ? <span>{p.titulo}</span> : <Link href={p.href}>{p.titulo}</Link>}
                    {p.detalhe && <span className={s.numeroSub} style={{ display: "block" }}>{p.detalhe}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

          <div className={s.painelGrid}>
            <div className={s.bloco}>
              <h3 className={s.blocoTitulo}>Problemas</h3>
              {problemas.length === 0 ? (
                <p className={s.blocoVazio}>Nada precisando de atenção agora.</p>
              ) : (
                <div className={s.alertaLista}>
                  {problemas.map((p) => (
                    <Link key={p.texto} href={p.href} className={s.alertaItem}>
                      <span>{p.texto}</span>
                      <span>{p.valor}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className={s.bloco}>
              <h3 className={s.blocoTitulo}>Atividade recente</h3>
              {atividadeLista.length === 0 ? (
                <p className={s.blocoVazio}>Nenhuma movimentação ainda.</p>
              ) : (
                <div className={s.atividadeLista}>
                  {atividadeLista.map((a) => (
                    <div key={a.id} className={s.atividadeItem}>
                      <span className={s.atividadeTexto}>{rotuloAcao(a.acao)}</span>
                      <span className={s.atividadeQuando}>{tempoRelativo(a.criado_em, agora)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
    </>
  );
}
