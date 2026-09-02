/**
 * Caso de uso: onboarding financeiro da empresa.
 *
 * ⚠ SERVIDOR APENAS. É o único lugar que orquestra "criar subconta" —
 * Server Actions chamam isto, nunca `lib/asaas/subconta.ts` direto (regra
 * de camadas do documento de arquitetura, §2).
 *
 * A idempotência é por COMPARE-AND-SWAP no banco, não por chave gerada no
 * cliente: o `UPDATE ... WHERE provider_status IN ('pendente','recusada')`
 * só afeta uma linha se ninguém mais estiver no meio da mesma operação.
 * Duplo clique, duas abas, retry de rede — todos batem nesse WHERE e só
 * um vence. É o mesmo padrão que `marcarComoPaga()` já usa para
 * cobrança; aqui é a mesma ideia aplicada à criação de subconta.
 *
 * Limitação conhecida, registrada e não escondida: se o processo cair
 * DEPOIS do CAS e ANTES da chamada ao Asaas terminar, a empresa fica
 * travada em `provider_status = 'criando'` até alguém destravar. Não
 * existe ainda uma rotina de reconciliação para isso — é trabalho de
 * Fase 3 (o documento de arquitetura já previa essa rotina, §12). Nesta
 * fase, o caminho de recuperação é manual: um operador reseta o status
 * pelo Supabase Studio.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { criarSubcontaParaEmpresa, CriarSubcontaDados, ResultadoSubconta } from "../asaas/subconta";
import { credencialDaEmpresa } from "../asaas/credenciais";
import {
  consultarSituacaoConta,
  consultarDocumentosPendentes,
  buscarSubcontaPorDocumento,
  DocumentoPendenteAsaas,
} from "../asaas/conta";
import { ContaFinanceira, EstadoOnboarding, StatusAprovacao, SituacaoContaAsaas } from "./conta-financeira";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira as registrarAcao } from "./auditoria";

/** Injetável só para teste — em produção é sempre `criarSubcontaParaEmpresa`. */
export type CriadorDeSubconta = (
  empresaId: string,
  dados: CriarSubcontaDados
) => Promise<ResultadoSubconta>;

function linhaParaConta(row: {
  provider_status: string;
  asaas_account_id: string | null;
  asaas_wallet_id: string | null;
  provider_aprovacao: string | null;
  provider_conectado_em: string | null;
  provider_sincronizado_em: string | null;
}): ContaFinanceira {
  const estadoOnboarding: EstadoOnboarding =
    row.provider_status === "ativa"
      ? "criada"
      : row.provider_status === "criando"
        ? "criando"
        : row.provider_status === "recusada"
          ? "recusada"
          : row.provider_status === "bloqueada"
            ? "bloqueada"
            : "nao_iniciada";

  return {
    empresaId: "", // preenchido por quem chama, quando precisar
    estadoOnboarding,
    asaasAccountId: row.asaas_account_id,
    asaasWalletId: row.asaas_wallet_id,
    statusAprovacao: (row.provider_aprovacao as StatusAprovacao | null) ?? null,
    conectadoEm: row.provider_conectado_em,
    sincronizadoEm: row.provider_sincronizado_em,
  };
}

/** Estado atual — seguro para exibir numa tela, sem nenhum segredo. */
export async function obterContaFinanceira(empresaId: string): Promise<ContaFinanceira | null> {
  if (!supabaseConfigurado()) return null;

  const { data } = await supabaseAdmin()
    .from("empresas")
    .select(
      "provider_status, asaas_account_id, asaas_wallet_id, provider_aprovacao, provider_conectado_em, provider_sincronizado_em"
    )
    .eq("id", empresaId)
    .maybeSingle();

  if (!data) return null;
  return { ...linhaParaConta(data), empresaId };
}

/**
 * Inicia (ou tenta iniciar) a conexão financeira da empresa.
 *
 * Idempotente: se já está `criando` ou já `ativa`, devolve conflito sem
 * tocar em nada — nunca cria uma segunda subconta pra mesma empresa.
 */
