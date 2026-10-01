/**
 * Caso de uso: autorização Pix Automático — o CONSENTIMENTO do pagador
 * para cobranças recorrentes futuras, distinto da cobrança em si.
 *
 * ⚠ SERVIDOR APENAS. Server Actions chamam isto, nunca
 * `lib/asaas/autorizacao-pix.ts` direto.
 *
 * ────────────────────────────────────────────────────────────────────
 * DECISÃO: paymentCreationMode = MANUAL (não SUBSCRIPTION)
 * ────────────────────────────────────────────────────────────────────
 * Confirmado em docs.asaas.com/docs/pix-automatico-implementacao
 * (01/09/2026): em MANUAL, "sua aplicação cria cada cobrança recorrente
 * pela API"; em SUBSCRIPTION, "as cobranças são geradas automaticamente
 * por uma assinatura" e o Zelo NÃO deveria criar cobrança nenhuma.
 *
 * A Zelo já tem motor de recorrência próprio (`gerarProximoCiclo()`,
 * `lib/core/cobranca-financeira.ts` da Fase 5) que cria cada `cobranca`
 * e o `payment` correspondente. SUBSCRIPTION duplicaria esse controle —
 * dois sistemas gerando cobrança pro mesmo ciclo — e tiraria da Zelo
 * exatamente o que ela precisa manter: pausar/reativar/editar valor por
 * recorrência, reconciliar contra o próprio banco, e não depender de um
 * scheduler que não é nosso. MANUAL é literalmente o que já construímos
 * nas Fases 4–5, então esta fase só PRECISA ligar a autorização a esse
 * fluxo existente — não inventar um segundo.
 *
 * ────────────────────────────────────────────────────────────────────
 * IDEMPOTÊNCIA
 * ────────────────────────────────────────────────────────────────────
 * Diferente das Fases 4–5 (CAS por UPDATE numa linha já existente):
 * aqui não existe linha de `autorizacoes_pix` antes da chamada ao
 * Asaas. O lock pré-chamada vive em `recorrencias.autorizacao_solicitada_em`
 * (TTL de 2min, `fase12_autorizacao_pix_lock_e_grants`) — só depois de
 * reservar esse lock é que o Asaas é chamado. Antes de criar, SEMPRE
 * busca no Asaas por uma autorização com o mesmo `contractId` (resposta
 * perdida / retry após timeout) — nunca cria cegamente. Depois de criar,
 * o índice único parcial `autorizacoes_pix_uma_viva_por_recorrencia`
 * (banco) é a rede de segurança final contra duas linhas vivas pra
 * mesma recorrência.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { credencialDaEmpresa } from "../asaas/credenciais";
import {
  criarAutorizacaoPixAsaas,
  consultarAutorizacaoPixAsaas,
  cancelarAutorizacaoPixAsaas,
  listarAutorizacoesPixAsaas,
  contractIdDaRecorrencia,
  CriarAutorizacaoPixDados,
} from "../asaas/autorizacao-pix";
import { obterContaFinanceira } from "./onboarding";
import { prontaParaCobrar } from "./conta-financeira";
import { obterElegibilidadePix } from "./elegibilidade-pix";
import { podeSolicitarPixAutomatico } from "./metodo-cobranca";
import { sincronizarClienteFinanceiro } from "./cliente-financeiro";
import { StatusAutorizacao, estaViva, transicaoValida, origemPermitida } from "./autorizacao";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira } from "./auditoria";
import { hojeISO } from "../cobranca";

/** Injetáveis só para teste — em produção são sempre as funções reais de `lib/asaas/autorizacao-pix.ts`. */
export type CriadorDeAutorizacaoPix = typeof criarAutorizacaoPixAsaas;
export type ListadorDeAutorizacoesPix = typeof listarAutorizacoesPixAsaas;
export type ConsultadorDeAutorizacaoPix = typeof consultarAutorizacaoPixAsaas;
export type CanceladorDeAutorizacaoPix = typeof cancelarAutorizacaoPixAsaas;

const TTL_LOCK_MS = 2 * 60 * 1000;
/** Sem prazo natural de fim vindo do produto — 5 anos é um horizonte longo, renovável recriando a autorização se preciso. Decisão explícita, não a API exigindo isso. */
const ANOS_VALIDADE_AUTORIZACAO = 5;
/** Tempo para o pagador concluir o QR combinado (primeiro pagamento + consentimento). */
const EXPIRACAO_QR_SEGUNDOS = 24 * 60 * 60;

