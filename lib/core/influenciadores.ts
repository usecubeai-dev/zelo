/**
 * Administração de influenciadores e comissões — SOMENTE para
 * administradores do Zelo.
 *
 * Sem React, sem DOM. Terceiro dos três fluxos financeiros (mensalidade /
 * taxa / COMISSÃO). Esta versão só RASTREIA e REGISTRA: marcar uma
 * comissão como paga é um registro administrativo de que o pagamento foi
 * feito POR FORA. Nada aqui movimenta dinheiro.
 *
 * Quem chama (`app/(app)/app/admin/*`) já verificou `ehAdministradorZelo`;
 * as funções não repetem a checagem de sessão, mas as tabelas não têm
 * policy nem grant para anon/authenticated — só a service_role chega nelas.
 */

import { supabaseAdmin } from "../supabase/admin";
import { gerarCodigo, normalizarCodigo } from "../indicacao-codigo";

export type StatusComissao = "pendente" | "disponivel" | "paga" | "cancelada";
export type AcaoComissao = "liberar" | "pagar" | "cancelar";

export type Influenciador = {
  id: string;
  nome: string;
  codigo: string;
  email: string | null;
  status: "ativo" | "inativo";
  criado_em: string;
};

export type ResumoInfluenciador = Influenciador & {
  indicacoes: number;
  convertidos: number;
  /** centavos, só ambiente `production` */
  pendenteCentavos: number;
  disponivelCentavos: number;
  pagoCentavos: number;
};

export type LinhaComissao = {
  id: string;
  influenciador_id: string;
  influenciadorNome: string;
  empresa_id: string | null;
  empresaNome: string | null;
  plano: string;
  valor_centavos: number;
  status: StatusComissao;
  ambiente: "sandbox" | "production";
  criada_em: string;
  disponivel_em: string | null;
  paga_em: string | null;
  estorno_apos_pagamento: boolean;
  observacao: string | null;
  mensalidade_id: string | null;
};

export async function ehAdministradorZelo(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await supabaseAdmin()
      .from("administradores_zelo")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export type ResultadoCriarInfluenciador =
  | { ok: true; influenciador: Influenciador }
  | { ok: false; mensagem: string };

export async function criarInfluenciador(dados: {
  nome: string;
  email?: string | null;
  codigo?: string | null;
}): Promise<ResultadoCriarInfluenciador> {
  const nome = dados.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) {
    return { ok: false, mensagem: "Informe o nome do influenciador (2 a 80 caracteres)." };
  }

  const email = dados.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, mensagem: "E-mail inválido." };
  }

  const codigoInformado = dados.codigo?.trim() ? normalizarCodigo(dados.codigo) : null;
  if (dados.codigo?.trim() && !codigoInformado) {
    return { ok: false, mensagem: "Código inválido: use de 4 a 20 letras ou números, sem espaço." };
  }

  const admin = supabaseAdmin();

  // vínculo com a conta do próprio influenciador (para barrar auto-indicação)
  let userId: string | null = null;
  if (email) {
    const { data: u } = await admin.rpc("zelo_user_id_por_email", { p_email: email });
    userId = (u as string | null) ?? null;
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = codigoInformado ?? gerarCodigo(8);
    const { data, error } = await admin
      .from("influenciadores")
      .insert({ nome, email, codigo, user_id: userId })
      .select("id, nome, codigo, email, status, criado_em")
      .single();

    if (!error) return { ok: true, influenciador: data as Influenciador };

    if (error.code === "23505") {
      if (codigoInformado) return { ok: false, mensagem: "Esse código (ou e-mail) já está em uso." };
      continue; // código gerado colidiu: sorteia outro
    }
    console.error("[influenciadores] erro ao criar:", error.code);
    return { ok: false, mensagem: "Não foi possível criar agora. Tente novamente." };
  }
  return { ok: false, mensagem: "Não foi possível gerar um código único. Tente novamente." };
}

