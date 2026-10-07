/**
 * Pagamento da assinatura do Zelo — o que o checkout precisa mostrar e a
 * conferência "Já paguei — atualizar".
 *
 * ⚠ SERVIDOR APENAS. Não cria assinatura (isso é `iniciarAssinaturaZelo`) e não
 * muda a conta por conta própria: só LÊ o pagamento em aberto no parceiro de
 * pagamentos (valor, vencimento, QR Pix, link da página segura) e, na
 * conferência, PERGUNTA ao parceiro o estado atual. Se ele confirma o
 * recebimento, o evento passa pelo MESMO caminho do webhook
 * (`processarEventoWebhook`) — mesma idempotência, mesma regra de ativação.
 * Clicar, voltar da página de pagamento ou ver "sucesso" na URL nunca ativam.
 */

import { supabaseAdmin } from "../supabase/admin";
import { credencialDaPlataforma, contaDaPlataforma } from "../asaas/config";
import { listarCobrancasDaAssinatura } from "../asaas/assinatura";
import { obterPixQrCode } from "../asaas/cobranca";
import { processarEventoWebhook } from "../asaas/webhook";
import type { AsaasPayment, AsaasWebhookPayload } from "../asaas/tipos";
import { linkPublicoValido } from "../whatsapp";
import { EstadoPagamento, estadoDoPagamento } from "../checkout";
import { Plano, normalizarPlano } from "../plano";

export type PixDoPagamento = {
  /** "copia e cola" */
  payload: string;
  /** imagem do QR em base64 (PNG) */
  imagem: string | null;
  expiraEm: string | null;
};

export type PagamentoDaAssinatura = {
  plano: Plano;
  valorCentavos: number;
  vencimento: string | null;
  estado: EstadoPagamento;
  /** Pix disponível (só enquanto aguarda pagamento) */
  pix: PixDoPagamento | null;
  /** página segura do parceiro: o cliente escolhe cartão, Pix ou boleto lá */
  linkSeguro: string | null;
  /** boleto, quando o parceiro gerou um */
  linkBoleto: string | null;
};

export type ResultadoPagamento =
  | { ok: true; pagamento: PagamentoDaAssinatura | null }
  | { ok: false; mensagem: string };

const SEM_PROVEDOR = "Não conseguimos preparar o pagamento agora. Tente novamente em instantes.";

async function dadosDaEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin()
    .from("empresas")
    .select("asaas_subscription_id, plano, plano_escolhido")
    .eq("id", empresaId)
    .maybeSingle();
  return data as { asaas_subscription_id: string | null; plano: string | null; plano_escolhido: string | null } | null;
}

/** A cobrança a mostrar: a em aberto (a mais antiga), senão a mais recente. */
function escolherCobranca(lista: AsaasPayment[]): AsaasPayment | null {
  return lista.find((p) => p.status === "PENDING" || p.status === "OVERDUE") ?? lista[0] ?? null;
}

async function mensalidadePaga(empresaId: string, paymentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("mensalidades")
    .select("status")
    .eq("empresa_id", empresaId)
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  return data?.status === "paga";
}

/**
 * Lê o pagamento da assinatura em andamento. `pagamento: null` = não há
 * assinatura paga em andamento (ex.: conta no Grátis, ou ainda sem plano).
 */
export async function obterPagamentoDaAssinatura(empresaId: string): Promise<ResultadoPagamento> {
  const empresa = await dadosDaEmpresa(empresaId);
  if (!empresa?.asaas_subscription_id) return { ok: true, pagamento: null };

  const cred = credencialDaPlataforma();
  if (!cred) return { ok: false, mensagem: SEM_PROVEDOR };

  try {
    const lista = await listarCobrancasDaAssinatura(empresa.asaas_subscription_id);
    if (!lista.ok) return { ok: false, mensagem: SEM_PROVEDOR };
    const cobranca = escolherCobranca(lista.data.data);
    if (!cobranca) return { ok: true, pagamento: null };

    const confirmado = await mensalidadePaga(empresaId, cobranca.id);
    const estado = estadoDoPagamento({ statusProvedor: cobranca.status, confirmadoNoBanco: confirmado });

    let pix: PixDoPagamento | null = null;
    if (estado === "aguardando") {
      const qr = await obterPixQrCode(cobranca.id);
      if (qr.ok && qr.data.payload) {
        pix = { payload: qr.data.payload, imagem: qr.data.encodedImage || null, expiraEm: qr.data.expirationDate || null };
      }
    }

    const plano = normalizarPlano(empresa.plano_escolhido) ?? normalizarPlano(empresa.plano) ?? "essencial";
    return {
      ok: true,
      pagamento: {
        plano,
        valorCentavos: Math.round(cobranca.value * 100),
        vencimento: cobranca.dueDate ?? null,
        estado,
        pix,
        linkSeguro: linkPublicoValido(cobranca.invoiceUrl),
        linkBoleto: linkPublicoValido(cobranca.bankSlipUrl),
      },
    };
  } catch {
    return { ok: false, mensagem: SEM_PROVEDOR };
  }
}

export type ResultadoConferencia = { ok: true; estado: EstadoPagamento | "sem_pagamento" } | { ok: false; mensagem: string };

/**
 * "Já paguei — atualizar": pergunta ao parceiro o estado ATUAL do pagamento.
 * Se ele já recebeu, aplica o evento pelo mesmo caminho do webhook (idempotente:
 * se o webhook real chegar depois, nada é contado duas vezes). Se ainda não,
 * devolve o estado — nunca altera a assinatura por conta própria.
 */
export async function conferirPagamentoDaAssinatura(empresaId: string): Promise<ResultadoConferencia> {
  const empresa = await dadosDaEmpresa(empresaId);
  if (!empresa?.asaas_subscription_id) return { ok: true, estado: "sem_pagamento" };
  if (!credencialDaPlataforma()) return { ok: false, mensagem: SEM_PROVEDOR };

  try {
    const lista = await listarCobrancasDaAssinatura(empresa.asaas_subscription_id);
    if (!lista.ok) return { ok: false, mensagem: SEM_PROVEDOR };
    const cobranca = escolherCobranca(lista.data.data);
    if (!cobranca) return { ok: true, estado: "sem_pagamento" };

    const recebido = cobranca.status === "RECEIVED" || cobranca.status === "CONFIRMED";
    if (recebido && !(await mensalidadePaga(empresaId, cobranca.id))) {
      const conta = contaDaPlataforma();
      const evento: AsaasWebhookPayload = {
        // o id é determinístico: repetir a conferência não cria um segundo evento
        id: `conferencia:${cobranca.id}:${cobranca.status}`,
        event: cobranca.status === "RECEIVED" ? "PAYMENT_RECEIVED" : "PAYMENT_CONFIRMED",
        dateCreated: new Date().toISOString(),
        account: conta ? { id: conta } : undefined,
        payment: cobranca,
      };
      const r = await processarEventoWebhook(evento);
      if (!r.ok) console.error("[pagamento-assinatura] conferência não aplicada, status", r.statusHttp);
    }

    const confirmado = await mensalidadePaga(empresaId, cobranca.id);
    return { ok: true, estado: estadoDoPagamento({ statusProvedor: cobranca.status, confirmadoNoBanco: confirmado }) };
  } catch {
    return { ok: false, mensagem: SEM_PROVEDOR };
  }
}
