import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { ehTipoDeExportacao, paraCsv, reaisCsv } from "@/lib/core/exportacao";

/**
 * Exportação dos dados do profissional em CSV (`?tipo=clientes|cobrancas|recebimentos`).
 *
 * Passa pelo cliente de SESSÃO (RLS ativo, nunca a chave de serviço): o que
 * sai é exatamente o que a própria pessoa já pode ver — não há como
 * exportar dado de outra empresa. Está sob /app, então o proxy já exige login.
 */
export async function GET(requisicao: NextRequest) {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!atual || !empresaId) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const tipo = requisicao.nextUrl.searchParams.get("tipo");
  if (!ehTipoDeExportacao(tipo)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });

  const supabase = await supabaseServer();
  let csv = "";

  if (tipo === "clientes") {
    const { data } = await supabase
      .from("clientes")
      .select("nome, email, whatsapp, documento, status, criado_em")
      .eq("empresa_id", empresaId)
      .order("nome");
    csv = paraCsv(
      ["nome", "email", "whatsapp", "documento", "situacao", "cadastrado_em"],
      (data ?? []).map((c) => [c.nome, c.email, c.whatsapp, c.documento, c.status, c.criado_em])
    );
  } else {
    const consulta = supabase
      .from("cobrancas")
      .select("descricao, valor_centavos, vence_em, status, pago_em, valor_pago_centavos, valor_estornado_centavos, pago_via, criado_em, clientes(nome)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    const { data } = tipo === "recebimentos" ? await consulta.in("status", ["paga", "estornada"]) : await consulta;

    const linhas = (data ?? []) as unknown as {
      descricao: string;
      valor_centavos: number;
      vence_em: string;
      status: string;
      pago_em: string | null;
      valor_pago_centavos: number | null;
      valor_estornado_centavos: number | null;
      pago_via: string | null;
      criado_em: string;
      clientes: { nome: string } | null;
    }[];

    csv =
      tipo === "recebimentos"
        ? paraCsv(
            ["pago_em", "cliente", "descricao", "valor_pago", "valor_estornado", "situacao", "origem"],
            linhas.map((c) => [c.pago_em, c.clientes?.nome, c.descricao, reaisCsv(c.valor_pago_centavos), reaisCsv(c.valor_estornado_centavos), c.status, c.pago_via]),
            new Set([3, 4])
          )
        : paraCsv(
            ["criada_em", "cliente", "descricao", "valor", "vencimento", "situacao", "pago_em"],
            linhas.map((c) => [c.criado_em, c.clientes?.nome, c.descricao, reaisCsv(c.valor_centavos), c.vence_em, c.status, c.pago_em]),
            new Set([3])
          );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zelo-${tipo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
