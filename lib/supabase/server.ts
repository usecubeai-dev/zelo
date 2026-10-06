import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do SERVIDOR — chave publicável + sessão lida do cookie, RLS ativo.
 *
 * É este que toda tela e toda Server Action do sistema deve usar. Ele
 * enxerga exatamente o que o usuário logado pode enxergar, porque as
 * policies rodam com o `auth.uid()` da sessão.
 *
 * Não confundir com `admin.ts`: aquele ignora o RLS e é só para lead e
 * webhook, onde não existe usuário.
 */
export async function supabaseServer() {
  const armazem = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return armazem.getAll();
        },
        setAll(cookiesParaGravar) {
          try {
            cookiesParaGravar.forEach(({ name, value, options }) =>
              armazem.set(name, value, options)
            );
          } catch {
            /* Server Component não pode gravar cookie. Silenciar aqui é
               correto: quem renova a sessão é o middleware, e ele grava. */
          }
        },
      },
    }
  );
}

/**
 * A sessão e a empresa do usuário, em uma chamada.
 *
 * `getUser()` e não `getSession()`: o primeiro valida o token contra o
 * servidor do Supabase; o segundo só lê o cookie, que é dado do cliente e
 * pode ser forjado. Para decisão de acesso, só `getUser()` vale.
 */
export async function usuarioAtual() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membro } = await supabase
    .from("membros")
    .select("empresa_id, papel, empresas(id, nome, assinatura_status, trial_termina_em, plano, assinatura_atualizada_em, deleted_at)")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, membro: membro ?? null };
}
