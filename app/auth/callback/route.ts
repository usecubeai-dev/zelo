import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { COOKIE_INDICACAO } from "@/lib/indicacao-codigo";
import { vincularIndicacaoDoUsuario } from "@/lib/core/indicacao";

/**
 * Destino dos links que o Supabase manda por e-mail: confirmação de conta
 * e recuperação de senha.
 *
 * O link traz um `code` de uso único que precisa virar sessão. A troca
 * acontece AQUI, no servidor, para o cookie ser gravado com HttpOnly — se
 * fosse no cliente, o token passaria pelo JavaScript da página.
 */
export async function GET(requisicao: NextRequest) {
  const { searchParams, origin } = requisicao.nextUrl;
  const code = searchParams.get("code");
  const proximo = searchParams.get("proximo") ?? "/app";

  /* só caminho interno: sem isso, `?proximo=https://outro.site` transforma
     o callback num redirecionador aberto */
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-expirado`);
  }

  /* Primeiro momento em que existe usuário autenticado no servidor: é aqui
     que a indicação de influenciador vira vínculo permanente. Duas fontes,
     porque o link de confirmação pode abrir em outro navegador (sem o
     cookie): `user_metadata.ref`, gravado no cadastro, e o cookie. Idempotente
     e nunca bloqueia a entrada — qualquer falha só vai pro log. */
  const usuario = data.user;
  if (usuario) {
    const metadata = (usuario.user_metadata ?? {}) as { ref?: unknown };
    await vincularIndicacaoDoUsuario({
      userId: usuario.id,
      email: usuario.email ?? null,
      metadataRef: metadata.ref,
      cookieRef: requisicao.cookies.get(COOKIE_INDICACAO)?.value,
    });
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
