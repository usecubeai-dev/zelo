"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import {
  REGRAS_DE_LEMBRETE,
  ehCanal,
  ehFormaPagamento,
  encargosDoTexto,
  validarEncargos,
} from "@/lib/recuperacao";

/**
 * Padrões de cobrança da empresa: forma de pagamento preferida, multa, juros,
 * lembretes e canal. São só o PONTO DE PARTIDA de uma cobrança NOVA — nunca
 * alteram uma cobrança que já existe, e o Zelo não envia mensagem sozinho.
 *
 * Quem decide é o servidor: tudo é revalidado aqui (o navegador só sugere) e
 * o banco repete os limites em CHECK. Só o dono da conta salva (a policy do
 * banco também exige).
 */

export type DadosPreferenciasCobranca = {
  forma: string;
  multa: string;
  juros: string;
  lembretes: Record<string, boolean>;
  canal: string;
};

export type ResultadoPreferencias =
  | { ok: true }
  | { ok: false; erros?: { multa?: string; juros?: string }; mensagem?: string };

export async function salvarPreferenciasCobranca(dados: DadosPreferenciasCobranca): Promise<ResultadoPreferencias> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  if (atual.membro.papel !== "dono") return { ok: false, mensagem: "Só o responsável pela conta pode alterar estes padrões." };

  if (!ehFormaPagamento(dados.forma)) return { ok: false, mensagem: "Escolha como o cliente paga." };
  if (!ehCanal(dados.canal)) return { ok: false, mensagem: "Escolha o canal." };

  const erros = validarEncargos(dados.multa ?? "", dados.juros ?? "");
  if (erros.multa || erros.juros) return { ok: false, erros };
  const enc = encargosDoTexto(dados.multa ?? "", dados.juros ?? "");

  const lembretes = Object.fromEntries(REGRAS_DE_LEMBRETE.map((r) => [r.id, dados.lembretes?.[r.id] === true])) as Record<string, boolean>;

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("empresas")
    .update({
      cobranca_forma_padrao: dados.forma,
      multa_padrao_pct: enc.multaPct,
      juros_padrao_pct_mes: enc.jurosPctMes,
      lembrete_3d_antes: lembretes["3d_antes"],
      lembrete_no_dia: lembretes["no_dia"],
      lembrete_1d_depois: lembretes["1d_depois"],
      lembrete_3d_depois: lembretes["3d_depois"],
      lembrete_7d_depois: lembretes["7d_depois"],
      canal_preferencial: dados.canal,
    })
    .eq("id", atual.membro.empresa_id);

  if (error) {
    console.error("[configuracoes] erro ao salvar padrões de cobrança:", error.code);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente novamente." };
  }

  revalidatePath("/app/configuracoes");
  revalidatePath("/app/inadimplencia");
  revalidatePath("/app/cobrancas/nova");
  return { ok: true };
}
