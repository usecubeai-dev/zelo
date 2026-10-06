"use client";

import { useState } from "react";
import { atualizarStatusSolicitacaoAction } from "../acoes";
import {
  ROTULO_SOLICITACAO,
  ROTULO_STATUS_SOLICITACAO,
  STATUS_SOLICITACAO,
  type StatusSolicitacao,
} from "@/lib/solicitacao-tipos";
import type { LinhaSolicitacao } from "@/lib/core/solicitacao-titular";
import s from "../../../App.module.css";
import a from "../influenciadores/Admin.module.css";

const CLASSE: Record<StatusSolicitacao, string> = {
  recebida: s.sitPendente,
  em_andamento: s.sitEnviada,
  concluida: s.sitPaga,
  recusada: s.sitCancelada,
};

const FUSO = "America/Sao_Paulo";
const momento = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function TabelaSolicitacoes({ linhas }: { linhas: LinhaSolicitacao[] }) {
  /* valor mostrado no seletor: muda na hora (otimista) e volta atrás se o servidor recusar */
  const [valores, setValores] = useState<Record<string, StatusSolicitacao>>({});
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  const mudar = async (l: LinhaSolicitacao, novo: StatusSolicitacao) => {
    if (trabalhando) return;
    const anterior = valores[l.id] ?? l.status;
    setErro(null);
    setValores((v) => ({ ...v, [l.id]: novo }));
    setTrabalhando(l.id);
    try {
      const r = await atualizarStatusSolicitacaoAction(l.id, novo);
      if (!r.ok) {
        setValores((v) => ({ ...v, [l.id]: anterior }));
        setErro({ id: l.id, mensagem: r.mensagem });
      }
    } catch {
      setValores((v) => ({ ...v, [l.id]: anterior }));
      setErro({ id: l.id, mensagem: "Não foi possível atualizar agora." });
    } finally {
      setTrabalhando(null);
    }
  };

  if (linhas.length === 0) {
    return (
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Nenhuma solicitação ainda</h2>
        <p className={s.vazioTexto}>Os pedidos enviados em /privacidade/solicitacao aparecem aqui.</p>
      </section>
    );
  }

  return (
    <div className={s.tabelaEnvolve}>
      <table className={s.tabela}>
        <caption className={s.somenteLeitor}>Solicitações de titular de dados</caption>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>E-mail</th>
            <th>Nome</th>
            <th>Mensagem</th>
            <th>Recebida em</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const status = valores[l.id] ?? l.status;
            return (
              <tr key={l.id}>
                <td data-label="Tipo">{ROTULO_SOLICITACAO[l.tipo] ?? l.tipo}</td>
                <td data-label="E-mail" style={{ overflowWrap: "anywhere" }}>
                  {l.email}
                </td>
                <td className={s.celulaFraca} data-label="Nome">
                  {l.nome ?? "—"}
                </td>
                <td data-label="Mensagem">
                  <span className={a.observacao} style={{ whiteSpace: "pre-wrap" }}>
                    {l.mensagem ?? "—"}
                  </span>
                </td>
                <td className={s.celulaFraca} data-label="Recebida em">
                  {momento(l.criada_em)}
                </td>
                <td data-label="Status">
                  <div className={a.statusCelula}>
                    <span className={`${s.etiqueta} ${CLASSE[status]}`}>{ROTULO_STATUS_SOLICITACAO[status]}</span>
                    <div className={s.campoApp}>
                      <label className={s.somenteLeitor} htmlFor={`status-${l.id}`}>
                        Status da solicitação de {l.email}
                      </label>
                      <select
                        id={`status-${l.id}`}
                        value={status}
                        disabled={trabalhando !== null}
                        aria-busy={trabalhando === l.id}
                        onChange={(e) => mudar(l, e.target.value as StatusSolicitacao)}
                      >
                        {STATUS_SOLICITACAO.map((x) => (
                          <option key={x} value={x}>
                            {ROTULO_STATUS_SOLICITACAO[x]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {erro?.id === l.id && (
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
