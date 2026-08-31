import { NextResponse, type NextRequest } from "next/server";
import {
  processarEventoWebhook,
  validarTokenWebhook,
  webhookConfigurado,
} from "@/lib/asaas/webhook";
import { AsaasWebhookPayload } from "@/lib/asaas/tipos";

/**
 * Endpoint de Webhook do Asaas.
 *
 * 1. Exige `ASAAS_WEBHOOK_TOKEN` configurado — sem fallback para a API key.
 * 2. Autentica pelo header `asaas-access-token`.
 * 3. Resolve o tenant por `account.id` antes de escrever qualquer coisa.
 * 4. Idempotência por `eventos_asaas.asaas_event_id`.
 */
export async function POST(request: NextRequest) {
  /* 503, e não 401, quando falta o token no ambiente: o problema é do
     servidor, não de quem chamou. Confundir os dois faria o Asaas parar
     de reenviar um evento que nunca deveria ter sido recusado. */
  if (!webhookConfigurado()) {
    console.error("[webhook/asaas] ASAAS_WEBHOOK_TOKEN ausente — endpoint desabilitado.");
    return NextResponse.json(
      { ok: false, erro: "Webhook não configurado." },
      { status: 503 }
    );
  }

  const token =
    request.headers.get("asaas-access-token") ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    null;

  if (!validarTokenWebhook(token)) {
    return NextResponse.json(
      { ok: false, erro: "Não autorizado: token de webhook inválido." },
      { status: 401 }
    );
  }

  let body: AsaasWebhookPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, erro: "Formato JSON inválido." },
      { status: 400 }
    );
  }

  if (!body || !body.event || !body.id) {
    return NextResponse.json(
      { ok: false, erro: "Payload de webhook incompleto." },
      { status: 400 }
    );
  }

  const resultado = await processarEventoWebhook(body);

  if (!resultado.ok) {
    return NextResponse.json(
      { ok: false, erro: resultado.erro },
      { status: resultado.statusHttp || 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    received: true,
    id: resultado.eventoId,
    idempotente: resultado.idempotente || false,
  });
}