export type DadosQrAutorizacao = {
  autorizacaoId: string;
  status: StatusAutorizacao;
  payload: string | null;
  encodedImage: string | null;
  jaExistia: boolean;
};

type LinhaRecorrencia = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  descricao: string;
  valor_centavos: number;
  periodicidade: string;
  status: string;
  autorizacao_atual_id: string | null;
  autorizacao_solicitada_em: string | null;
};

function frequenciaAsaas(periodicidade: string): "MONTHLY" {
  // Único valor suportado hoje pelo motor de recorrência da Zelo (`lib/recorrencia.ts`, `Periodicidade = "mensal"`).
  if (periodicidade !== "mensal") throw new Error(`periodicidade não suportada: ${periodicidade}`);
  return "MONTHLY";
}

async function buscarRecorrencia(recorrenciaId: string, empresaId: string): Promise<LinhaRecorrencia | null> {
  const { data } = await supabaseAdmin()
    .from("recorrencias")
    .select("id, empresa_id, cliente_id, descricao, valor_centavos, periodicidade, status, autorizacao_atual_id, autorizacao_solicitada_em")
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Solicita a autorização Pix Automático de uma recorrência — cria o
 * objeto no Asaas (com o QR combinado de primeiro pagamento) e persiste
 * localmente. Idempotente: duplo clique, retry e timeout não criam uma
 * segunda autorização.
 */
export async function criarAutorizacaoPix(
  recorrenciaId: string,
  empresaId: string,
  usuarioId: string | null = null,
  criador: CriadorDeAutorizacaoPix = criarAutorizacaoPixAsaas,
  listador: ListadorDeAutorizacoesPix = listarAutorizacoesPixAsaas
): Promise<ResultadoDominio<DadosQrAutorizacao>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const recorrencia = await buscarRecorrencia(recorrenciaId, empresaId);
  if (!recorrencia) return falha("nao_encontrado", "Recorrência não encontrada.");
  if (recorrencia.status !== "ativa") {
    return falha("conflito", "Só é possível autorizar Pix Automático para uma recorrência ativa.");
  }
  if (recorrencia.autorizacao_atual_id) {
    return falha("conflito", "Esta recorrência já tem uma autorização em andamento ou ativa.");
  }

  const conta = await obterContaFinanceira(empresaId);
  if (!conta || !prontaParaCobrar(conta)) {
    return falha(
      "integracao_externa",
      "Sua conta financeira precisa estar totalmente aprovada pelo Asaas antes de habilitar Pix Automático."
    );
  }

  /* Fase 21: só bloqueia quando o Asaas já confirmou INELIGIBLE — UNKNOWN
     (nunca sincronizado) e PENDING não impedem a tentativa, porque
     ausência de sinal não é evidência de inelegibilidade. Mensagem
     honesta, sem jargão técnico nem menção ao Asaas (regra da Fase 21,
     "UX do fallback") — direciona para o caminho que continua
     funcionando (Pix comum), nunca deixa o profissional sem saída. */
  const elegibilidade = await obterElegibilidadePix(empresaId);
  if (!podeSolicitarPixAutomatico(elegibilidade.status)) {
    return falha(
      "conflito",
      "Seu Pix Automático não está disponível no momento. Você ainda pode continuar cobrando seus clientes usando Pix comum, com lembretes automáticos."
    );
  }

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) {
    return falha("integracao_externa", "Conecte sua conta financeira antes de solicitar Pix Automático.");
  }

  const { data: clienteRow } = await admin
    .from("clientes")
    .select("id, status, asaas_customer_id")
    .eq("id", recorrencia.cliente_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!clienteRow) return falha("nao_encontrado", "Cliente desta recorrência não encontrado.");
  if (clienteRow.status === "arquivado") {
    return falha("conflito", "Este cliente está arquivado — não é possível solicitar autorização.");
  }

  let asaasCustomerId = clienteRow.asaas_customer_id as string | null;
  if (!asaasCustomerId) {
    const syncCliente = await sincronizarClienteFinanceiro(clienteRow.id, empresaId, usuarioId);
    if (!syncCliente.ok) {
      return falha(
        "integracao_externa",
        "Não foi possível sincronizar o cliente desta recorrência com o Asaas.",
        syncCliente.erro.mensagem
      );
    }
    asaasCustomerId = syncCliente.dado.asaasCustomerId;
  }

  // Lock com TTL: só avança se ninguém mais estiver no meio da mesma solicitação.
  const agora = new Date();
  const limiteExpirado = new Date(agora.getTime() - TTL_LOCK_MS).toISOString();
  const { data: travado, error: erroCas } = await admin
    .from("recorrencias")
    .update({ autorizacao_solicitada_em: agora.toISOString() })
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .is("autorizacao_atual_id", null)
    .or(`autorizacao_solicitada_em.is.null,autorizacao_solicitada_em.lt.${limiteExpirado}`)
    .select("id")
    .maybeSingle();

  if (erroCas) return falha("infraestrutura", undefined, erroCas.message);
  if (!travado) {
    const atual = await buscarRecorrencia(recorrenciaId, empresaId);
    if (atual?.autorizacao_atual_id) {
      // Alguém já concluiu enquanto esperávamos — relê e devolve o que existe.
      const { data: viva } = await admin
        .from("autorizacoes_pix")
        .select("id, status")
        .eq("id", atual.autorizacao_atual_id)
        .maybeSingle();
      if (viva) {
        return ok({ autorizacaoId: viva.id, status: viva.status as StatusAutorizacao, payload: null, encodedImage: null, jaExistia: true });
      }
    }
    return falha("conflito", "Já existe uma solicitação de autorização em andamento para esta recorrência. Aguarde um instante.");
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_solicitada", recorrenciaId);

  const contractId = contractIdDaRecorrencia(recorrenciaId);
  const descricao = recorrencia.descricao.slice(0, 35);
  const inicio = hojeISO();
  const fim = new Date(agora);
  fim.setFullYear(fim.getFullYear() + ANOS_VALIDADE_AUTORIZACAO);
  const finishDate = fim.toISOString().slice(0, 10);

  // Resposta perdida / retry: busca antes de criar. `contractId` não é
  // filtro de servidor (não suportado pelo Asaas) — filtra em memória
  // sobre os resultados por `customerId`.
  const busca = await listador(asaasCustomerId, credencial);
  if (busca.ok) {
    const existente = busca.data.data.find((a) => a.contractId === contractId && estaViva(a.status));
    if (existente) {
      const inserida = await persistirAutorizacaoLocal(admin, {
        empresaId,
        recorrenciaId,
        clienteId: clienteRow.id,
        asaasAuthorizationId: existente.id,
        asaasSubscriptionId: existente.subscriptionId ?? null,
        status: existente.status,
        finishDate: existente.finishDate ?? finishDate,
        retryPolicy: existente.retryPolicy,
      });
      if (!inserida.ok) return inserida;
      await admin.from("recorrencias").update({ autorizacao_atual_id: inserida.dado, autorizacao_solicitada_em: null }).eq("id", recorrenciaId);
      await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_recuperada", existente.id);

      // Busca os dados de QR completos — a listagem não devolve payload/encodedImage.
      const detalhe = await consultarAutorizacaoPixAsaas(existente.id, credencial);
      return ok({
        autorizacaoId: inserida.dado,
        status: existente.status,
        payload: detalhe.ok ? detalhe.data.payload ?? null : null,
        encodedImage: detalhe.ok ? detalhe.data.encodedImage ?? null : null,
        jaExistia: true,
      });
    }
  }

  const dados: CriarAutorizacaoPixDados = {
    customerId: asaasCustomerId,
    contractId,
    frequency: frequenciaAsaas(recorrencia.periodicidade),
    startDate: inicio,
    finishDate,
    valorCentavos: recorrencia.valor_centavos,
    description: descricao,
    paymentCreationMode: "MANUAL",
    retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
    immediateQrCode: {
      valorOriginalCentavos: recorrencia.valor_centavos,
      expirationSeconds: EXPIRACAO_QR_SEGUNDOS,
      description: descricao,
    },
  };

  const resultado = await criador(dados, credencial);

  if (!resultado.ok) {
    // Destrava — a próxima tentativa não fica presa esperando o TTL.
    await admin.from("recorrencias").update({ autorizacao_solicitada_em: null }).eq("id", recorrenciaId);
    await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_falhou", recorrenciaId);
    return falha(
      "integracao_externa",
      "Não foi possível solicitar a autorização Pix Automático agora. Tente novamente.",
      resultado.erro
    );
  }

  const inserida = await persistirAutorizacaoLocal(admin, {
    empresaId,
    recorrenciaId,
    clienteId: clienteRow.id,
    asaasAuthorizationId: resultado.data.id,
    asaasSubscriptionId: resultado.data.subscriptionId ?? null,
    status: resultado.data.status,
    finishDate: resultado.data.finishDate ?? finishDate,
    retryPolicy: resultado.data.retryPolicy,
  });
  if (!inserida.ok) return inserida;

  const { error: erroLink } = await admin
    .from("recorrencias")
    .update({ autorizacao_atual_id: inserida.dado, autorizacao_solicitada_em: null })
    .eq("id", recorrenciaId);

  if (erroLink) {
    // A autorização FOI criada no Asaas — isto é só o espelhamento local
    // falhando. Não tenta de novo (duplicaria); fica pra reconciliação.
    await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_sync_parcial_falhou", resultado.data.id);
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_criada", resultado.data.id);

  return ok({
    autorizacaoId: inserida.dado,
    status: resultado.data.status,
    payload: resultado.data.payload ?? null,
    encodedImage: resultado.data.encodedImage ?? null,
    jaExistia: false,
  });
}

async function persistirAutorizacaoLocal(
  admin: ReturnType<typeof supabaseAdmin>,
  dados: {
    empresaId: string;
    recorrenciaId: string;
    clienteId: string;
    asaasAuthorizationId: string;
    asaasSubscriptionId: string | null;
    status: StatusAutorizacao;
    finishDate: string;
    retryPolicy: string;
  }
): Promise<ResultadoDominio<string>> {
  const { data, error } = await admin
    .from("autorizacoes_pix")
    .insert({
      empresa_id: dados.empresaId,
      recorrencia_id: dados.recorrenciaId,
      cliente_id: dados.clienteId,
      asaas_authorization_id: dados.asaasAuthorizationId,
      asaas_subscription_id: dados.asaasSubscriptionId,
      status: dados.status,
      finish_date: dados.finishDate,
      retry_policy: dados.retryPolicy,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 no índice único do asaas_authorization_id: outra tentativa já persistiu a mesma autorização (corrida rara na recuperação por resposta perdida).
    if (error.code === "23505") {
      const { data: existente } = await admin
        .from("autorizacoes_pix")
        .select("id")
        .eq("asaas_authorization_id", dados.asaasAuthorizationId)
        .maybeSingle();
      if (existente) return ok(existente.id);
    }
    return falha("infraestrutura", undefined, error.message);
  }

  return ok(data.id as string);
}

/**
 * Consulta ativa no Asaas — complementa o webhook (pull, para quando o
 * push atrasa ou se perde). Não persiste `payload`/`encodedImage`, só o
 * necessário pra decidir estado.
 */
export async function sincronizarStatusAutorizacaoPix(
  autorizacaoId: string,
  empresaId: string,
  consultor: ConsultadorDeAutorizacaoPix = consultarAutorizacaoPixAsaas
): Promise<ResultadoDominio<{ status: StatusAutorizacao }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const { data: linha } = await admin
    .from("autorizacoes_pix")
    .select("id, status, asaas_authorization_id")
    .eq("id", autorizacaoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!linha) return falha("nao_encontrado", "Autorização não encontrada.");
  if (!linha.asaas_authorization_id) return falha("infraestrutura", undefined, "Autorização sem id externo.");

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) return falha("integracao_externa", "Conta financeira não conectada.");

  const resposta = await consultor(linha.asaas_authorization_id, credencial);
  if (!resposta.ok) {
    return falha("integracao_externa", "Não foi possível consultar a autorização no Asaas agora.", resposta.erro);
  }

  const statusRemoto = resposta.data.status;
  if (statusRemoto === linha.status) return ok({ status: statusRemoto });

  if (!transicaoValida(linha.status as StatusAutorizacao, statusRemoto) || !origemPermitida(statusRemoto, "reconciliacao")) {
    return falha("conflito", "Estado da autorização não pôde ser reconciliado automaticamente.");
  }

  const atualizacao: Record<string, unknown> = { status: statusRemoto, atualizado_em: new Date().toISOString() };
  if (statusRemoto === "CANCELLED") {
    atualizacao.cancellation_date = resposta.data.cancellationDate
      ? new Date(resposta.data.cancellationDate).toISOString()
      : new Date().toISOString();
    atualizacao.cancellation_reason = resposta.data.cancellationReason ?? "Cancelado (reconciliação)";
  }

  await admin.from("autorizacoes_pix").update(atualizacao).eq("id", linha.id);
  if (!estaViva(statusRemoto)) {
    await admin.from("recorrencias").update({ autorizacao_atual_id: null }).eq("autorizacao_atual_id", linha.id);
  }
  await registrarAcaoFinanceira(empresaId, null, `autorizacao_pix_reconciliada_${statusRemoto.toLowerCase()}`, linha.id);

  return ok({ status: statusRemoto });
}