export async function iniciarOnboardingFinanceiro(
  empresaId: string,
  usuarioId: string,
  dados: CriarSubcontaDados,
  criador: CriadorDeSubconta = criarSubcontaParaEmpresa
): Promise<ResultadoDominio<ContaFinanceira>> {
  if (!supabaseConfigurado()) {
    return falha("infraestrutura", undefined, "Supabase não configurado");
  }
  const admin = supabaseAdmin();

  // Compare-and-swap: só avança se ninguém mais estiver no meio disto.
  const { data: travado, error: erroCas } = await admin
    .from("empresas")
    .update({ provider_status: "criando" })
    .eq("id", empresaId)
    .in("provider_status", ["pendente", "recusada"])
    .select("id")
    .maybeSingle();

  if (erroCas) {
    return falha("infraestrutura", undefined, erroCas.message);
  }

  if (!travado) {
    // Já está em andamento, já está pronta, ou a empresa não existe.
    const atual = await obterContaFinanceira(empresaId);
    if (!atual) return falha("nao_encontrado", "Empresa não encontrada.");
    if (atual.estadoOnboarding === "criada") {
      return falha("conflito", "Sua conta já está conectada.");
    }
    return falha("conflito", "Já existe uma conexão em andamento. Aguarde um instante.");
  }

  await registrarAcao(empresaId, usuarioId, "onboarding_iniciado");

  const resultado = await criador(empresaId, dados);

  if (!resultado.ok) {
    // Destrava — a próxima tentativa não fica presa em 'criando'.
    await admin.from("empresas").update({ provider_status: "recusada" }).eq("id", empresaId);
    await registrarAcao(empresaId, usuarioId, "onboarding_falhou");

    const tipo = resultado.status === 503 ? "integracao_externa" : "integracao_externa";
    return falha(tipo, "Não foi possível conectar sua conta agora. Tente novamente em instantes.", resultado.erro);
  }

  // `criarSubcontaParaEmpresa` já gravou a credencial cifrada e os campos
  // legados (asaas_account_id, asaas_wallet_id, asaas_status). Aqui só
  // sincroniza os campos novos desta fase — sem duplicar o que já existe.
  const { error: erroSync } = await admin
    .from("empresas")
    .update({
      provider_status: "ativa",
      provider_account_id: resultado.subconta.accountId,
      provider_conectado_em: new Date().toISOString(),
    })
    .eq("id", empresaId);

  if (erroSync) {
    // A subconta FOI criada e a credencial FOI salva — isto é só o
    // espelhamento dos campos novos falhando. Não é um incidente
    // financeiro (a próxima leitura de `obterContaFinanceira` já vai ler
    // `asaas_account_id`, que está correto), mas fica registrado.
    await registrarAcao(empresaId, usuarioId, "onboarding_sync_parcial_falhou", resultado.subconta.accountId);
  }

  await registrarAcao(empresaId, usuarioId, "onboarding_concluido", resultado.subconta.accountId);

  const conta = await obterContaFinanceira(empresaId);
  if (!conta) return falha("infraestrutura", undefined, "conta sumiu logo após criação");
  return ok(conta);
}

/**
 * Sincroniza `provider_aprovacao` com o que o Asaas realmente diz agora.
 *
 * Não é chamado automaticamente por nenhuma rota de usuário — é para uso
 * por uma Server Action de "atualizar status" (botão manual) ou por um
 * cron futuro (Fase 9 tratará o disparo por webhook; isto aqui é a
 * consulta ativa, pull, que complementa o push do webhook quando ele
 * atrasa ou se perde).
 *
 * Só funciona com credencial DA SUBCONTA — se a empresa está `bloqueada`
 * (credencial perdida) isto falha por definição, e é esperado.
 */
export async function sincronizarStatusFinanceiro(
  empresaId: string
): Promise<ResultadoDominio<{ situacao: SituacaoContaAsaas; documentosPendentes: DocumentoPendenteAsaas[] }>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) {
    return falha("nao_encontrado", "Conta financeira ainda não conectada ou credencial indisponível.");
  }

  const respostaSituacao = await consultarSituacaoConta(credencial);
  if (!respostaSituacao.ok) {
    return falha("integracao_externa", "Não foi possível consultar o status da sua conta agora.", respostaSituacao.erro);
  }

  // Documentos pendentes são informativos para a UI — uma falha aqui não
  // deve impedir a sincronização do status geral, que é o dado principal.
  const respostaDocs = await consultarDocumentosPendentes(credencial);
  const documentosPendentes = respostaDocs.ok ? respostaDocs.data.data : [];

  const admin = supabaseAdmin();
  const { error: erroUpdate } = await admin
    .from("empresas")
    .update({
      provider_aprovacao: respostaSituacao.data.general,
      provider_sincronizado_em: new Date().toISOString(),
    })
    .eq("id", empresaId);

  if (erroUpdate) {
    return falha("infraestrutura", undefined, erroUpdate.message);
  }

  await registrarAcao(empresaId, null, "status_financeiro_sincronizado", respostaSituacao.data.id);

  const { id: _id, ...situacao } = respostaSituacao.data;
  return ok({ situacao, documentosPendentes });
}

/**
 * Reconciliação: cobre exatamente o buraco descrito no cabeçalho do
 * arquivo — empresa presa em `criando` porque o processo caiu entre o
 * CAS e a conclusão da chamada ao Asaas.
 *
 * Duas classes de divergência, tratadas de forma diferente:
 *
 * (A) A subconta já existe localmente (`asaas_account_id` presente) mas
 *     o bookkeeping ficou em `criando` — é só o espelhamento final que
 *     falhou. Reparo seguro: repetir o `UPDATE` que `iniciarOnboardingFinanceiro`
 *     já teria feito. Nenhuma chamada ao Asaas é necessária.
 *
 * (B) Não há `asaas_account_id` local nenhum. Aí sim é preciso perguntar
 *     ao Asaas via `GET /accounts?cpfCnpj=` (credencial da PLATAFORMA)
 *     se uma subconta foi criada mesmo assim. Dois resultados possíveis:
 *       - Não encontrada: a criação realmente falhou. Seguro destravar
 *         para `nao_iniciada` — o usuário tenta de novo do zero.
 *       - Encontrada: a subconta EXISTE do lado do Asaas, mas o Zelo
 *         nunca guardou a `apiKey` dela (a API só devolve isso uma vez,
 *         na criação — não existe endpoint para reobter). Sem a
 *         credencial não dá pra operar essa subconta. Não é seguro
 *         fingir que está tudo bem: transiciona para `bloqueada`, que
 *         exige suporte manual (não é uma falha que o usuário resolve
 *         clicando "tentar de novo").
 */
