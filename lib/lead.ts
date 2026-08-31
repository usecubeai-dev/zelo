/**
 * O contrato do pré-cadastro da Zelo.
 *
 * Este módulo existe para ser a ÚNICA definição do que é um lead: o formato,
 * as regras de validação e o ponto de registro. Ele não importa React nem
 * nada do DOM de propósito — quando o backend existir, o servidor vai
 * precisar revalidar o que chega (validação de cliente nunca é garantia:
 * qualquer um faz um POST direto), e vai poder usar exatamente estas mesmas
 * regras em vez de reescrevê-las e divergir.
 *
 * Só os três campos que o fluxo pediu. Nada além do necessário: cada campo a
 * mais é um dado pessoal a proteger e um motivo a mais para desistir.
 */

export type Lead = {
  nome: string;
  whatsapp: string;
  email: string;
};

export type CampoLead = keyof Lead;

export type ErrosLead = Partial<Record<CampoLead, string>>;

export const LEAD_VAZIO: Lead = { nome: "", whatsapp: "", email: "" };

/** Rótulos em um lugar só — o formulário e as mensagens leem daqui. */
export const ROTULOS: Record<CampoLead, string> = {
  nome: "Nome",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

/**
 * Normaliza antes de validar e de enviar: espaços sobrando e caixa do e-mail
 * são erro de digitação, não erro do visitante. O WhatsApp guarda só dígitos,
 * que é o formato que qualquer destino final vai querer.
 */
export function normalizarLead(lead: Lead): Lead {
  return {
    nome: lead.nome.trim().replace(/\s+/g, " "),
    whatsapp: lead.whatsapp.replace(/\D/g, ""),
    email: lead.email.trim().toLowerCase(),
  };
}

/**
 * Regras deliberadamente frouxas: o objetivo é impedir engano óbvio, não
 * provar que o dado é verdadeiro. Só a confirmação real (uma mensagem no
 * WhatsApp, um e-mail) prova isso, e ela ainda não existe.
 *
 * 10 dígitos = DDD + 8 (fixo antigo); 11 = DDD + 9 (celular). Acima de 13
 * já não é número brasileiro plausível nem com código de país.
 */
export function validarLead(lead: Lead): ErrosLead {
  const limpo = normalizarLead(lead);
  const erros: ErrosLead = {};

  if (limpo.nome.length < 2) {
    erros.nome = "Informe seu nome.";
  }

  if (limpo.whatsapp.length < 10 || limpo.whatsapp.length > 13) {
    erros.whatsapp = "Informe um WhatsApp com DDD.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo.email)) {
    erros.email = "Informe um e-mail válido.";
  }

  return erros;
}

/** Ordem de leitura do formulário — usada para focar o PRIMEIRO inválido. */
export const ORDEM_CAMPOS: CampoLead[] = ["nome", "whatsapp", "email"];

export function primeiroCampoInvalido(erros: ErrosLead): CampoLead | null {
  return ORDEM_CAMPOS.find((campo) => erros[campo]) ?? null;
}

/* ============================================================
   O PONTO DE REGISTRO
   ============================================================ */

export type ResultadoLead =
  /** o lead chegou ao destino e o cadastro pode seguir */
  | { estado: "registrado" }
  /** não há destino configurado: nada saiu deste navegador */
  | { estado: "nao-configurado" }
  /** o servidor revalidou e recusou — alguém passou por cima do formulário */
  | { estado: "invalido"; erros: ErrosLead }
  /** havia destino, mas o envio falhou */
  | { estado: "erro"; mensagem: string };

/** Para onde o formulário manda. Rota interna: nenhum segredo no cliente. */
export const ENDPOINT_LEAD = "/api/lead";

/**
 * Envia o lead para a rota interna.
 *
 * Este arquivo é importado pelo componente cliente, então ele NÃO conhece
 * Supabase, URL de banco nem chave nenhuma — só um caminho relativo. Quem
 * fala com o banco é `app/api/lead/route.ts`, no servidor.
 *
 * O servidor revalida tudo com `validarLead`, então um 422 aqui significa
 * que alguém passou por cima do formulário: devolvemos os erros por campo
 * do mesmo jeito, e a interface reaproveita a exibição que já existe.
 */
export async function registrarLead(lead: Lead): Promise<ResultadoLead> {
  try {
    const resposta = await fetch(ENDPOINT_LEAD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizarLead(lead)),
    });

    if (resposta.status === 201) return { estado: "registrado" };
    if (resposta.status === 503) return { estado: "nao-configurado" };

    if (resposta.status === 422) {
      const corpo = (await resposta.json().catch(() => null)) as
        | { erros?: ErrosLead }
        | null;
      return {
        estado: "invalido",
        erros: corpo?.erros ?? {},
      };
    }

    const corpo = (await resposta.json().catch(() => null)) as
      | { mensagem?: string }
      | null;
    return {
      estado: "erro",
      mensagem:
        corpo?.mensagem ??
        "Não conseguimos registrar agora. Tente de novo em instantes.",
    };
  } catch {
    /* offline, DNS, servidor fora do ar — nada disso é culpa do visitante,
       e nenhum detalhe técnico ajuda ele aqui */
    return {
      estado: "erro",
      mensagem: "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
    };
  }
}
