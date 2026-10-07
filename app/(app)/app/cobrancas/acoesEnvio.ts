"use server";

import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { enderecoDeEmailValido, estadoDoEmailDoCliente, mascararEmail } from "@/lib/email/estado";
import { sendEmail } from "@/lib/email/enviar";
import { templateCobrancaCliente } from "@/lib/email/templates/cobranca-cliente";
import { linkDePagamentoDaCobranca } from "@/lib/core/link-cobranca";
import { sincronizarCobrancaFinanceira } from "@/lib/core/cobranca-financeira";
import { dataCurta, primeiroNome } from "@/lib/whatsapp";
import { formatarCentavos } from "@/lib/dinheiro";
import { diasAte, hojeISO } from "@/lib/cobranca";
import { revalidatePath } from "next/cache";

/**
 * "Enviar para o cliente" — o lado do SERVIDOR do envio por e-mail e da
 * preparação do link.
 *
 * O e-mail só sai quando o profissional clica (nunca automático), só para o
 * e-mail que ele mesmo cadastrou no cliente, e com o link público de
 * pagamento que o parceiro de pagamentos já gerou. Nada aqui muda estado
 * financeiro: cobrança não vira "paga", valor nunca vem do navegador.
 *
 * As mensagens devolvidas são para a pessoa (sem código, sem JSON, sem nome
 * de fornecedor): o detalhe técnico vai só para o log do servidor.
 */

export type ResultadoEnvio =
  | { ok: true; mensagem: string }
  | {
      ok: false;
      codigo: "sessao" | "nao_encontrada" | "nao_aberta" | "sem_email" | "sem_link" | "nao_configurado" | "limite" | "indisponivel";
      mensagem: string;
    };

/** No máximo isto por cobrança, por dia: protege o cliente final de spam e o remetente de reputação ruim. */
const LIMITE_EMAILS_POR_DIA = 3;
/** Teto por empresa, por dia, somando todas as cobranças. */
const LIMITE_EMAILS_EMPRESA_POR_DIA = 50;

