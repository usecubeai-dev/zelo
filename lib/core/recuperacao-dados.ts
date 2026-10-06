/**
 * Leituras da central de atraso e dos lembretes — SERVIDOR, sempre com o
 * cliente de SESSÃO (RLS), nunca com a service_role: o isolamento por
 * empresa é o do banco, e cada consulta ainda filtra por `empresa_id`.
 *
 * Só lê. Não cria cobrança, não envia nada, não muda estado financeiro.
 */

import type { supabaseServer } from "../supabase/server";
import {
  ConfigLembretes,
  Encargos,
  RegraLembrete,
  REGRAS_DE_LEMBRETE,
  contaComoContato,
  lembreteDaVez,
  somarDias,
} from "../recuperacao";
import type { CobrancaComCliente } from "../cobranca";

type Sessao = Awaited<ReturnType<typeof supabaseServer>>;

export type UltimaAcao = {
  tipo: string;
  em: string;
  /** já houve alguma ação de contato (WhatsApp, link, lembrete)? */
  temContato: boolean;
  /** dia (`YYYY-MM-DD`) do último contato, para decidir lembretes */
  ultimoContatoEm: string | null;
};

/** Última ação e "já houve contato" de cada cobrança — uma consulta só. */
export async function acoesDasCobrancas(
  supabase: Sessao,
  empresaId: string,
  cobrancaIds: string[]
): Promise<Map<string, UltimaAcao>> {
  const mapa = new Map<string, UltimaAcao>();
  if (cobrancaIds.length === 0) return mapa;

  const { data } = await supabase
    .from("acoes_cobranca")
    .select("cobranca_id, tipo, criado_em")
    .eq("empresa_id", empresaId)
    .in("cobranca_id", cobrancaIds)
    .order("criado_em", { ascending: false })
    .limit(1000);

  for (const l of data ?? []) {
    const atual = mapa.get(l.cobranca_id);
    const dia = l.criado_em.slice(0, 10);
    if (!atual) {
      mapa.set(l.cobranca_id, {
        tipo: l.tipo,
        em: l.criado_em,
        temContato: contaComoContato(l.tipo),
        ultimoContatoEm: contaComoContato(l.tipo) ? dia : null,
      });
    } else {
      // linhas vêm da mais nova para a mais velha: a 1ª é a última ação; só completa o contato
      if (!atual.temContato && contaComoContato(l.tipo)) {
        atual.temContato = true;
        atual.ultimoContatoEm = dia;
      } else if (atual.ultimoContatoEm === null && contaComoContato(l.tipo)) {
        atual.ultimoContatoEm = dia;
      }
    }
  }
  return mapa;
}

export const POR_PAGINA_ATRASO = 20;

export type ResumoAtraso = {
  quantidade: number;
  totalCentavos: number;
  clientes: number;
};

/** Totais de TODA a carteira em atraso (não só da página). */
export async function resumoDeAtraso(supabase: Sessao, empresaId: string, hoje: string): Promise<ResumoAtraso> {
  const { data } = await supabase
    .from("cobrancas")
    .select("valor_centavos, cliente_id")
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"])
    .lt("vence_em", hoje)
    .limit(5000);
  const linhas = data ?? [];
  return {
    quantidade: linhas.length,
    totalCentavos: linhas.reduce((t, l) => t + l.valor_centavos, 0),
    clientes: new Set(linhas.map((l) => l.cliente_id)).size,
  };
}

/** Uma página da fila de atraso — as mais antigas primeiro (a que mais urge). */
export async function listarAtrasadas(supabase: Sessao, empresaId: string, hoje: string, pagina: number) {
  const de = (Math.max(1, pagina) - 1) * POR_PAGINA_ATRASO;
  const { data, count, error } = await supabase
    .from("cobrancas")
    .select("*, clientes(id, nome, whatsapp)", { count: "exact" })
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"])
    .lt("vence_em", hoje)
    .order("vence_em", { ascending: true })
    .range(de, de + POR_PAGINA_ATRASO - 1);
  return { cobrancas: (data ?? []) as CobrancaComCliente[], total: count ?? 0, erro: Boolean(error) };
}

export type LembreteDoDia = { cobranca: CobrancaComCliente; regra: RegraLembrete };

/**
 * Lembretes na vez hoje. Só olha cobranças ABERTAS cujo vencimento cai num
 * dia em que alguma regra ligada está na janela — nunca varre a tabela.
 */
export async function lembretesDoDia(
  supabase: Sessao,
  empresaId: string,
  hoje: string,
  config: ConfigLembretes
): Promise<LembreteDoDia[]> {
  const ligadas = REGRAS_DE_LEMBRETE.filter((r) => config[r.id]);
  if (ligadas.length === 0) return [];

  // vencimentos candidatos: regra cai em `hoje` ou em `ontem` ⇒ vence = hoje|ontem − deslocamento
  const candidatos = new Set<string>();
  for (const r of ligadas) {
    candidatos.add(somarDias(hoje, -r.deslocamento));
    candidatos.add(somarDias(hoje, -1 - r.deslocamento));
  }

  const { data } = await supabase
    .from("cobrancas")
    .select("*, clientes(id, nome, whatsapp)")
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"])
    .in("vence_em", [...candidatos])
    .is("negociada_em", null)
    .limit(200);

  const cobrancas = (data ?? []) as CobrancaComCliente[];
  const acoes = await acoesDasCobrancas(supabase, empresaId, cobrancas.map((c) => c.id));

  const saida: LembreteDoDia[] = [];
  for (const c of cobrancas) {
    const regra = lembreteDaVez({
      venceEm: c.vence_em,
      hoje,
      config,
      ultimoContatoEm: acoes.get(c.id)?.ultimoContatoEm ?? null,
    });
    if (regra) saida.push({ cobranca: c, regra });
  }
  saida.sort((a, b) => (a.cobranca.vence_em < b.cobranca.vence_em ? -1 : 1));
  return saida;
}

/** Encargos guardados na cobrança (NUMERIC volta como string do PostgREST). */
export function encargosDaCobranca(c: { forma_pagamento?: string | null; multa_pct?: unknown; juros_pct_mes?: unknown }): Encargos {
  if (c.forma_pagamento !== "cliente_escolhe") return { multaPct: null, jurosPctMes: null };
  const n = (v: unknown) => {
    const x = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  return { multaPct: n(c.multa_pct), jurosPctMes: n(c.juros_pct_mes) };
}
