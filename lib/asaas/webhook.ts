/**
 * Processamento e idempotência de Webhooks do Asaas.
 *
 * Roda apenas no servidor e usa o cliente admin do Supabase (service_role).
 *
 * ────────────────────────────────────────────────────────────────────
 * O TENANT VEM DA CONTA, NUNCA DA COBRANÇA
 * ────────────────────────────────────────────────────────────────────
 *
 * Antes, o webhook localizava a cobrança por `externalReference` ou por
 * `asaas_payment_id` e dava `update` sem `empresa_id`. Com uma conta só
 * isso passava. Com subcontas, seria uma porta de escrita entre tenants:
 * qualquer valor que colidisse com o identificador de outra empresa
 * alteraria os dados dela — usando `service_role`, que ignora RLS.
 *
 * A correção é de origem, não de filtro extra: o tenant passa a ser
 * resolvido por `account.id`, o identificador da conta que gerou o evento,
 * que o Asaas envia no corpo de todo evento da API v3. `externalReference`
 * descreve a cobrança; `account.id` descreve o dono dela. Só o segundo
 * serve para decidir em quais linhas escrever.
 *
 * Não resolveu a conta? O evento é recusado. Não há adivinhação, não há
 * fallback, e um evento não processado é reenviado pelo Asaas — o que é
 * infinitamente mais barato que uma escrita no tenant errado.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { contaDaPlataforma, tokenDoWebhook } from "./config";
import { AsaasWebhookPayload } from "./tipos";

export type ResultadoProcessamentoWebhook =
  | { ok: true; idempotente?: boolean; eventoId: string; empresaId?: string | null }
  | { ok: false; erro: string; statusHttp: number };

/**
 * Contexto do evento: de quem é o dinheiro que ele descreve.
 *
 * - `subconta`: cobrança de um cliente final, dinheiro do profissional.
 * - `plataforma`: a mensalidade que o profissional paga ao Zelo.
 *
 * São mundos separados de propósito. Um evento de subconta jamais mexe em
 * `assinatura_status`; um evento da plataforma jamais mexe em `cobrancas`.
 */
type ContextoEvento =
  | { tipo: "subconta"; empresaId: string; accountId: string }
  | { tipo: "plataforma"; accountId: string };

/**
 * Log do webhook.
 *
 * Registra o suficiente para reconstruir o que aconteceu — evento,
 * empresa, conta, resultado — e nada além disso.
 *
 * O que **nunca** entra: `apiKey`, token, o payload cru (que traz nome,
 * CPF/CNPJ e e-mail do cliente final do profissional) e mensagens de erro
 * do Postgres, que ecoam os valores enviados. Do erro fica só o código.
 *
 * O payload completo continua guardado em `eventos_asaas.payload`, atrás
 * de RLS sem policy — acessível para depuração, invisível para o log.
 */
