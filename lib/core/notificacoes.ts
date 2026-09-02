/**
 * Caso de uso: notificações internas / centro de alertas — Fase 13.
 *
 * ⚠ SERVIDOR APENAS. `criarNotificacao` é chamada de dentro dos casos
 * de uso e do webhook (`lib/asaas/webhook.ts`), nunca por um Server
 * Action de frontend — notificação é decisão do sistema, não algo que
 * o usuário cria. `marcarComoLida`/`marcarTodasComoLidas` são as duas
 * únicas mutações que o profissional pode disparar, e ambas só tocam
 * `lida` (a única coluna com grant pra `authenticated`, Fase 13).
 *
 * IDEMPOTÊNCIA — `chave_idempotencia` + `unique(empresa_id,
 * chave_idempotencia)` é a mesma disciplina do resto do projeto: um
 * webhook reenviado, ou o mesmo evento processado por dois caminhos
 * (push do webhook + reconciliação por consulta ativa), nunca gera uma
 * segunda notificação pro mesmo acontecimento real. A chave é
 * construída pelo chamador a partir de algo estável (o id da entidade
 * + o novo estado — nunca um timestamp ou um valor aleatório).
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";

export type PrioridadeNotificacao = "baixa" | "media" | "alta";

export type Notificacao = {
  id: string;
  empresa_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  prioridade: PrioridadeNotificacao;
  lida: boolean;
  link: string | null;
  chave_idempotencia: string;
  criado_em: string;
};

/**
 * Cria uma notificação — idempotente por `chaveIdempotencia`. Nunca
 * lança: uma falha aqui não pode derrubar o fluxo financeiro que a
 * originou (o mesmo princípio de `registrarAcaoFinanceira`).
 */
export async function criarNotificacao(
  empresaId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  prioridade: PrioridadeNotificacao,
  link: string | null,
  chaveIdempotencia: string
): Promise<void> {
  if (!supabaseConfigurado()) return;

  const { error } = await supabaseAdmin()
    .from("notificacoes")
    .insert({ empresa_id: empresaId, tipo, titulo, mensagem, prioridade, link, chave_idempotencia: chaveIdempotencia });

  if (error && error.code !== "23505") {
    console.error("[core/notificacoes] falha ao criar notificação:", tipo, error.code);
  }
}

export async function marcarComoLida(id: string, empresaId: string): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  const { error, count } = await supabaseAdmin()
    .from("notificacoes")
    .update({ lida: true }, { count: "exact" })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  return !error && (count ?? 0) > 0;
}

export async function marcarTodasComoLidas(empresaId: string): Promise<void> {
  if (!supabaseConfigurado()) return;
  await supabaseAdmin().from("notificacoes").update({ lida: true }).eq("empresa_id", empresaId).eq("lida", false);
}

export async function contarNaoLidas(empresaId: string): Promise<number> {
  if (!supabaseConfigurado()) return 0;
  const { count } = await supabaseAdmin()
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("lida", false);
  return count ?? 0;
}