export async function enviarCobrancaPorEmail(cobrancaId: string): Promise<ResultadoEnvio> {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!atual || !empresaId) return { ok: false, codigo: "sessao", mensagem: "Sessão expirada. Entre de novo." };

  const supabase = await supabaseServer();
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, status, valor_centavos, vence_em, asaas_payment_id, clientes(nome, email)")
    .eq("id", cobrancaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!cobranca) return { ok: false, codigo: "nao_encontrada", mensagem: "Cobrança não encontrada." };
  if (cobranca.status !== "pendente" && cobranca.status !== "enviada") {
    return { ok: false, codigo: "nao_aberta", mensagem: "Esta cobrança não está em aberto." };
  }

  const cliente = (cobranca.clientes ?? null) as unknown as { nome: string; email: string | null } | null;
  const destino = cliente?.email?.trim() ?? "";
  if (!enderecoDeEmailValido(destino)) {
    return { ok: false, codigo: "sem_email", mensagem: "Este cliente não tem um e-mail cadastrado. Adicione o e-mail na ficha do cliente." };
  }

  // não esconde o problema: sem configuração, o profissional é avisado — e a cobrança continua normal
  if (estadoDoEmailDoCliente(destino) === "nao_configurado") {
    return { ok: false, codigo: "nao_configurado", mensagem: "E-mail ainda não configurado. Use o WhatsApp ou copie o link." };
  }

  const resultadoLink = await linkDePagamentoDaCobranca(empresaId, cobranca.asaas_payment_id);
  if (!resultadoLink.ok) {
    return { ok: false, codigo: "indisponivel", mensagem: "Não conseguimos preparar o pagamento agora. Tente novamente em instantes." };
  }
  if (!resultadoLink.link) {
    return { ok: false, codigo: "sem_link", mensagem: "O link de pagamento ainda está sendo preparado. Atualize em alguns segundos." };
  }

  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await supabase
    .from("acoes_cobranca")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("cobranca_id", cobrancaId)
    .eq("tipo", "email")
    .gte("criado_em", desde);
  if ((count ?? 0) >= LIMITE_EMAILS_POR_DIA) {
    return { ok: false, codigo: "limite", mensagem: "Você já enviou este e-mail 3 vezes hoje. Para não incomodar o cliente, tente amanhã ou use o WhatsApp." };
  }

  const { count: totalEmpresa } = await supabase
    .from("acoes_cobranca")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("tipo", "email")
    .gte("criado_em", desde);
  if ((totalEmpresa ?? 0) >= LIMITE_EMAILS_EMPRESA_POR_DIA) {
    return { ok: false, codigo: "limite", mensagem: "Você atingiu o limite de e-mails de hoje. Use o WhatsApp ou copie o link, ou tente amanhã." };
  }

  const { data: empresa } = await supabase.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
  const hoje = hojeISO();
  const dias = diasAte(cobranca.vence_em, hoje);
  const email = templateCobrancaCliente({
    nomeCliente: primeiroNome(cliente?.nome),
    nomeEmpresa: empresa?.nome ?? "",
    valor: formatarCentavos(cobranca.valor_centavos),
    vencimento: dataCurta(cobranca.vence_em, hoje),
    situacao: dias < 0 ? "vencida" : dias === 0 ? "vence_hoje" : "a_vencer",
    link: resultadoLink.link,
  });

  const envio = await sendEmail({ to: destino, ...email }, "cobranca_cliente");
  if (envio.status === "nao_configurado") {
    return { ok: false, codigo: "nao_configurado", mensagem: "E-mail ainda não configurado. Use o WhatsApp ou copie o link." };
  }
  if (envio.status !== "enviado") {
    console.error("[envio-cobranca] e-mail não enviado:", envio.status);
    return { ok: false, codigo: "indisponivel", mensagem: "Não conseguimos enviar o e-mail agora. Tente novamente em instantes." };
  }

  // registro leve (última ação / histórico); uma falha aqui não desfaz o envio que já aconteceu
  await supabase.from("acoes_cobranca").insert({ empresa_id: empresaId, cobranca_id: cobrancaId, tipo: "email", usuario_id: atual.user.id });
  // o e-mail FOI enviado (diferente de "WhatsApp aberto"): a cobrança passa a "Enviada". Só sai de pendente, nunca mexe em paga/cancelada.
  await supabase.from("cobrancas").update({ status: "enviada" }).eq("id", cobrancaId).eq("empresa_id", empresaId).eq("status", "pendente");
  revalidatePath(`/app/cobrancas/${cobrancaId}`);
  return { ok: true, mensagem: `E-mail enviado para ${mascararEmail(destino)}.` };
}

/**
 * "Atualizar" / "Tentar de novo" quando o link de pagamento ainda não existe:
 * refaz a preparação do pagamento (idempotente — nunca cria uma segunda
 * cobrança) e devolve se já há link.
 */
export async function prepararPagamentoDaCobranca(cobrancaId: string): Promise<{ pronto: boolean; mensagem: string | null }> {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!atual || !empresaId) return { pronto: false, mensagem: "Sessão expirada. Entre de novo." };

  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("cobrancas")
    .select("asaas_payment_id, status")
    .eq("id", cobrancaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!c) return { pronto: false, mensagem: "Cobrança não encontrada." };
  if (c.status !== "pendente" && c.status !== "enviada") return { pronto: false, mensagem: "Esta cobrança não está em aberto." };

  if (!c.asaas_payment_id) {
    const r = await sincronizarCobrancaFinanceira(cobrancaId, empresaId, atual.user.id);
    if (!r.ok) {
      return { pronto: false, mensagem: "Não conseguimos preparar o pagamento agora. Tente novamente em instantes." };
    }
  }
  const link = await linkDePagamentoDaCobranca(empresaId, (await supabase.from("cobrancas").select("asaas_payment_id").eq("id", cobrancaId).maybeSingle()).data?.asaas_payment_id);
  revalidatePath(`/app/cobrancas/${cobrancaId}`);
  if (!link.ok) return { pronto: false, mensagem: "Não conseguimos preparar o pagamento agora. Tente novamente em instantes." };
  return link.link ? { pronto: true, mensagem: null } : { pronto: false, mensagem: "O link de pagamento ainda está sendo preparado. Atualize em alguns segundos." };
}
