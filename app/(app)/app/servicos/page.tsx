import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Servico, ROTULO_TIPO_SERVICO } from "@/lib/servico";
import { formatarCentavos } from "@/lib/dinheiro";
import AcoesServico from "./AcoesServico";
import s from "../../App.module.css";

export const metadata = { title: "Serviços" };

type Busca = { status?: string };

export default async function ListaServicos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const { status = "ativo" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("servicos")
    .select("id,nome,tipo,valor_centavos,status,criado_em")
    .eq("empresa_id", empresaId)
    .order("nome");

  if (status !== "todos") consulta = consulta.eq("status", status);

  const { data, error } = await consulta;
  const servicos = (data ?? []) as Pick<Servico, "id" | "nome" | "tipo" | "valor_centavos" | "status" | "criado_em">[];

  const url = (novoStatus: string) => (novoStatus === "ativo" ? "/app/servicos" : `/app/servicos?status=${novoStatus}`);

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Serviços</h1>
        <p className={s.subtitulo}>
          {servicos.length === 0 ? "Nenhum serviço ainda." : `${servicos.length} serviço${servicos.length > 1 ? "s" : ""}.`}
        </p>
      </header>

      <div className={s.barraTopo}>
        <div className={s.filtros}>
          {[
            { v: "ativo", r: "Ativos" },
            { v: "arquivado", r: "Arquivados" },
            { v: "todos", r: "Todos" },
          ].map((f) => (
            <Link
              key={f.v}
              href={url(f.v)}
              className={status === f.v ? `${s.filtro} ${s.filtroAtivo}` : s.filtro}
              aria-current={status === f.v ? "true" : undefined}
            >
              {f.r}
            </Link>
          ))}
        </div>
        <Link href="/app/servicos/novo" className={s.botao}>Novo serviço</Link>
      </div>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar seus serviços agora. Recarregue a página.
        </div>
      )}

      {!error && servicos.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Cadastre seu primeiro serviço</h2>
          <p className={s.vazioTexto}>
            Um serviço é o que você vende — nome, tipo e valor. Depois de cadastrado, ele preenche a cobrança e a
            recorrência sozinho, sem digitar de novo toda vez.
          </p>
          <div className={s.acoes} style={{ justifyContent: "center" }}>
            <Link href="/app/servicos/novo" className={s.botao}>Novo serviço</Link>
          </div>
        </section>
      )}

      {servicos.length > 0 && (
        <div className={s.tabelaEnvolve}>
          <table className={s.tabela}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Situação</th>
                <th><span className={s.somenteLeitor}>Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((sv) => (
                <tr key={sv.id}>
                  <td data-label="Nome">
                    <Link href={`/app/servicos/${sv.id}/editar`} className={s.linkTabela}>
                      {sv.nome}
                    </Link>
                  </td>
                  <td className={s.celulaFraca} data-label="Tipo">{ROTULO_TIPO_SERVICO[sv.tipo]}</td>
                  <td className={s.valorCelula} data-label="Valor">{formatarCentavos(sv.valor_centavos)}</td>
                  <td data-label="Situação">
                    <span className={sv.status === "ativo" ? `${s.etiqueta} ${s.etiquetaAtivo}` : `${s.etiqueta} ${s.etiquetaArquivado}`}>
                      {sv.status === "ativo" ? "Ativo" : "Arquivado"}
                    </span>
                  </td>
                  <td data-label="Ações">
                    <div className={s.acoesLinha}>
                      <AcoesServico id={sv.id} arquivado={sv.status === "arquivado"} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
