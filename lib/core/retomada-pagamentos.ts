/**
 * Retomada segura da preparação do pagamento.
 *
 * Caso real: a pessoa cria cobranças ANTES de a conta de recebimentos estar
 * conectada/aprovada. A cobrança fica salva no Zelo, mas sem pagamento no
 * Asaas — e, depois que a conta é conectada, nada tentava de novo.
 *
 * Esta rotina NÃO cria uma segunda integração nem uma segunda forma de
 * sincronizar: cada cobrança passa por `sincronizarCobrancaFinanceira`, que
 * já garante a idempotência (compare-and-swap no banco, busca no Asaas por
 * `externalReference` antes de criar, identificadores persistidos). Chamar
 * duas vezes — ou duas abas ao mesmo tempo — nunca cria dois pagamentos nem
 * dois clientes no provedor.
 *
 * Limites de propósito:
 *  - só cobranças em aberto, ainda SEM pagamento no provedor;
 *  - nunca as de recorrência (o ciclo de uma cobrança automática tem fluxo
 *    próprio, ligado à autorização Pix; sincronizá-las aqui duplicaria);
 *  - no máximo `LIMITE_RETOMADA` por chamada, em sequência, sem laço de fundo;
 *  - para cedo se o provedor recusar o ACESSO da conta (401/403): insistir
 *    só repetiria a mesma recusa;
 *  - nunca marca como paga, nunca cancela, nunca apaga, nunca muda valor nem
 *    vencimento.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { credencialDaEmpresa } from "../asaas/credenciais";
import { sincronizarCobrancaFinanceira } from "./cobranca-financeira";
import { registrarAcaoFinanceira } from "./auditoria";
import { explicarPreparoDoPagamento, type ExplicacaoDoPreparo } from "./recebimentos";
import type { ResultadoDominio } from "./erros";

export const LIMITE_RETOMADA = 20;

/** Injetável só para teste — em produção é sempre `sincronizarCobrancaFinanceira`. */
export type SincronizadorDeCobranca = (
  cobrancaId: string,
  empresaId: string,
  usuarioId: string | null
) => Promise<ResultadoDominio<{ asaasPaymentId: string; jaExistia: boolean }>>;

export type ResultadoRetomada = {
  tentadas: number;
  preparadas: number;
  /** já existiam no provedor (ou foram recuperadas): nada foi criado de novo */
  jaExistiam: number;
  falharam: number;
  /** ainda elegíveis e NÃO tentadas nesta chamada (limite ou parada antecipada) */
  restantes: number;
  /** a empresa não tem credencial: nada foi tentado */
  semConta: boolean;
  primeiraFalha: ExplicacaoDoPreparo | null;
};

const VAZIO: ResultadoRetomada = {
  tentadas: 0,
  preparadas: 0,
  jaExistiam: 0,
  falharam: 0,
  restantes: 0,
  semConta: false,
  primeiraFalha: null,
};

/** Cobranças em aberto da empresa que ainda não têm pagamento no provedor. */
function consultaPendentes(empresaId: string) {
  return supabaseAdmin()
    .from("cobrancas")
    .select("id", { count: "exact" })
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"])
    .is("asaas_payment_id", null)
    .is("recorrencia_id", null)
    .in("asaas_sync_status", ["pendente", "erro", "sincronizando"]);
}

/** Quantas cobranças da empresa estão salvas, mas sem link de pagamento. */
export async function contarPendentesDeLink(empresaId: string): Promise<number> {
  if (!supabaseConfigurado()) return 0;
  const { count } = await consultaPendentes(empresaId).limit(1);
  return count ?? 0;
}

export async function retomarPagamentosPendentes(
  empresaId: string,
  usuarioId: string | null = null,
  opcoes: { limite?: number; sincronizar?: SincronizadorDeCobranca } = {}
): Promise<ResultadoRetomada> {
  if (!supabaseConfigurado()) return { ...VAZIO };

  const limite = Math.max(1, Math.min(opcoes.limite ?? LIMITE_RETOMADA, LIMITE_RETOMADA));
  const sincronizar: SincronizadorDeCobranca = opcoes.sincronizar ?? sincronizarCobrancaFinanceira;

  // sem credencial não há o que tentar: avisa em vez de gravar "erro" em cada cobrança
  if (!(await credencialDaEmpresa(empresaId))) return { ...VAZIO, semConta: true };

  const { data, count } = await consultaPendentes(empresaId).order("criado_em", { ascending: true }).limit(limite);
  const ids = (data ?? []).map((l) => l.id as string);
  const total = count ?? ids.length;

  const r: ResultadoRetomada = { ...VAZIO };
  let recusasDeAcesso = 0;

  for (const id of ids) {
    const s = await sincronizar(id, empresaId, usuarioId);
    r.tentadas += 1;
    if (s.ok) {
      if (s.dado.jaExistia) r.jaExistiam += 1;
      else r.preparadas += 1;
      recusasDeAcesso = 0;
      continue;
    }
    if (s.erro.codigo === "em_andamento") continue; // outra aba/execução já está cuidando dela
    r.falharam += 1;
    if (!r.primeiraFalha) r.primeiraFalha = explicarPreparoDoPagamento(s.erro);
    if (s.erro.statusProvedor === 401 || s.erro.statusProvedor === 403) {
      recusasDeAcesso += 1;
      if (recusasDeAcesso >= 2) break; // o provedor está recusando a CONTA: insistir só repete a recusa
    } else {
      recusasDeAcesso = 0;
    }
  }

  r.restantes = Math.max(0, total - r.preparadas - r.jaExistiam);
  await registrarAcaoFinanceira(empresaId, usuarioId, "pagamentos_pendentes_retomados", empresaId);
  return r;
}
