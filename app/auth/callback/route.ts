import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-expirado`);
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
