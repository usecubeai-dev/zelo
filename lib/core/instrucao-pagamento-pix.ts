/**
 * Caso de uso: gerar o ciclo financeiro de uma recorrência com Pix
 * Automático ativo — cobrança → payment com `pixAutomaticAuthorizationId`
 * → descoberta da instrução gerada pelo Asaas.
 *
 * ⚠ SERVIDOR APENAS. Server Actions chamam isto, nunca
 * `lib/asaas/instrucao-pagamento.ts` direto.
 *
 * ────────────────────────────────────────────────────────────────────
 * NÃO EXISTE ENDPOINT DE CRIAÇÃO DE INSTRUÇÃO
 * ────────────────────────────────────────────────────────────────────
 * Confirmado em docs.asaas.com (Fase 7, 01/09/2026): a instrução nasce
 * automaticamente quando o Zelo cria o `payment` com
 * `pixAutomaticAuthorizationId` (paymentCreationMode MANUAL, decidido
 * na Fase 6). Este arquivo não CRIA instrução — ele cria a COBRANÇA
 * (reaproveitando `sincronizarCobrancaFinanceira` da Fase 5) e depois
 * DESCOBRE a instrução que o Asaas gerou, por `paymentId` (a correlação
 * mais direta que existe — nunca por valor/nome/data isolada).
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { credencialDaEmpresa } from "../asaas/credenciais";
import { listarInstrucoesPagamentoAsaas, consultarInstrucaoPagamentoAsaas } from "../asaas/instrucao-pagamento";
import { sincronizarCobrancaFinanceira, CriadorDeCobrancaAsaas, BuscadorDeCobrancaAsaas } from "./cobranca-financeira";
import { calcularPrimeiroVencimento, calcularProximoVencimento } from "../recorrencia";
import { hojeISO } from "../cobranca";
import {
  StatusInstrucao,
  transicaoValida as transicaoInstrucaoValida,
  origemPermitida as origemInstrucaoPermitida,
  janelaDeEnvio,
  diasUteisAte,
} from "./instrucao-pagamento";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira } from "./auditoria";

export type ListadorDeInstrucoesAsaas = typeof listarInstrucoesPagamentoAsaas;
export type ConsultadorDeInstrucaoAsaas = typeof consultarInstrucaoPagamentoAsaas;

export type PreparacaoCiclo =
  | { status: "aguardando_janela"; diasUteisAteVencimento: number; vencimento: string }
  | { status: "cobranca_ja_existia"; cobrancaId: string }
  | { status: "ciclo_preparado"; cobrancaId: string; asaasPaymentId: string; instrucaoId: string | null };

type LinhaRecorrencia = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  descricao: string;
  valor_centavos: number;
  dia_vencimento: number;
  inicia_em: string;
  status: string;
  autorizacao_atual_id: string | null;
};

type DecisaoCiclo =
  | { tipo: "retomar"; cobrancaId: string; vencimento: string }
  | { tipo: "novo"; vencimento: string };

/**
 * Decide se prepara um ciclo NOVO ou retoma o mais recente que ainda não
 * foi sincronizado — numa ÚNICA leitura, de propósito (Fase 10).
 *
 * Achado sob stress de concorrência REAL (8 chamadas simultâneas, não
 * só retry sequencial — esse já tinha sido corrigido na Fase 7): antes,
 * a checagem de "existe pendente?" e o cálculo do próximo vencimento
 * eram DUAS consultas separadas. Entre uma e outra, uma chamada
 * concorrente podia inserir a linha do ciclo atual (ainda sem
 * `asaas_payment_id`) — a checagem de "pendente" desta chamada já tinha
 * rodado e não viu nada, mas o cálculo de vencimento (que não filtrava
 * por status de sincronização) via essa linha recém-criada e avançava
 * pro MÊS SEGUINTE, achando que o ciclo atual já tinha sido tratado.
 * Ler uma vez só e decidir a partir da MESMA linha fecha essa janela:
 * ou não existe nada (ciclo novo, primeiro vencimento), ou a última
 * cobrança ainda não foi sincronizada (retoma ELA, nunca recalcula), ou
 * já foi sincronizada (aí sim é seguro avançar pro próximo vencimento).
 */
async function decidirProximoCiclo(admin: ReturnType<typeof supabaseAdmin>, rec: LinhaRecorrencia): Promise<DecisaoCiclo> {
  const { data: ultima } = await admin
    .from("cobrancas")
    .select("id, vence_em, asaas_payment_id")
    .eq("recorrencia_id", rec.id)
    .eq("empresa_id", rec.empresa_id)
    .order("vence_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultima) {
    return { tipo: "novo", vencimento: calcularPrimeiroVencimento(rec.inicia_em, rec.dia_vencimento) };
  }
  if (!ultima.asaas_payment_id) {
    return { tipo: "retomar", cobrancaId: ultima.id, vencimento: ultima.vence_em };
  }
  return { tipo: "novo", vencimento: calcularProximoVencimento(ultima.vence_em, rec.dia_vencimento) };
}

