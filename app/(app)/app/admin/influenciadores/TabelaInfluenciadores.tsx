"use client";

import { useState } from "react";
import { definirStatusInfluenciadorAction, definirTermoParceriaAction } from "../acoes";
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
  /** YYYY-MM-DD; `null` = sem termo assinado, então o influenciador não pode ficar ativo */
  termoAssinadoEm: string | null;
};

/** Hoje no fuso do navegador (YYYY-MM-DD): o termo já foi assinado, a data não pode ser futura. */
const hojeLocal = () => new Date().toLocaleDateString("sv-SE");

export default function TabelaInfluenciadores({ linhas }: { linhas: LinhaInfluenciador[] }) {
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);
  /* rascunho da data por linha: só vira dado quando o administrador clica em Salvar */
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [salvandoTermo, setSalvandoTermo] = useState<string | null>(null);

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

  const salvarTermo = async (l: LinhaInfluenciador, data: string | null) => {
    if (trabalhando || salvandoTermo) return;
    setErro(null);
    setSalvandoTermo(l.id);
    try {
      const r = await definirTermoParceriaAction(l.id, data);
      if (!r.ok) {
        setErro({ id: l.id, mensagem: r.mensagem });
        return;
      }
      /* a action revalida a rota: o rascunho some e a linha passa a mostrar o valor salvo */
      setRascunhos((atual) => {
        const proximo = { ...atual };
        delete proximo[l.id];
        return proximo;
      });
    } catch {
      setErro({ id: l.id, mensagem: "Não foi possível salvar agora." });
    } finally {
      setSalvandoTermo(null);
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
            <th>Status</th>
            <th>Termo assinado em</th>
            <th>Link</th>
            <th>Indicações</th>
            <th>Convertidos</th>
            <th>Pendente</th>
            <th>Disponível</th>
            <th>Pago</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const rascunho = rascunhos[l.id] ?? l.termoAssinadoEm ?? "";
            const mudou = rascunho !== (l.termoAssinadoEm ?? "");
            const salvando = salvandoTermo === l.id;
            const semTermo = !l.termoAssinadoEm;
            const ativarBloqueado = l.status !== "ativo" && semTermo;

            return (
              <tr key={l.id}>
                <td data-label="Nome">{l.nome}</td>
                <td data-label="Código">
                  <code className={a.codigo}>{l.codigo}</code>
                </td>
                <td data-label="Status">
                  <div className={a.statusColuna}>
                  <div className={a.statusCelula}>
                    {semTermo ? (
                      /* sem termo o banco recusa ativar: o estado precisa ser óbvio, não só "Inativo" */
                      <span className={`${s.etiqueta} ${s.sitVencida} ${a.semTermo}`}>Inativo (sem termo)</span>
                    ) : (
                      <span className={`${s.etiqueta} ${l.status === "ativo" ? s.sitPaga : s.sitCancelada}`}>
                        {l.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${s.botaoSec} ${a.botaoCompacto}`}
                      onClick={() => alternar(l)}
                      disabled={trabalhando !== null || ativarBloqueado}
                      aria-busy={trabalhando === l.id}
                      aria-describedby={ativarBloqueado ? `dica-termo-${l.id}` : undefined}
                      title={ativarBloqueado ? "Registre a data do termo de parceria para ativar" : undefined}
                      aria-label={`${l.status === "ativo" ? "Desativar" : "Ativar"} ${l.nome}`}
                    >
                      {trabalhando === l.id ? "Salvando…" : l.status === "ativo" ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                  {ativarBloqueado && (
                    <span id={`dica-termo-${l.id}`} className={s.dicaCampo}>
                      Sem a data do termo, o link e o código não funcionam. Registre a data para ativar.
                    </span>
                  )}
                  {erro?.id === l.id && (
                    <span className={s.erroCampo} role="alert">
                      {erro.mensagem}
                    </span>
                  )}
                  </div>
                </td>
                <td data-label="Termo assinado em">
                  <div className={a.termoCelula}>
                    <label className={s.somenteLeitor} htmlFor={`termo-${l.id}`}>
                      Data do termo de parceria de {l.nome}
                    </label>
                    <input
                      id={`termo-${l.id}`}
                      type="date"
                      className={a.campoData}
                      value={rascunho}
                      max={hojeLocal()}
                      disabled={salvando}
                      onChange={(e) => setRascunhos((atual) => ({ ...atual, [l.id]: e.target.value }))}
                    />
                    <div className={a.statusCelula}>
                      <button
                        type="button"
                        className={`${s.botaoSec} ${a.botaoCompacto}`}
                        onClick={() => salvarTermo(l, rascunho)}
                        disabled={!mudou || rascunho === "" || salvandoTermo !== null || trabalhando !== null}
                        aria-busy={salvando}
                        aria-label={`Salvar data do termo de ${l.nome}`}
                      >
                        {salvando ? "Salvando…" : "Salvar"}
                      </button>
                      {l.termoAssinadoEm && (
                        <button
                          type="button"
                          className={`${s.botaoSec} ${s.botaoPerigo} ${a.botaoCompacto}`}
                          onClick={() => salvarTermo(l, null)}
                          disabled={salvandoTermo !== null || trabalhando !== null}
                          aria-label={`Limpar data do termo de ${l.nome} (isto também desativa o influenciador)`}
                          title="Limpar a data também desativa o influenciador"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
