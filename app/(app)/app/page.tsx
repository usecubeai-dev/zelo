import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { formatarCentavos } from "@/lib/dinheiro";
import {
  CobrancaComCliente,
  ROTULO_SITUACAO,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { obterJornadaOnboarding } from "@/lib/core/jornada-onboarding";
import { rotuloAcao, tempoRelativo } from "@/lib/atividade";
import s from "../App.module.css";

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
      .select("valor_centavos")
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
      .select("id", { count: "exact", head: true })
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

  const resumo = {
    aReceber: soma(aReceber.data, "valor_centavos"),
    recebidoAsaas: soma(recebidoAsaas.data, "valor_pago_centavos"),
    recebidoManual: soma(recebidoManual.data, "valor_pago_centavos"),
    vencido: soma(vencidas.data, "valor_centavos"),
    qtdVencidas: (vencidas.data ?? []).length,
    processandoValor: soma(processando.data, "valor_centavos"),
    qtdProcessando: processando.count ?? 0,
    clientes: clientesAtivos.count ?? 0,
    recorrencias: recorrenciasAtivas.count ?? 0,
  };

  const lista = (proximas.data ?? []) as CobrancaComCliente[];
  const semNada = resumo.clientes === 0;

  const problemas = [
    resumo.qtdVencidas > 0 && {
      href: "/app/cobrancas?f=vencidas",
      texto: `Cobrança${resumo.qtdVencidas > 1 ? "s" : ""} vencida${resumo.qtdVencidas > 1 ? "s" : ""}`,
      valor: String(resumo.qtdVencidas),
    },
    (cobrancasComErro.count ?? 0) > 0 && {
      href: "/app/cobrancas",
      texto: `Falha ao enviar ao Asaas`,
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
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Visão geral</h1>
        <p className={s.subtitulo}>{semNada ? "Sua conta está pronta." : "O resumo do seu mês."}</p>
      </header>

      {!jornada.completa && (
        <section className={s.bloco} style={{ marginBottom: 26 }}>
          <div className={s.barraTopo} style={{ marginBottom: 14 }}>
            <h2 className={s.blocoTitulo} style={{ margin: 0 }}>
              Primeiros passos ({jornada.passos.filter((p) => p.concluido).length}/{jornada.passos.length})
            </h2>
            {jornada.proximoPasso && (
              <Link href={jornada.proximoPasso.href} className={s.botao}>
                {jornada.proximoPasso.titulo}
              </Link>
            )}
          </div>
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
        </section>
      )}

      <div className={s.numeros}>
        <div className={`${s.numero} ${s.numeroRecebido}`}>
          <span className={s.numeroRotulo}>Recebido no mês</span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.recebidoAsaas)}</span>
          {resumo.recebidoManual > 0 && (
            <span className={s.numeroSub}>+ {formatarCentavos(resumo.recebidoManual)} registrados manualmente</span>
          )}
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>A receber este mês</span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.aReceber)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>
            Processando{resumo.qtdProcessando > 0 ? ` (${resumo.qtdProcessando})` : ""}
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.processandoValor)}</span>
          <span className={s.numeroSub}>Enviado ao Asaas, aguardando confirmação</span>
        </div>
        <div className={`${s.numero} ${s.numeroVencido}`}>
          <span className={s.numeroRotulo}>
            Vencido{resumo.qtdVencidas > 0 ? ` (${resumo.qtdVencidas})` : ""}
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.vencido)}</span>
        </div>
      </div>

      <p className={s.statsCompactas}>
        <span><strong>{resumo.clientes}</strong> cliente{resumo.clientes !== 1 ? "s" : ""} ativo{resumo.clientes !== 1 ? "s" : ""}</span>
        <span><strong>{resumo.recorrencias}</strong> recorrência{resumo.recorrencias !== 1 ? "s" : ""} ativa{resumo.recorrencias !== 1 ? "s" : ""}</span>
      </p>

      <div className={s.acoes} style={{ marginTop: 0, marginBottom: 26 }}>
        <Link href="/app/cobrancas/nova" className={s.botao}>
          Nova cobrança
        </Link>
        <Link href="/app/clientes/novo" className={s.botaoSec}>
          Novo cliente
        </Link>
        <Link href="/app/recorrencias/nova" className={s.botaoSec}>
          Nova recorrência
        </Link>
      </div>

      {lista.length === 0 ? (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Nenhuma cobrança em aberto</h2>
          <p className={s.vazioTexto}>
            {situacao?.emTrial
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
                          <td>
                            <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                              {c.descricao}
                            </Link>
                          </td>
                          <td className={s.celulaFraca}>{c.clientes?.nome ?? "—"}</td>
                          <td className={s.celulaFraca}>{formatarData(c.vence_em)}</td>
                          <td className={s.valorCelula}>
                            {formatarCentavos(c.valor_centavos)}
                          </td>
                          <td>
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
