import { Suspense } from "react";
import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { formatarData, hojeISO } from "@/lib/cobranca";
import { formatarCentavos } from "@/lib/dinheiro";
import {
  COLUNAS_PREFERENCIAS,
  ROTULO_ACAO_COBRANCA,
  ROTULO_RECUPERACAO,
  acaoRecomendada,
  diasDeAtraso,
  estadoDeRecuperacao,
  preferenciasDaEmpresa,
  rotuloDaRegra,
  valorAtualizado,
  type TipoAcaoCobranca,
} from "@/lib/recuperacao";
import {
  POR_PAGINA_ATRASO,
  acoesDasCobrancas,
  encargosDaCobranca,
  lembretesDoDia,
  listarAtrasadas,
  resumoDeAtraso,
} from "@/lib/core/recuperacao-dados";
import { tempoRelativo } from "@/lib/atividade";
import OpcoesRecuperacao, { RecuperacaoPreparando } from "../cobrancas/OpcoesRecuperacao";
import s from "../../App.module.css";
import c from "../Recuperacao.module.css";

export const metadata = { title: "Em atraso" };

/* Sempre fresco: é a tela de "quem me deve agora" e mostra o estado do banco. */
export const dynamic = "force-dynamic";

const CLASSE_ESTADO: Record<string, string> = {
  vencida: s.sitVencida,
  em_recuperacao: s.sitEnviada,
  negociada: s.sitPendente,
};

