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
import { sendEmail } from "../email/enviar";
import { templateNotificacao } from "../email/templates/notificacao";
import type { TomEmail } from "../email/templates/layout";
import { emailDoResponsavelDaEmpresa } from "./destinatario-email";

export type PrioridadeNotificacao = "baixa" | "media" | "alta";

/**
 * Fase 22 — quais `tipo`s de notificação (já existentes no código, ver
 * `lib/asaas/webhook.ts` e `lib/core/agendador-cobrancas.ts`) também
 * disparam e-mail, e com que tom visual. Deliberadamente não é "todo
 * tipo vira e-mail": in-app já basta pra ruído de baixo valor — só os
 * que pedem atenção fora do painel entram aqui. Adicionar um tipo novo é
 * uma linha nesta tabela, nunca um novo call site espalhado pelo código.
 */
const MAPA_TOM_EMAIL: Partial<Record<string, TomEmail>> = {
  pagamento_recebido: "sucesso",
  cobranca_estornada: "atencao",
  conta_aprovada: "sucesso",
  conta_recusada: "erro",
  cobranca_automatica_falhou: "atencao",
  instrucao_pagamento_scheduled: "neutro",
  instrucao_pagamento_refused: "atencao",
  autorizacao_pix_active: "sucesso",
  autorizacao_pix_refused: "atencao",
  autorizacao_pix_expired: "atencao",
  autorizacao_pix_cancelled: "neutro",
  pix_automatico_inelegivel: "atencao",
  pix_automatico_elegivel: "sucesso",
  assinatura_inadimplente: "erro",
  assinatura_regularizada: "sucesso",
  assinatura_cancelada: "erro",
};

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

  if (error) {
    // 23505 = já existe (reenvio do mesmo evento) — idempotente, não é
    // falha, mas também não é uma notificação NOVA: não reenvia e-mail
    // pro mesmo acontecimento. Qualquer outro erro: só loga, mesmo
    // comportamento de antes desta fase.
    if (error.code !== "23505") {
      console.error("[core/notificacoes] falha ao criar notificação:", tipo, error.code);
    }
    return;
  }

  await despacharEmailDaNotificacao(empresaId, tipo, titulo, mensagem, link);
}

/**
 * E-mail é sempre um efeito colateral best-effort da notificação in-app,
 * nunca o contrário — a linha em `notificacoes` já foi gravada com
 * sucesso antes de chegar aqui. Nunca lança: nenhuma falha de e-mail
 * pode se propagar para quem chamou `criarNotificacao` (que normalmente
 * está no meio do processamento de um webhook ou de um caso de uso
 * financeiro).
 */
async function despacharEmailDaNotificacao(
  empresaId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  link: string | null
): Promise<void> {
  const tom = MAPA_TOM_EMAIL[tipo];
  if (!tom) return; // este tipo não tem e-mail associado — in-app já basta.

  try {
    const destino = await emailDoResponsavelDaEmpresa(empresaId);
    if (!destino) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://zelopay.com.br";
    const conteudo = templateNotificacao({ titulo, mensagem, link, tom, siteUrl });
    await sendEmail({ to: destino, subject: conteudo.subject, html: conteudo.html, text: conteudo.text }, tipo);
  } catch {
    // Rede de segurança final — ver docstring acima.
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
