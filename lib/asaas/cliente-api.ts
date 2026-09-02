/**
 * Cliente HTTP desacoplado para a API do Asaas v3.
 *
 * Roda apenas no servidor. Nunca expõe chaves.
 */

import { CredencialAsaas, credencialDaPlataforma } from "./config";
import { AsaasApiErrorResponse } from "./tipos";

export type RespostaAsaas<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; erro: string; errosApi?: AsaasApiErrorResponse["errors"] };

export type OpcoesRequisicao = {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  corpo?: unknown;
  parametros?: Record<string, string | number | boolean | undefined>;
  /**
   * Conta pela qual a requisição sai.
   *
   * Omitir significa "a conta do próprio Zelo" — que é o comportamento
   * que existia antes das subcontas e continua valendo para a mensalidade
   * da plataforma. Operações em nome de um profissional passam a
   * credencial da subconta dele, resolvida por
   * `credencialDaEmpresa(empresaId)`.
   */
  credencial?: CredencialAsaas;
  /** Timeout em ms. Padrão 15s — nenhuma chamada ao Asaas deve travar a requisição do usuário para sempre. */
  timeoutMs?: number;
};

const TIMEOUT_PADRAO_MS = 15_000;

export async function asaasRequisicao<T>(
  caminho: string,
  opcoes: OpcoesRequisicao = {}
): Promise<RespostaAsaas<T>> {
  const credencial = opcoes.credencial ?? credencialDaPlataforma();

  if (!credencial) {
    return {
      ok: false,
      status: 503,
      erro: "Integração Asaas não configurada (ASAAS_API_KEY ausente).",
    };
  }

  const { metodo = "GET", corpo, parametros, timeoutMs = TIMEOUT_PADRAO_MS } = opcoes;

  let url = `${credencial.baseUrl}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
  if (parametros) {
    const sp = new URLSearchParams();
    Object.entries(parametros).forEach(([k, v]) => {
      if (v !== undefined) sp.set(k, String(v));
    });
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: {
        access_token: credencial.apiKey,
        "Content-Type": "application/json",
        UserAgent: "Zelo/1.0",
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
      signal: controlador.signal,
    });

    const texto = await res.text();
    let dadosJson: unknown = null;
    try {
      dadosJson = texto ? JSON.parse(texto) : null;
    } catch {
      dadosJson = null;
    }

    if (!res.ok) {
      const errObj = dadosJson as AsaasApiErrorResponse | null;
      const primeiroErro = errObj?.errors?.[0]?.description;
      return {
        ok: false,
        status: res.status,
        erro: primeiroErro || `Erro na API do Asaas (HTTP ${res.status}).`,
        errosApi: errObj?.errors,
      };
    }

    return {
      ok: true,
      data: dadosJson as T,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, status: 504, erro: "O Asaas demorou demais para responder. Tente novamente." };
    }
    return {
      ok: false,
      status: 500,
      erro: err instanceof Error ? err.message : "Erro de comunicação com o Asaas.",
    };
  } finally {
    clearTimeout(temporizador);
  }
}
