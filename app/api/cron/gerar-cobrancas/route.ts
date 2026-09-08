import { NextResponse, type NextRequest } from "next/server";
import { executarGeracaoAutomaticaDeCobrancas } from "@/lib/core/agendador-cobrancas";

/**
 * Cron diário (ver `vercel.json`) — dispara o próximo ciclo de toda
 * recorrência com Pix Automático ativo. É a peça que faltava para
 * "cobrança recorrente automática" ser automática de verdade: antes
 * deste endpoint, o único jeito de gerar o próximo ciclo era o
 * profissional clicar em "Gerar próxima cobrança" na tela — todo mês,
 * um por um.
 *
 * Mesma disciplina do webhook do Asaas (`app/api/webhooks/asaas`):
 * 503 quando o segredo não está configurado (problema do servidor,
 * não de quem chamou), 401 quando o token não bate, comparação em
 * tempo constante para não vazar o segredo por timing.
 *
 * Autenticação: a Vercel envia `Authorization: Bearer $CRON_SECRET`
 * automaticamente em Cron Jobs quando `CRON_SECRET` está definida no
 * projeto — não é preciso configurar nada além da env var.
 */
function comparaEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error("[cron/gerar-cobrancas] CRON_SECRET ausente — endpoint desabilitado.");
    return NextResponse.json({ ok: false, erro: "Cron não configurado." }, { status: 503 });
  }

  const recebido = request.headers.get("authorization")?.replace("Bearer ", "").trim() ?? "";
  if (!recebido || !comparaEmTempoConstante(recebido, segredo)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const resumo = await executarGeracaoAutomaticaDeCobrancas();

  if (resumo.falhas.length > 0) {
    console.error("[cron/gerar-cobrancas] falhas nesta execução:", JSON.stringify(resumo.falhas));
  }

  return NextResponse.json({ ok: true, ...resumo });
}