/**
 * Cancela a autorização — nunca confundir com cancelar cobrança
 * (`cancelarCobrancaFinanceira`, Fase 5) ou encerrar recorrência
 * (`encerrarRecorrenciaFinanceira`, Fase 8). Cancelar a autorização
 * revoga o CONSENTIMENTO (a recorrência pode pedir uma nova depois,
 * como um evento comercial independente); cancelar uma cobrança afeta
 * só aquele ciclo. Encerrar a recorrência USA esta função como uma das
 * suas etapas — desde a Fase 8, encerrar não é mais silencioso pro
 * Asaas: revoga o consentimento vivo (se houver) antes de marcar
 * `encerrada`, senão o pagador fica exposto a um consentimento que a
 * Zelo já considera morto. Ver `lib/core/recorrencia-financeira.ts`.
 *
 * CONCORRÊNCIA (Fase 10): duas chamadas simultâneas (duplo clique, ou
 * `encerrarRecorrenciaFinanceira` chamado duas vezes) podem ambas ler a
 * autorização como viva e ambas chamarem o Asaas — inofensivo (DELETE é
 * idempotente lá, 404 já é tratado como sucesso aqui), mas sem o
 * `count` do UPDATE final, ambas registrariam auditoria e re-tocariam
 * `recorrencias` mesmo quando só uma de fato mudou o estado local.
 * `count` decide isso: quem perdeu a corrida do UPDATE local trata como
 * já cancelada por outro caminho, sem duplicar efeito colateral.
 */
