"use server";

import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/enviar";
import { enderecoDeEmailValido, estadoDoEmailDoCliente, mascararEmail } from "@/lib/email/estado";
import { templateAutorizacaoCliente } from "@/lib/email/templates/autorizacao-cliente";
import { primeiroNome } from "@/lib/whatsapp";
import { formatarCentavos } from "@/lib/dinheiro";
import { registrarAcaoFinanceira } from "@/lib/core/auditoria";

/** No máximo isto por autorização, por dia: o e-mail sai do domínio do Zelo, então não pode virar spam. */
const LIMITE_EMAILS_POR_DIA = 3;

/**
 * Envio por e-mail do link de AUTORIZAÇÃO da cobrança automática ao cliente.
 *
 * Só sai quando o profissional clica, só para o e-mail que ele cadastrou no
 * cliente, e só enquanto existe uma autorização aguardando o cliente
 * (`CREATED`). Não muda nada financeiro. Mensagens para a pessoa, sem termos
 * técnicos; o detalhe vai só para o log.
 */

export type ResultadoEnvioAutorizacao = { ok: boolean; mensagem: string };

export async function enviarAutorizacaoPorEmail(recorrenciaId: string): Promise<ResultadoEnvioAutorizacao> {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!atual || !empresaId) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const supabase = await supabaseServer();
  const { data: rec } = await supabase
    .from("recorrencias")
    .select("id, valor_centavos, dia_vencimento, status, clientes(nome, email)")
    .eq("id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!rec || rec.status !== "ativa") return { ok: false, mensagem: "Recorrência não encontrada." };

  const cliente = (rec.clientes ?? null) as unknown as { nome: string; email: string | null } | null;
  const destino = cliente?.email?.trim() ?? "";
  if (!enderecoDeEmailValido(destino)) {
    return { ok: false, mensagem: "Este cliente não tem um e-mail cadastrado. Adicione o e-mail na ficha do cliente." };
  }
  if (estadoDoEmailDoCliente(destino) === "nao_configurado") {
    return { ok: false, mensagem: "E-mail ainda não configurado. Use o WhatsApp ou copie o link." };
  }

  const { data: autorizacao } = await supabase
    .from("autorizacoes_pix")
    .select("id")
    .eq("recorrencia_id", recorrenciaId)
    .eq("empresa_id", empresaId)
    .eq("status", "CREATED")
    .maybeSingle();
  if (!autorizacao) return { ok: false, mensagem: "A autorização ainda não está pronta para enviar. Atualize a página." };

  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await supabase
    .from("log_acoes_financeiras")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("acao", "autorizacao_email_enviado")
    .eq("entidade_id", autorizacao.id)
    .gte("criado_em", desde);
  if ((count ?? 0) >= LIMITE_EMAILS_POR_DIA) {
    return { ok: false, mensagem: "Você já enviou este e-mail 3 vezes hoje. Para não incomodar o cliente, tente amanhã ou use o WhatsApp." };
  }

  const { data: empresa } = await supabase.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
  const site = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.zelopay.com.br").replace(/\/+$/, "");

  const email = templateAutorizacaoCliente({
    nomeCliente: primeiroNome(cliente?.nome),
    nomeEmpresa: empresa?.nome ?? "",
    valor: formatarCentavos(rec.valor_centavos),
    diaVencimento: rec.dia_vencimento,
    link: `${site}/autorizar/${autorizacao.id}`,
  });

  const envio = await sendEmail({ to: destino, ...email }, "autorizacao_cliente");
  if (envio.status === "nao_configurado") return { ok: false, mensagem: "E-mail ainda não configurado. Use o WhatsApp ou copie o link." };
  if (envio.status !== "enviado") {
    console.error("[envio-autorizacao] e-mail não enviado:", envio.status);
    return { ok: false, mensagem: "Não conseguimos enviar o e-mail agora. Tente novamente em instantes." };
  }
  await registrarAcaoFinanceira(empresaId, atual.user.id, "autorizacao_email_enviado", autorizacao.id);
  return { ok: true, mensagem: `E-mail enviado para ${mascararEmail(destino)}.` };
}
