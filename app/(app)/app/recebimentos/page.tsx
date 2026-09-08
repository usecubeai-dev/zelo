import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { formatarCentavos, paraCentavos } from "@/lib/dinheiro";
import s from "../../App.module.css";

export const metadata = { title: "Recebimentos" };

const POR_PAGINA = 20;

type Pagamento = {
  id: string;
  asaas_payment_id: string;
  valor_liquido_centavos: number;
  taxa_centavos: number;
  liquidado_em: string;
  instrucoes_pagamento: {
    cobranca_id: string;
    cobrancas: { id: string; descricao: string; clientes: { id: string; nome: string } | null } | null;
  } | null;
};

/**
 * Recebimentos — Fase 12 do Core Financeiro.
 *
 * Distinto de "Cobranças": aqui é só o que o Asaas confirmou de verdade
 * pelo Pix Automático (`pagamentos`, ligado 1:1 a uma instrução), com o
 * valor líquido e a taxa reais — não o valor bruto da cobrança. Uma
 * cobrança "paga" manualmente (`pago_via='manual'`, Fase 11) nunca
 * aparece aqui: não existe linha em `pagamentos` pra ela, porque o
 * Asaas nunca confirmou nada. Essa ausência É a separação entre
 * confirmado e declarado, não uma coincidência.
 */
export default async function ListaRecebimentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; de?: string; ate?: string; valorMin?: string; valorMax?: string; pagina?: string }>;
}) {
  const { q = "", de: dataDe = "", ate: dataAte = "", valorMin = "", valorMax = "", pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("pagamentos")
    .select(
      "id, asaas_payment_id, valor_liquido_centavos, taxa_centavos, liquidado_em, instrucoes_pagamento!inner(cobranca_id, cobrancas!inner(id, descricao, clientes!inner(id, nome)))",
      { count: "exact" }
    )
    .eq("empresa_id", empresaId)
    .order("liquidado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  if (q.trim()) consulta = consulta.ilike("instrucoes_pagamento.cobrancas.clientes.nome", `%${q.trim()}%`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataDe)) consulta = consulta.gte("liquidado_em", dataDe);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataAte)) consulta = consulta.lte("liquidado_em", `${dataAte}T23:59:59`);
  const valorMinCentavos = paraCentavos(valorMin);
  const valorMaxCentavos = paraCentavos(valorMax);
  if (valorMinCentavos !== null) consulta = consulta.gte("valor_liquido_centavos", valorMinCentavos);
  if (valorMaxCentavos !== null) consulta = consulta.lte("valor_liquido_centavos", valorMaxCentavos);

  const { data, count, error } = await consulta;
  const pagamentos = (data ?? []) as unknown as Pagamento[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = Boolean(q.trim()) || Boolean(dataDe) || Boolean(dataAte) || Boolean(valorMin) || Boolean(valorMax);
  const somaLiquido = pagamentos.reduce((t, p) => t + p.valor_liquido_centavos, 0);

  const url = (m: { q?: string; de?: string; ate?: string; valorMin?: string; valorMax?: string; pagina?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { q, de: dataDe, ate: dataAte, valorMin, valorMax, pagina: String(p), ...m };
    if (alvo.q) sp.set("q", alvo.q);
    if (alvo.de) sp.set("de", alvo.de);
    if (alvo.ate) sp.set("ate", alvo.ate);
    if (alvo.valorMin) sp.set("valorMin", alvo.valorMin);
    if (alvo.valorMax) sp.set("valorMax", alvo.valorMax);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const t = sp.toString();
    return t ? `/app/recebimentos?${t}` : "/app/recebimentos";
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Recebimentos</h1>
        <p className={s.subtitulo}>
          {total === 0
            ? "Nenhum recebimento confirmado ainda."
            : `${total} recebimento${total > 1 ? "s" : ""} · líquido nesta página: ${formatarCentavos(somaLiquido)}`}
        </p>
      </header>

      <div className={s.barraTopo}>
        <form className={s.busca} method="get" action="/app/recebimentos">
          <input type="search" name="q" defaultValue={q} placeholder="Buscar pelo nome do cliente" aria-label="Buscar recebimentos" />
          <button type="submit" className={s.botaoSec}>Buscar</button>
        </form>
      </div>

      <form className={s.filtroIntervalo} method="get" action="/app/recebimentos">
        {q && <input type="hidden" name="q" value={q} />}
        <div className={s.filtroIntervaloCampo}>
          <label htmlFor="de">Recebido de</label>
          <input type="date" id="de" name="de" defaultValue={dataDe} />
        </div>
        <div className={s.filtroIntervaloCampo}>
          <label htmlFor="ate">até</label>
          <input type="date" id="ate" name="ate" defaultValue={dataAte} />
        </div>
        <div className={s.filtroIntervaloCampo}>
          <label htmlFor="valorMin">Valor líquido mínimo</label>
          <input type="text" id="valorMin" name="valorMin" defaultValue={valorMin} placeholder="0,00" inputMode="decimal" />
        </div>
        <div className={s.filtroIntervaloCampo}>
          <label htmlFor="valorMax">Valor líquido máximo</label>
          <input type="text" id="valorMax" name="valorMax" defaultValue={valorMax} placeholder="0,00" inputMode="decimal" />
        </div>
        <button type="submit" className={s.botaoSec}>Filtrar</button>
        {filtrando && (
          <Link href="/app/recebimentos" className={s.botaoSec}>Limpar filtros</Link>
        )}
      </form>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar seus recebimentos agora. Recarregue a página.
        </div>
      )}

      {!error && pagamentos.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>
            {filtrando ? "Nenhum recebimento encontrado" : "Nenhum recebimento confirmado ainda"}
          </h2>
          <p className={s.vazioTexto}>
            {filtrando
              ? "Tente outro termo ou outro período."
              : "Aparece aqui assim que o primeiro pagamento via Pix Automático for confirmado — cobrança marcada como paga manualmente não conta, de propósito."}
          </p>
        </section>
      )}

      {pagamentos.length > 0 && (
        <>
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Cobrança</th>
                  <th>Cliente</th>
                  <th>Recebido em</th>
                  <th>Valor líquido</th>
                  <th>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((pgto) => {
                  const cobranca = pgto.instrucoes_pagamento?.cobrancas;
                  return (
                    <tr key={pgto.id}>
                      <td>
                        {cobranca ? (
                          <Link href={`/app/cobrancas/${cobranca.id}`} className={s.linkTabela}>
                            {cobranca.descricao}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={s.celulaFraca}>{cobranca?.clientes?.nome ?? "—"}</td>
                      <td className={s.celulaFraca}>
                        {new Date(pgto.liquidado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className={s.valorCelula}>{formatarCentavos(pgto.valor_liquido_centavos)}</td>
                      <td className={`${s.valorCelula} ${s.celulaFraca}`}>{formatarCentavos(pgto.taxa_centavos)}</td>
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
                {p > 1 && <Link href={url({ pagina: String(p - 1) })} className={s.botaoSec}>Anterior</Link>}
                {p < ultima && <Link href={url({ pagina: String(p + 1) })} className={s.botaoSec}>Próxima</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
