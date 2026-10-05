import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_INDICACAO,
  DURACAO_COOKIE_INDICACAO_DIAS,
  normalizarCodigo,
} from "@/lib/indicacao-codigo";

/**
 * Renova a sessão e protege a área autenticada.
 *
 * Arquivo `proxy.ts` e não `middleware.ts`: o Next 16 depreciou a convenção
 * antiga e avisa no build. Mesmo comportamento, nome novo.
 *
 * Duas coisas que precisam ficar claras:
 *
 * 1. **O middleware é conveniência, não autorização.** Quem garante que um
 *    usuário não lê dados de outra empresa é o RLS, no banco. Middleware
 *    furado com RLS certo = tela vazia. RLS furado com middleware certo =
 *    vazamento. A ordem de importância é essa.
 *
 * 2. **O webhook não passa por aqui.** Requisição de provedor externo não
 *    tem cookie de sessão; redirecioná-la para o login faria o Asaas
 *    receber um 307 e reenviar o evento para sempre.
 */

const ROTAS_PROTEGIDAS = ["/app"];
const ROTAS_DE_AUTH = ["/entrar", "/criar-conta"];

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaGravar) {
          cookiesParaGravar.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          resposta = NextResponse.next({ request });
          cookiesParaGravar.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /* getUser() valida o token no servidor. getSession() só lê o cookie —
     não serve para decidir acesso. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;

  /* Indicação de influenciador: qualquer página (a landing inclusive) que
     chegue com `?ref=CODIGO` guarda a origem num cookie httpOnly — assim o
     código sobrevive landing → cadastro sem depender da query string. Só o
     formato é validado aqui; se o código existe e está ativo, quem decide é
     o banco, na hora de vincular (`vincular_indicacao`). O mais recente
     vence. */
  const codigoIndicacao = normalizarCodigo(request.nextUrl.searchParams.get("ref"));
  const gravarIndicacao = (r: NextResponse) => {
    if (!codigoIndicacao) return r;
    r.cookies.set(COOKIE_INDICACAO, codigoIndicacao, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DURACAO_COOKIE_INDICACAO_DIAS * 24 * 60 * 60,
    });
    return r;
  };

  const protegida = ROTAS_PROTEGIDAS.some((r) => caminho.startsWith(r));
  const deAuth = ROTAS_DE_AUTH.some((r) => caminho.startsWith(r));

  if (protegida && !user) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    /* de onde veio, para voltar depois do login */
    destino.searchParams.set("de", caminho);
    return gravarIndicacao(NextResponse.redirect(destino));
  }

  if (deAuth && user) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/app";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return gravarIndicacao(resposta);
}

export const config = {
  matcher: [
    /* tudo, menos estático, imagem, favicon e AS ROTAS DE API.
       As de API ficam de fora porque o webhook do Asaas vai morar lá:
       requisição de provedor externo não tem cookie de sessão, e
       redirecioná-la para o login faria o Asaas reenviar o evento para
       sempre. */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
