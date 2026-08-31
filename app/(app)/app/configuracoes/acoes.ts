"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { soDigitos } from "@/lib/cliente";

export type DadosEmpresa = {
  nome: string;
  documento: string;
};

export type ResultadoEmpresa =
  | { ok: true }
  | { ok: false; erros?: Record<string, string>; mensagem?: string };

export async function atualizarDadosEmpresa(dados: DadosEmpresa): Promise<ResultadoEmpresa> {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) {
    return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
  }

  const erros: Record<string, string> = {};
  const nomeLimpo = dados.nome.trim().replace(/\s+/g, " ");
  if (nomeLimpo.length < 2) {
    erros.nome = "Informe o nome da sua empresa ou seu nome comercial.";
  } else if (nomeLimpo.length > 120) {
    erros.nome = "Nome muito longo.";
  }

  const docLimpo = soDigitos(dados.documento);
  if (docLimpo && docLimpo.length !== 11 && docLimpo.length !== 14) {
    erros.documento = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("empresas")
    .update({
      nome: nomeLimpo,
      documento: docLimpo || null,
    })
    .eq("id", atual.membro.empresa_id);

  if (error) {
    console.error("[configuracoes] erro ao atualizar empresa:", error.message);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente novamente." };
  }

  revalidatePath("/app/configuracoes");
  revalidatePath("/app");
  return { ok: true };
}
