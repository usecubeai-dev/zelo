/**
 * Caso de uso: ponte entre uma Cobrança Zelo e o objeto `payment`
 * correspondente no Asaas.
 *
 * ⚠ SERVIDOR APENAS. Mesma regra de camadas das Fases 2–4: Server
 * Actions chamam isto, nunca `lib/asaas/cobranca.ts` direto.
 *
 * ESCOPO DESTA FASE — só a ponte, nada além:
 *
 *   cobranca  ↕  objeto externo Asaas
 *
 * Não é autorização Pix Automático, não é instrução de pagamento, não é
 * confirmação de recebimento. `cobrancas.status` (comercial:
 * pendente/enviada/paga/cancelada) nunca é tocado por este arquivo — só
 * o webhook (`lib/asaas/webhook.ts`) marca `status = 'paga'`, e só
 * quando o Asaas confirma de verdade. Criar o payment no Asaas prova que
 * o objeto existe lá; não prova que o cliente pagou.
 *
 * IDEMPOTÊNCIA — mesmo padrão de compare-and-swap das Fases 2–4:
 * `UPDATE cobrancas SET asaas_sync_status='sincronizando' WHERE
 * asaas_sync_status IN ('pendente','erro') AND asaas_payment_id IS NULL`
 * só afeta a linha se ninguém mais estiver no meio da mesma
 * sincronização.
 *
 * TTL DO LOCK (Fase 10) — `asaasRequisicao()` nunca lança exceção, então
 * só um PROCESSO caindo no meio do caminho (não uma falha comum do
 * Asaas, que sempre desbloqueia via `asaas_sync_status='erro'`) deixaria
 * uma linha presa em `sincronizando` pra sempre. Mesmo raciocínio de
 * `criarAutorizacaoPix` (Fase 6): uma linha `sincronizando` com
 * `atualizado_em` (já existente, já atualizado por trigger em todo
 * UPDATE) mais velho que o TTL é tratada como travada.
 *
 * RESPOSTA PERDIDA — antes de criar, busca por
 * `externalReference = cobranca.id` (`GET /v3/payments?externalReference=`,
 * confirmado em docs.asaas.com/reference/listar-cobrancas). Se uma
 * tentativa anterior criou o payment mas a resposta se perdeu antes de
 * gravar `asaas_payment_id` localmente, a próxima tentativa recupera em
 * vez de duplicar.
 *
 * `externalReference = cobranca.id`, nunca nome/CPF/valor — mesma
 * estratégia já usada na Fase 4 para clientes, pelo mesmo motivo: o
 * Asaas não impõe unicidade nesses campos.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { credencialDaEmpresa } from "../asaas/credenciais";
import {
  criarCobrancaAsaas,
  buscarCobrancaPorExternalReference,
  cancelarCobrancaAsaas,
  obterCobrancaAsaas,
} from "../asaas/cobranca";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira } from "./auditoria";
import { criarNotificacao } from "./notificacoes";
import { ehFormaPagamento, planoDePagamento } from "../recuperacao";

/** Injetáveis só para teste — em produção são sempre as funções reais de `lib/asaas/cobranca.ts`. */
export type CriadorDeCobrancaAsaas = typeof criarCobrancaAsaas;
export type BuscadorDeCobrancaAsaas = typeof buscarCobrancaPorExternalReference;
export type CanceladorDeCobrancaAsaas = typeof cancelarCobrancaAsaas;
export type ConsultadorDeCobrancaAsaas = typeof obterCobrancaAsaas;

const TTL_TRAVA_MS = 2 * 60 * 1000;

export type SincronizacaoCobranca = {
  cobrancaId: string;
  asaasPaymentId: string;
  jaExistia: boolean;
};

type LinhaCobranca = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  descricao: string;
  valor_centavos: number;
  vence_em: string;
  status: string;
  asaas_payment_id: string | null;
  asaas_sync_status: string;
  forma_pagamento: string;
  multa_pct: number | string | null;
  juros_pct_mes: number | string | null;
};

type LinhaCliente = {
  id: string;
  status: string;
  asaas_customer_id: string | null;
};

