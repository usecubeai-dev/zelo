"use server";

import { headers } from "next/headers";
import { registrarSolicitacaoTitular, type ErrosSolicitacao } from "@/lib/core/solicitacao-titular";
import { origemDaRequisicao } from "@/lib/core/aceite-legal";
import { verificarLimite } from "@/lib/limitador";

export type ResultadoSolicitacao =
  | { ok: true }
  | { ok: false; erros?: ErrosSolicitacao; mensagem?: string };

/**
 * Pedido de titular de dados (acesso, correção, exclusão, portabilidade).
 * Público, sem login. Defesas simples contra lixo: campo-isca `site` (um
 * robô preenche, uma pessoa não vê) e limite por IP. O IP não é gravado.
 */
export async function enviarSolicitacaoTitular(dados: {
  tipo: string;
  email: string;
  nome?: string;
  mensagem?: string;
  /** campo-isca: precisa chegar vazio */
  site?: string;
}): Promise<ResultadoSolicitacao> {
  if (dados.site && dados.site.trim() !== "") {
    // finge sucesso para o robô, sem gravar nada
    return { ok: true };
  }

  const { ip } = origemDaRequisicao(await headers());
  const limite = verificarLimite(`titular:${ip ?? "desconhecido"}`, 5, 10 * 60 * 1000);
  if (!limite.permitido) return { ok: false, mensagem: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." };

  const r = await registrarSolicitacaoTitular({ tipo: dados.tipo, email: dados.email, nome: dados.nome, mensagem: dados.mensagem });
  return r.ok ? { ok: true } : { ok: false, erros: r.erros, mensagem: r.mensagem };
}
