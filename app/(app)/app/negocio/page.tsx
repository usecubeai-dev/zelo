import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { hojeISO } from "@/lib/cobranca";
import {
  DIAS_DE_AVISO,
  LIMITE_ATRASO_IMEDIATO_DIAS,
  LIMITE_ATRASO_IMEDIATO_PCT,
  LIMITE_ATRASO_IMEDIATO_QTD,
  inicioDoMes,
  proporcoesDoFluxo,
  resumirNegocio,
  serieDeReceita,
  textoDaVariacao,
} from "@/lib/negocio";
import GraficoReceita from "./GraficoReceita";
import s from "../../App.module.css";
import c from "./Negocio.module.css";

export const metadata = { title: "Meu negócio" };

/* Sempre fresco: é o retrato do negócio agora. */
export const dynamic = "force-dynamic";

/**
 * "Meu negócio": a visão GERENCIAL. O painel (Visão geral) é a operação do dia;
 * aqui a pessoa entende como o negócio está e o que precisa da atenção dela.
 *
 * Só dado que o Zelo já tem, lido com a sessão da própria pessoa (RLS): nada de
 * service_role, nada de outra empresa. Poucas consultas, todas em paralelo e
 * já limitadas no banco.
 */
export default async function MeuNegocio() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const hoje = hojeISO();
  const iniMes = inicioDoMes(hoje);
  const iniTresMeses = inicioDoMes(hoje, -2);
  const supabase = await supabaseServer();

  const [abertas, pagas, clientesAtivos, clientesNovos, recorrencias, totalCobrancas] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("valor_centavos, vence_em, cliente_id")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .limit(5000),
    supabase
      .from("cobrancas")
      .select("valor_pago_centavos, valor_centavos, pago_em")
      .eq("empresa_id", empresaId)
      .eq("status", "paga")
      .gte("pago_em", `${iniTresMeses}T00:00:00`)
      .limit(5000),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ativo"),
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .gte("criado_em", `${iniMes}T00:00:00`),
    supabase.from("recorrencias").select("valor_centavos").eq("empresa_id", empresaId).eq("status", "ativa").limit(5000),
    supabase.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
  ]);

  const erroDeLeitura = Boolean(abertas.error || pagas.error);
  const r = resumirNegocio({
    abertas: abertas.data ?? [],
    pagas: (pagas.data ?? []).filter((p): p is { valor_pago_centavos: number | null; valor_centavos: number; pago_em: string } => Boolean(p.pago_em)),
    clientesAtivos: clientesAtivos.count ?? 0,
    clientesNovosNoMes: clientesNovos.count ?? 0,
    recorrencias: recorrencias.data ?? [],
    totalDeCobrancas: totalCobrancas.count ?? 0,
    hoje,
  });

  const pagasValidas = (pagas.data ?? []).filter((p) => p.pago_em) as { valor_pago_centavos: number | null; valor_centavos: number; pago_em: string }[];
  const series = {
    "7d": serieDeReceita(pagasValidas, "7d", hoje),
    mes: serieDeReceita(pagasValidas, "mes", hoje),
    "3m": serieDeReceita(pagasValidas, "3m", hoje),
  };
  const fluxo = proporcoesDoFluxo(r.fluxo);
  const variacao = textoDaVariacao(r.variacaoPct);

  /* Primeiro acesso: sem cliente e sem cobrança, não há o que mostrar —
     a tela conduz a pessoa até o valor do produto. */
  if (r.semDados && r.clientesAtivos === 0) {
    return (
      <>
        <header className={s.cabecalho}>
          <h1 className={s.titulo}>Meu negócio</h1>
        </header>
        <section className={c.primeiro} aria-labelledby="primeiro-titulo">
          <h2 id="primeiro-titulo" className={c.primeiroTitulo}>
            Seu negócio começa aqui.
          </h2>
          <p className={c.posicionamento}>Você ainda não possui dados suficientes para mostrar sua saúde financeira. Comece por:</p>
          <ol className={c.passos}>
            <li>Cadastre seu primeiro cliente</li>
            <li>Crie sua primeira cobrança</li>
            <li>Acompanhe seu primeiro recebimento</li>
          </ol>
          <Link href="/app/cobrancas/nova" className={c.ctaPrimeiro}>
            Criar primeira cobrança
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Meu negócio</h1>
        <p className={s.subtitulo}>Tenha uma visão clara do seu negócio.</p>
        <p className={c.posicionamento}>Veja o que entrou, o que está para entrar e o que precisa da sua atenção.</p>
      </header>

      <div className={c.raiz}>
        {erroDeLeitura && (
          <div className={s.erroForm} role="alert">
            Não conseguimos carregar todos os números agora. Recarregue a página em instantes.
          </div>
        )}

        {/* ---------- resumo principal ---------- */}
        <section className={c.resumo} aria-label="Resumo do mês">
          <div className={`${c.numero} ${c.verde}`}>
            <span className={c.numeroRotulo}>Receita do mês</span>
            <span className={`${c.numeroValor} tnum`}>{formatarCentavos(r.receitaMesCentavos)}</span>
            <span className={c.numeroSub}>
              {variacao ? (
                <span className={r.variacaoPct !== null && r.variacaoPct < 0 ? c.negativo : c.positivo}>{variacao}</span>
              ) : (
                "Sem mês anterior para comparar ainda."
              )}
            </span>
          </div>
          <div className={c.numero}>
            <span className={c.numeroRotulo}>A receber</span>
            <span className={`${c.numeroValor} tnum`}>{formatarCentavos(r.aReceberCentavos)}</span>
            <span className={c.numeroSub}>
              {r.qtdAReceber} cobrança{r.qtdAReceber !== 1 ? "s" : ""} em aberto que ainda não venceu{r.qtdAReceber !== 1 ? "ram" : ""}
            </span>
          </div>
          <div className={`${c.numero} ${r.qtdEmAtraso > 0 ? c.vermelho : ""}`}>
            <span className={c.numeroRotulo}>Em atraso</span>
            <span className={`${c.numeroValor} tnum`}>{formatarCentavos(r.emAtrasoCentavos)}</span>
            <span className={c.numeroSub}>
              {r.qtdEmAtraso > 0 ? `${r.qtdEmAtraso} cobrança${r.qtdEmAtraso !== 1 ? "s" : ""} vencida${r.qtdEmAtraso !== 1 ? "s" : ""}` : "Nenhuma cobrança vencida"}
            </span>
          </div>
          <div className={c.numero}>
            <span className={c.numeroRotulo}>Previsão do mês</span>
            <span className={`${c.numeroValor} tnum`}>{formatarCentavos(r.previsaoDoMesCentavos)}</span>
            <span className={c.numeroSub}>O que já entrou mais o que ainda vence neste mês.</span>
          </div>
        </section>

        {/* ---------- saúde + atenção ---------- */}
        <div className={c.duas}>
          <section className={c.bloco} aria-labelledby="saude-titulo">
            <h2 id="saude-titulo" className={c.blocoTitulo}>
              Saúde do negócio
            </h2>
            <div className={c.saude} data-nivel={r.saude.nivel}>
              <span className={c.saudeIcone} aria-hidden="true">
                {r.saude.nivel === "ok" ? "✓" : "!"}
              </span>
              <div>
                <p className={c.saudeTitulo}>{r.saude.titulo}</p>
                <p className={c.saudeMotivo}>{r.saude.motivo}</p>
                {r.saude.nivel !== "ok" && (
                  <div style={{ marginTop: 10 }}>
                    <Link href="/app/inadimplencia" className={s.botao}>
                      Recuperar cobrança
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <p className={c.saudeRegra}>
              Não é uma nota: é uma regra simples sobre as suas cobranças. Sem atraso, está tudo sob controle. Com atraso, pede atenção. E pede atenção imediata
              quando há {LIMITE_ATRASO_IMEDIATO_QTD} ou mais cobranças atrasadas, o atraso passa de {LIMITE_ATRASO_IMEDIATO_PCT}% do que está em aberto, ou
              alguma está atrasada há mais de {LIMITE_ATRASO_IMEDIATO_DIAS} dias.
            </p>
          </section>

          <section className={c.bloco} aria-labelledby="atencao-titulo">
            <h2 id="atencao-titulo" className={c.blocoTitulo}>
              Precisa da sua atenção
            </h2>
            {r.alertas.length === 0 ? (
              <p className={c.vazioAlertas}>Nada precisando da sua atenção agora.</p>
            ) : (
              <ul className={c.alertas}>
                {r.alertas.map((a) => (
                  <li key={a.id} className={c.alerta} data-tom={a.tom}>
                    <p className={c.alertaTexto}>{a.texto}</p>
                    <Link href={a.acao.href} className={a.tom === "perigo" ? s.botao : s.botaoSec}>
                      {a.acao.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- fluxo de dinheiro ---------- */}
        <section className={c.bloco} aria-labelledby="fluxo-titulo">
          <h2 id="fluxo-titulo" className={c.blocoTitulo}>
            Fluxo de dinheiro
          </h2>
          <div className={c.fluxo}>
            <div className={c.fluxoItem} data-tipo="recebido">
              <span className={`${c.fluxoValor} tnum`}>{formatarCentavos(r.fluxo.recebidoCentavos)}</span>
              <span className={c.fluxoRotulo}>recebido no mês</span>
            </div>
            <div className={c.fluxoItem} data-tipo="areceber">
              <span className={`${c.fluxoValor} tnum`}>{formatarCentavos(r.fluxo.aReceberCentavos)}</span>
              <span className={c.fluxoRotulo}>a receber</span>
            </div>
            <div className={c.fluxoItem} data-tipo="atraso">
              <span className={`${c.fluxoValor} tnum`}>{formatarCentavos(r.fluxo.emAtrasoCentavos)}</span>
              <span className={c.fluxoRotulo}>em atraso</span>
            </div>
          </div>
          {fluxo.recebido + fluxo.aReceber + fluxo.emAtraso > 0 && (
            <>
              <div className={c.barra} role="img" aria-label={`Do total, ${fluxo.recebido}% recebido, ${fluxo.aReceber}% a receber e ${fluxo.emAtraso}% em atraso.`}>
                <span className={c.barraRecebido} style={{ width: `${fluxo.recebido}%` }} />
                <span className={c.barraAReceber} style={{ width: `${fluxo.aReceber}%` }} />
                <span className={c.barraAtraso} style={{ width: `${fluxo.emAtraso}%` }} />
              </div>
              <ul className={c.legenda}>
                <li>
                  <span className={c.ponto} style={{ background: "var(--success)" }} /> Recebido
                </li>
                <li>
                  <span className={c.ponto} style={{ background: "var(--violet)" }} /> A receber
                </li>
                <li>
                  <span className={c.ponto} style={{ background: "var(--danger)" }} /> Em atraso
                </li>
              </ul>
            </>
          )}
        </section>

        {/* ---------- gráfico ---------- */}
        <section className={c.bloco} aria-labelledby="grafico-titulo">
          <h2 id="grafico-titulo" className={c.blocoTitulo}>
            Evolução da receita
          </h2>
          <p className={c.blocoNota}>Só o que foi recebido e confirmado.</p>
          <GraficoReceita series={series} />
        </section>

        {/* ---------- clientes ---------- */}
        <section aria-labelledby="clientes-titulo">
          <h2 id="clientes-titulo" className={c.blocoTitulo}>
            Clientes
          </h2>
          <div className={c.clientes}>
            <div className={c.numero}>
              <span className={c.numeroRotulo}>Clientes ativos</span>
              <span className={`${c.numeroValor} tnum`}>{r.clientesAtivos}</span>
            </div>
            <div className={c.numero}>
              <span className={c.numeroRotulo}>Novos este mês</span>
              <span className={`${c.numeroValor} tnum`}>{r.clientesNovosNoMes}</span>
            </div>
            <div className={`${c.numero} ${r.clientesEmAtraso > 0 ? c.vermelho : ""}`}>
              <span className={c.numeroRotulo}>Clientes em atraso</span>
              <span className={`${c.numeroValor} tnum`}>{r.clientesEmAtraso}</span>
            </div>
            <div className={c.numero}>
              <span className={c.numeroRotulo}>Ticket médio</span>
              <span className={`${c.numeroValor} tnum`}>{r.ticketMedioCentavos === null ? "—" : formatarCentavos(r.ticketMedioCentavos)}</span>
              <span className={c.numeroSub}>
                {r.ticketMedioCentavos === null ? "Aparece depois do primeiro recebimento." : "Média por cobrança recebida nos últimos 3 meses."}
              </span>
            </div>
          </div>
          {r.clientesAtivos > 0 && r.clientesAtivos <= 2 && (
            <p className={c.blocoNota} style={{ marginTop: 10 }}>
              Poucos clientes por enquanto.{" "}
              <Link href="/app/clientes/novo" className={s.linkTabela}>
                Cadastrar cliente
              </Link>
            </p>
          )}
        </section>

        {/* ---------- receita recorrente (só quando há dado) ---------- */}
        {r.recorrente.quantidade > 0 && (
          <section className={c.bloco} aria-labelledby="recorrente-titulo">
            <h2 id="recorrente-titulo" className={c.blocoTitulo}>
              Previsão de receita recorrente
            </h2>
            <div className={c.recorrente}>
              <span className={`${c.recorrenteValor} tnum`}>
                {formatarCentavos(r.recorrente.mensalCentavos)}
                <small>/mês</small>
              </span>
              <Link href="/app/recorrencias" className={s.botaoSec}>
                Ver recorrências
              </Link>
            </div>
            <p className={c.blocoNota} style={{ marginTop: 10, marginBottom: 0 }}>
              Vem de {r.recorrente.quantidade} cobrança{r.recorrente.quantidade !== 1 ? "s" : ""} automática{r.recorrente.quantidade !== 1 ? "s" : ""} ativa
              {r.recorrente.quantidade !== 1 ? "s" : ""}, somando o valor mensal de cada uma. É uma previsão: depende de o cliente pagar cada cobrança.
            </p>
          </section>
        )}

        <p className={c.blocoNota}>
          Para o dia a dia, use a <Link href="/app" className={s.linkTabela}>Visão geral</Link>. Aqui fica a visão do negócio.{" "}
          {r.qtdEmAtraso > 0 && (
            <>
              <Link href="/app/inadimplencia" className={s.linkTabela}>
                Ver quem está em atraso
              </Link>
              .
            </>
          )}{" "}
          Avisos de vencimento consideram os próximos {DIAS_DE_AVISO} dias.
        </p>
      </div>
    </>
  );
}
