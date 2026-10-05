"use client";

import { useState } from "react";
import { definirStatusInfluenciadorAction } from "../acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import BotaoCopiar from "./BotaoCopiar";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

export type LinhaInfluenciador = {
  id: string;
  nome: string;
  codigo: string;
  link: string;
  status: "ativo" | "inativo";
  indicacoes: number;
  convertidos: number;
  pendenteCentavos: number;
  disponivelCentavos: number;
  pagoCentavos: number;
};

export default function TabelaInfluenciadores({ linhas }: { linhas: LinhaInfluenciador[] }) {
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  const alternar = async (l: LinhaInfluenciador) => {
    if (trabalhando) return;
    setErro(null);
    setTrabalhando(l.id);
    try {
      const r = await definirStatusInfluenciadorAction(l.id, l.status === "ativo" ? "inativo" : "ativo");
      if (!r.ok) setErro({ id: l.id, mensagem: r.mensagem });
    } catch {
      setErro({ id: l.id, mensagem: "Não foi possível atualizar agora." });
    } finally {
      setTrabalhando(null);
    }
  };

  if (linhas.length === 0) {
    return (
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Nenhum influenciador ainda</h2>
        <p className={s.vazioTexto}>Crie o primeiro acima para gerar um link de indicação.</p>
      </section>
    );
  }

  return (
    <div className={s.tabelaEnvolve}>
      <table className={`${s.tabela} ${a.tabelaLarga}`}>
        <caption className={s.somenteLeitor}>Influenciadores e valores de comissão (somente produção)</caption>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Código</th>
            <th>Link</th>
            <th>Indicações</th>
            <th>Convertidos</th>
            <th>Pendente</th>
            <th>Disponível</th>
            <th>Pago</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td data-label="Nome">{l.nome}</td>
              <td data-label="Código">
                <code className={a.codigo}>{l.codigo}</code>
              </td>
              <td data-label="Link">
                <BotaoCopiar texto={l.link} aria={`Copiar link de ${l.nome}`} />
              </td>
              <td className={s.celulaFraca} data-label="Indicações">
                {l.indicacoes}
              </td>
              <td className={s.celulaFraca} data-label="Convertidos">
                {l.convertidos}
              </td>
              <td className={s.valorCelula} data-label="Pendente">
                {formatarCentavos(l.pendenteCentavos)}
              </td>
              <td className={s.valorCelula} data-label="Disponível">
                {formatarCentavos(l.disponivelCentavos)}
              </td>
              <td className={s.valorCelula} data-label="Pago">
                {formatarCentavos(l.pagoCentavos)}
              </td>
              <td data-label="Status">
                <div className={a.statusCelula}>
                  <span className={`${s.etiqueta} ${l.status === "ativo" ? s.sitPaga : s.sitCancelada}`}>
                    {l.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    type="button"
                    className={`${s.botaoSec} ${a.botaoCompacto}`}
                    onClick={() => alternar(l)}
                    disabled={trabalhando !== null}
                    aria-busy={trabalhando === l.id}
                    aria-label={`${l.status === "ativo" ? "Desativar" : "Ativar"} ${l.nome}`}
                  >
                    {trabalhando === l.id ? "Salvando…" : l.status === "ativo" ? "Desativar" : "Ativar"}
                  </button>
                </div>
                {erro?.id === l.id && (
                  <span className={s.erroCampo} role="alert">
                    {erro.mensagem}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