export async function cancelarAutorizacaoPix(
  autorizacaoId: string,
  empresaId: string,
  usuarioId: string | null = null,
  motivo: string | null = null,
  cancelador: CanceladorDeAutorizacaoPix = cancelarAutorizacaoPixAsaas
): Promise<ResultadoDominio<{ autorizacaoId: string }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");
  const admin = supabaseAdmin();

  const { data: linha } = await admin
    .from("autorizacoes_pix")
    .select("id, status, asaas_authorization_id")
    .eq("id", autorizacaoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!linha) return falha("nao_encontrado", "Autorização não encontrada.");
  if (!estaViva(linha.status as StatusAutorizacao)) {
    return falha("conflito", "Esta autorização não está mais ativa.");
  }

  if (linha.asaas_authorization_id) {
    const credencial = await credencialDaEmpresa(empresaId);
    if (!credencial) {
      return falha("integracao_externa", "Não foi possível confirmar o cancelamento no Asaas agora.");
    }
    const resultado = await cancelador(linha.asaas_authorization_id, credencial);
    // 404 = já não existe mais no Asaas — equivalente a já cancelada, retry seguro.
    if (!resultado.ok && resultado.status !== 404) {
      await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_cancelamento_falhou", linha.asaas_authorization_id);
      return falha(
        "integracao_externa",
        "Não foi possível cancelar a autorização no Asaas agora. Tente novamente.",
        resultado.erro
      );
    }
  }

  const { error, count } = await admin
    .from("autorizacoes_pix")
    .update(
      {
        status: "CANCELLED",
        cancellation_date: new Date().toISOString(),
        cancellation_reason: motivo ?? "Cancelado pelo profissional",
      },
      { count: "exact" }
    )
    .eq("id", autorizacaoId)
    .eq("empresa_id", empresaId)
    .in("status", ["CREATED", "ACTIVE"]);

  if (error) return falha("infraestrutura", undefined, error.message);

  // count=0: uma chamada concorrente já cancelou esta autorização entre a
  // leitura e este UPDATE (perdeu a corrida do CAS local) — idempotente,
  // não repete o efeito colateral (auditoria/desvínculo) de quem já fez isso.
  if (count) {
    await admin.from("recorrencias").update({ autorizacao_atual_id: null }).eq("autorizacao_atual_id", autorizacaoId);
    await registrarAcaoFinanceira(empresaId, usuarioId, "autorizacao_pix_cancelada", autorizacaoId);
  }

  return ok({ autorizacaoId });
}

