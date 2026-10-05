import { usuarioAtual } from "@/lib/supabase/server";
import { ehAdministradorZelo } from "@/lib/core/influenciadores";

/**
 * Sessão do administrador do Zelo, ou `null`.
 *
 * Administrador = linha em `administradores_zelo` (tabela sem policy: só a
 * service_role lê). Ser dono de uma empresa NÃO dá acesso — a checagem é
 * refeita em TODA página e TODA action de `/app/admin`, não só no menu.
 */
export async function administradorAtual() {
  const atual = await usuarioAtual();
  if (!atual) return null;
  return (await ehAdministradorZelo(atual.user.id)) ? atual : null;
}
