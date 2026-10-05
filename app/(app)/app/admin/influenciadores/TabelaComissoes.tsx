"use client";

import { useState } from "react";
import { moverComissaoAction } from "../acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import { NOME_DO_PLANO, normalizarPlano } from "@/lib/plano";
import type { AcaoComissao, StatusComissao } from "@/lib/core/influenciadores";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

/** A comissão pode ter gravado o identificador antigo (profissional/premium). */
function planoDaComissao(valor: string): string {
  const plano = normalizarPlano(valor);
  return plano ? NOME_DO_PLANO[plano] : valor;
}

export type LinhaDeComissao = {
  id: string;
  influenciadorNome: string;
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
};

const ROTULO: Record<StatusComissao, string> = {
  pendente: "Pendente",
  disponivel: "Disponível",
  paga: "Paga",
  cancelada: "Cancelada",
};

const CLASSE: Record<StatusComissao, string> = {
  pendente: s.sitPendente,
  disponivel: s.sitEnviada,
  paga: s.sitPaga,
  cancelada: s.sitCancelada,
};

/** Data no fuso do Brasil, fixo: o mesmo texto no servidor e no navegador. */
function dia(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function TabelaComissoes({ linhas }: { linhas: LinhaDeComissao[] }) {
  /** linha cujo registro de pagamento está aberto (campo de observação visível) */
  const [pagando, setPagando] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  const mover = async (l: LinhaDeComissao, acao: AcaoComissao, obs?: string) => {
    if (trabalhando) return;
    setErro(null);
    setTrabalhando(l.id);
    try {
      const r = await moverComissaoAction(l.id, acao, obs);
      if (!r.ok) {
        setErro({ id: l.id, mensagem: r.mensagem });
        return;
      }
      setPagando(null);
      setObservacao("");
    } catch {
      setErro({ id: l.id, mensagem: "Não foi possível atualizar agora." });
    } finally {
      setTrabalhando(null);
    }
  };

  const cancelar = (l: LinhaDeComissao) => {
    /* ação sem volta: a comissão cancelada fica no histórico, mas não
       reabre — por isso a confirmação (mesmo padrão do cancelar Pix) */
    if (!window.confirm(`Cancelar a comissão de ${l.influenciadorNome}? Ela continua no histórico, mas não volta a ficar disponível.`)) {
      return;
    }
    void mover(l, "cancelar");
  };

  if (linhas.length === 0) {
    return (
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Nenhuma comissão ainda</h2>
        <p className={s.vazioTexto}>
          As comissões aparecem aqui quando um cliente indicado paga a primeira mensalidade.
        </p>
      </section>
    );
  }

  return (
    <div className={s.tabelaEnvolve}>
      <table className={`${s.tabela} ${a.tabelaLarga}`}>
        <caption className={s.somenteLeitor}>Comissões de influenciadores</caption>
        <thead>
          <tr>
            <th>Influenciador</th>
            <th>Cliente</th>
            <th>Plano</th>
            <th>Valor</th>
            <th>Situação</th>
            <th>Datas</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const ocupada = trabalhando === l.id;
            const abrindoPagamento = pagando === l.id;
            return (
              <tr key={l.id}>
                <td data-label="Influenciador">{l.influenciadorNome}</td>
                <td className={s.celulaFraca} data-label="Cliente">
                  {l.empresaNome ?? "—"}
                </td>
                <td className={s.celulaFraca} data-label="Plano">
                  {planoDaComissao(l.plano)}
                </td>
                <td className={s.valorCelula} data-label="Valor">
                  {formatarCentavos(l.valor_centavos)}
                </td>
                <td data-label="Situação">
                  <div className={a.etiquetas}>
                    <span className={`${s.etiqueta} ${CLASSE[l.status]}`}>{ROTULO[l.status]}</span>
                    {l.ambiente === "sandbox" && <span className={a.etiquetaTeste}>teste</span>}
                    {l.estorno_apos_pagamento && (
                      <span className={`${s.etiqueta} ${s.sitEstornada}`}>estornada após pagamento</span>
                    )}
                  </div>
                </td>
                <td data-label="Datas">
                  <ul className={a.datas}>
                    <li>Criada {dia(l.criada_em)}</li>
                    {l.disponivel_em && <li>Disponível {dia(l.disponivel_em)}</li>}
                    {l.paga_em && <li>Paga {dia(l.paga_em)}</li>}
                    {l.observacao && <li className={a.observacao}>Obs.: {l.observacao}</li>}
                  </ul>
                </td>
                <td data-label="Ação">
                  {l.status === "pendente" && (
                    <div className={a.acoesCelula}>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${a.botaoCompacto}`}
                        onClick={() => mover(l, "liberar")}
                        disabled={trabalhando !== null}
                        aria-busy={ocupada}
                      >
                        {ocupada ? "Salvando…" : "Liberar"}
                      </button>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${s.botaoPerigo} ${a.botaoCompacto}`}
                        onClick={() => cancelar(l)}
                        disabled={trabalhando !== null}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {l.status === "disponivel" && !abrindoPagamento && (
                    <div className={a.acoesCelula}>
                      <button
                        type="button"
                        className={`${s.botao} ${a.botaoCompacto}`}
                        onClick={() => {
                          setErro(null);
                          setObservacao("");
                          setPagando(l.id);
                        }}
                        disabled={trabalhando !== null}
                      >
                        Marcar como paga
                      </button>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${s.botaoPerigo} ${a.botaoCompacto}`}
                        onClick={() => cancelar(l)}
                        disabled={trabalhando !== null}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {l.status === "disponivel" && abrindoPagamento && (
                    <div className={a.registroPagamento}>
                      <label htmlFor={`obs-${l.id}`}>Observação (opcional)</label>
                      <input
                        id={`obs-${l.id}`}
                        value={observacao}
                        maxLength={200}
                        autoComplete="off"
                        placeholder="Ex.: Pix de 05/10"
                        onChange={(e) => setObservacao(e.target.value)}
                        autoFocus
                      />
                      <p className={a.registroAviso}>Só registra que você já pagou por fora.</p>
                      <div className={a.acoesCelula}>
                        <button
                          type="button"
                          className={`${s.botao} ${a.botaoCompacto}`}
                          onClick={() => mover(l, "pagar", observacao.trim() || undefined)}
                          disabled={trabalhando !== null}
                          aria-busy={ocupada}
                        >
                          {ocupada ? "Salvando…" : "Confirmar registro"}
                        </button>
                        <button
                          type="button"
                          className={`${s.botaoSec} ${a.botaoCompacto}`}
                          onClick={() => setPagando(null)}
                          disabled={ocupada}
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}

                  {(l.status === "paga" || l.status === "cancelada") && <span className={s.celulaFraca}>—</span>}

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
