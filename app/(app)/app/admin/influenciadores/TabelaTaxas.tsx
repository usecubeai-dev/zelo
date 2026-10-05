"use client";

import { useState } from "react";
import { marcarTaxasFaturadasAction } from "../acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

export type LinhaTaxa = {
  empresaId: string | null;
  empresaNome: string;
  quantidade: number;
  totalCentavos: number;
  maisAntiga: string;
};

/**
 * Taxas de recebimento (R$ 1,99) ainda não cobradas, por profissional.
 * "Marcar como cobrada" só REGISTRA que a cobrança foi feita por fora.
 */
export default function TabelaTaxas({ linhas }: { linhas: LinhaTaxa[] }) {
  const [referencias, setReferencias] = useState<Record<string, string>>({});
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  if (linhas.length === 0) {
    return (
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Nenhuma taxa a cobrar</h2>
        <p className={s.vazioTexto}>As taxas aparecem aqui quando um profissional recebe um pagamento real.</p>
      </section>
    );
  }

  const marcar = async (l: LinhaTaxa) => {
    if (!l.empresaId || trabalhando) return;
    const id = l.empresaId;
    setErro(null);
    setTrabalhando(id);
    try {
      const r = await marcarTaxasFaturadasAction(id, referencias[id] ?? "");
      if (!r.ok) setErro({ id, mensagem: r.mensagem });
    } catch {
      setErro({ id, mensagem: "Não foi possível atualizar agora." });
    } finally {
      setTrabalhando(null);
    }
  };

  return (
    <div className={s.tabelaEnvolve}>
      <table className={`${s.tabela} ${a.tabelaLarga}`}>
        <caption className={s.somenteLeitor}>Taxas de recebimento a cobrar, por profissional (somente produção)</caption>
        <thead>
          <tr>
            <th>Profissional</th>
            <th>Recebimentos</th>
            <th>Total a cobrar</th>
            <th>Desde</th>
            <th>Cobrança</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.empresaId ?? l.empresaNome}>
              <td data-label="Profissional">{l.empresaNome}</td>
              <td className={s.celulaFraca} data-label="Recebimentos">
                {l.quantidade}
              </td>
              <td className={s.valorCelula} data-label="Total a cobrar">
                {formatarCentavos(l.totalCentavos)}
              </td>
              <td className={s.celulaFraca} data-label="Desde">
                {new Date(l.maisAntiga).toLocaleDateString("pt-BR")}
              </td>
              <td data-label="Cobrança">
                {l.empresaId ? (
                  <div className={a.statusCelula}>
                    <input
                      className={a.campoTaxa}
                      type="text"
                      placeholder="Referência (ex.: Pix 10/2026)"
                      aria-label={`Referência da cobrança de ${l.empresaNome}`}
                      value={referencias[l.empresaId] ?? ""}
                      onChange={(e) => setReferencias((r) => ({ ...r, [l.empresaId as string]: e.target.value }))}
                      maxLength={80}
                    />
                    <button
                      type="button"
                      className={`${s.botaoSec} ${a.botaoCompacto}`}
                      onClick={() => marcar(l)}
                      disabled={trabalhando !== null}
                      aria-busy={trabalhando === l.empresaId}
                    >
                      {trabalhando === l.empresaId ? "Salvando…" : "Marcar como cobrada"}
                    </button>
                    {erro?.id === l.empresaId && (
                      <span className={s.erroCampo} role="alert">
                        {erro.mensagem}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={s.celulaFraca}>Conta removida</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
