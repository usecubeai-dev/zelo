/**
 * Caso de uso: sincronização de um Cliente Zelo com o Asaas.
 *
 * ⚠ SERVIDOR APENAS. É o único lugar que orquestra "criar cliente no
 * Asaas" para um cliente do CRM — Server Actions chamam isto, nunca
 * `lib/asaas/cliente.ts` direto (mesma regra de camadas da Fase 2/3).
 *
 * O cliente final pertence à SUBCONTA do profissional, nunca à
 * plataforma — por isso esta função sempre resolve
 * `credencialDaEmpresa(empresaId)` e falha cedo se a empresa ainda não
 * tem conta financeira conectada. Cadastrar clientes no CRM continua
 * funcionando sem Asaas conectado (o `criarCliente()` do CRM não muda);
 * só a sincronização em si exige a subconta.
 *
 * IDEMPOTÊNCIA — mesmo padrão de compare-and-swap já usado em
 * `lib/core/onboarding.ts`: antes de chamar o Asaas, um
 * `UPDATE clientes SET asaas_sync_status = 'sincronizando' WHERE
 * asaas_sync_status IN ('pendente','erro') AND asaas_customer_id IS
 * NULL` só afeta a linha se ninguém mais estiver no meio da mesma
 * sincronização. Duplo clique, retry, duas abas — todos batem nesse
 * WHERE e só um chega a chamar o Asaas.
 *
 * TTL DO LOCK (Fase 10) — `asaasRequisicao()` nunca lança exceção (todo
 * erro de rede/timeout vira `{ok:false}`), então o único jeito de uma
 * linha ficar presa em `sincronizando` pra sempre é o PROCESSO cair no
 * meio do caminho (deploy, crash, OOM) entre o lock e o desbloqueio —
 * sem isso, `asaas_sync_status='erro'` sempre roda depois. Esse era
 * exatamente o gap que `criarAutorizacaoPix` (Fase 6) já resolvia com
 * `autorizacao_solicitada_em` + TTL de 2min — aqui reaproveitamos o
 * `atualizado_em` que já existe e já é atualizado automaticamente por
 * trigger em todo UPDATE (inclusive o do próprio lock), sem precisar de
 * coluna nova: uma linha `sincronizando` com `atualizado_em` mais velho
 * que o TTL é tratada como travada e pode ser destravada por uma nova
 * tentativa.
 *
 * RESPOSTA PERDIDA — se o processo cair depois de criar o cliente no
 * Asaas mas antes de gravar `asaas_customer_id` localmente, a próxima
 * tentativa busca por `externalReference = cliente.id` antes de criar de
 * novo, para não duplicar do lado do Asaas. Fase 10: trocado de
 * "buscar por CPF/CNPJ, filtrar por externalReference na memória" pra
 * buscar direto por `externalReference` — confirmado em
 * docs.asaas.com/reference/listar-clientes que é um filtro de servidor
 * independente, sem precisar de `cpfCnpj` junto. Mais robusto (não
 * depende do cliente ter documento, nem da formatação bater) e mesma
 * estratégia já usada em `cobranca-financeira.ts`/`autorizacao-pix.ts`.
 * `cpfCnpj` continua sendo obrigatório PRA CRIAR um cliente no Asaas
 * (confirmado na mesma pesquisa) — então um cliente sem documento nunca
 * chega a ser criado lá, não é um caso de resposta perdida possível.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { credencialDaEmpresa } from "../asaas/credenciais";
import {
  criarClienteAsaas,
  buscarClientePorExternalReference,
  CriarClienteAsaasDados,
} from "../asaas/cliente";
import { ResultadoDominio, ok, falha } from "./erros";
import { registrarAcaoFinanceira } from "./auditoria";
import { criarNotificacao } from "./notificacoes";

/** Injetáveis só para teste — em produção são sempre as funções reais de `lib/asaas/cliente.ts`. */
export type CriadorDeClienteAsaas = typeof criarClienteAsaas;
export type BuscadorDeClienteAsaas = typeof buscarClientePorExternalReference;

const TTL_TRAVA_MS = 2 * 60 * 1000;

export type SincronizacaoCliente = {
  clienteId: string;
  asaasCustomerId: string;
  jaExistia: boolean;
};

type LinhaCliente = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  documento: string | null;
  status: string;
  asaas_customer_id: string | null;
  asaas_sync_status: string;
};

