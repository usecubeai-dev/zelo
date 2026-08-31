import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Sair. Só POST: logout por GET permite que uma imagem `<img src="/auth/sair">`
 * em outro site derrube a sessão do usuário sem ele pedir.
 */
export async function POST(requisicao: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/entrar", requisicao.url), { status: 303 });
}
