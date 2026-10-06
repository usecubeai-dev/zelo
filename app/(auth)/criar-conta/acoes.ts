"use server";

import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { COOKIE_INDICACAO, normalizarCodigo } from "@/lib/indicacao-codigo";
import { vincularIndicacaoDoUsuario } from "@/lib/core/indicacao";
import { origemDaRequisicao, registrarAceite } from "@/lib/core/aceite-legal";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { ehPlano } from "@/lib/plano";
import { verificarLimite } from "@/lib/limitador";
import { mensagemDeErroAuth, normalizarEmail, validarCadastro, type ErrosConta } from "@/lib/conta";

/** Código de indicação guardado no cookie (ou `null`). Só formato — a validade real é do banco. */
export async function indicacaoDoCookie(): Promise<string | null> {
  const armazem = await cookies();
  return normalizarCodigo(armazem.get(COOKIE_INDICACAO)?.value);
}

export type DadosCriarConta = {
  nome: string;
  email: string;
  senha: string;
  /** o checkbox "Li e aceito os Termos de Uso e a Política de Privacidade" */
  aceite: boolean;
  ref?: string | null;
  plano?: string | null;
};

export type ResultadoCriarConta =
  | { ok: true; precisaConfirmarEmail: boolean }
  | { ok: false; erros?: ErrosConta & { aceite?: string }; mensagem?: string };

/**
 * Cria a conta — SEMPRE aqui, no servidor.
 *
 * Sem o aceite dos Termos e da Política a conta NÃO é criada: a checagem
 * acontece antes de qualquer chamada ao provedor de autenticação, então
 * burlar o formulário (desabilitar o `required`, chamar a action direto)
 * não cria conta sem aceite. Com o aceite, a prova é gravada com a versão
 * dos documentos, a data e o IP/user agent que o SERVIDOR viu.
 *
 * Se a gravação do aceite falhar depois da conta criada, nada se perde: a
 * conta nasce sem aceite vigente e o primeiro acesso cai em `/aceite`.
 */
export async function criarConta(dados: DadosCriarConta): Promise<ResultadoCriarConta> {
  const erros: ErrosConta & { aceite?: string } = validarCadastro({ nome: dados.nome ?? "", email: dados.email ?? "", senha: dados.senha ?? "" });
  if (dados.aceite !== true) {
    erros.aceite = "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.";
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const cab = await headers();
  const origem = origemDaRequisicao(cab);

  const limite = verificarLimite(`cadastro:${origem.ip ?? "desconhecido"}`, 10, 10 * 60 * 1000);
  if (!limite.permitido) return { ok: false, mensagem: "Muitas tentativas em pouco tempo. Aguarde alguns minutos." };

  const armazem = await cookies();
  const ref = normalizarCodigo(dados.ref) ?? normalizarCodigo(armazem.get(COOKIE_INDICACAO)?.value);
  const planoEscolhido = ehPlano(dados.plano) ? dados.plano : null;

  const base = (cab.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? `https://${cab.get("host") ?? "www.zelopay.com.br"}`).replace(/\/+$/, "");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: normalizarEmail(dados.email),
    password: dados.senha,
    options: {
      /* o trigger usa `nome` para nomear a empresa. `ref` e `plano_escolhido`
         viajam só como intenção (a indicação é validada no banco e o plano só
         vale quando confirmado em /app/assinatura). As versões aceitas ficam
         no metadado também, como segunda cópia da prova. */
      data: {
        nome: dados.nome.trim().replace(/\s+/g, " "),
        ...(ref ? { ref } : {}),
        ...(planoEscolhido ? { plano_escolhido: planoEscolhido } : {}),
        termos_versao: TERMS_VERSION,
        privacidade_versao: PRIVACY_VERSION,
      },
      emailRedirectTo: `${base}/auth/callback?proximo=/app/assinatura`,
    },
  });
  if (error) return { ok: false, mensagem: mensagemDeErroAuth(error.message) };

  const usuario = data.user;
  /* Com e-mail já cadastrado e confirmação ligada o Supabase devolve um
     usuário "de mentira" (sem identidades) para não revelar quem tem conta:
     esse NÃO é um usuário novo, então não se grava aceite em nome dele. */
  const novo = Boolean(usuario && (usuario.identities?.length ?? 0) > 0);
  if (usuario && novo) {
    await registrarAceite({ userId: usuario.id, origem: "cadastro", ip: origem.ip, userAgent: origem.userAgent });
    if (data.session) {
      await vincularIndicacaoDoUsuario({
        userId: usuario.id,
        email: usuario.email ?? null,
        metadataRef: ref,
        cookieRef: armazem.get(COOKIE_INDICACAO)?.value,
      });
    }
  }

  return { ok: true, precisaConfirmarEmail: !data.session };
}

/**
 * Cadastro que já volta com sessão (projeto sem confirmação de e-mail):
 * não passa pelo `/auth/callback`, então o vínculo da indicação é feito aqui.
 * Idempotente; nunca lança e nunca atrapalha a entrada.
 *
 * (`criarConta` já faz isso quando há sessão; esta função continua exportada
 * para quem ainda a chama.)
 */
export async function vincularIndicacaoAposCadastro(): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const metadata = (user.user_metadata ?? {}) as { ref?: unknown };
    await vincularIndicacaoDoUsuario({
      userId: user.id,
      email: user.email ?? null,
      metadataRef: metadata.ref,
      cookieRef: (await cookies()).get(COOKIE_INDICACAO)?.value,
    });
  } catch (e) {
    console.error("[criar-conta] vínculo de indicação falhou:", e instanceof Error ? e.message : "erro");
  }
}
