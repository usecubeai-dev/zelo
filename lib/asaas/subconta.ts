/**
 * Criação de subcontas Asaas — uma por empresa.
 *
 * ⚠ SERVIDOR APENAS.
 *
 * Nesta fase existe só a camada de integração. **Nada aqui é disparado
 * automaticamente**: não há chamada em login, cadastro, carregamento de
 * página ou webhook. Quem cria uma subconta é uma ação explícita do
 * onboarding, que ainda não foi construído.
 *
 * O contrato importante: a `apiKey` devolvida pelo Asaas aparece **uma
 * única vez**, na resposta da criação. Ela é gravada cifrada de imediato e
 * **nunca é retornada** por esta função. Se ela se perder entre a resposta
 * e a gravação, a subconta fica órfã — por isso a gravação acontece antes
 * de qualquer outra coisa, e uma falha ali é reportada como falha da
 * operação inteira.
 */

import { asaasRequisicao } from "./cliente-api";
import { credencialDaPlataforma } from "./config";
import { salvarCredencialDaEmpresa } from "./credenciais";
import { AsaasSubconta } from "./tipos";
import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";

if (typeof window !== "undefined") {
  throw new Error("lib/asaas/subconta.ts é servidor-apenas e foi importado no cliente.");
}

/**
 * Campos que o Asaas exige. Consulte a API Reference antes de mexer: a
 * lista de obrigatórios muda conforme o tipo de pessoa.
 */
export type CriarSubcontaDados = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  complement?: string;
  birthDate?: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
};

/**
 * O que sai desta função. Repare no que NÃO está aqui: a `apiKey`.
 * Só identificadores públicos, seguros para chegar a uma tela.
 */
export type SubcontaCriada = {
  accountId: string;
  walletId: string;
};

export type ResultadoSubconta =
  | { ok: true; subconta: SubcontaCriada }
  | { ok: false; erro: string; status?: number };

/**
 * Cria a subconta no Asaas e vincula à empresa.
 *
 * Ordem deliberada:
 *   1. cria no Asaas
 *   2. **grava a credencial cifrada** — se falhar, aborta e avisa
 *   3. só então marca a empresa como vinculada
 *
 * Inverter 2 e 3 deixaria a empresa marcada como "ativa" sem credencial
 * utilizável, e o erro só apareceria na primeira cobrança.
 */
export async function criarSubcontaParaEmpresa(
  empresaId: string,
  dados: CriarSubcontaDados
): Promise<ResultadoSubconta> {
  if (!credencialDaPlataforma()) {
    return { ok: false, erro: "Integração Asaas não configurada.", status: 503 };
  }
  if (!supabaseConfigurado()) {
    return { ok: false, erro: "Banco de dados não configurado.", status: 503 };
  }

  /* Sem credencial explícita: subcontas nascem SEMPRE pela conta da
     plataforma. É a conta-pai que as cria. */
  const resposta = await asaasRequisicao<AsaasSubconta>("/accounts", {
    metodo: "POST",
    corpo: dados,
  });

  if (!resposta.ok) {
    return { ok: false, erro: resposta.erro, status: resposta.status };
  }

  const { id, walletId, apiKey } = resposta.data;

  if (!id || !walletId || !apiKey) {
    /* Não logamos a resposta: ela contém a chave. */
    console.error("[asaas/subconta] resposta sem id, walletId ou apiKey.");
    return { ok: false, erro: "Resposta inesperada do Asaas ao criar a subconta." };
  }

  const gravou = await salvarCredencialDaEmpresa(empresaId, apiKey);
  if (!gravou.ok) {
    console.error("[asaas/subconta] subconta criada mas credencial NÃO gravada:", id);
    return {
      ok: false,
      erro: "Subconta criada, mas a credencial não pôde ser guardada com segurança.",
    };
  }

  const { error } = await supabaseAdmin()
    .from("empresas")
    .update({ asaas_account_id: id, asaas_wallet_id: walletId, asaas_status: "ativa" })
    .eq("id", empresaId);

  if (error) {
    console.error("[asaas/subconta] falha ao vincular empresa:", error.code);
    return { ok: false, erro: "Não foi possível vincular a subconta à empresa." };
  }

  return { ok: true, subconta: { accountId: id, walletId } };
}

/**
 * Estado da conexão de uma empresa — seguro para exibir numa tela.
 */
export async function estadoDaSubconta(empresaId: string): Promise<{
  status: "pendente" | "ativa" | "recusada";
  accountId: string | null;
  walletId: string | null;
}> {
  const vazio = { status: "pendente" as const, accountId: null, walletId: null };
  if (!supabaseConfigurado()) return vazio;

  const { data } = await supabaseAdmin()
    .from("empresas")
    .select("asaas_account_id, asaas_wallet_id, asaas_status")
    .eq("id", empresaId)
    .maybeSingle();

  if (!data) return vazio;

  return {
    status: (data.asaas_status as "pendente" | "ativa" | "recusada") ?? "pendente",
    accountId: data.asaas_account_id ?? null,
    walletId: data.asaas_wallet_id ?? null,
  };
}