async function buscarCobranca(cobrancaId: string, empresaId: string): Promise<LinhaCobranca | null> {
  const { data } = await supabaseAdmin()
    .from("cobrancas")
    .select("id, empresa_id, cliente_id, descricao, valor_centavos, vence_em, status, asaas_payment_id, asaas_sync_status, forma_pagamento, multa_pct, juros_pct_mes")
    .eq("id", cobrancaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Sincroniza uma cobrança já existente no CRM com o Asaas — cria o
 * `payment` correspondente e vincula os IDs.
 *
 * Pré-condições (falha cedo, sem chamar o Asaas, se qualquer uma faltar):
 * cobrança existe nesta empresa; ainda não foi paga/cancelada; empresa
 * tem subconta conectada; cliente existe, não está arquivado e tem
 * `asaas_customer_id` (sincronizado automaticamente aqui se ainda não
 * estiver — reaproveita a Fase 4 em vez de duplicar a lógica).
 */
export async function sincronizarCobrancaFinanceira(
  cobrancaId: string,
  empresaId: string,
  usuarioId: string | null = null,
  criador: CriadorDeCobrancaAsaas = criarCobrancaAsaas,
  buscador: BuscadorDeCobrancaAsaas = buscarCobrancaPorExternalReference,
  /** Fase 7: liga a cobrança a uma autorização Pix Automático ACTIVE — opções por último pra não quebrar nenhuma chamada existente. */
  opcoes: { pixAutomaticAuthorizationId?: string | null; ttlTravaMs?: number } = {}
): Promise<ResultadoDominio<SincronizacaoCobranca>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");

  const admin = supabaseAdmin();

  const cobranca = await buscarCobranca(cobrancaId, empresaId);
  if (!cobranca) return falha("nao_encontrado", "Cobrança não encontrada.");

  if (cobranca.status !== "pendente" && cobranca.status !== "enviada") {
    return falha("conflito", "Esta cobrança já foi paga ou cancelada — não é possível enviá-la ao Asaas.");
  }

  // Já sincronizada: no-op idempotente, sem chamar o Asaas de novo.
  if (cobranca.asaas_payment_id) {
    return ok({ cobrancaId, asaasPaymentId: cobranca.asaas_payment_id, jaExistia: true });
  }

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) {
    return falha(
      "integracao_externa",
      "Conecte sua conta financeira antes de enviar cobranças ao Asaas."
    );
  }

  const { data: clienteRow } = await admin
    .from("clientes")
    .select("id, status, asaas_customer_id")
    .eq("id", cobranca.cliente_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const cliente = clienteRow as LinhaCliente | null;

  if (!cliente) return falha("nao_encontrado", "Cliente desta cobrança não encontrado.");
  if (cliente.status === "arquivado") {
    return falha("conflito", "Este cliente está arquivado — não é possível enviar a cobrança ao Asaas.");
  }

  let asaasCustomerId = cliente.asaas_customer_id;
  if (!asaasCustomerId) {
    // Reaproveita a Fase 4 em vez de duplicar a lógica de sincronização de cliente.
    const { sincronizarClienteFinanceiro } = await import("./cliente-financeiro");
    const syncCliente = await sincronizarClienteFinanceiro(cliente.id, empresaId, usuarioId);
    if (!syncCliente.ok) {
      return falha(
        "integracao_externa",
        "Não foi possível sincronizar o cliente desta cobrança com o Asaas.",
        syncCliente.erro.mensagem
      );
    }
    asaasCustomerId = syncCliente.dado.asaasCustomerId;
  }

  // Compare-and-swap: só avança se ninguém mais estiver sincronizando esta
  // cobrança agora — OU se a última tentativa travou em 'sincronizando' há
  // mais que o TTL (processo interrompido, Fase 10 — ver docstring acima).
  const limiteTravaExpirada = new Date(Date.now() - (opcoes.ttlTravaMs ?? TTL_TRAVA_MS)).toISOString();
  const { data: travado, error: erroCas } = await admin
    .from("cobrancas")
    .update({ asaas_sync_status: "sincronizando" })
    .eq("id", cobrancaId)
    .eq("empresa_id", empresaId)
    .is("asaas_payment_id", null)
    .or(`asaas_sync_status.in.(pendente,erro),and(asaas_sync_status.eq.sincronizando,atualizado_em.lt.${limiteTravaExpirada})`)
    .select("id")
    .maybeSingle();

  if (erroCas) return falha("infraestrutura", undefined, erroCas.message);

  if (!travado) {
    const atual = await buscarCobranca(cobrancaId, empresaId);
    if (atual?.asaas_payment_id) {
      return ok({ cobrancaId, asaasPaymentId: atual.asaas_payment_id, jaExistia: true });
    }
    return falha("conflito", "Esta cobrança já está sendo enviada ao Asaas. Aguarde um instante.");
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_sincronizacao_iniciada", cobrancaId);

  // Resposta perdida: antes de criar, verifica se uma tentativa anterior já criou este payment.
  const busca = await buscador(cobrancaId, credencial);
  if (busca.ok) {
    const existente = busca.data.data.find((p) => p.externalReference === cobrancaId);
    if (existente) {
      await admin
        .from("cobrancas")
        .update({ asaas_payment_id: existente.id, asaas_sync_status: "sincronizado" })
        .eq("id", cobrancaId);
      await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_sincronizacao_recuperada", existente.id);
      return ok({ cobrancaId, asaasPaymentId: existente.id, jaExistia: true });
    }
  }

  /* Forma de pagamento: a cobrança Pix Automático é SEMPRE Pix (a
     autorização é Pix). Nas demais, "cliente escolhe" vira UNDEFINED
     (Pix, boleto ou cartão numa fatura hospedada pelo Asaas — o Zelo nunca
     toca em dado de cartão) e só aí multa/juros seguem no payload, porque o
     Asaas só os aplica a boleto. Tudo vem do BANCO, nunca do navegador. */
  const forma = ehFormaPagamento(cobranca.forma_pagamento) ? cobranca.forma_pagamento : "pix";
  const pagamento = opcoes.pixAutomaticAuthorizationId
    ? ({ billingType: "PIX", encargos: { multaPct: null, jurosPctMes: null } } as const)
    : planoDePagamento(
        forma,
        { multaPct: Number(cobranca.multa_pct) || null, jurosPctMes: Number(cobranca.juros_pct_mes) || null },
        cobranca.valor_centavos
      );

  const resultado = await criador(
    {
      customer: asaasCustomerId,
      billingType: pagamento.billingType,
      valorCentavos: cobranca.valor_centavos,
      dueDate: cobranca.vence_em,
      description: cobranca.descricao,
      externalReference: cobrancaId,
      pixAutomaticAuthorizationId: opcoes.pixAutomaticAuthorizationId ?? undefined,
      multaPct: pagamento.encargos.multaPct,
      jurosPctMes: pagamento.encargos.jurosPctMes,
    },
    credencial
  );

  if (!resultado.ok) {
    // Destrava — a próxima tentativa não fica presa em 'sincronizando'.
    await admin.from("cobrancas").update({ asaas_sync_status: "erro" }).eq("id", cobrancaId);
    await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_sincronizacao_falhou", cobrancaId);
    // Chave por dia: uma sequência de retries no mesmo dia (comum — o
    // usuário clica "tentar de novo" várias vezes) não vira uma
    // notificação por tentativa, mas uma falha nova amanhã ainda avisa.
    await criarNotificacao(
      empresaId,
      "integracao_problema",
      "Falha ao enviar cobrança ao Asaas",
      `"${cobranca.descricao}" não pôde ser enviada ao Asaas. Você pode tentar de novo na ficha da cobrança.`,
      "media",
      `/app/cobrancas/${cobrancaId}`,
      `cobranca_sync_erro:${cobrancaId}:${new Date().toISOString().slice(0, 10)}`
    );
    return falha(
      "integracao_externa",
      "Não foi possível enviar esta cobrança ao Asaas agora. Tente novamente.",
      resultado.erro
    );
  }

  const { error: erroSync } = await admin
    .from("cobrancas")
    .update({ asaas_payment_id: resultado.data.id, asaas_sync_status: "sincronizado" })
    .eq("id", cobrancaId);

  if (erroSync) {
    // O payment FOI criado no Asaas — isto é só o espelhamento local
    // falhando. Não tenta de novo automaticamente (duplicaria no Asaas);
    // a próxima sincronização recupera via busca por externalReference.
    await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_sync_parcial_falhou", resultado.data.id);
    return falha("infraestrutura", undefined, erroSync.message);
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_sincronizacao_concluida", resultado.data.id);
  return ok({ cobrancaId, asaasPaymentId: resultado.data.id, jaExistia: false });
}

/**
 * Cancela a cobrança no Asaas quando ela já foi enviada para lá, e só
 * então marca o estado local. Nunca declara "cancelada" localmente
 * enquanto o Asaas ainda considera o payment ativo — mostrar isso ao
 * usuário seria mentir sobre o que vai acontecer com o cliente dele.
 *
 * Idempotente: o Asaas trata `DELETE` num payment já removido como
 * sucesso (`deleted: true`), então uma segunda tentativa (retry) não
 * falha.
 */
export async function cancelarCobrancaFinanceira(
  cobrancaId: string,
  empresaId: string,
  usuarioId: string | null = null,
  cancelador: CanceladorDeCobrancaAsaas = cancelarCobrancaAsaas
): Promise<ResultadoDominio<{ cobrancaId: string }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");

  const admin = supabaseAdmin();
  const cobranca = await buscarCobranca(cobrancaId, empresaId);
  if (!cobranca) return falha("nao_encontrado", "Cobrança não encontrada.");

  if (cobranca.status !== "pendente" && cobranca.status !== "enviada") {
    return falha("conflito", "Esta cobrança não pode mais ser cancelada.");
  }

  if (cobranca.asaas_payment_id) {
    const credencial = await credencialDaEmpresa(empresaId);
    if (!credencial) {
      // Existe payment no Asaas mas não temos mais a credencial — não é
      // seguro fingir que cancelamos algo que ainda pode estar ativo lá.
      return falha("integracao_externa", "Não foi possível confirmar o cancelamento no Asaas agora.");
    }

    const resultado = await cancelador(cobranca.asaas_payment_id, credencial);
    // status 404 = já não existe mais no Asaas — equivalente a já cancelado, retry seguro.
    if (!resultado.ok && resultado.status !== 404) {
      await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_cancelamento_falhou", cobranca.asaas_payment_id);
      return falha(
        "integracao_externa",
        "Não foi possível cancelar esta cobrança no Asaas agora. Tente novamente.",
        resultado.erro
      );
    }
    await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_cancelada_no_asaas", cobranca.asaas_payment_id);
  }

  const { error } = await admin
    .from("cobrancas")
    .update({ status: "cancelada" })
    .eq("id", cobrancaId)
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "enviada"]);

  if (error) return falha("infraestrutura", undefined, error.message);

  await registrarAcaoFinanceira(empresaId, usuarioId, "cobranca_cancelada", cobrancaId);
  return ok({ cobrancaId });
}

