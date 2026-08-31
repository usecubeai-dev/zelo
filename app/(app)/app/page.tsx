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
};

export default async function Painel() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  if (!empresaId) return null;

  const situacao = empresa ? situacaoDaConta(empresa) : null;
  const hoje = hojeISO();
  const { inicio, fim } = mesCorrente(hoje);
  const supabase = await supabaseServer();

  /* Cinco consultas pequenas em paralelo. Somar centavos no banco evita
     trazer a tabela inteira só para reduzir — e mantém a conta exata,
     porque tudo é inteiro. */
  const [aReceber, recebido, vencidas, clientes, proximas] = await Promise.all([
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
      .gte("pago_em", `${inicio}T00:00:00`),
    supabase
      .from("cobrancas")
      .select("valor_centavos")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .lt("vence_em", hoje),
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "ativo"),
    supabase
      .from("cobrancas")
      .select("*, clientes(id,nome)")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "enviada"])
      .order("vence_em")
      .limit(5),
  ]);

  const soma = (linhas: { valor_centavos?: number | null; valor_pago_centavos?: number | null }[] | null, campo: "valor_centavos" | "valor_pago_centavos") =>
    (linhas ?? []).reduce((t, l) => t + (l[campo] ?? 0), 0);

  const resumo = {
    aReceber: soma(aReceber.data, "valor_centavos"),
    recebido: soma(recebido.data, "valor_pago_centavos"),
    vencido: soma(vencidas.data, "valor_centavos"),
    qtdVencidas: (vencidas.data ?? []).length,
    clientes: clientes.count ?? 0,
  };

  const lista = (proximas.data ?? []) as CobrancaComCliente[];
  const semNada = resumo.clientes === 0;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Visão geral</h1>
        <p className={s.subtitulo}>
          {semNada
            ? "Sua conta está pronta. Comece cadastrando um cliente."
            : "O resumo do seu mês."}
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>A receber este mês</span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.aReceber)}</span>
        </div>
        <div className={`${s.numero} ${s.numeroRecebido}`}>
          <span className={s.numeroRotulo}>Recebido no mês</span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.recebido)}</span>
        </div>
        <div className={`${s.numero} ${s.numeroVencido}`}>
          <span className={s.numeroRotulo}>
            Vencido{resumo.qtdVencidas > 0 ? ` (${resumo.qtdVencidas})` : ""}
          </span>
          <span className={s.numeroValor}>{formatarCentavos(resumo.vencido)}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Clientes ativos</span>
          <span className={s.numeroValor}>{resumo.clientes}</span>
        </div>
      </div>

      {semNada ? (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Comece por aqui</h2>
          <p className={s.vazioTexto}>
            Cadastre seu primeiro cliente. Depois você cria a cobrança dele —
            leva menos de um minuto.
          </p>
          <div className={s.acoes} style={{ justifyContent: "center" }}>
            <Link href="/app/clientes/novo" className={s.botao}>
              Cadastrar cliente
            </Link>
          </div>
        </section>
      ) : lista.length === 0 ? (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Nenhuma cobrança em aberto</h2>
          <p className={s.vazioTexto}>
            {situacao?.emTrial
              ? "Crie sua primeira cobrança e acompanhe tudo por aqui."
              : "Quando houver cobrança pendente, ela aparece aqui."}
          </p>
          <div className={s.acoes} style={{ justifyContent: "center" }}>
            <Link href="/app/cobrancas/nova" className={s.botao}>
              Nova cobrança
            </Link>
          </div>
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
    </>
  );
}
