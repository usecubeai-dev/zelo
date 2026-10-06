"use server";

import { revalidatePath } from "next/cache";
import { excluirContaZelo } from "@/lib/core/exclusao-conta";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { soDigitos } from "@/lib/cliente";
import {
  iniciarOnboardingFinanceiro,
  obterContaFinanceira,
  sincronizarStatusFinanceiro,
  reconciliarContaFinanceira,
} from "@/lib/core/onboarding";
import type { ContaFinanceira, SituacaoContaAsaas } from "@/lib/core/conta-financeira";
import type { DocumentoPendenteAsaas } from "@/lib/asaas/conta";
import type { CriarSubcontaDados } from "@/lib/asaas/subconta";

export type DadosEmpresa = {
  nome: string;
  documento: string;
};

export type ResultadoEmpresa =
  | { ok: true }
  | { ok: false; erros?: Record<string, string>; mensagem?: string };

export async function atualizarDadosEmpresa(dados: DadosEmpresa): Promise<ResultadoEmpresa> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  }

  const erros: Record<string, string> = {};
  const nomeLimpo = dados.nome.trim().replace(/\s+/g, " ");
  if (nomeLimpo.length < 2) {
    erros.nome = "Informe o nome da sua empresa ou seu nome comercial.";
  } else if (nomeLimpo.length > 120) {
    erros.nome = "Nome muito longo.";
  }

  const docLimpo = soDigitos(dados.documento);
  if (docLimpo && docLimpo.length !== 11 && docLimpo.length !== 14) {
    erros.documento = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("empresas")
    .update({
      nome: nomeLimpo,
      documento: docLimpo || null,
    })
    .eq("id", atual.membro.empresa_id);

  if (error) {
    console.error("[configuracoes] erro ao atualizar empresa:", error.message);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente novamente." };
  }

  revalidatePath("/app/configuracoes");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Dados que o Asaas exige para criar a subconta. Vêm de um formulário
 * próprio (não implementado nesta fase — a UI só tem o botão que dispara
 * com os dados já cadastrados da empresa/usuário, como mínimo viável).
 */
export type ResultadoOnboarding =
  | { ok: true; conta: ContaFinanceira }
  | { ok: false; mensagem: string };

/**
 * Server Action que dispara o onboarding financeiro.
 *
 * `empresa_id` e `usuario_id` vêm SEMPRE da sessão — nunca do
 * formulário. O frontend só pede; quem decide é o servidor (regra da
 * Fase 2, §13 do plano).
 */
export async function conectarContaFinanceira(dados: CriarSubcontaDados): Promise<ResultadoOnboarding> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  }

  const resultado = await iniciarOnboardingFinanceiro(
    atual.membro.empresa_id as string,
    atual.user.id,
    dados
  );

  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.erro.mensagem };
  }

  revalidatePath("/app/configuracoes");
  return { ok: true, conta: resultado.dado };
}

/** Estado atual da conexão — para a tela renderizar sem esperar uma ação. */
export async function situacaoDaContaFinanceira(): Promise<ContaFinanceira | null> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return null;
  return obterContaFinanceira(atual.membro.empresa_id as string);
}

export type ResultadoSincronizacao =
  | { ok: true; situacao: SituacaoContaAsaas; documentosPendentes: DocumentoPendenteAsaas[] }
  | { ok: false; mensagem: string };

/**
 * Botão "Verificar status agora" — consulta o Asaas ao vivo (situação +
 * documentos pendentes) e persiste `provider_aprovacao`. Não muda
 * `estadoOnboarding`; só refina o que a tela sabe sobre uma conta já
 * `criada`.
 */
export async function sincronizarContaFinanceira(): Promise<ResultadoSincronizacao> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  }

  const resultado = await sincronizarStatusFinanceiro(atual.membro.empresa_id as string);
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.erro.mensagem };
  }

  revalidatePath("/app/configuracoes");
  return { ok: true, ...resultado.dado };
}

/**
 * Botão "Verificar novamente" quando a conta está presa em `criando`/
 * `recusada` — pede ao servidor para checar se, apesar da falha local,
 * a subconta existe do lado do Asaas. Pode resultar em `criada`,
 * `recusada` (confirmado que não existe) ou `bloqueada` (existe mas sem
 * credencial recuperável) — nunca decidido pelo cliente.
 */
export async function reconciliarContaFinanceiraAcao(): Promise<ResultadoOnboarding> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  }

  const resultado = await reconciliarContaFinanceira(atual.membro.empresa_id as string, atual.user.id);
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.erro.mensagem };
  }

  revalidatePath("/app/configuracoes");
  return { ok: true, conta: resultado.dado };
}

export type ResultadoExclusaoConta = { ok: true } | { ok: false; mensagem: string };

/**
 * Excluir a conta: exclusão LÓGICA + anonimização (ver
 * `lib/core/exclusao-conta.ts`) — registros fiscais ficam, dados pessoais
 * saem, o acesso é bloqueado. A pessoa precisa digitar a palavra de
 * confirmação. Depois de excluída, a sessão é encerrada aqui mesmo.
 */
export async function excluirConta(confirmacao: string): Promise<ResultadoExclusaoConta> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const r = await excluirContaZelo({
    empresaId: atual.membro.empresa_id as string,
    userId: atual.user.id,
    papel: atual.membro.papel,
    confirmacao,
  });
  if (!r.ok) return { ok: false, mensagem: r.mensagem };

  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return { ok: true };
}
