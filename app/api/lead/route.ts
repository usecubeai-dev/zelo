import { NextResponse } from "next/server";
import { Lead, normalizarLead, validarLead } from "@/lib/lead";
import { inserirLead, supabaseConfigurado } from "@/lib/supabase/admin";

/**
 * Recebe o pré-cadastro de /comecar.
 *
 * Só existe `POST`: o App Router responde 405 sozinho para qualquer outro
 * método, então não há verificação manual a fazer.
 *
 * A regra que justifica esta rota existir: **a validação do navegador não
 * vale nada aqui**. Qualquer um manda um POST direto, sem passar pelo
 * formulário. Por isso tudo é normalizado e validado de novo, com as mesmas
 * funções de `lib/lead.ts` — mesmas regras, um lugar só.
 */

export const runtime = "nodejs";
/* nada aqui pode ser pré-renderizado nem cacheado */
export const dynamic = "force-dynamic";

type Corpo = Partial<Record<keyof Lead, unknown>>;

/** Aceita só string e corta o tamanho: proteção barata contra payload absurdo. */
function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, 200) : "";
}

export async function POST(requisicao: Request) {
  let corpo: Corpo;
  try {
    corpo = (await requisicao.json()) as Corpo;
  } catch {
    return NextResponse.json(
      { estado: "invalido", erros: {} },
      { status: 400 }
    );
  }

  /* só os três campos que o contrato conhece. O que vier além é descartado
     aqui — não chega nem a ser considerado para gravação. */
  const lead = normalizarLead({
    nome: texto(corpo.nome),
    whatsapp: texto(corpo.whatsapp),
    email: texto(corpo.email),
  });

  const erros = validarLead(lead);
  if (Object.keys(erros).length) {
    return NextResponse.json({ estado: "invalido", erros }, { status: 422 });
  }

  if (!supabaseConfigurado()) {
    /* 503: o serviço existe, o destino é que não está ligado ainda. */
    return NextResponse.json({ estado: "nao-configurado" }, { status: 503 });
  }

  const resultado = await inserirLead(lead, "comecar");

  if (resultado.ok) {
    return NextResponse.json({ estado: "registrado" }, { status: 201 });
  }

  if (resultado.motivo === "nao-configurado") {
    return NextResponse.json({ estado: "nao-configurado" }, { status: 503 });
  }

  /* O detalhe fica no log do servidor. Para o navegador vai uma frase que
     não revela tabela, coluna, constraint nem nada da infraestrutura. */
  console.error("[lead] falha ao gravar:", resultado.detalhe);
  return NextResponse.json(
    { estado: "erro", mensagem: "Não conseguimos registrar agora. Tente de novo em instantes." },
    { status: 502 }
  );
}