function registrar(mensagem: string, campos: Record<string, string | number | null | undefined> = {}) {
  const partes = Object.entries(campos)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  console.error(`[webhook/asaas] ${mensagem}${partes.length ? ` | ${partes.join(" ")}` : ""}`);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ehUuidValido(valor?: string | null): boolean {
  return Boolean(valor && UUID_REGEX.test(valor.trim()));
}

/**
 * Comparação de segredos em tempo constante.
 *
 * `===` em string retorna assim que encontra o primeiro byte diferente, e
 * essa diferença de tempo é mensurável. Não é a vulnerabilidade mais
 * urgente do mundo, mas o custo de evitá-la é uma função de três linhas.
 */
function comparaEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/**
 * Valida o token enviado pelo Asaas no header.
 *
 * **Sem fallback.** A versão anterior aceitava a `ASAAS_API_KEY` quando
 * `ASAAS_WEBHOOK_TOKEN` faltava — o que punha a chave que movimenta
 * dinheiro em trânsito num header de webhook e a expunha a qualquer log
 * intermediário. Sem token configurado, nada é aceito.
 */
export function validarTokenWebhook(tokenRecebido: string | null): boolean {
  const esperado = tokenDoWebhook();
  if (!esperado) return false;
  if (!tokenRecebido) return false;
  return comparaEmTempoConstante(tokenRecebido.trim(), esperado);
}

/** Se o endpoint tem token configurado. Distingue "mal configurado" de "token errado". */
export function webhookConfigurado(): boolean {
  return tokenDoWebhook() !== null;
}

/**
 * Descobre de quem é o evento.
 *
 * Ordem: primeiro tenta casar com uma empresa; só depois considera a conta
 * da plataforma. Assim, uma empresa vinculada nunca é confundida com a
 * conta raiz, mesmo que alguém configure as duas com o mesmo id por engano.
 */
async function resolverContexto(
  evento: AsaasWebhookPayload
): Promise<{ ok: true; contexto: ContextoEvento } | { ok: false; erro: string; statusHttp: number }> {
  const accountId = evento.account?.id?.trim();

  if (!accountId) {
    /* Webhook sem `account` não permite decidir o tenant. Em vez de
       processar "na conta padrão" — que é exatamente o bug antigo —
       recusamos. */
    return {
      ok: false,
      erro: "Evento sem identificação de conta (account.id).",
      statusHttp: 400,
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("empresas")
    .select("id")
    .eq("asaas_account_id", accountId)
    .maybeSingle();

  if (error) {
    registrar("falha ao resolver empresa", { erro: error.code });
    return { ok: false, erro: "Não foi possível resolver a conta.", statusHttp: 503 };
  }

  if (data?.id) {
    return { ok: true, contexto: { tipo: "subconta", empresaId: data.id, accountId } };
  }

  const plataforma = contaDaPlataforma();
  if (plataforma && comparaEmTempoConstante(accountId, plataforma)) {
    return { ok: true, contexto: { tipo: "plataforma", accountId } };
  }

  /* Conta desconhecida: nem subconta vinculada, nem a conta do Zelo.
     Pode ser configuração incompleta ou requisição forjada — em ambos os
     casos, a resposta certa é não escrever nada. */
  registrar("conta desconhecida, evento recusado", { accountId, evento: evento.event });
  return {
    ok: false,
    erro: "Conta de origem não reconhecida.",
    statusHttp: 422,
  };
}

/**
 * Processa o evento de webhook com verificação de idempotência.
 */
export async function processarEventoWebhook(
  evento: AsaasWebhookPayload
): Promise<ResultadoProcessamentoWebhook> {
  if (!evento || !evento.id || !evento.event) {
    return { ok: false, erro: "Payload de evento inválido.", statusHttp: 400 };
  }

  if (!supabaseConfigurado()) {
    return { ok: false, erro: "Banco de dados não configurado.", statusHttp: 503 };
  }

  const admin = supabaseAdmin();

  /* 1. Resolver o tenant ANTES da idempotência.
     Um evento que não se sabe de quem é não deve nem ocupar linha na
     tabela de eventos: registrá-lo faria a retentativa do Asaas ser
     tratada como duplicata e o evento se perderia em silêncio depois que
     a configuração fosse corrigida. */
  const resolucao = await resolverContexto(evento);
  if (!resolucao.ok) {
    return { ok: false, erro: resolucao.erro, statusHttp: resolucao.statusHttp };
  }
  const contexto = resolucao.contexto;
  const empresaId = contexto.tipo === "subconta" ? contexto.empresaId : null;

  /* 2. Registrar o evento ANTES de qualquer efeito.
     Esta gravação É a idempotência: a constraint única em `asaas_event_id`
     é o que impede o mesmo evento de ser processado duas vezes.

     Se ela falhar por qualquer motivo que não seja "já existe", NÃO dá
     para seguir: processar sem essa proteção é o que transforma um
     reenvio do provedor em pagamento contado em dobro. Melhor devolver
     erro e deixar o Asaas reenviar — reenvio é barato, pagamento
     duplicado não é. */
  try {
    const { error: insertErr } = await admin.from("eventos_asaas").insert({
      asaas_event_id: evento.id,
      tipo: evento.event,
      payload: evento,
      empresa_id: empresaId,
      asaas_account_id: contexto.accountId,
      recebido_em: new Date().toISOString(),
    });

    if (insertErr) {
      // 23505 = unique_violation: já recebemos este evento. Caminho feliz.
      if (insertErr.code === "23505") {
        return { ok: true, idempotente: true, eventoId: evento.id, empresaId };
      }

      /* Tabela ausente, permissão negada, conexão caída — todos significam
         a mesma coisa aqui: não há garantia de idempotência. O detalhe
         (código, tabela, mensagem do Postgres) fica no log do servidor; a
         resposta HTTP leva só uma frase genérica. */
      registrar("idempotencia indisponivel — evento NAO processado", {
        erro: insertErr.code,
        evento: evento.event,
        accountId: contexto.accountId,
      });
      return {
        ok: false,
        erro: "Não foi possível registrar o evento. Tente novamente.",
        statusHttp: 503,
      };
    }
  } catch (err) {
    registrar("falha ao registrar evento — NAO processado", {
      evento: evento.event,
      accountId: contexto.accountId,
    });
    return {
      ok: false,
      erro: "Não foi possível registrar o evento. Tente novamente.",
      statusHttp: 503,
    };
  }

  // 3. Tratar eventos específicos, sempre dentro do contexto resolvido
  try {
    const { payment, subscription } = evento;

    // ---------- EVENTOS DE PAGAMENTO ----------
    if (payment) {
      const valorCentavos = Math.round(payment.value * 100);
      const dataPagamento = payment.paymentDate
        ? new Date(payment.paymentDate).toISOString()
        : new Date().toISOString();

      const temRefUuid = ehUuidValido(payment.externalReference);

      if (contexto.tipo === "subconta") {
        /* Cobrança de um cliente final. `externalReference` e
           `asaas_payment_id` continuam sendo usados para achar a LINHA —
           mas agora só depois de `empresa_id` já ter restringido o
           universo à empresa dona da conta. É a diferença entre "procure
           esta cobrança" e "procure esta cobrança nesta empresa". */
        if (evento.event === "PAYMENT_RECEIVED" || evento.event === "PAYMENT_CONFIRMED") {
          if (temRefUuid || payment.id) {
            let query = admin
              .from("cobrancas")
              .update({
                status: "paga",
                pago_em: dataPagamento,
                valor_pago_centavos: valorCentavos,
                asaas_payment_id: payment.id,
              })
              .eq("empresa_id", contexto.empresaId);

            query = temRefUuid
              ? query.eq("id", payment.externalReference!.trim())
              : query.eq("asaas_payment_id", payment.id);

            const { error: cobErr } = await query;
            if (cobErr) {
              registrar("erro ao atualizar cobranca", {
                evento: evento.event,
                empresaId: contexto.empresaId,
                accountId: contexto.accountId,
                erro: cobErr.code,
              });
            }
          }
        } else if (evento.event === "PAYMENT_DELETED" || evento.event === "PAYMENT_RESTORED") {
          /* `pago_em` e `valor_pago_centavos` saem junto do status.
             A constraint `cobrancas_pagamento_coerente` exige
             status='paga' ⟺ pago_em não nulo. Gravar só o status sobre
             uma cobrança que estava paga violava a constraint, o update
             era recusado, e como o retorno não era conferido a cobrança
             continuava "paga" sem nada aparecer — o pior tipo de falha
             num dado financeiro: silenciosa. */
          const novoStatus = evento.event === "PAYMENT_DELETED" ? "cancelada" : "pendente";

          if (temRefUuid || payment.id) {
            let query = admin
              .from("cobrancas")
              .update({ status: novoStatus, pago_em: null, valor_pago_centavos: null })
              .eq("empresa_id", contexto.empresaId);

            query = temRefUuid
              ? query.eq("id", payment.externalReference!.trim())
              : query.eq("asaas_payment_id", payment.id);

            const { error: errStatus } = await query;
            if (errStatus) {
              registrar("erro ao alterar status da cobrança", {
                evento: evento.event,
                empresaId: contexto.empresaId,
                accountId: contexto.accountId,
                erro: errStatus.code,
              });
            }
          }
        }
      } else {
        /* Contexto plataforma: é a mensalidade do Zelo sendo paga. Só
           `empresas.assinatura_status` muda — nenhuma cobrança de tenant
           é tocada, porque nenhuma cobrança de tenant vive nesta conta. */
        if (
          (evento.event === "PAYMENT_RECEIVED" || evento.event === "PAYMENT_CONFIRMED") &&
          payment.customer
        ) {
          const { error: empErr } = await admin
            .from("empresas")
            .update({ assinatura_status: "ativa" })
            .eq("asaas_customer_id", payment.customer);

          if (empErr) {
            registrar("erro ao ativar assinatura de empresa", {
              evento: evento.event,
              accountId: contexto.accountId,
              erro: empErr.code,
            });
          }
        }
      }
    }

    // ---------- EVENTOS DE ASSINATURA ----------
    if (subscription && evento.event === "SUBSCRIPTION_DELETED" && subscription.id) {
      if (contexto.tipo === "subconta") {
        await admin
          .from("recorrencias")
          .update({ status: "encerrada" })
          .eq("empresa_id", contexto.empresaId)
          .eq("asaas_subscription_id", subscription.id);
      } else {
        await admin
          .from("empresas")
          .update({ assinatura_status: "cancelada" })
          .eq("asaas_subscription_id", subscription.id);
      }
    }

    // 4. Marcar como processado
    try {
      await admin
        .from("eventos_asaas")
        .update({ processado_em: new Date().toISOString() })
        .eq("asaas_event_id", evento.id);
    } catch {
      // Silenciar: o efeito principal já ocorreu.
    }

    return { ok: true, eventoId: evento.id, empresaId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao processar evento";
    registrar("falha no processamento", {
      evento: evento.event,
      empresaId,
      accountId: contexto.accountId,
    });
    return { ok: false, erro: msg, statusHttp: 500 };
  }
}
