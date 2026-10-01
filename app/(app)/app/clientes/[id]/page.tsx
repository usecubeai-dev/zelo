import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { Cliente, formatarDocumento, formatarWhatsapp } from "@/lib/cliente";
import {
  ROTULO_STATUS_RECORRENCIA,
  Recorrencia,
} from "@/lib/recorrencia";
import {
  Cobranca,
  ROTULO_SITUACAO,
  formatarData,
  hojeISO,
  situacaoDaCobranca,
} from "@/lib/cobranca";
import { formatarCentavos } from "@/lib/dinheiro";
import AcoesCliente from "../AcoesCliente";
import s from "../../../App.module.css";

export const metadata = { title: "Cliente" };

const CLASSE_STATUS_REC: Record<string, string> = {
  ativa: s.sitPaga,
  pausada: s.sitVencida,
  encerrada: s.sitCancelada,
};

const CLASSE_COBRANCA: Record<string, string> = {
  pendente: s.sitPendente,
  enviada: s.sitEnviada,
  paga: s.sitPaga,
  vencida: s.sitVencida,
  cancelada: s.sitCancelada,
  estornada: s.sitEstornada,
};

export default async function FichaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const supabase = await supabaseServer();
  const [cliRes, recRes, cobRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("recorrencias")
      .select("*")
      .eq("cliente_id", id)
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false }),
    supabase
      .from("cobrancas")
      .select("*")
      .eq("cliente_id", id)
      .eq("empresa_id", empresaId)
      .order("vence_em", { ascending: false }),
  ]);

  if (!cliRes.data) notFound();
  const cliente = cliRes.data as Cliente;
  const recorrencias = (recRes.data ?? []) as Recorrencia[];
  const cobrancas = (cobRes.data ?? []) as Cobranca[];

  const hoje = hojeISO();
  const criado = new Date(cliente.criado_em).toLocaleDateString("pt-BR");

  /* Resumo financeiro do cliente — "valor além da cobrança": o
     profissional não deveria precisar somar a tabela de baixo na
     cabeça pra saber se este cliente está em dia. Tudo calculado do
     mesmo `cobrancas` já buscado acima, sem consulta nova. */
  const totalRecebidoCentavos = cobrancas
    .filter((c) => c.status === "paga")
    .reduce((soma, c) => soma + (c.valor_pago_centavos ?? c.valor_centavos), 0);
  const emAberto = cobrancas.filter((c) => c.status === "pendente" || c.status === "enviada");
  const emAtraso = emAberto.filter((c) => situacaoDaCobranca(c, hoje) === "vencida");
  const proximaCobranca = emAberto
    .filter((c) => situacaoDaCobranca(c, hoje) !== "vencida")
    .sort((a, b) => (a.vence_em < b.vence_em ? -1 : 1))[0];

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{cliente.nome}</h1>
        <p className={s.subtitulo}>
          Cliente desde {criado} ·{" "}
          {cliente.status === "ativo" ? "Ativo" : "Arquivado"}
        </p>
      </header>

      {cobrancas.length > 0 && (
        <div className={`${s.numeros} ${s.numerosTres}`}>
          <div className={`${s.numero} ${s.numeroRecebido}`}>
            <span className={s.numeroRotulo}>Já recebido</span>
            <span className={s.numeroValor}>{formatarCentavos(totalRecebidoCentavos)}</span>
          </div>
          <div className={s.numero}>
            <span className={s.numeroRotulo}>Próxima cobrança</span>
            <span className={s.numeroValor}>
              {proximaCobranca ? formatarCentavos(proximaCobranca.valor_centavos) : "—"}
            </span>
            {proximaCobranca && (
              <span className={s.numeroSub}>vence em {formatarData(proximaCobranca.vence_em)}</span>
            )}
          </div>
          <div className={emAtraso.length > 0 ? `${s.numero} ${s.numeroVencido}` : s.numero}>
            <span className={s.numeroRotulo}>Em atraso</span>
            <span className={s.numeroValor}>{emAtraso.length}</span>
          </div>
        </div>
      )}

      <div className={s.ficha}>
        <div className={s.fichaItem}>
          <span className={s.fichaRotulo}>E-mail</span>
          <span className={s.fichaValor}>{cliente.email ?? "—"}</span>
        </div>
        <div className={s.fichaItem}>
          <span className={s.fichaRotulo}>WhatsApp</span>
          <span className={s.fichaValor}>{formatarWhatsapp(cliente.whatsapp)}</span>
        </div>
        <div className={s.fichaItem}>
          <span className={s.fichaRotulo}>CPF/CNPJ</span>
          <span className={s.fichaValor}>{formatarDocumento(cliente.documento)}</span>
        </div>
        <div className={s.fichaItem}>
          <span className={s.fichaRotulo}>Situação</span>
          <span className={s.fichaValor}>
            {cliente.status === "ativo" ? "Ativo" : "Arquivado"}
          </span>
        </div>
      </div>

      {cliente.observacoes && (
        <div style={{ marginTop: 20 }}>
          <span className={s.fichaRotulo}>Observações</span>
          <p className={s.vazioTexto} style={{ margin: "8px 0 0", textAlign: "left" }}>
            {cliente.observacoes}
          </p>
        </div>
      )}

      <div className={s.acoes}>
        {cliente.status === "ativo" && (
          <>
            <Link
              href={`/app/recorrencias/nova?cliente_id=${cliente.id}`}
              className={s.botao}
            >
              Criar cobrança automática
            </Link>
            <Link
              href={`/app/cobrancas/nova?cliente_id=${cliente.id}`}
              className={s.botaoSec}
            >
              + Cobrança avulsa
            </Link>
          </>
        )}
        <Link href={`/app/clientes/${cliente.id}/editar`} className={s.botaoSec}>
          Editar
        </Link>
        <AcoesCliente id={cliente.id} arquivado={cliente.status === "arquivado"} />
      </div>

      {/* Recorrências do Cliente */}
      <div style={{ marginTop: 32 }}>
        <div className={s.barraTopo}>
          <h2 className={s.vazioTitulo}>Recorrências ({recorrencias.length})</h2>
          {cliente.status === "ativo" && (
            <Link
              href={`/app/recorrencias/nova?cliente_id=${cliente.id}`}
              className={s.botaoSec}
            >
              Adicionar
            </Link>
          )}
        </div>

        {recorrencias.length === 0 ? (
          <p className={s.vazioTexto} style={{ textAlign: "left" }}>
            Nenhuma recorrência cadastrada para este cliente.
          </p>
        ) : (
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor mensal</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {recorrencias.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Descrição">
                      <Link href={`/app/recorrencias/${r.id}`} className={s.linkTabela}>
                        {r.descricao}
                      </Link>
                    </td>
                    <td className={s.celulaFraca} data-label="Vencimento">Todo dia {r.dia_vencimento}</td>
                    <td className={s.valorCelula} data-label="Valor mensal">{formatarCentavos(r.valor_centavos)}</td>
                    <td data-label="Situação">
                      <span className={`${s.etiqueta} ${CLASSE_STATUS_REC[r.status] || ""}`}>
                        {ROTULO_STATUS_RECORRENCIA[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cobranças do Cliente */}
      <div style={{ marginTop: 32 }}>
        <div className={s.barraTopo}>
          <h2 className={s.vazioTitulo}>Histórico de cobranças ({cobrancas.length})</h2>
        </div>

        {cobrancas.length === 0 ? (
          <p className={s.vazioTexto} style={{ textAlign: "left" }}>
            Nenhuma cobrança registrada para este cliente.
          </p>
        ) : (
          <div className={s.tabelaEnvolve}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const sit = situacaoDaCobranca(c, hoje);
                  return (
                    <tr key={c.id}>
                      <td data-label="Descrição">
                        <Link href={`/app/cobrancas/${c.id}`} className={s.linkTabela}>
                          {c.descricao}
                        </Link>
                      </td>
                      <td className={s.celulaFraca} data-label="Vencimento">{formatarData(c.vence_em)}</td>
                      <td className={s.valorCelula} data-label="Valor">{formatarCentavos(c.valor_centavos)}</td>
                      <td data-label="Situação">
                        <span className={`${s.etiqueta} ${CLASSE_COBRANCA[sit]}`}>
                          {ROTULO_SITUACAO[sit]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={s.acoes} style={{ marginTop: 24 }}>
        <Link href="/app/clientes" className={s.faixaLink}>
          ← Voltar para clientes
        </Link>
      </div>
    </>
  );
}
