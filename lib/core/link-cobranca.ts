/**
 * Link público de pagamento de uma cobrança — SOMENTE LEITURA.
 *
 * O Zelo não guarda esse link: ele é a fatura hospedada (`invoiceUrl`) que
 * o provedor já gerou quando a cobrança foi sincronizada. Aqui só
 * consultamos a cobrança existente, com a credencial da subconta DA
 * EMPRESA, e devolvemos o link se ele for válido. Nada é criado, nada é
 * alterado, nenhum estado financeiro muda. Servidor apenas.
 */

import { credencialDaEmpresa } from "../asaas/credenciais";
import { obterCobrancaAsaas } from "../asaas/cobranca";
import { linkPublicoValido } from "../whatsapp";

export type ResultadoLinkCobranca =
  /** `link` é `null` quando a cobrança não tem (ainda) um link público válido */
  | { ok: true; link: string | null }
  /** não deu para consultar agora (rede/provedor) — diferente de "não tem link" */
  | { ok: false };

export async function linkDePagamentoDaCobranca(
  empresaId: string,
  asaasPaymentId: string | null | undefined
): Promise<ResultadoLinkCobranca> {
  // cobrança que nunca foi ao provedor não tem link — e não há o que consultar
  if (!asaasPaymentId) return { ok: true, link: null };

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) return { ok: true, link: null };

  try {
    const r = await obterCobrancaAsaas(asaasPaymentId, credencial);
    if (!r.ok) return r.status === 404 ? { ok: true, link: null } : { ok: false };
    if (r.data.deleted) return { ok: true, link: null };
    return { ok: true, link: linkPublicoValido(r.data.invoiceUrl) };
  } catch {
    return { ok: false };
  }
}
