"use client";

import { useEffect, useState } from "react";
import { processarReembolsoAction, recusarReembolsoAction } from "../acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import type { PedidoReembolso } from "@/lib/core/reembolso";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

type Status = PedidoReembolso["status"];

const ROTULO: Record<Status, string> = {
  pendente: "Pendente",
  processando: "Processando",
  processado: "Estorno solicitado",
  recusado: "Recusado",
  falhou: "Falhou — tentar de novo",
};

const CLASSE: Record<Status, string> = {
  pendente: s.sitPendente,
  processando: s.sitEnviada,
  processado: s.sitPaga,
  recusado: s.sitCancelada,
  falhou: s.sitEstornada,
};

const FUSO = "America/Sao_Paulo";
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });

type Aberto = { id: string; modo: "estornar" | "recusar" } | null;

/**
 * Pedidos de reembolso do arrependimento. O estorno NUNCA é automático: o
 * administrador precisa abrir "Estornar no Asaas" e confirmar num segundo
 * passo — mandar dinheiro de volta é irreversível. Só `pendente` e `falhou`
 * aceitam ação (o servidor também recusa nos outros estados).
 */
export default function TabelaReembolsos({ linhas }: { linhas: PedidoReembolso[] }) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  /* Ao abrir o passo de confirmação o botão clicado some: o foco vai para o grupo. */
  const idAberto = aberto?.id;
  useEffect(() => {
    if (idAberto) document.getElementById(`confirma-${idAberto}`)?.focus();
  }, [idAberto]);

  const abrir = (id: string, modo: "estornar" | "recusar") => {
    setErro(null);
    setObservacao("");
    setAberto({ id, modo });
  };

  const confirmar = async (p: PedidoReembolso) => {
    if (!aberto || ocupado) return;
    if (aberto.modo === "recusar" && observacao.trim().length < 3) {
      setErro({ id: p.id, mensagem: "Informe o motivo da recusa." });
      return;
    }
    setErro(null);
    setOcupado(p.id);
    try {
      const r = aberto.modo === "estornar" ? await processarReembolsoAction(p.id) : await recusarReembolsoAction(p.id, observacao.trim());
      if (!r.ok) {
        setErro({ id: p.id, mensagem: r.mensagem });
        return;
      }
      setAberto(null);
      setObservacao("");
    } catch {
      setErro({ id: p.id, mensagem: "Não foi possível concluir agora. Tente novamente." });
    } finally {
      setOcupado(null);
    }
  };

  if (linhas.length === 0) {
    return (
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Nenhum pedido de reembolso</h2>
        <p className={s.vazioTexto}>Os pedidos de arrependimento (7 dias) aparecem aqui.</p>
      </section>
    );
  }

  return (
    <div className={s.tabelaEnvolve}>
      <table className={s.tabela}>
        <caption className={s.somenteLeitor}>Pedidos de reembolso por arrependimento</caption>
        <thead>
          <tr>
            <th>Conta</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Solicitado em</th>
            <th>Motivo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((p) => {
            const acionavel = p.status === "pendente" || p.status === "falhou";
            const aqui = aberto?.id === p.id ? aberto : null;
            const trabalhando = ocupado === p.id;
            return (
              <tr key={p.id}>
                <td data-label="Conta">{p.empresaNome ?? "Conta removida"}</td>
                <td className={s.valorCelula} data-label="Valor">
                  {formatarCentavos(p.valor_centavos)}
                </td>
                <td data-label="Status">
                  <span className={`${s.etiqueta} ${CLASSE[p.status]}`}>{ROTULO[p.status]}</span>
                </td>
                <td className={s.celulaFraca} data-label="Solicitado em">
                  {dia(p.solicitado_em)}
                  {p.processado_em && <div className={a.datas}>Resolvido em {dia(p.processado_em)}</div>}
                </td>
                <td data-label="Motivo">
                  <span className={a.observacao}>{p.motivo ?? "—"}</span>
                  {p.observacao && (
                    <div className={a.datas}>
                      <strong>Observação:</strong> {p.observacao}
                    </div>
                  )}
                </td>
                <td data-label="Ações">
                  {!acionavel ? (
                    <span className={s.celulaFraca}>—</span>
                  ) : aqui ? (
                    <div id={`confirma-${p.id}`} tabIndex={-1} className={a.registroPagamento} role="group" aria-label={`Confirmar ação no pedido de ${p.empresaNome ?? "conta removida"}`}>
                      {aqui.modo === "estornar" ? (
                        <p className={a.registroAviso}>
                          <strong>Isto manda o estorno integral ao Asaas</strong> ({formatarCentavos(p.valor_centavos)}). Não dá para
                          desfazer.
                        </p>
                      ) : (
                        <>
                          <label htmlFor={`recusa-${p.id}`}>Motivo da recusa (obrigatório)</label>
                          <input
                            id={`recusa-${p.id}`}
                            value={observacao}
                            maxLength={300}
                            disabled={trabalhando}
                            onChange={(e) => {
                              setObservacao(e.target.value);
                              setErro(null);
                            }}
                            aria-invalid={erro?.id === p.id ? true : undefined}
                          />
                        </>
                      )}
                      <div className={a.acoesCelula}>
                        <button
                          type="button"
                          className={`${s.botaoSec} ${s.botaoPerigo} ${a.botaoCompacto}`}
                          onClick={() => confirmar(p)}
                          disabled={trabalhando}
                          aria-busy={trabalhando}
                        >
                          {trabalhando ? "Enviando…" : aqui.modo === "estornar" ? "Confirmar estorno" : "Confirmar recusa"}
                        </button>
                        <button
                          type="button"
                          className={`${s.botaoSec} ${a.botaoCompacto}`}
                          onClick={() => setAberto(null)}
                          disabled={trabalhando}
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={a.acoesCelula}>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${a.botaoCompacto}`}
                        onClick={() => abrir(p.id, "estornar")}
                        disabled={ocupado !== null}
                      >
                        Estornar no Asaas
                      </button>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${s.botaoPerigo} ${a.botaoCompacto}`}
                        onClick={() => abrir(p.id, "recusar")}
                        disabled={ocupado !== null}
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                  {erro?.id === p.id && (
                    <span className={s.erroCampo} role="alert">
                      {erro.mensagem}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