export async function definirStatusInfluenciador(id: string, status: "ativo" | "inativo"): Promise<boolean> {
  const { error } = await supabaseAdmin().from("influenciadores").update({ status }).eq("id", id);
  return !error;
}

export async function listarResumoInfluenciadores(): Promise<ResumoInfluenciador[]> {
  const admin = supabaseAdmin();
  const [{ data: infs }, { data: inds }, { data: coms }] = await Promise.all([
    admin.from("influenciadores").select("id, nome, codigo, email, status, criado_em").order("criado_em", { ascending: false }),
    admin.from("indicacoes").select("influenciador_id, convertida_em"),
    admin.from("comissoes").select("influenciador_id, valor_centavos, status, ambiente"),
  ]);

  return ((infs ?? []) as Influenciador[]).map((i) => {
    const minhas = (inds ?? []).filter((x) => x.influenciador_id === i.id);
    const comissoes = (coms ?? []).filter((x) => x.influenciador_id === i.id && x.ambiente === "production");
    const soma = (s: StatusComissao) =>
      comissoes.filter((c) => c.status === s).reduce((t, c) => t + (c.valor_centavos as number), 0);
    return {
      ...i,
      indicacoes: minhas.length,
      convertidos: minhas.filter((x) => x.convertida_em).length,
      pendenteCentavos: soma("pendente"),
      disponivelCentavos: soma("disponivel"),
      pagoCentavos: soma("paga"),
    };
  });
}

export async function listarComissoes(): Promise<LinhaComissao[]> {
  const admin = supabaseAdmin();
  const { data: coms } = await admin
    .from("comissoes")
    .select(
      "id, influenciador_id, empresa_id, plano, valor_centavos, status, ambiente, criada_em, disponivel_em, paga_em, estorno_apos_pagamento, observacao, mensalidade_id"
    )
    .order("criada_em", { ascending: false })
    .limit(500);

  const lista = coms ?? [];
  const infIds = [...new Set(lista.map((c) => c.influenciador_id))];
  const empIds = [...new Set(lista.map((c) => c.empresa_id).filter(Boolean))] as string[];

  const [{ data: infs }, { data: emps }] = await Promise.all([
    infIds.length ? admin.from("influenciadores").select("id, nome").in("id", infIds) : Promise.resolve({ data: [] }),
    empIds.length ? admin.from("empresas").select("id, nome").in("id", empIds) : Promise.resolve({ data: [] }),
  ]);

  const nomeInf = new Map((infs ?? []).map((i) => [i.id as string, i.nome as string]));
  const nomeEmp = new Map((emps ?? []).map((e) => [e.id as string, e.nome as string]));

  return lista.map((c) => ({
    ...(c as Omit<LinhaComissao, "influenciadorNome" | "empresaNome">),
    influenciadorNome: nomeInf.get(c.influenciador_id) ?? "—",
    empresaNome: c.empresa_id ? nomeEmp.get(c.empresa_id) ?? null : null,
  }));
}

export type ResultadoMoverComissao = { ok: true } | { ok: false; mensagem: string };

export async function moverComissao(
  comissaoId: string,
  acao: AcaoComissao,
  adminUserId: string,
  observacao?: string | null
): Promise<ResultadoMoverComissao> {
  const { data, error } = await supabaseAdmin().rpc("mover_comissao", {
    p_comissao: comissaoId,
    p_acao: acao,
    p_admin: adminUserId,
    p_observacao: observacao ?? null,
  });
  if (error) {
    console.error("[influenciadores] erro ao mover comissão:", error.code);
    return { ok: false, mensagem: "Não foi possível atualizar agora." };
  }
  if (data === "ok") return { ok: true };
  if (data === "transicao_invalida") {
    return { ok: false, mensagem: "Essa comissão não está num estado que permita esta ação." };
  }
  return { ok: false, mensagem: "Ação inválida." };
}