export type AutorizacaoPublica = {
  status: StatusAutorizacao;
  empresaNome: string;
  descricao: string;
  valorCentavos: number;
  diaVencimento: number;
  /** Só vem preenchido quando `status === "CREATED"` e a consulta ao Asaas funcionou agora. */
  payload: string | null;
  encodedImage: string | null;
};

export type ResultadoAutorizacaoPublica =
  | { ok: true; dado: AutorizacaoPublica }
  | { ok: false; motivo: "nao_encontrado" };

/**
 * Leitura PÚBLICA (sem sessão) de uma autorização — é o que alimenta o
 * link que o profissional entrega ao cliente (`/autorizar/[id]`).
 *
 * O "token" do link é o próprio `id` da autorização: `gen_random_uuid()`
 * já tem 122 bits de entropia e não é listável em nenhuma tela (não
 * existe endpoint que enumere autorizações sem `empresa_id` de sessão),
 * então reaproveitar a chave primária evita inventar um segredo novo.
 *
 * Superfície de dados deliberadamente mínima: nunca devolve `empresa_id`,
 * `recorrencia_id`, `cliente_id` nem nenhum id do Asaas — só o que o
 * pagador precisa pra entender o que está autorizando. Quem chama esta
 * função (a rota pública) não tem acesso a mais nada além do que este
 * tipo de retorno expõe.
 */
