/**
 * Indicação por influenciador — rastreio e vínculo.
 *
 * Sem React, sem DOM. A origem da indicação sobrevive ao caminho
 * landing → cadastro → confirmação de e-mail → plano → pagamento por três
 * camadas, nenhuma delas confiando só na query string:
 *
 *   1. cookie httpOnly `zelo_ref` gravado pelo `proxy.ts` quando qualquer
 *      página chega com `?ref=CODIGO` (a landing inclusive);
 *   2. `user_metadata.ref`, gravado no `signUp` — sobrevive a abrir o link
 *      de confirmação em OUTRO navegador/aparelho, onde o cookie não existe;
 *   3. o vínculo persistido em `indicacoes` (UNIQUE por empresa), feito no
 *      servidor assim que há usuário autenticado. Depois dele o navegador
 *      deixa de importar: a comissão sai da relação gravada.
 *
 * A validação de verdade (código existe? ativo? é auto-indicação? a
 * empresa já pagou?) é a função SQL `vincular_indicacao`, atômica.
 */

import { supabaseAdmin } from "../supabase/admin";
import { normalizarCodigo } from "../indicacao-codigo";

export {
  COOKIE_INDICACAO,
  DURACAO_COOKIE_INDICACAO_DIAS,
  gerarCodigo,
  linkDeIndicacao,
  normalizarCodigo,
} from "../indicacao-codigo";

export type ResultadoVinculo =
  | "vinculada"
  | "ja_vinculada"
  | "codigo_invalido"
  | "autoindicacao"
  | "empresa_ja_paga"
  | "erro";

export async function vincularIndicacao(dados: {
  empresaId: string;
  userId: string;
  email: string | null;
  codigo: unknown;
}): Promise<ResultadoVinculo> {
  const codigo = normalizarCodigo(dados.codigo);
  if (!codigo) return "codigo_invalido";

  const { data, error } = await supabaseAdmin().rpc("vincular_indicacao", {
    p_empresa: dados.empresaId,
    p_codigo: codigo,
    p_user: dados.userId,
    p_email: dados.email,
  });

  if (error) {
    console.error("[indicacao] falha ao vincular:", error.code);
    return "erro";
  }
  return data as ResultadoVinculo;
}

/**
 * Tenta vincular a empresa recém-criada, na ordem: `user_metadata.ref`
 * (sobrevive a outro navegador) e depois o cookie. Nunca lança — indicação
 * é um extra e jamais pode impedir alguém de entrar no sistema.
 */
export async function vincularIndicacaoDoUsuario(dados: {
  userId: string;
  email: string | null;
  metadataRef: unknown;
  cookieRef: unknown;
}): Promise<ResultadoVinculo | "sem_codigo"> {
  const candidatos = [normalizarCodigo(dados.metadataRef), normalizarCodigo(dados.cookieRef)].filter(
    (c): c is string => Boolean(c)
  );
  if (candidatos.length === 0) return "sem_codigo";

  try {
    const { data: membro } = await supabaseAdmin()
      .from("membros")
      .select("empresa_id")
      .eq("user_id", dados.userId)
      .maybeSingle();
    if (!membro?.empresa_id) return "erro";

    let ultimo: ResultadoVinculo = "codigo_invalido";
    for (const codigo of candidatos) {
      ultimo = await vincularIndicacao({
        empresaId: membro.empresa_id,
        userId: dados.userId,
        email: dados.email,
        codigo,
      });
      if (ultimo === "vinculada" || ultimo === "ja_vinculada") return ultimo;
    }
    return ultimo;
  } catch (e) {
    console.error("[indicacao] falha inesperada ao vincular:", e instanceof Error ? e.message : "erro");
    return "erro";
  }
}