/**
 * Descobre a instrução gerada pelo Asaas pro `paymentId` informado, e
 * persiste localmente. Se ainda não existir do lado do Asaas (pequeno
 * atraso de propagação é esperado), grava um placeholder `AWAITING_REQUEST`
 * sem `asaas_instruction_id` — o webhook ou uma reconciliação posterior
 * completa.
 */
async function descobrirInstrucao(
  admin: ReturnType<typeof supabaseAdmin>,
  dados: { empresaId: string; cobrancaId: string; autorizacaoId: string; asaasPaymentId: string; vencimento: string },
  credencial: Awaited<ReturnType<typeof credencialDaEmpresa>>,
  listador: ListadorDeInstrucoesAsaas
): Promise<string | null> {
  let encontrada: { id: string; status: StatusInstrucao; dueDate: string; refusalReason?: string | null } | null = null;

  if (credencial) {
    const resposta = await listador({ paymentId: dados.asaasPaymentId }, credencial);
    if (resposta.ok && resposta.data.data[0]) {
      const i = resposta.data.data[0];
      encontrada = { id: i.id, status: i.status, dueDate: i.dueDate, refusalReason: i.refusalReason };
    }
  }

  const { data: linha, error } = await admin
    .from("instrucoes_pagamento")
    .insert({
      empresa_id: dados.empresaId,
      cobranca_id: dados.cobrancaId,
      autorizacao_id: dados.autorizacaoId,
      asaas_payment_id: dados.asaasPaymentId,
      asaas_instruction_id: encontrada?.id ?? null,
      status: encontrada?.status ?? "AWAITING_REQUEST",
      due_date: encontrada?.dueDate ?? dados.vencimento,
      refusal_reason: encontrada?.refusalReason ?? null,
      sincronizado_em: encontrada ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 no índice de uma instrução viva por cobrança: outra chamada já criou. Não é erro de verdade.
    if (error.code === "23505") {
      const { data: existente } = await admin
        .from("instrucoes_pagamento")
        .select("id")
        .eq("cobranca_id", dados.cobrancaId)
        .maybeSingle();
      return existente?.id ?? null;
    }
    return null;
  }

  await registrarAcaoFinanceira(dados.empresaId, null, "instrucao_pagamento_descoberta", linha.id);
  return linha.id as string;
}

/**
 * Prepara o próximo ciclo de uma recorrência com Pix Automático ativo:
 * calcula o vencimento, respeita a janela operacional (2–10 dias úteis),
 * cria a cobrança (idempotente pela chave `(recorrencia_id, vence_em)`),
 * envia ao Asaas com `pixAutomaticAuthorizationId`, e descobre a
 * instrução resultante.
 */
export async function prepararCicloPixAutomatico(
  recorrenciaId: string,
  empresaId: string,
  usuarioId: string | null = null,
  criadorCobranca?: CriadorDeCobrancaAsaas,
  buscadorCobranca?: BuscadorDeCobrancaAsaas,
  listadorInstrucao: ListadorDeInstrucoesAsaas = listarInstrucoesPagamentoAsaas
): Promise<ResultadoDominio<PreparacaoCiclo>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const { data: recRow } = await admin
    .from("recorrencias")
    .select("id, empresa_id, cliente_id, descricao, valor_centavos, dia_vencimento, inicia_em, status, autorizacao_atual_id")
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const rec = recRow as LinhaRecorrencia | null;

  if (!rec) return falha("nao_encontrado", "Recorrência não encontrada.");
  if (rec.status !== "ativa") return falha("conflito", "Recorrência não está ativa.");
  if (!rec.autorizacao_atual_id) {
    return falha("conflito", "Esta recorrência ainda não tem autorização Pix Automático.");
  }

  const { data: autorizacao } = await admin
    .from("autorizacoes_pix")
    .select("id, status, asaas_authorization_id")
    .eq("id", rec.autorizacao_atual_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!autorizacao) return falha("infraestrutura", undefined, "Autorização vinculada não encontrada.");
  if (autorizacao.status !== "ACTIVE") {
    return falha("conflito", "A autorização Pix Automático ainda não está ativa.");
  }
  if (!autorizacao.asaas_authorization_id) {
    return falha("infraestrutura", undefined, "Autorização sem id externo.");
  }

  /* Retry (sequencial OU concorrente, Fase 10): se a cobrança mais
     recente desta recorrência ainda não foi enviada ao Asaas
     (`asaas_payment_id` nulo), RETOMA ela em vez de calcular um novo
     próximo ciclo — ver `decidirProximoCiclo` acima pro porquê de ser
     uma leitura só. A janela já foi validada quando essa linha foi
     criada, não é revalidada aqui de propósito: "ainda não foi enviada"
     é a única condição adicional que a fase pede pra um retry. */
  const decisao = await decidirProximoCiclo(admin, rec);

  let cobrancaId: string;
  let vencimento: string;

  if (decisao.tipo === "retomar") {
    cobrancaId = decisao.cobrancaId;
    vencimento = decisao.vencimento;
  } else {
    vencimento = decisao.vencimento;
    const hoje = hojeISO();
    const janela = janelaDeEnvio(hoje, vencimento);

    if (!janela.dentro) {
      return ok({ status: "aguardando_janela", diasUteisAteVencimento: diasUteisAte(hoje, vencimento), vencimento });
    }

    // Idempotência: tenta inserir; se já existe cobrança pra este ciclo (índice único), reaproveita.
    const { data: novaCob, error: erroInsert } = await admin
      .from("cobrancas")
      .insert({
        empresa_id: empresaId,
        cliente_id: rec.cliente_id,
        recorrencia_id: recorrenciaId,
        descricao: rec.descricao,
        valor_centavos: rec.valor_centavos,
        vence_em: vencimento,
        status: "pendente",
      })
      .select("id")
      .single();

    if (erroInsert) {
      if (erroInsert.code !== "23505") return falha("infraestrutura", undefined, erroInsert.message);
      const { data: existente } = await admin
        .from("cobrancas")
        .select("id, asaas_payment_id")
        .eq("recorrencia_id", recorrenciaId)
        .eq("vence_em", vencimento)
        .maybeSingle();
      if (!existente) return falha("infraestrutura", undefined, "conflito de ciclo sem linha correspondente");
      if (existente.asaas_payment_id) {
        return ok({ status: "cobranca_ja_existia", cobrancaId: existente.id });
      }
      cobrancaId = existente.id;
    } else {
      cobrancaId = novaCob.id as string;
      await registrarAcaoFinanceira(empresaId, usuarioId, "ciclo_pix_automatico_preparado", cobrancaId);
    }
  }

  const sync = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, usuarioId, criadorCobranca, buscadorCobranca, {
    pixAutomaticAuthorizationId: autorizacao.asaas_authorization_id,
  });

  if (!sync.ok) return sync;

  const credencial = await credencialDaEmpresa(empresaId);
  const instrucaoId = await descobrirInstrucao(
    admin,
    {
      empresaId,
      cobrancaId,
      autorizacaoId: autorizacao.id,
      asaasPaymentId: sync.dado.asaasPaymentId,
      vencimento,
    },
    credencial,
    listadorInstrucao
  );

  return ok({ status: "ciclo_preparado", cobrancaId, asaasPaymentId: sync.dado.asaasPaymentId, instrucaoId });
}

