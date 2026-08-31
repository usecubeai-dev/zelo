/**
 * Módulo de Clientes do Asaas (customers).
 *
 * Mapeia clientes do Zelo para clientes cadastrados no Asaas.
 *
 * O cliente final pertence à conta que vai cobrá-lo. Por isso toda função
 * aceita `credencial`: sem ela, o cadastro cai na conta da plataforma —
 * correto apenas para o próprio profissional enquanto cliente do Zelo.
 */

import { asaasRequisicao } from "./cliente-api";
import { CredencialAsaas } from "./config";
import { AsaasCustomer, AsaasListResponse } from "./tipos";

export type CriarClienteAsaasDados = {
  name: string;
  cpfCnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  externalReference?: string | null;
};

/**
 * Cria um novo cliente no Asaas.
 */
export async function criarClienteAsaas(
  dados: CriarClienteAsaasDados,
  credencial?: CredencialAsaas
) {
  return asaasRequisicao<AsaasCustomer>("/customers", {
    metodo: "POST",
    corpo: dados,
    credencial,
  });
}

/**
 * Busca cliente por CPF/CNPJ no Asaas.
 */
export async function buscarClientePorCpfCnpj(cpfCnpj: string, credencial?: CredencialAsaas) {
  const limpo = cpfCnpj.replace(/\D/g, "");
  return asaasRequisicao<AsaasListResponse<AsaasCustomer>>("/customers", {
    metodo: "GET",
    parametros: { cpfCnpj: limpo },
    credencial,
  });
}

/**
 * Busca cliente por e-mail no Asaas.
 */
export async function buscarClientePorEmail(email: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasListResponse<AsaasCustomer>>("/customers", {
    metodo: "GET",
    parametros: { email: email.trim().toLowerCase() },
    credencial,
  });
}

/**
 * Obtém os detalhes de um cliente no Asaas por ID.
 */
export async function obterClienteAsaas(id: string, credencial?: CredencialAsaas) {
  return asaasRequisicao<AsaasCustomer>(`/customers/${id}`, {
    metodo: "GET",
    credencial,
  });
}

/**
 * Atualiza os dados de um cliente no Asaas.
 */
export async function atualizarClienteAsaas(
  id: string,
  dados: Partial<CriarClienteAsaasDados>,
  credencial?: CredencialAsaas
) {
  return asaasRequisicao<AsaasCustomer>(`/customers/${id}`, {
    metodo: "PUT",
    corpo: dados,
    credencial,
  });
}
