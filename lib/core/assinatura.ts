/**
 * Assinatura da própria Zelo — sem React, sem DOM.
 *
 * Domínio DIFERENTE do core financeiro do tenant: aqui quem é cobrado é o
 * profissional, e quem cobra é a Zelo (conta "plataforma" do Asaas, ver
 * `lib/asaas/config.ts`). Nunca misturar com `cobrancas`/`recorrencias`,
 * que são o profissional cobrando os clientes DELE.
 *
 * Os 4 estados (`StatusAssinatura`, em `lib/empresa.ts`) e a tabela
 * `empresas` já existiam antes desta fase — não foram inventados aqui.
 * Esta fase só ACRESCENTA: a tabela de transições válidas e de origem
 * permitida (mesmo padrão de `lib/core/autorizacao.ts`), e o cálculo de
 * uso do plano para a tela `/app/assinatura`.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { StatusAssinatura } from "../empresa";
import { ehPlano, LIMITE_DE_CLIENTES, NOME_DO_PLANO, Plano } from "../plano";

/**
 * Transições válidas, espelhando o que o sistema realmente faz (ver
 * `lib/asaas/webhook.ts`, bloco "contexto plataforma"):
 *
 *   trial        → ativa         (primeiro pagamento confirmado)
 *   ativa        → inadimplente  (pagamento em atraso)
 *   ativa        → cancelada     (assinatura removida no Asaas)
 *   inadimplente → ativa         (pagamento em atraso foi recuperado)
 *   inadimplente → cancelada     (assinatura removida enquanto em atraso)
 *
 * `cancelada` é definitiva — reativar exigiria uma NOVA assinatura, caso
 * de uso que não existe ainda (não há billing provider configurado, ver
 * `lib/asaas/config.ts`). `trial` nunca é destino de transição: é o
 * padrão da coluna, atribuído pelo trigger que cria a empresa.
 */
const TRANSICOES_VALIDAS: Record<StatusAssinatura, readonly StatusAssinatura[]> = {
  trial: ["ativa"],
  ativa: ["inadimplente", "cancelada"],
  inadimplente: ["ativa", "cancelada"],
  cancelada: [],
};

export function transicaoValidaAssinatura(de: StatusAssinatura, para: StatusAssinatura): boolean {
  return TRANSICOES_VALIDAS[de].includes(para);
}

/**
 * Quem pode provocar cada transição. Nenhum estado admite `caso_de_uso`
 * (ação direta do usuário) — a mesma regra da arquitetura financeira
 * (§14): "nenhum pagamento marcado como confirmado pelo cliente" vale
 * também para a própria mensalidade da Zelo. Hoje só `webhook` está
 * implementado; `reconciliacao` fica reservado (mesmo padrão do resto do
 * Core Financeiro) para quando existir consulta ativa à assinatura no
 * Asaas — não implementada nesta fase por falta de provider configurado.
 */
export type OrigemTransicaoAssinatura = "webhook" | "reconciliacao";

const ORIGEM_PERMITIDA: Record<StatusAssinatura, readonly OrigemTransicaoAssinatura[]> = {
  trial: [],
  ativa: ["webhook", "reconciliacao"],
  inadimplente: ["webhook", "reconciliacao"],
  cancelada: ["webhook", "reconciliacao"],
};

export function origemPermitidaAssinatura(para: StatusAssinatura, origem: OrigemTransicaoAssinatura): boolean {
  return ORIGEM_PERMITIDA[para].includes(origem);
}

export type UsoDoPlano = {
  plano: Plano;
  nomePlano: string;
  clientesAtivos: number;
  limiteClientes: number;
};

/**
 * Uso real do plano — clientes ativos contra o limite de
 * `lib/plano.ts`/`public.limite_de_clientes()`. Não recalcula o limite
 * aqui: importa de `lib/plano.ts`, a fonte única (ver comentário lá).
 */
export async function obterUsoDoPlano(empresaId: string, planoAtual: unknown): Promise<UsoDoPlano> {
  const plano = ehPlano(planoAtual) ? planoAtual : "essencial";

  if (!supabaseConfigurado()) {
    return { plano, nomePlano: NOME_DO_PLANO[plano], clientesAtivos: 0, limiteClientes: LIMITE_DE_CLIENTES[plano] };
  }

  const admin = supabaseAdmin();
  const { count } = await admin
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  return {
    plano,
    nomePlano: NOME_DO_PLANO[plano],
    clientesAtivos: count ?? 0,
    limiteClientes: LIMITE_DE_CLIENTES[plano],
  };
}
