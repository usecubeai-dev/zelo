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
import { sincronizarStatusFinanceiro } from "../core/onboarding";
import { StatusAutorizacao, transicaoValida, origemPermitida, estaViva } from "../core/autorizacao";
import {
  StatusInstrucao,
  transicaoValida as transicaoInstrucaoValida,
  origemPermitida as origemInstrucaoPermitida,
} from "../core/instrucao-pagamento";
import { registrarAcaoFinanceira } from "../core/auditoria";
import { criarNotificacao } from "../core/notificacoes";
import { transicaoValidaAssinatura } from "../core/assinatura";
import { StatusAssinatura } from "../empresa";
import { formatarCentavos } from "../dinheiro";

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
  /* Eventos de AUTORIZAÇÃO de Pix Automático são um caso à parte: o
     payload de exemplo da doc oficial (docs.asaas.com/docs/eventos-para-
     pix-automático, confirmado 01/09/2026) não mostra o campo `account`
     que todo outro evento v3 traz. Sem ele, a regra geral abaixo
     recusaria o evento por completo.

     A saída não é confiar cegamente em nada do corpo — é resolver o
     tenant por `authorization.id` → `autorizacoes_pix.empresa_id`. Essa
     linha só existe porque O PRÓPRIO ZELO a criou, depois de uma chamada
     real ao Asaas com a credencial daquela subconta — então `empresa_id`
     ali é tão confiável quanto `account.id` seria, só que resolvido por
     um caminho diferente. Se `account.id` VIER mesmo assim, ele ainda é
     conferido contra o dono real da autorização, como defesa extra. */
  if (evento.event.startsWith("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_") && evento.authorization?.id) {
    const admin = supabaseAdmin();
    const { data: linha, error: erroLinha } = await admin
      .from("autorizacoes_pix")
      .select("empresa_id")
      .eq("asaas_authorization_id", evento.authorization.id)
      .maybeSingle();

    if (erroLinha) {
      registrar("falha ao resolver autorização", { erro: erroLinha.code });
      return { ok: false, erro: "Não foi possível resolver a autorização.", statusHttp: 503 };
    }
    if (!linha?.empresa_id) {
      registrar("autorização desconhecida, evento recusado", {
        authorizationId: evento.authorization.id,
        evento: evento.event,
      });
      return { ok: false, erro: "Autorização não reconhecida.", statusHttp: 422 };
    }

    const { data: empresa } = await admin
      .from("empresas")
      .select("asaas_account_id")
      .eq("id", linha.empresa_id)
      .maybeSingle();

    const accountIdRecebido = evento.account?.id?.trim();
    if (accountIdRecebido && empresa?.asaas_account_id && !comparaEmTempoConstante(accountIdRecebido, empresa.asaas_account_id)) {
      registrar("account.id do evento não bate com o dono da autorização", {
        authorizationId: evento.authorization.id,
        empresaId: linha.empresa_id,
      });
      return { ok: false, erro: "Conta de origem não confere.", statusHttp: 422 };
    }

    return {
      ok: true,
      contexto: { tipo: "subconta", empresaId: linha.empresa_id, accountId: empresa?.asaas_account_id ?? accountIdRecebido ?? "desconhecida" },
    };
  }

  /* Eventos de INSTRUÇÃO DE PAGAMENTO: mesmo achado da Fase 6, o payload
     de exemplo não traz `account`. Resolvido por `paymentId` →
     `instrucoes_pagamento.asaas_payment_id` → `empresa_id` — a linha já
     existe porque `prepararCicloPixAutomatico` a criou de forma síncrona
     junto com a cobrança, antes de qualquer webhook poder chegar. */
  if (evento.event.startsWith("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_") && evento.paymentInstruction) {
    const admin = supabaseAdmin();
    const paymentId = evento.paymentInstruction.paymentId;
    const authorizationId = evento.paymentInstruction.authorization?.id;

    let empresaId: string | null = null;
    if (paymentId) {
      const { data: linha } = await admin
        .from("instrucoes_pagamento")
        .select("empresa_id")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();
      empresaId = linha?.empresa_id ?? null;
    }
    if (!empresaId && authorizationId) {
      const { data: linhaAuth } = await admin
        .from("autorizacoes_pix")
        .select("empresa_id")
        .eq("asaas_authorization_id", authorizationId)
        .maybeSingle();
      empresaId = linhaAuth?.empresa_id ?? null;
    }

    if (!empresaId) {
      registrar("instrução desconhecida, evento recusado", {
        paymentId: paymentId ?? undefined,
        authorizationId: authorizationId ?? undefined,
        evento: evento.event,
      });
      return { ok: false, erro: "Instrução não reconhecida.", statusHttp: 422 };
    }

    const { data: empresa } = await admin.from("empresas").select("asaas_account_id").eq("id", empresaId).maybeSingle();
    return {
      ok: true,
      contexto: { tipo: "subconta", empresaId, accountId: empresa?.asaas_account_id ?? "desconhecida" },
    };
  }

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
                pago_via: "asaas",
                asaas_payment_id: payment.id,
              })
              .eq("empresa_id", contexto.empresaId);

            query = temRefUuid
              ? query.eq("id", payment.externalReference!.trim())
              : query.eq("asaas_payment_id", payment.id);

            const { data: cobAtualizada, error: cobErr } = await query.select("id, descricao").maybeSingle();
            if (cobErr) {
              registrar("erro ao atualizar cobranca", {
                evento: evento.event,
                empresaId: contexto.empresaId,
                accountId: contexto.accountId,
                erro: cobErr.code,
              });
            } else if (cobAtualizada) {
              await criarNotificacao(
                contexto.empresaId,
                "pagamento_recebido",
                "Pagamento recebido",
                `"${cobAtualizada.descricao}" — ${formatarCentavos(valorCentavos)}.`,
                "baixa",
                `/app/cobrancas/${cobAtualizada.id}`,
                `pagamento_recebido:${cobAtualizada.id}`
              );
            }

            /* Registro do pagamento em si (Fase 7) — só quando a cobrança
               tem uma instrução Pix Automático vinculada
               (`pagamentos.instrucao_id` é NOT NULL, de propósito: esta
               tabela é específica do fluxo Pix Automático, não de toda
               cobrança). `instrucao = concluída` continua uma entidade
               separada de `pagamento = recebido` — este bloco só CRIA o
               registro do pagamento, nunca toca `instrucoes_pagamento.status`
               (regra explícita da Fase 7, item 12). */
            if (payment.id) {
              const { data: instrucaoLigada } = await admin
                .from("instrucoes_pagamento")
                .select("id")
                .eq("asaas_payment_id", payment.id)
                .eq("empresa_id", contexto.empresaId)
                .maybeSingle();

              if (instrucaoLigada) {
                const liquidoCentavos = payment.netValue != null ? Math.round(payment.netValue * 100) : valorCentavos;
                const { error: pagErr } = await admin.from("pagamentos").insert({
                  empresa_id: contexto.empresaId,
                  instrucao_id: instrucaoLigada.id,
                  asaas_payment_id: payment.id,
                  valor_liquido_centavos: liquidoCentavos,
                  taxa_centavos: Math.max(0, valorCentavos - liquidoCentavos),
                  liquidado_em: dataPagamento,
                });
                // 23505 = já registrado (reenvio do mesmo evento) — idempotente, não é falha.
                if (pagErr && pagErr.code !== "23505") {
                  registrar("erro ao registrar pagamento", {
                    evento: evento.event,
                    empresaId: contexto.empresaId,
                    erro: pagErr.code,
                  });
                }
              }
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
              .update({ status: novoStatus, pago_em: null, valor_pago_centavos: null, pago_via: null })
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
        } else if (evento.event === "PAYMENT_REFUNDED" || evento.event === "PAYMENT_PARTIALLY_REFUNDED") {
          /* Estorno total ou parcial de um Pix já recebido. Confirmado em
             docs.asaas.com/reference/refund-payment (01/09/2026): Pix
             aceita estorno total ou múltiplos parciais; total muda
             `payment.status` para REFUNDED, parcial mantém
             RECEIVED/CONFIRMED — só o array `refunds` cresce. Por isso
             somamos `refunds` em vez de confiar no status pra decidir o
             valor estornado. `pago_em`/`valor_pago_centavos` NUNCA são
             apagados aqui: o pagamento aconteceu de fato, o estorno é um
             evento posterior, não uma correção de "nunca foi pago" (essa
             é a diferença de propósito com PAYMENT_DELETED acima). Só
             cobrança que estava `paga` pode virar `estornada` — nunca
             sobrescreve pendente/enviada/cancelada. */
          const somaEstornada = (payment.refunds ?? []).reduce((soma, r) => soma + Math.round(r.value * 100), 0);
          const valorEstornadoCentavos = somaEstornada > 0 ? somaEstornada : valorCentavos;
          const estornoTotal = evento.event === "PAYMENT_REFUNDED" || valorEstornadoCentavos >= valorCentavos;

          if (temRefUuid || payment.id) {
            let query = admin
              .from("cobrancas")
              .update(
                {
                  ...(estornoTotal ? { status: "estornada" } : {}),
                  valor_estornado_centavos: valorEstornadoCentavos,
                  estornado_em: new Date().toISOString(),
                },
                { count: "exact" }
              )
              .eq("empresa_id", contexto.empresaId)
              .eq("status", "paga");

            query = temRefUuid
              ? query.eq("id", payment.externalReference!.trim())
              : query.eq("asaas_payment_id", payment.id);

            const { data: cobEstornada, error: errEstorno, count: countEstorno } = await query.select("id, descricao").maybeSingle();
            if (errEstorno) {
              registrar("erro ao registrar estorno", {
                evento: evento.event,
                empresaId: contexto.empresaId,
                erro: errEstorno.code,
              });
            } else if (!countEstorno) {
              // Nenhuma linha 'paga' bateu — evento fora de ordem (estorno chegou antes do recebimento ser processado) ou reenvio depois que a linha já virou 'estornada'. Não é silêncio: fica no log pra investigar se persistir.
              registrar("estorno sem cobrança 'paga' correspondente", {
                evento: evento.event,
                empresaId: contexto.empresaId,
                paymentId: payment.id,
              });
            } else {
              await registrarAcaoFinanceira(
                contexto.empresaId,
                null,
                estornoTotal ? "cobranca_estornada" : "cobranca_parcialmente_estornada",
                payment.id
              );
              if (estornoTotal && cobEstornada) {
                await criarNotificacao(
                  contexto.empresaId,
                  "cobranca_estornada",
                  "Cobrança estornada",
                  `"${cobEstornada.descricao}" — ${formatarCentavos(valorEstornadoCentavos)} devolvidos ao pagador.`,
                  "alta",
                  `/app/cobrancas/${cobEstornada.id}`,
                  `cobranca_estornada:${cobEstornada.id}`
                );
              }
            }
          }
        } else if (
          evento.event === "PAYMENT_CHARGEBACK_REQUESTED" ||
          evento.event === "PAYMENT_CHARGEBACK_DISPUTE" ||
          evento.event === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL" ||
          evento.event === "PAYMENT_REFUND_IN_PROGRESS" ||
          evento.event === "PAYMENT_REFUND_DENIED"
        ) {
          /* Etapas intermediárias do fluxo de chargeback/estorno — nenhuma
             é terminal (o desfecho real chega depois como
             PAYMENT_REFUNDED, ou como PAYMENT_RECEIVED/CONFIRMED de novo
             se a disputa for ganha). Só auditoria: inventar um status
             novo de `cobrancas` por etapa seria "inventar etapas" que a
             interface ainda não sabe mostrar — fica pra quando o centro
             financeiro (Fase 12) tiver uma timeline de verdade pra isso. */
          await registrarAcaoFinanceira(
            contexto.empresaId,
            null,
            `cobranca_${evento.event.replace("PAYMENT_", "").toLowerCase()}`,
            payment.id
          );
        }
      } else {
        /* Contexto plataforma: é a mensalidade do Zelo sendo paga (ou
           atrasada). Só `empresas.assinatura_status` muda — nenhuma
           cobrança de tenant é tocada, porque nenhuma cobrança de tenant
           vive nesta conta. Delegado a `processarEventoAssinaturaPlataforma`,
           que valida a transição contra `lib/core/assinatura.ts` antes de
           escrever — mesma disciplina de `processarEventoAutorizacaoPix`. */
        const novoStatusAssinatura: StatusAssinatura | null =
          evento.event === "PAYMENT_RECEIVED" || evento.event === "PAYMENT_CONFIRMED"
            ? "ativa"
            : evento.event === "PAYMENT_OVERDUE"
            ? "inadimplente"
            : null;

        if (novoStatusAssinatura && payment.customer) {
          await processarEventoAssinaturaPlataforma(
            admin,
            evento,
            novoStatusAssinatura,
            "asaas_customer_id",
            payment.customer
          );
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
        await processarEventoAssinaturaPlataforma(
          admin,
          evento,
          "cancelada",
          "asaas_subscription_id",
          subscription.id
        );
      }
    }

    // ---------- EVENTOS DE CONTA (situação cadastral da subconta) ----------
    /* Deliberadamente separado dos blocos de pagamento/assinatura acima:
       um evento de conta nunca deveria poder, por acidente de código,
       tocar em `cobrancas` ou `recorrencias` — e vice-versa. */
    if (evento.event.startsWith("ACCOUNT_STATUS_GENERAL_APPROVAL_") && contexto.tipo === "subconta") {
      // `general` é o único dos 4 campos que persistimos diretamente —
      // é o que `prontaParaCobrar()` lê. O nome do evento já contém o
      // valor, então não é preciso outra chamada para aplicar este.
      const statusAprovacao = evento.event.replace("ACCOUNT_STATUS_GENERAL_APPROVAL_", "");
      const { error: errAprovacao } = await admin
        .from("empresas")
        .update({ provider_aprovacao: statusAprovacao, provider_sincronizado_em: new Date().toISOString() })
        .eq("id", contexto.empresaId);

      if (errAprovacao) {
        registrar("erro ao atualizar aprovação da conta", {
          evento: evento.event,
          empresaId: contexto.empresaId,
          erro: errAprovacao.code,
        });
      } else if (statusAprovacao === "APPROVED" || statusAprovacao === "REJECTED") {
        // Chave por `evento.id`, não por empresa: a idempotência de "não
        // duplicar o MESMO evento" já é garantida por `eventos_asaas` antes
        // daqui (por isso é seguro chegar até aqui só na primeira vez de
        // cada evento real) — usar só `empresaId` na chave impediria uma
        // segunda aprovação genuína (rara, mas possível após reprovar e
        // corrigir) de notificar de novo.
        const aprovada = statusAprovacao === "APPROVED";
        await criarNotificacao(
          contexto.empresaId,
          aprovada ? "conta_aprovada" : "conta_recusada",
          aprovada ? "Conta financeira aprovada" : "Conta financeira recusada",
          aprovada
            ? "O Asaas aprovou sua conta — você já pode cobrar de verdade, inclusive por Pix Automático."
            : "O Asaas recusou a aprovação da sua conta. Veja em Configurações o que precisa ser corrigido.",
          aprovada ? "media" : "alta",
          "/app/configuracoes",
          `${aprovada ? "conta_aprovada" : "conta_recusada"}:${contexto.empresaId}:${evento.id}`
        );
      }
    }

    /* BANK_ACCOUNT_INFO_*, COMMERCIAL_INFO_*, DOCUMENT_APPROVED: os outros
       3 campos de `SituacaoContaAsaas` (`bankAccountInfo`, `commercialInfo`,
       `documentation`) nunca foram promovidos a coluna própria — são lidos
       ao vivo por `sincronizarStatusFinanceiro`/`estadoConceitual`, de
       propósito, para não duplicar estado (ver `lib/core/conta-financeira.ts`).
       Um evento aqui não carrega o valor final do jeito que GENERAL_APPROVAL
       carrega, então a única ação honesta é usá-lo como gatilho para ir
       buscar o estado real agora — não fabricar um valor a partir do nome
       do evento. */
    if (
      contexto.tipo === "subconta" &&
      (evento.event.startsWith("ACCOUNT_STATUS_BANK_ACCOUNT_INFO_") ||
        evento.event.startsWith("ACCOUNT_STATUS_COMMERCIAL_INFO_") ||
        evento.event === "ACCOUNT_STATUS_DOCUMENT_APPROVED")
    ) {
      const resultado = await sincronizarStatusFinanceiro(contexto.empresaId);
      if (!resultado.ok) {
        registrar("falha ao ressincronizar após evento de conta", {
          evento: evento.event,
          empresaId: contexto.empresaId,
          erro: resultado.erro.tipo,
        });
      }
    }

    // ---------- EVENTOS DE AUTORIZAÇÃO PIX AUTOMÁTICO ----------
    /* Bloco isolado dos demais, mesma disciplina: um evento de autorização
       nunca deveria poder tocar `cobrancas`/`recorrencias` diretamente —
       só `autorizacoes_pix` e, quando a autorização morre, a referência
       em `recorrencias.autorizacao_atual_id` que aponta pra ela. */
    if (
      evento.event.startsWith("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_") &&
      contexto.tipo === "subconta" &&
      evento.authorization
    ) {
      await processarEventoAutorizacaoPix(admin, contexto.empresaId, evento.event, evento.authorization);
    }

    // ---------- EVENTOS DE INSTRUÇÃO DE PAGAMENTO PIX AUTOMÁTICO ----------
    /* Mesmo isolamento dos blocos acima: um evento de instrução só toca
       `instrucoes_pagamento` — nunca `cobrancas` (isso é papel do evento
       de PAGAMENTO, tratado acima) nem `autorizacoes_pix`. */
    if (
      evento.event.startsWith("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_") &&
      contexto.tipo === "subconta" &&
      evento.paymentInstruction
    ) {
      await processarEventoInstrucaoPagamento(admin, contexto.empresaId, evento.event, evento.paymentInstruction);
    }

    /* Elegibilidade da CONTA (não da autorização individual) para Pix
       Automático. Confirmado: quando fica INELIGIBLE o próprio Asaas
       cancela as autorizações ativas, o que chega aqui como eventos
       AUTHORIZATION_CANCELLED normais — já tratados acima. Só
       reconhecido e auditado; nenhum efeito próprio inventado. */
    if (evento.event === "PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED" && contexto.tipo === "subconta") {
      await registrarAcaoFinanceira(contexto.empresaId, null, "pix_automatico_elegibilidade_atualizada");
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

/**
 * Aplica a transição da assinatura da própria Zelo (contexto plataforma —
 * ver `lib/core/assinatura.ts`). Mesma disciplina de
 * `processarEventoAutorizacaoPix` logo abaixo: valida a transição contra o
 * domínio antes de escrever, nunca decide sozinho. `campoBusca` é
 * `asaas_customer_id` para eventos de pagamento e `asaas_subscription_id`
 * para o cancelamento da assinatura em si — são os dois jeitos de achar a
 * empresa dona desta mensalidade.
 */
async function processarEventoAssinaturaPlataforma(
  admin: ReturnType<typeof supabaseAdmin>,
  evento: AsaasWebhookPayload,
  novoStatus: StatusAssinatura,
  campoBusca: "asaas_customer_id" | "asaas_subscription_id",
  valorBusca: string
) {
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, assinatura_status")
    .eq(campoBusca, valorBusca)
    .maybeSingle();

  // Sem empresa vinculada a este customer/subscription — nada a fazer.
  if (!empresa) return;

  const statusAtual = empresa.assinatura_status as StatusAssinatura;

  // Reenvio do mesmo estado: idempotente, nada a fazer.
  if (statusAtual === novoStatus) return;

  if (!transicaoValidaAssinatura(statusAtual, novoStatus)) {
    registrar("transição de assinatura recusada", {
      evento: evento.event,
      de: statusAtual,
      para: novoStatus,
      empresaId: empresa.id,
    });
    return;
  }

  const { error } = await admin
    .from("empresas")
    .update({ assinatura_status: novoStatus, assinatura_atualizada_em: new Date().toISOString() })
    .eq("id", empresa.id);

  if (error) {
    registrar("erro ao atualizar assinatura de empresa", {
      evento: evento.event,
      empresaId: empresa.id,
      erro: error.code,
    });
    return;
  }

  const ACAO: Record<StatusAssinatura, string> = {
    trial: "",
    ativa: "assinatura_zelo_ativada",
    inadimplente: "assinatura_zelo_inadimplente",
    cancelada: "assinatura_zelo_cancelada",
  };
  await registrarAcaoFinanceira(
    empresa.id,
    null,
    ACAO[novoStatus],
    evento.payment?.id ?? evento.subscription?.id ?? null
  );

  if (novoStatus === "inadimplente") {
    await criarNotificacao(
      empresa.id,
      "assinatura_inadimplente",
      "Pagamento da assinatura em atraso",
      "Não conseguimos confirmar o pagamento da sua assinatura Zelo. Enquanto isso, cadastrar novos clientes, cobranças ou recorrências fica bloqueado — o que já existe continua acessível.",
      "alta",
      "/app/assinatura",
      `assinatura_inadimplente:${empresa.id}:${evento.id}`
    );
  } else if (novoStatus === "ativa" && statusAtual === "inadimplente") {
    await criarNotificacao(
      empresa.id,
      "assinatura_regularizada",
      "Assinatura regularizada",
      "Recebemos o pagamento em atraso — sua conta está liberada novamente.",
      "media",
      "/app/assinatura",
      `assinatura_regularizada:${empresa.id}:${evento.id}`
    );
  } else if (novoStatus === "cancelada") {
    await criarNotificacao(
      empresa.id,
      "assinatura_cancelada",
      "Assinatura cancelada",
      "Sua assinatura Zelo foi cancelada. Cadastrar novos clientes, cobranças ou recorrências fica bloqueado até uma nova assinatura ser criada.",
      "alta",
      "/app/assinatura",
      `assinatura_cancelada:${empresa.id}:${evento.id}`
    );
  }
}

/**
 * Aplica a transição de estado de uma autorização Pix Automático.
 *
 * Valida com as MESMAS regras de `lib/core/autorizacao.ts`
 * (`transicaoValida`/`origemPermitida`) — o webhook não decide sozinho o
 * que é uma transição legítima, só executa o que o domínio já definiu
 * como permitido pra origem "webhook". Reenviar o mesmo estado (mesmo
 * evento duas vezes, ou dois eventos que resultam no mesmo status) é
 * idempotente: a linha simplesmente não muda.
 */
async function processarEventoAutorizacaoPix(
  admin: ReturnType<typeof supabaseAdmin>,
  empresaId: string,
  eventName: string,
  authorization: NonNullable<AsaasWebhookPayload["authorization"]>
) {
  const MAPA_EVENTO_STATUS: Partial<Record<string, StatusAutorizacao>> = {
    PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED: "CREATED",
    PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED: "ACTIVE",
    PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED: "CANCELLED",
    PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED: "EXPIRED",
    PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED: "REFUSED",
  };
  const novoStatus = MAPA_EVENTO_STATUS[eventName];
  if (!novoStatus) return;

  const { data: linha } = await admin
    .from("autorizacoes_pix")
    .select("id, status, recorrencia_id")
    .eq("asaas_authorization_id", authorization.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // Já recusado em resolverContexto na prática — defesa extra, não deveria acontecer.
  if (!linha) return;

  // Reenvio do mesmo estado: idempotente, nada a fazer.
  if (linha.status === novoStatus) return;

  if (!transicaoValida(linha.status as StatusAutorizacao, novoStatus) || !origemPermitida(novoStatus, "webhook")) {
    registrar("transição de autorização recusada", {
      de: linha.status,
      para: novoStatus,
      autorizacaoId: linha.id,
      empresaId,
    });
    return;
  }

  const atualizacao: Record<string, unknown> = { status: novoStatus, atualizado_em: new Date().toISOString() };
  if (novoStatus === "CANCELLED") {
    atualizacao.cancellation_date = authorization.cancellationDate
      ? new Date(authorization.cancellationDate).toISOString()
      : new Date().toISOString();
    atualizacao.cancellation_reason = authorization.cancellationReason ?? "Cancelado (webhook Asaas)";
  }
  if (authorization.subscriptionId) atualizacao.asaas_subscription_id = authorization.subscriptionId;

  const { error: erroUpdate } = await admin.from("autorizacoes_pix").update(atualizacao).eq("id", linha.id);
  if (erroUpdate) {
    registrar("erro ao atualizar autorização", { autorizacaoId: linha.id, empresaId, erro: erroUpdate.code });
    return;
  }

  if (!estaViva(novoStatus)) {
    // Libera a recorrência: uma nova autorização pode ser solicitada.
    await admin.from("recorrencias").update({ autorizacao_atual_id: null }).eq("autorizacao_atual_id", linha.id);
  }

  await registrarAcaoFinanceira(empresaId, null, `autorizacao_pix_${novoStatus.toLowerCase()}`, linha.id);
  await notificarMudancaDeAutorizacao(empresaId, linha.id, linha.recorrencia_id, novoStatus);
}

/**
 * Notifica o profissional só nas transições que ele não provocou (e por
 * isso não deveria já saber): `ACTIVE` (o pagador concluiu o
 * consentimento), `REFUSED`/`EXPIRED` (o pagador nunca concluiu, ou o
 * prazo passou), e `CANCELLED` só quando chega por AQUI — este bloco só
 * roda pra eventos de WEBHOOK, então uma autorização cancelada pelo
 * próprio profissional (`cancelarAutorizacaoPix()`, que grava direto no
 * banco sem passar pelo webhook) nunca duplica aviso do que ele mesmo
 * acabou de fazer.
 */
async function notificarMudancaDeAutorizacao(empresaId: string, autorizacaoId: string, recorrenciaId: string, status: StatusAutorizacao) {
  const TEXTO: Partial<Record<StatusAutorizacao, { titulo: string; mensagem: string; prioridade: "baixa" | "media" | "alta" }>> = {
    ACTIVE: { titulo: "Pix Automático ativado", mensagem: "O pagador concluiu a autorização — os próximos ciclos já podem ser cobrados automaticamente.", prioridade: "media" },
    REFUSED: { titulo: "Autorização Pix Automático recusada", mensagem: "O pagador não concluiu o consentimento. Solicite uma nova autorização quando quiser tentar de novo.", prioridade: "alta" },
    EXPIRED: { titulo: "Autorização Pix Automático expirada", mensagem: "O prazo de validade da autorização passou. Solicite uma nova para continuar cobrando por Pix Automático.", prioridade: "alta" },
    CANCELLED: { titulo: "Autorização Pix Automático cancelada pelo pagador", mensagem: "O pagador revogou o consentimento diretamente no banco dele. Solicite uma nova autorização se quiser continuar cobrando.", prioridade: "alta" },
  };
  const texto = TEXTO[status];
  if (!texto) return;
  await criarNotificacao(
    empresaId,
    `autorizacao_pix_${status.toLowerCase()}`,
    texto.titulo,
    texto.mensagem,
    texto.prioridade,
    `/app/recorrencias/${recorrenciaId}`,
    `autorizacao_pix_${status.toLowerCase()}:${autorizacaoId}`
  );
}

/**
 * Aplica a transição de estado de uma instrução de pagamento.
 *
 * Resolvida por `paymentId` (não por `asaas_instruction_id`, que pode
 * ainda não estar preenchido se o webhook chegar antes da descoberta
 * síncrona ter terminado — corrida rara, mas possível). Só existem 4
 * eventos reais (CREATED/SCHEDULED/REFUSED/CANCELLED) — `DONE` nunca
 * chega por webhook, só por reconciliação (`origemPermitida`).
 */
async function processarEventoInstrucaoPagamento(
  admin: ReturnType<typeof supabaseAdmin>,
  empresaId: string,
  eventName: string,
  paymentInstruction: NonNullable<AsaasWebhookPayload["paymentInstruction"]>
) {
  const MAPA_EVENTO_STATUS: Partial<Record<string, StatusInstrucao>> = {
    PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED: "AWAITING_REQUEST",
    PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED: "SCHEDULED",
    PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED: "REFUSED",
    PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED: "CANCELLED",
  };
  const novoStatus = MAPA_EVENTO_STATUS[eventName];
  if (!novoStatus || !paymentInstruction.paymentId) return;

  const { data: linha } = await admin
    .from("instrucoes_pagamento")
    .select("id, status, cobranca_id")
    .eq("asaas_payment_id", paymentInstruction.paymentId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // Defesa extra — resolverContexto já teria recusado o evento sem essa linha.
  if (!linha) return;

  // Reenvio do mesmo estado: idempotente, nada a fazer (mas ainda backfilla o asaas_instruction_id, se estava faltando).
  if (linha.status === novoStatus) {
    if (paymentInstruction.id) {
      await admin.from("instrucoes_pagamento").update({ asaas_instruction_id: paymentInstruction.id }).eq("id", linha.id).is("asaas_instruction_id", null);
    }
    return;
  }

  if (
    !transicaoInstrucaoValida(linha.status as StatusInstrucao, novoStatus) ||
    !origemInstrucaoPermitida(novoStatus, "webhook")
  ) {
    registrar("transição de instrução recusada", { de: linha.status, para: novoStatus, instrucaoId: linha.id, empresaId });
    return;
  }

  const atualizacao: Record<string, unknown> = {
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
    sincronizado_em: new Date().toISOString(),
  };
  if (paymentInstruction.id) atualizacao.asaas_instruction_id = paymentInstruction.id;
  if (paymentInstruction.dueDate) atualizacao.due_date = paymentInstruction.dueDate;
  if (novoStatus === "REFUSED") atualizacao.refusal_reason = paymentInstruction.refusalReason ?? null;

  const { error: erroUpdate } = await admin.from("instrucoes_pagamento").update(atualizacao).eq("id", linha.id);
  if (erroUpdate) {
    registrar("erro ao atualizar instrução", { instrucaoId: linha.id, empresaId, erro: erroUpdate.code });
    return;
  }

  await registrarAcaoFinanceira(empresaId, null, `instrucao_pagamento_${novoStatus.toLowerCase()}`, linha.id);

  // Só SCHEDULED/REFUSED — CREATED é ruído (o profissional já viu isso
  // acontecer ao gerar o ciclo), CANCELLED normalmente é consequência de
  // uma autorização cancelada, já notificada por `notificarMudancaDeAutorizacao`.
  if (novoStatus === "SCHEDULED") {
    await criarNotificacao(
      empresaId,
      "instrucao_pagamento_scheduled",
      "Débito automático agendado",
      paymentInstruction.dueDate ? `Cobrança agendada para ${paymentInstruction.dueDate}.` : "Cobrança agendada no banco do pagador.",
      "baixa",
      `/app/cobrancas/${linha.cobranca_id}`,
      `instrucao_pagamento_scheduled:${linha.id}`
    );
  } else if (novoStatus === "REFUSED") {
    await criarNotificacao(
      empresaId,
      "instrucao_pagamento_refused",
      "Débito automático recusado",
      "O banco do pagador recusou o débito deste ciclo. A cobrança continua pendente — veja o motivo na ficha dela.",
      "alta",
      `/app/cobrancas/${linha.cobranca_id}`,
      `instrucao_pagamento_refused:${linha.id}`
    );
  }
}