/**
 * Reconciliação por consulta ativa (Fase 9) — completa a última entidade
 * financeira que ainda só reconciliava por webhook (autorização, Fase 6;
 * instrução, Fase 7; conta, Fase 3). Complementa o push: quando um
 * webhook se perde (endpoint fora do ar, erro de rede), esta é a única
 * forma de descobrir que o Asaas já confirmou/estornou/removeu um
 * pagamento que o Zelo ainda acha `pendente`/`paga`.
 *
 * Deliberadamente conservadora: só aplica as MESMAS transições que o
 * webhook já aplicaria (`lib/asaas/webhook.ts`), gated pelo status LOCAL
 * atual — nunca "força" um estado que não faz sentido pra onde a
 * cobrança está agora. Uma divergência fora dessas transições conhecidas
 * (ex.: Asaas diz PENDING mas local está `paga`) não é uma que a
 * reconciliação deveria corrigir sozinha — fica sinalizada como
 * `conflito` para investigação humana, nunca revertida às cegas.
 */
export async function sincronizarStatusCobranca(
  cobrancaId: string,
  empresaId: string,
  consultor: ConsultadorDeCobrancaAsaas = obterCobrancaAsaas
): Promise<ResultadoDominio<{ status: string }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const cobranca = await buscarCobranca(cobrancaId, empresaId);
  if (!cobranca) return falha("nao_encontrado", "Cobrança não encontrada.");
  if (!cobranca.asaas_payment_id) {
    return falha("conflito", "Esta cobrança ainda não foi enviada ao Asaas.");
  }

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) return falha("integracao_externa", "Conta financeira não conectada.");

  const resposta = await consultor(cobranca.asaas_payment_id, credencial);
  if (!resposta.ok) {
    return falha("integracao_externa", "Não foi possível consultar esta cobrança no Asaas agora.", resposta.erro);
  }

  const remoto = resposta.data;
  const valorCentavos = Math.round(remoto.value * 100);
  const dataPagamento = remoto.paymentDate ? new Date(remoto.paymentDate).toISOString() : new Date().toISOString();

  if ((remoto.status === "RECEIVED" || remoto.status === "CONFIRMED") && cobranca.status === "pendente") {
    const { error } = await admin
      .from("cobrancas")
      .update({ status: "paga", pago_em: dataPagamento, valor_pago_centavos: valorCentavos, pago_via: "asaas" })
      .eq("id", cobrancaId)
      .eq("status", "pendente");
    if (error) return falha("infraestrutura", undefined, error.message);
    await registrarAcaoFinanceira(empresaId, null, "cobranca_reconciliada_paga", cobrancaId);

    /* Mesma lógica de `lib/asaas/webhook.ts` pro evento PAYMENT_RECEIVED/
       CONFIRMED (Fase 7): se esta cobrança tem uma instrução Pix
       Automático vinculada, registra o pagamento também aqui — senão um
       webhook perdido reconciliaria o status da cobrança mas deixaria
       `pagamentos` (a trilha de valor líquido/taxa) permanentemente sem
       essa linha, mesmo depois da reconciliação "corrigir" tudo. */
    const { data: instrucaoLigada } = await admin
      .from("instrucoes_pagamento")
      .select("id")
      .eq("asaas_payment_id", cobranca.asaas_payment_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (instrucaoLigada) {
      const liquidoCentavos = remoto.netValue != null ? Math.round(remoto.netValue * 100) : valorCentavos;
      const { error: erroPag } = await admin.from("pagamentos").insert({
        empresa_id: empresaId,
        instrucao_id: instrucaoLigada.id,
        asaas_payment_id: cobranca.asaas_payment_id,
        valor_liquido_centavos: liquidoCentavos,
        taxa_centavos: Math.max(0, valorCentavos - liquidoCentavos),
        liquidado_em: dataPagamento,
      });
      // 23505 = já registrado (webhook chegou antes, ou reconciliação repetida) — idempotente, não é falha.
      if (erroPag && erroPag.code !== "23505") {
        return falha("infraestrutura", undefined, erroPag.message);
      }
    }

    return ok({ status: "paga" });
  }

  if (remoto.status === "REFUNDED" && cobranca.status === "paga") {
    const somaEstornada = (remoto.refunds ?? []).reduce((soma, r) => soma + Math.round(r.value * 100), 0);
    const valorEstornadoCentavos = somaEstornada > 0 ? somaEstornada : valorCentavos;
    const { error } = await admin
      .from("cobrancas")
      .update({ status: "estornada", valor_estornado_centavos: valorEstornadoCentavos, estornado_em: new Date().toISOString() })
      .eq("id", cobrancaId)
      .eq("status", "paga");
    if (error) return falha("infraestrutura", undefined, error.message);
    await registrarAcaoFinanceira(empresaId, null, "cobranca_reconciliada_estornada", cobrancaId);
    return ok({ status: "estornada" });
  }

  if (remoto.deleted && (cobranca.status === "pendente" || cobranca.status === "enviada")) {
    const { error } = await admin
      .from("cobrancas")
      .update({ status: "cancelada" })
      .eq("id", cobrancaId)
      .in("status", ["pendente", "enviada"]);
    if (error) return falha("infraestrutura", undefined, error.message);
    await registrarAcaoFinanceira(empresaId, null, "cobranca_reconciliada_cancelada", cobrancaId);
    return ok({ status: "cancelada" });
  }

  // Já bate, ou é uma divergência que a reconciliação não sabe corrigir sozinha.
  return ok({ status: cobranca.status });
}
