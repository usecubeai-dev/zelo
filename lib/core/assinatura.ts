/**
 * Assinatura da própria Zelo — sem React, sem DOM.
 *
 * Domínio DIFERENTE do core financeiro do tenant: aqui quem é cobrado é o
 * profissional, e quem cobra é a Zelo (conta "plataforma" do Asaas, ver
 * `lib/asaas/config.ts`). Nunca misturar com `cobrancas`/`recorrencias`,
 * que são o profissional cobrando os clientes DELE.
 *
 * Os estados (`StatusAssinatura`, em `lib/empresa.ts`) vivem em
 * `empresas.assinatura_status`.
 * Esta fase só ACRESCENTA: a tabela de transições válidas e de origem
 * permitida (mesmo padrão de `lib/core/autorizacao.ts`), e o cálculo de
 * uso do plano para a tela `/app/assinatura`.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { StatusAssinatura } from "../empresa";
import {
  ehPlano,
  LIMITE_DE_CLIENTES,
  LIMITE_DE_COBRANCAS_MENSAL,
  NOME_DO_PLANO,
  PRECO_POR_PLANO_CENTAVOS,
  Plano,
} from "../plano";

/**
 * Transições válidas, espelhando o que o sistema realmente faz (ver
 * `lib/asaas/webhook.ts`, bloco "contexto plataforma"):
 *
 *   pendente     → ativa         (primeiro pagamento confirmado)
 *   pendente     → cancelada     (assinatura removida antes de pagar)
 *   trial        → ativa         (legado: conta antiga que pagou)
 *   trial        → cancelada     (legado)
 *   ativa        → inadimplente  (pagamento em atraso)
 *   ativa        → cancelada     (assinatura removida)
 *   ativa        → suspensa
 *   inadimplente → ativa         (pagamento em atraso foi recuperado)
 *   inadimplente → cancelada
 *   inadimplente → suspensa
 *   suspensa     → ativa         (regularizada)
 *   suspensa     → cancelada
 *   cancelada    → pendente      (NOVA assinatura criada pelo próprio cliente)
 *
 * `pendente` e `trial` nunca são destino de uma transição de pagamento. O
 * único caminho para `pendente` é recomeçar depois de cancelar. `trial` não
 * é mais atribuído a ninguém (fim do mês grátis): é só legado.
 */
const TRANSICOES_VALIDAS: Record<StatusAssinatura, readonly StatusAssinatura[]> = {
  trial: ["ativa", "cancelada"],
  pendente: ["ativa", "cancelada"],
  ativa: ["inadimplente", "cancelada", "suspensa"],
  inadimplente: ["ativa", "cancelada", "suspensa"],
  suspensa: ["ativa", "cancelada"],
  cancelada: ["pendente"],
};

export function transicaoValidaAssinatura(de: StatusAssinatura, para: StatusAssinatura): boolean {
  return TRANSICOES_VALIDAS[de].includes(para);
}

/**
 * Quem pode provocar cada transição. `ativa`, `inadimplente`, `suspensa` e
 * `cancelada` só por evento do provedor (`webhook`, ou `reconciliacao` quando
 * houver consulta ativa): a mesma regra da arquitetura financeira (§14) —
 * nenhum pagamento é marcado como confirmado pelo cliente, vale também para
 * a mensalidade da Zelo. Única exceção: `pendente`, que é a ação do próprio
 * cliente de assinar de novo (`caso_de_uso`) e por si só não libera nada.
 */
export type OrigemTransicaoAssinatura = "webhook" | "reconciliacao" | "caso_de_uso";

const ORIGEM_PERMITIDA: Record<StatusAssinatura, readonly OrigemTransicaoAssinatura[]> = {
  trial: [],
  pendente: ["caso_de_uso"],
  ativa: ["webhook", "reconciliacao"],
  inadimplente: ["webhook", "reconciliacao"],
  suspensa: ["webhook", "reconciliacao"],
  cancelada: ["webhook", "reconciliacao"],
};

export function origemPermitidaAssinatura(para: StatusAssinatura, origem: OrigemTransicaoAssinatura): boolean {
  return ORIGEM_PERMITIDA[para].includes(origem);
}

export type UsoDoPlano = {
  plano: Plano;
  nomePlano: string;
  precoCentavos: number;
  clientesAtivos: number;
  limiteClientes: number;
  cobrancasNoMes: number;
  limiteCobrancasMes: number;
};

/**
 * Uso real do plano — clientes ativos e cobranças do mês corrente contra
 * os limites de `lib/plano.ts`/`public.limite_de_clientes()`/
 * `public.limite_de_cobrancas_mensal()`. Não recalcula os limites nem o
 * preço aqui: importa de `lib/plano.ts`, a fonte única (ver comentário lá).
 */
export async function obterUsoDoPlano(empresaId: string, planoAtual: unknown): Promise<UsoDoPlano> {
  const plano = ehPlano(planoAtual) ? planoAtual : "essencial";
  const base = {
    plano,
    nomePlano: NOME_DO_PLANO[plano],
    precoCentavos: PRECO_POR_PLANO_CENTAVOS[plano],
    limiteClientes: LIMITE_DE_CLIENTES[plano],
    limiteCobrancasMes: LIMITE_DE_COBRANCAS_MENSAL[plano],
  };

  if (!supabaseConfigurado()) {
    return { ...base, clientesAtivos: 0, cobrancasNoMes: 0 };
  }

  const admin = supabaseAdmin();
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const [{ count: clientesAtivos }, { count: cobrancasNoMes }] = await Promise.all([
    admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ativo"),
    admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gte("criado_em", inicioDoMes.toISOString()),
  ]);

  return { ...base, clientesAtivos: clientesAtivos ?? 0, cobrancasNoMes: cobrancasNoMes ?? 0 };
}