/** Injetável só para teste — em produção é sempre `buscarSubcontaPorDocumento`. */
export type BuscadorDeSubconta = typeof buscarSubcontaPorDocumento;

export async function reconciliarContaFinanceira(
  empresaId: string,
  usuarioId: string | null = null,
  buscador: BuscadorDeSubconta = buscarSubcontaPorDocumento
): Promise<ResultadoDominio<ContaFinanceira>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("empresas")
    .select(
      "provider_status, asaas_account_id, asaas_wallet_id, provider_aprovacao, provider_conectado_em, provider_sincronizado_em, documento"
    )
    .eq("id", empresaId)
    .maybeSingle();

  if (!row) return falha("nao_encontrado", "Empresa não encontrada.");

  const estadoAtual: EstadoOnboarding = linhaParaConta(row).estadoOnboarding;

  // Nada para reconciliar fora dos estados que podem estar divergentes.
  if (estadoAtual !== "criando" && estadoAtual !== "recusada") {
    const conta = await obterContaFinanceira(empresaId);
    if (!conta) return falha("infraestrutura", undefined, "conta sumiu durante reconciliação");
    return ok(conta);
  }

  // Classe (A): já sabemos o accountId, só faltou espelhar.
  if (row.asaas_account_id) {
    // Mesmo padrão de CAS do onboarding: `.select().maybeSingle()` para
    // saber se ALGUMA linha foi realmente afetada. Sem isto, um UPDATE
    // que não bate em nenhuma linha (porque a outra chamada concorrente
    // já mudou o status) não gera `error` nenhum — e a auditoria seria
    // registrada mesmo sem o resync ter acontecido de verdade.
    const { data: afetada, error } = await admin
      .from("empresas")
      .update({ provider_status: "ativa", provider_conectado_em: new Date().toISOString() })
      .eq("id", empresaId)
      .in("provider_status", ["criando", "recusada"])
      .select("id")
      .maybeSingle();

    if (error) return falha("infraestrutura", undefined, error.message);

    if (afetada) {
      await registrarAcao(empresaId, usuarioId, "reconciliacao_resync_local", row.asaas_account_id);
    }
    const conta = await obterContaFinanceira(empresaId);
    if (!conta) return falha("infraestrutura", undefined, "conta sumiu durante reconciliação");
    return ok(conta);
  }

  // Classe (B): perguntar ao Asaas se existe uma subconta órfã.
  if (!row.documento) {
    return falha("infraestrutura", undefined, "Empresa sem documento cadastrado — reconciliação não é possível.");
  }

  // Sem checagem prévia de credencial aqui: `buscador` (produção:
  // `buscarSubcontaPorDocumento`) já devolve `{ok:false}` quando a
  // integração não está configurada — checar antes duplicaria a lógica
  // e, em teste, impediria o `buscador` injetado de ser exercitado.
  const resposta = await buscador(row.documento);
  if (!resposta.ok) {
    return falha("integracao_externa", "Não foi possível consultar o Asaas para reconciliar.", resposta.erro);
  }

  const encontrada = resposta.data.data[0] ?? null;

  if (!encontrada) {
    // Realmente não existe do lado do Asaas — seguro destravar.
    const { data: afetada, error } = await admin
      .from("empresas")
      .update({ provider_status: "recusada" })
      .eq("id", empresaId)
      .in("provider_status", ["criando"])
      .select("id")
      .maybeSingle();
    if (error) return falha("infraestrutura", undefined, error.message);

    if (afetada) {
      await registrarAcao(empresaId, usuarioId, "reconciliacao_nao_encontrada");
    }
    const conta = await obterContaFinanceira(empresaId);
    if (!conta) return falha("infraestrutura", undefined, "conta sumiu durante reconciliação");
    return ok(conta);
  }

  // Órfã encontrada: existe, mas a credencial dela está irrecuperável.
  const { data: afetadaBloqueio, error } = await admin
    .from("empresas")
    .update({
      provider_status: "bloqueada",
      provider_account_id: encontrada.id,
      asaas_account_id: encontrada.id,
      asaas_wallet_id: encontrada.walletId,
    })
    .eq("id", empresaId)
    .in("provider_status", ["criando", "recusada"])
    .select("id")
    .maybeSingle();

  if (error) return falha("infraestrutura", undefined, error.message);

  if (afetadaBloqueio) {
    await registrarAcao(empresaId, usuarioId, "reconciliacao_orfa_bloqueada", encontrada.id);
  }
  const conta = await obterContaFinanceira(empresaId);
  if (!conta) return falha("infraestrutura", undefined, "conta sumiu durante reconciliação");
  return ok(conta);
}