async function buscarCliente(clienteId: string, empresaId: string): Promise<LinhaCliente | null> {
  const { data } = await supabaseAdmin()
    .from("clientes")
    .select("id, empresa_id, nome, email, whatsapp, documento, status, asaas_customer_id, asaas_sync_status")
    .eq("id", clienteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data ?? null;
}

function paraDadosAsaas(c: LinhaCliente): CriarClienteAsaasDados {
  return {
    name: c.nome,
    cpfCnpj: c.documento || undefined,
    email: c.email || undefined,
    mobilePhone: c.whatsapp || undefined,
    externalReference: c.id,
  };
}

/**
 * Sincroniza um cliente já existente no CRM com o Asaas.
 *
 * Idempotente: chamar de novo para um cliente já sincronizado só
 * devolve o `asaas_customer_id` existente (`jaExistia: true`), sem
 * nenhuma chamada ao Asaas.
 */
export async function sincronizarClienteFinanceiro(
  clienteId: string,
  empresaId: string,
  usuarioId: string | null = null,
  criador: CriadorDeClienteAsaas = criarClienteAsaas,
  buscador: BuscadorDeClienteAsaas = buscarClientePorExternalReference,
  /** Só para teste — em produção é sempre `TTL_TRAVA_MS` (2min). */
  ttlTravaMs: number = TTL_TRAVA_MS
): Promise<ResultadoDominio<SincronizacaoCliente>> {
  if (!supabaseConfigurado()) return falha("infraestrutura", undefined, "Supabase não configurado");

  const cliente = await buscarCliente(clienteId, empresaId);
  if (!cliente) return falha("nao_encontrado", "Cliente não encontrado.");

  if (cliente.status === "arquivado") {
    return falha("conflito", "Cliente arquivado não pode ser sincronizado com o Asaas.");
  }

  // Já sincronizado: no-op idempotente, sem chamar o Asaas de novo.
  if (cliente.asaas_customer_id) {
    return ok({ clienteId, asaasCustomerId: cliente.asaas_customer_id, jaExistia: true });
  }

  const credencial = await credencialDaEmpresa(empresaId);
  if (!credencial) {
    return falha(
      "integracao_externa",
      "Conecte sua conta financeira antes de sincronizar clientes com o Asaas."
    );
  }

  const admin = supabaseAdmin();

  // Compare-and-swap: só avança se ninguém mais estiver sincronizando este
  // cliente agora — OU se a última tentativa travou em 'sincronizando' há
  // mais que o TTL (processo interrompido, Fase 10 — ver docstring acima).
  const limiteTravaExpirada = new Date(Date.now() - ttlTravaMs).toISOString();
  const { data: travado, error: erroCas } = await admin
    .from("clientes")
    .update({ asaas_sync_status: "sincronizando" })
    .eq("id", clienteId)
    .eq("empresa_id", empresaId)
    .is("asaas_customer_id", null)
    .or(`asaas_sync_status.in.(pendente,erro),and(asaas_sync_status.eq.sincronizando,atualizado_em.lt.${limiteTravaExpirada})`)
    .select("id")
    .maybeSingle();

  if (erroCas) return falha("infraestrutura", undefined, erroCas.message);

  if (!travado) {
    // Perdeu a corrida (ou já foi sincronizado nesse meio-tempo) — relê o estado real.
    const atual = await buscarCliente(clienteId, empresaId);
    if (atual?.asaas_customer_id) {
      return ok({ clienteId, asaasCustomerId: atual.asaas_customer_id, jaExistia: true });
    }
    return falha("conflito", "Este cliente já está sendo sincronizado. Aguarde um instante.");
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "cliente_sincronizacao_iniciada", clienteId);

  // Resposta perdida: antes de criar, verifica se uma tentativa anterior já criou este cliente no Asaas.
  const busca = await buscador(cliente.id, credencial);
  if (busca.ok) {
    const existente = busca.data.data.find((c) => c.externalReference === cliente.id);
    if (existente) {
      await admin
        .from("clientes")
        .update({ asaas_customer_id: existente.id, asaas_sync_status: "sincronizado" })
        .eq("id", clienteId);
      await registrarAcaoFinanceira(empresaId, usuarioId, "cliente_sincronizacao_recuperada", existente.id);
      return ok({ clienteId, asaasCustomerId: existente.id, jaExistia: true });
    }
  }

  const resultado = await criador(paraDadosAsaas(cliente), credencial);

  if (!resultado.ok) {
    // Destrava — a próxima tentativa não fica presa em 'sincronizando'.
    await admin.from("clientes").update({ asaas_sync_status: "erro" }).eq("id", clienteId);
    await registrarAcaoFinanceira(empresaId, usuarioId, "cliente_sincronizacao_falhou", clienteId);
    // Chave por dia — mesmo raciocínio de `cobranca-financeira.ts`: não
    // vira notificação por retry, mas uma falha nova amanhã ainda avisa.
    await criarNotificacao(
      empresaId,
      "integracao_problema",
      "Falha ao sincronizar cliente com o Asaas",
      `"${cliente.nome}" não pôde ser sincronizado com o Asaas.`,
      "media",
      `/app/clientes/${clienteId}`,
      `cliente_sync_erro:${clienteId}:${new Date().toISOString().slice(0, 10)}`
    );
    return falha(
      "integracao_externa",
      "Não foi possível sincronizar este cliente com o Asaas agora. Tente novamente.",
      resultado.erro
    );
  }

  const { error: erroSync } = await admin
    .from("clientes")
    .update({ asaas_customer_id: resultado.data.id, asaas_sync_status: "sincronizado" })
    .eq("id", clienteId);

  if (erroSync) {
    // O cliente FOI criado no Asaas — isto é só o espelhamento local falhando.
    // Não tenta de novo automaticamente (evitaria duplicar no Asaas); fica
    // para a próxima sincronização recuperar via busca por externalReference.
    await registrarAcaoFinanceira(empresaId, usuarioId, "cliente_sync_parcial_falhou", resultado.data.id);
    return falha("infraestrutura", undefined, erroSync.message);
  }

  await registrarAcaoFinanceira(empresaId, usuarioId, "cliente_sincronizacao_concluida", resultado.data.id);
  return ok({ clienteId, asaasCustomerId: resultado.data.id, jaExistia: false });
}