export async function obterAutorizacaoPublica(
  autorizacaoId: string
): Promise<ResultadoAutorizacaoPublica> {
  if (!supabaseConfigurado()) return { ok: false, motivo: "nao_encontrado" };
  const admin = supabaseAdmin();

  const { data: linha } = await admin
    .from("autorizacoes_pix")
    .select(
      "id, empresa_id, status, asaas_authorization_id, recorrencias!autorizacoes_pix_recorrencia_id_fkey(descricao, valor_centavos, dia_vencimento), empresas(nome)"
    )
    .eq("id", autorizacaoId)
    .maybeSingle();

  if (!linha) return { ok: false, motivo: "nao_encontrado" };

  const recorrencia = linha.recorrencias as unknown as
    | { descricao: string; valor_centavos: number; dia_vencimento: number }
    | null;
  const empresa = linha.empresas as unknown as { nome: string } | null;
  if (!recorrencia || !empresa) return { ok: false, motivo: "nao_encontrado" };

  let payload: string | null = null;
  let encodedImage: string | null = null;

  // O QR/código só existe enquanto a autorização está `CREATED` (aguardando
  // o pagamento combinado) — Asaas não devolve isso pra ACTIVE/REFUSED/etc.
  // Falha em buscar não é erro fatal da página: mostra o resto do estado
  // mesmo sem o QR, e o botão "Atualizar" deixa tentar de novo.
  if (linha.status === "CREATED" && linha.asaas_authorization_id) {
    const credencial = await credencialDaEmpresa(linha.empresa_id);
    if (credencial) {
      const detalhe = await consultarAutorizacaoPixAsaas(linha.asaas_authorization_id, credencial);
      if (detalhe.ok) {
        payload = detalhe.data.payload ?? null;
        encodedImage = detalhe.data.encodedImage ?? null;
      }
    }
  }

  return {
    ok: true,
    dado: {
      status: linha.status as StatusAutorizacao,
      empresaNome: empresa.nome,
      descricao: recorrencia.descricao,
      valorCentavos: recorrencia.valor_centavos,
      diaVencimento: recorrencia.dia_vencimento,
      payload,
      encodedImage,
    },
  };
}