export default async function CentralDeAtraso({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const hoje = hojeISO();
  const agora = new Date();
  const p = Math.max(1, Number(pagina) || 1);
  const supabase = await supabaseServer();

  const [{ data: linhaEmpresa }, resumo, lista] = await Promise.all([
    supabase.from("empresas").select(COLUNAS_PREFERENCIAS).eq("id", empresaId).maybeSingle(),
    resumoDeAtraso(supabase, empresaId, hoje),
    listarAtrasadas(supabase, empresaId, hoje, p),
  ]);
  const prefs = preferenciasDaEmpresa(linhaEmpresa as Record<string, unknown> | null);
  const lembretes = await lembretesDoDia(supabase, empresaId, hoje, prefs.lembretes);
  const acoes = await acoesDasCobrancas(supabase, empresaId, [
    ...lista.cobrancas.map((x) => x.id),
    ...lembretes.map((l) => l.cobranca.id),
  ]);

  const ultima = Math.max(1, Math.ceil(lista.total / POR_PAGINA_ATRASO));
  const algumLembreteLigado = Object.values(prefs.lembretes).some(Boolean);

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Em atraso</h1>
        <p className={s.subtitulo}>Quem está te devendo dinheiro agora.</p>
      </header>

      <div className={c.resumo}>
        <div className={`${s.numero} ${resumo.quantidade > 0 ? s.numeroVencido : ""}`}>
          <span className={s.numeroRotulo}>Em atraso</span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.totalCentavos)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Cobranças atrasadas</span>
          <span className={s.numeroValor}>{resumo.quantidade}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Clientes em atraso</span>
          <span className={s.numeroValor}>{resumo.clientes}</span>
        </div>
      </div>

      {/* Lembretes na vez hoje — só se a empresa ligou alguma regra. Nada é
          enviado: a lista mostra o que mandar e o botão abre o WhatsApp. */}
      <section className={s.bloco} style={{ marginBottom: 26 }} aria-labelledby="titulo-lembretes">
        <h2 id="titulo-lembretes" className={s.blocoTitulo}>
          Lembretes de hoje
        </h2>
        {!algumLembreteLigado ? (
          <p className={s.blocoVazio}>
            Você ainda não escolheu quando lembrar seus clientes.{" "}
            <Link href="/app/configuracoes#cobranca-e-recuperacao" className={s.linkTabela}>
              Configurar lembretes
            </Link>
          </p>
        ) : lembretes.length === 0 ? (
          <p className={s.blocoVazio}>Nenhum lembrete pendente para hoje.</p>
        ) : (
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Lembrete</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {lembretes.map(({ cobranca, regra }) => (
                  <tr key={`${cobranca.id}-${regra}`}>
                    <td data-label="Cliente">
                      <Link href={`/app/cobrancas/${cobranca.id}`} className={s.linkTabela}>
                        {cobranca.clientes?.nome ?? "—"}
                      </Link>
                    </td>
                    <td className={s.valorCelula} data-label="Valor">{formatarCentavos(cobranca.valor_centavos)}</td>
                    <td className={s.celulaFraca} data-label="Vencimento">{formatarData(cobranca.vence_em)}</td>
                    <td className={s.celulaFraca} data-label="Lembrete">{rotuloDaRegra(regra)}</td>
                    <td className={c.celulaAcoes} data-label="Ação">
                      <div className={c.celula}>
                      {cobranca.clientes && (
                        <Suspense fallback={<RecuperacaoPreparando />}>
                          <OpcoesRecuperacao
                            empresaId={empresaId}
                            cobranca={cobranca}
                            cliente={{ id: cobranca.clientes.id, nome: cobranca.clientes.nome, whatsapp: cobranca.clientes.whatsapp ?? null }}
                            regra={regra}
                            rotulo="Enviar lembrete"
                            local="lembretes-do-dia"
                            canal={prefs.canal}
                          />
                        </Suspense>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lista.erro && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar as cobranças em atraso agora. Recarregue a página.
        </div>
      )}

      {!lista.erro && lista.cobrancas.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Nenhuma cobrança em atraso</h2>
          <p className={s.vazioTexto}>Tudo em dia por aqui. Quando uma cobrança passar do vencimento, ela aparece nesta lista.</p>
          <div className={s.acoes} style={{ justifyContent: "center" }}>
            <Link href="/app/cobrancas" className={s.botaoSec}>
              Ver todas as cobranças
            </Link>
          </div>
        </section>
      )}

      {lista.cobrancas.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Atraso</th>
                  <th>Valor atualizado</th>
                  <th>Última ação</th>
                  <th>Ação recomendada</th>
                </tr>
              </thead>
              <tbody>
                {lista.cobrancas.map((cobranca) => {
                  const dias = diasDeAtraso(cobranca.vence_em, hoje);
                  const encargos = encargosDaCobranca(cobranca);
                  const atualizado = valorAtualizado({ valorCentavos: cobranca.valor_centavos, venceEm: cobranca.vence_em, hoje, encargos });
                  const ultimaAcao = acoes.get(cobranca.id);
                  const estado = estadoDeRecuperacao(cobranca, Boolean(ultimaAcao?.temContato), hoje);
                  return (
                    <tr key={cobranca.id}>
                      <td data-label="Cliente">
                        <div className={`${c.celula} ${c.celulaPrimeira}`}>
                          <Link href={`/app/cobrancas/${cobranca.id}`} className={s.linkTabela}>
                            {cobranca.clientes?.nome ?? "—"}
                          </Link>
                          <span className={c.ultimaAcao}>{cobranca.descricao}</span>
                          <span className={`${s.etiqueta} ${CLASSE_ESTADO[estado] ?? ""}`}>{ROTULO_RECUPERACAO[estado]}</span>
                        </div>
                      </td>
                      <td className={s.valorCelula} data-label="Valor">{formatarCentavos(cobranca.valor_centavos)}</td>
                      <td className={s.celulaFraca} data-label="Vencimento">{formatarData(cobranca.vence_em)}</td>
                      <td data-label="Atraso">
                        {dias} dia{dias !== 1 ? "s" : ""} atrasado
                      </td>
                      <td className={s.valorCelula} data-label="Valor atualizado">
                        <div className={c.celula}>
                          {formatarCentavos(atualizado.totalCentavos)}
                          <span className={c.atualizado}>
                            {atualizado.aplicou ? "estimativa com encargos (boleto)" : "sem encargos"}
                          </span>
                        </div>
                      </td>
                      <td className={s.celulaFraca} data-label="Última ação">
                        <div className={c.celula}>
                          {ultimaAcao ? (
                            <>
                              <span className={c.ultimaAcao}>{ROTULO_ACAO_COBRANCA[ultimaAcao.tipo as TipoAcaoCobranca] ?? ultimaAcao.tipo}</span>
                              <span className={c.atualizado}>{tempoRelativo(ultimaAcao.em, agora)}</span>
                            </>
                          ) : (
                            "Nenhuma ainda"
                          )}
                        </div>
                      </td>
                      <td className={c.celulaAcoes} data-label="Ação recomendada">
                        <div className={c.celula}>
                        <span className={c.recomendada} style={{ marginBottom: 8 }}>{acaoRecomendada(dias)}</span>
                        {cobranca.clientes && (
                          <Suspense fallback={<RecuperacaoPreparando />}>
                            <OpcoesRecuperacao
                              empresaId={empresaId}
                              cobranca={cobranca}
                              cliente={{ id: cobranca.clientes.id, nome: cobranca.clientes.nome, whatsapp: cobranca.clientes.whatsapp ?? null }}
                              canal={prefs.canal}
                            />
                          </Suspense>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {ultima > 1 && (
            <nav className={s.paginacao} aria-label="Paginação">
              <span>Página {p} de {ultima}</span>
              <span className={s.paginacaoAcoes}>
                {p > 1 && <Link href={`/app/inadimplencia?pagina=${p - 1}`} className={s.botaoSec}>Anterior</Link>}
                {p < ultima && <Link href={`/app/inadimplencia?pagina=${p + 1}`} className={s.botaoSec}>Próxima</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
