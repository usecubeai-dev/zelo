/**
 * Elegibilidade da CONTA (empresa) para Pix Automático — distinta da
 * elegibilidade de uma AUTORIZAÇÃO individual (`lib/core/autorizacao.ts`).
 *
 * Confirmado por consulta direta à documentação do Asaas (Fase 21,
 * 09/09/2026): o evento de webhook `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_
 * UPDATED` traz `eligibility.status` com dois valores reais — `ELIGIBLE`
 * e `INELIGIBLE` — e `eligibility.ineligibleReasons` (lista, pode vir
 * vazia). Nenhuma regra de negócio (CNPJ, CNAE, tempo de conta) é
 * hardcoded aqui: quem decide elegibilidade é sempre o Asaas, nunca o
 * Zelo. Esta camada só representa o que o Asaas já disse.
 *
 * `PENDING` e `UNKNOWN` são estados do ZELO, não do Asaas — não existe
 * webhook nem endpoint que devolva "pending". Servem para representar
 * honestamente o que o Zelo ainda não sabe:
 *
 *   - `UNKNOWN`: nunca recebemos nenhum sinal do Asaas sobre esta conta
 *     (a maioria das empresas hoje, inclusive todas as já cadastradas
 *     antes desta fase — ver migration). Não significa "não elegível",
 *     significa "não verificado".
 *   - `PENDING`: reservado para um fluxo futuro de verificação ativa
 *     (ex.: checagem disparada no onboarding, antes de qualquer webhook
 *     chegar). Nenhum caso de uso ainda grava este valor — existe na
 *     abstração para não exigir migration de novo quando esse fluxo for
 *     construído.
 *   - `ELIGIBLE` / `INELIGIBLE`: valor real, informado pelo Asaas.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";

export type StatusElegibilidadePix = "ELIGIBLE" | "INELIGIBLE" | "PENDING" | "UNKNOWN";

export type ElegibilidadePix = {
  status: StatusElegibilidadePix;
  /** Motivos informados pelo Asaas (`ineligibleReasons`) — nunca inventados. `null` = Asaas não informou nenhum, ou ainda não sincronizado. */
  motivo: string | null;
  /** Quando este status foi gravado pela última vez — `null` = nunca (é o `UNKNOWN` default). */
  atualizadoEm: string | null;
};

const ESTADOS_VALIDOS: readonly StatusElegibilidadePix[] = ["ELIGIBLE", "INELIGIBLE", "PENDING", "UNKNOWN"];

export function ehStatusElegibilidadeValido(valor: unknown): valor is StatusElegibilidadePix {
  return typeof valor === "string" && (ESTADOS_VALIDOS as readonly string[]).includes(valor);
}

/**
 * Lê a elegibilidade atual da empresa. Nunca lança — infraestrutura
 * ausente ou coluna ainda não migrada (ver migration desta fase) devolve
 * `UNKNOWN`, o estado mais conservador: não bloqueia nada que já
 * funcionava antes desta fase.
 */
export async function obterElegibilidadePix(empresaId: string): Promise<ElegibilidadePix> {
  const DESCONHECIDA: ElegibilidadePix = { status: "UNKNOWN", motivo: null, atualizadoEm: null };
  if (!supabaseConfigurado()) return DESCONHECIDA;

  try {
    const { data, error } = await supabaseAdmin()
      .from("empresas")
      .select("pix_automatico_status, pix_automatico_motivo, pix_automatico_atualizado_em")
      .eq("id", empresaId)
      .maybeSingle();

    // Coluna ainda não existe (migration pendente) ou qualquer outro erro
    // de leitura: degrada para UNKNOWN, nunca derruba quem chamou.
    if (error || !data) return DESCONHECIDA;

    const status = ehStatusElegibilidadeValido(data.pix_automatico_status) ? data.pix_automatico_status : "UNKNOWN";
    return {
      status,
      motivo: (data.pix_automatico_motivo as string | null) ?? null,
      atualizadoEm: (data.pix_automatico_atualizado_em as string | null) ?? null,
    };
  } catch {
    return DESCONHECIDA;
  }
}

/**
 * Grava a elegibilidade — chamada só pelo webhook (`lib/asaas/webhook.ts`),
 * a única fonte legítima (é o Asaas quem decide, nunca o Zelo). Nunca
 * lança: se a coluna ainda não existir (migration pendente), a chamada
 * falha silenciosamente e fica só auditada via `log_acoes_financeiras` —
 * o mesmo padrão de degradação de `descricaoDoEstado`/`sincronizarStatus
 * Financeiro` para colunas que ainda não têm valor sincronizado.
 */
export async function gravarElegibilidadePix(
  empresaId: string,
  status: Extract<StatusElegibilidadePix, "ELIGIBLE" | "INELIGIBLE">,
  motivo: string | null
): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  try {
    const { error } = await supabaseAdmin()
      .from("empresas")
      .update({
        pix_automatico_status: status,
        pix_automatico_motivo: motivo,
        pix_automatico_atualizado_em: new Date().toISOString(),
      })
      .eq("id", empresaId);
    return !error;
  } catch {
    return false;
  }
}

export type DescricaoElegibilidade = {
  titulo: string;
  detalhe: string;
  tom: "neutro" | "atencao" | "sucesso" | "erro";
};

/**
 * Texto seguro para a UI (Fase 21, "UX do fallback") — nunca menciona
 * Asaas, endpoint, código de erro ou stack trace. Cobre os 4 estados;
 * `INELIGIBLE` é o único que muda o que o profissional deveria fazer
 * agora (usar Pix comum em vez de Pix Automático).
 */
export function descricaoElegibilidadePix(elegibilidade: Pick<ElegibilidadePix, "status">): DescricaoElegibilidade {
  switch (elegibilidade.status) {
    case "INELIGIBLE":
      return {
        titulo: "Seu Pix Automático não está disponível no momento.",
        detalhe:
          "Você ainda pode continuar cobrando seus clientes usando Pix comum, com lembretes automáticos. Vamos avisar quando o Pix Automático estiver disponível novamente.",
        tom: "atencao",
      };
    case "ELIGIBLE":
      return {
        titulo: "Pix Automático disponível",
        detalhe: "Sua conta pode usar Pix Automático para cobranças recorrentes.",
        tom: "sucesso",
      };
    case "PENDING":
      return {
        titulo: "Verificando disponibilidade do Pix Automático",
        detalhe: "Estamos confirmando se sua conta pode usar Pix Automático. Isso não impede você de cobrar por Pix comum enquanto isso.",
        tom: "atencao",
      };
    case "UNKNOWN":
    default:
      return {
        titulo: "Pix Automático",
        detalhe: "Ainda não confirmamos a disponibilidade de Pix Automático para sua conta — você pode cobrar normalmente por Pix comum enquanto isso.",
        tom: "neutro",
      };
  }
}