/**
 * Consulta ativa no Asaas — complementa o webhook. Se a instrução ainda
 * não tinha `asaas_instruction_id` (descoberta pendente), tenta
 * descobrir de novo por `paymentId` antes de desistir.
 */
export async function sincronizarStatusInstrucao(
  instrucaoId: string,
  empresaId: string,
  consultor: ConsultadorDeInstrucaoAsaas = consultarInstrucaoPagamentoAsaas,
  listador: ListadorDeInstrucoesAsaas = listarInstrucoesPagamentoAsaas
): Promise<ResultadoDominio<{ status: StatusInstrucao }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const { data: linha } = await admin
    .from("instrucoes_pagamento")
    .select("id, status, asaas_instruction_id, asaas_payment_id")
    .eq("id", instrucaoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!linha) return falha("nao_encontrado", "Instrução não encontrada.");

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) return falha("integracao_externa", "Conta financeira não conectada.");

  let statusRemoto: StatusInstrucao;
  let refusalReason: string | null | undefined;
  let asaasInstructionId = linha.asaas_instruction_id as string | null;

  if (asaasInstructionId) {
    const resposta = await consultor(asaasInstructionId, credencial);
    if (!resposta.ok) return falha("integracao_externa", "Não foi possível consultar a instrução no Asaas agora.", resposta.erro);
    statusRemoto = resposta.data.status;
    refusalReason = resposta.data.refusalReason;
  } else if (linha.asaas_payment_id) {
    const resposta = await listador({ paymentId: linha.asaas_payment_id }, credencial);
    if (!resposta.ok || !resposta.data.data[0]) {
      return falha("integracao_externa", "A instrução ainda não foi encontrada no Asaas.");
    }
    const i = resposta.data.data[0];
    statusRemoto = i.status;
    refusalReason = i.refusalReason;
    asaasInstructionId = i.id;
  } else {
    return falha("infraestrutura", undefined, "Instrução sem payment_id — dado incompleto.");
  }

  if (statusRemoto === linha.status && asaasInstructionId === linha.asaas_instruction_id) {
    return ok({ status: statusRemoto });
  }

  if (
    statusRemoto !== linha.status &&
    (!transicaoInstrucaoValida(linha.status as StatusInstrucao, statusRemoto) || !origemInstrucaoPermitida(statusRemoto, "reconciliacao"))
  ) {
    return falha("conflito", "Estado da instrução não pôde ser reconciliado automaticamente.");
  }

  await admin
    .from("instrucoes_pagamento")
    .update({
      status: statusRemoto,
      asaas_instruction_id: asaasInstructionId,
      refusal_reason: refusalReason ?? null,
      sincronizado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", instrucaoId);

  await registrarAcaoFinanceira(empresaId, null, `instrucao_reconciliada_${statusRemoto.toLowerCase()}`, instrucaoId);
  return ok({ status: statusRemoto });
}
