/**
 * Lê, no servidor, o estado da conta de recebimentos da empresa para as telas
 * de cobrança. Só leitura do banco (`obterContaFinanceira`): nenhuma chamada ao
 * provedor a cada tela aberta. Quem consulta o provedor é o botão "Verificar
 * status agora" de Configurações (e o webhook), que gravam o resultado.
 */

import { obterContaFinanceira } from "./onboarding";
import {
  avisoDeRecebimentos,
  estadoDeRecebimentos,
  type AvisoRecebimentos,
  type EstadoRecebimentos,
} from "./recebimentos";
import { contarPendentesDeLink } from "./retomada-pagamentos";
import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import type { EntradaDoTutorial } from "./tutorial-cobranca";

export type SituacaoDeRecebimentosDaEmpresa = {
  estado: EstadoRecebimentos;
  aviso: AvisoRecebimentos;
  /** cobranças em aberto, salvas no Zelo, ainda sem pagamento no provedor */
  semLink: number;
};

export async function situacaoDeRecebimentosDaEmpresa(empresaId: string): Promise<SituacaoDeRecebimentosDaEmpresa> {
  const [conta, semLink] = await Promise.all([obterContaFinanceira(empresaId), contarPendentesDeLink(empresaId)]);
  const estado = estadoDeRecebimentos(conta);
  return { estado, aviso: avisoDeRecebimentos(estado), semLink };
}

/** O que o tutorial precisa saber da empresa: conta de recebimentos, clientes e cobranças (só contagens). */
export async function entradaDoTutorialDaEmpresa(empresaId: string): Promise<EntradaDoTutorial> {
  const conta = await obterContaFinanceira(empresaId);
  const estado = estadoDeRecebimentos(conta);
  if (!supabaseConfigurado()) return { estado, temClientes: false, temCobrancas: false };
  const admin = supabaseAdmin();
  const [{ count: clientes }, { count: cobrancas }] = await Promise.all([
    admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ativo"),
    admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
  ]);
  return { estado, temClientes: (clientes ?? 0) > 0, temCobrancas: (cobrancas ?? 0) > 0 };
}
