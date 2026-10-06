import { NextResponse, type NextRequest } from "next/server";
import { executarManutencaoDiaria } from "@/lib/core/manutencao";

/**
 * Cron diário (ver `vercel.json`) — manutenção de conformidade:
 *  1. leva ao plano Grátis quem cancelou e chegou ao fim do período pago;
 *  2. elimina de vez contas excluídas que passaram do prazo de retenção —
 *     etapa DESLIGADA por padrão (exige `RETENCAO_JOB_ATIVO=true` e o prazo
 *     preenchido em `lib/legal.ts`).
 *
 * Mesma autenticação do cron de cobranças: 503 sem `CRON_SECRET` (problema do
 * servidor), 401 se o token não bate, comparação em tempo constante.
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
    console.error("[cron/manutencao] CRON_SECRET ausente — endpoint desabilitado.");
    return NextResponse.json({ ok: false, erro: "Cron não configurado." }, { status: 503 });
  }

  const recebido = request.headers.get("authorization")?.replace("Bearer ", "").trim() ?? "";
  if (!recebido || !comparaEmTempoConstante(recebido, segredo)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const resumo = await executarManutencaoDiaria();
  return NextResponse.json({ ok: true, ...resumo });
}
