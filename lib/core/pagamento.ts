/**
 * Contrato de Pagamento — sem React, sem DOM.
 *
 * Não é uma máquina de estados: é o EFEITO observado, gravado quando o
 * webhook confirma liquidação (ver arquitetura §5.5). Nada no Zelo cria
 * ou edita um `Pagamento` — só o processamento de webhook grava, e só
 * uma vez por `asaas_payment_id` (índice único no banco).
 */

export type Pagamento = {
  id: string;
  empresa_id: string;
  instrucao_id: string;
  asaas_payment_id: string;
  valor_liquido_centavos: number;
  taxa_centavos: number;
  liquidado_em: string;
  criado_em: string;
};

/** Valor bruto = líquido + taxa. Não é gravado — é sempre derivado, pro dado nunca divergir de si mesmo. */
export function valorBrutoCentavos(p: Pick<Pagamento, "valor_liquido_centavos" | "taxa_centavos">): number {
  return p.valor_liquido_centavos + p.taxa_centavos;
}
