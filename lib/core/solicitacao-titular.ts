/**
 * Pedidos dos titulares de dados (LGPD): acesso, correção, exclusão,
 * portabilidade. Qualquer pessoa — cliente do Zelo ou cliente de um
 * profissional — pode pedir; por isso é público, sem login.
 *
 * Grava em `solicitacoes_titular` (status e data) e, se o Resend estiver
 * configurado E o e-mail de privacidade já tiver sido preenchido
 * (`lib/company.ts`), avisa a equipe. A tabela não tem policy: só o servidor
 * escreve e só administradores leem. Servidor apenas.
 */

import { supabaseAdmin } from "../supabase/admin";
import { EMPRESA, estaPendente } from "../company";
import { sendEmail } from "../email/enviar";
import { montarEmailBase } from "../email/templates/layout";
import { escaparHtml } from "../email/sanitizar";
import { getEmailConfiguration } from "../email/config";

import {
  ROTULO_SOLICITACAO,
  STATUS_SOLICITACAO,
  TIPOS_SOLICITACAO,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from "../solicitacao-tipos";

export { ROTULO_SOLICITACAO, STATUS_SOLICITACAO, TIPOS_SOLICITACAO };
export type { StatusSolicitacao, TipoSolicitacao };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type DadosSolicitacao = { tipo: unknown; email: unknown; nome?: unknown; mensagem?: unknown };
export type ErrosSolicitacao = Partial<Record<"tipo" | "email" | "nome" | "mensagem", string>>;

export function validarSolicitacao(d: DadosSolicitacao): {
  erros: ErrosSolicitacao;
  limpo?: { tipo: TipoSolicitacao; email: string; nome: string | null; mensagem: string | null };
} {
  const erros: ErrosSolicitacao = {};
  const tipo = (TIPOS_SOLICITACAO as readonly string[]).includes(d.tipo as string) ? (d.tipo as TipoSolicitacao) : null;
  if (!tipo) erros.tipo = "Escolha o tipo de pedido.";

  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 200) erros.email = "Informe um e-mail válido.";

  const nome = typeof d.nome === "string" ? d.nome.trim().replace(/\s+/g, " ") : "";
  if (nome.length > 120) erros.nome = "Nome muito longo.";

  const mensagem = typeof d.mensagem === "string" ? d.mensagem.trim() : "";
  if (mensagem.length > 2000) erros.mensagem = "Mensagem muito longa (máximo 2000 caracteres).";

  if (Object.keys(erros).length > 0 || !tipo) return { erros };
  return { erros, limpo: { tipo, email, nome: nome || null, mensagem: mensagem || null } };
}

export async function registrarSolicitacaoTitular(d: DadosSolicitacao): Promise<
  | { ok: true; avisouEquipe: boolean }
  | { ok: false; erros?: ErrosSolicitacao; mensagem?: string }
> {
  const { erros, limpo } = validarSolicitacao(d);
  if (!limpo) return { ok: false, erros };

  const { data, error } = await supabaseAdmin()
    .from("solicitacoes_titular")
    .insert({ tipo: limpo.tipo, email: limpo.email, nome: limpo.nome, mensagem: limpo.mensagem })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[solicitacao-titular] falha ao gravar:", error?.code);
    return { ok: false, mensagem: "Não foi possível registrar agora. Tente novamente em instantes." };
  }

  // aviso à equipe: só com e-mail de privacidade real E Resend configurado
  let avisouEquipe = false;
  if (!estaPendente(EMPRESA.emailPrivacidade) && getEmailConfiguration().isConfigured) {
    const base = montarEmailBase({
      preheader: "Novo pedido de titular de dados",
      titulo: "Novo pedido de titular de dados",
      paragrafosHtml: [
        `Tipo: <strong>${escaparHtml(ROTULO_SOLICITACAO[limpo.tipo])}</strong>`,
        `E-mail do solicitante: ${escaparHtml(limpo.email)}`,
        limpo.mensagem ? `Mensagem: ${escaparHtml(limpo.mensagem)}` : "Sem mensagem.",
      ],
      paragrafosTexto: [`Tipo: ${ROTULO_SOLICITACAO[limpo.tipo]}`, `E-mail: ${limpo.email}`, limpo.mensagem ?? "Sem mensagem."],
      tom: "atencao",
    });
    const r = await sendEmail(
      { to: EMPRESA.emailPrivacidade, subject: "Novo pedido de titular de dados", html: base.html, text: base.text },
      "solicitacao_titular"
    );
    avisouEquipe = r.status === "enviado";
  }
  return { ok: true, avisouEquipe };
}

export type LinhaSolicitacao = {
  id: string;
  tipo: TipoSolicitacao;
  email: string;
  nome: string | null;
  mensagem: string | null;
  status: StatusSolicitacao;
  criada_em: string;
};

export async function listarSolicitacoes(): Promise<LinhaSolicitacao[]> {
  const { data } = await supabaseAdmin()
    .from("solicitacoes_titular")
    .select("id, tipo, email, nome, mensagem, status, criada_em")
    .order("criada_em", { ascending: false })
    .limit(300);
  return (data ?? []) as LinhaSolicitacao[];
}

export async function atualizarStatusSolicitacao(id: string, status: StatusSolicitacao): Promise<boolean> {
  if (!STATUS_SOLICITACAO.includes(status)) return false;
  const { data } = await supabaseAdmin().from("solicitacoes_titular").update({ status }).eq("id", id).select("id").maybeSingle();
  return Boolean(data);
}
