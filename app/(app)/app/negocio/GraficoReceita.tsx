"use client";

import { useId, useState } from "react";
import { formatarCentavos } from "@/lib/dinheiro";
import type { PeriodoDoGrafico, PontoDaSerie } from "@/lib/negocio";
import c from "./Negocio.module.css";

type Props = {
  /** séries já calculadas no servidor (só dado real da empresa): o gráfico não calcula nada de dinheiro */
  series: Record<PeriodoDoGrafico, PontoDaSerie[]>;
};

const ABAS: { id: PeriodoDoGrafico; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "3m", rotulo: "3 meses" },
];

const LARGURA = 320;
const ALTURA = 140;
const BASE = 118; // linha do eixo
const TOPO = 12;

/**
 * Evolução da receita: barras simples, sem biblioteca. O SVG escala com a
 * largura da tela (`viewBox`), então o mesmo desenho serve do celular ao
 * desktop sem estourar. Acessível: o gráfico tem descrição em texto e uma
 * tabela só para leitor de tela com os mesmos números.
 */
export default function GraficoReceita({ series }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoDoGrafico>("7d");
  const nome = useId();
  const pontos = series[periodo];
  const maior = Math.max(...pontos.map((p) => p.valorCentavos), 0);
  const total = pontos.reduce((t, p) => t + p.valorCentavos, 0);
  const n = pontos.length;
  const passo = LARGURA / n;
  const larguraBarra = Math.max(3, Math.min(34, passo * 0.62));
  // rótulos esparsos para não amontoar (mês tem até 31 pontos)
  const cadaQuantos = n <= 8 ? 1 : n <= 16 ? 2 : 5;
  const rotuloDoPeriodo = ABAS.find((a) => a.id === periodo)?.rotulo ?? "";

  return (
    <div>
      <fieldset className={c.abas} aria-label="Período do gráfico">
        {ABAS.map((a) => (
          <label key={a.id} className={c.aba}>
            <input type="radio" name={nome} value={a.id} checked={periodo === a.id} onChange={() => setPeriodo(a.id)} />
            <span>{a.rotulo}</span>
          </label>
        ))}
      </fieldset>

      <svg
        className={c.grafico}
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label={`Receita recebida, ${rotuloDoPeriodo.toLowerCase()}: ${formatarCentavos(total)} no total.`}
      >
        <line x1="0" y1={BASE} x2={LARGURA} y2={BASE} className={c.graficoEixo} />
        {pontos.map((p, i) => {
          const h = maior > 0 ? Math.max(p.valorCentavos > 0 ? 3 : 0, Math.round((p.valorCentavos / maior) * (BASE - TOPO))) : 0;
          const x = i * passo + (passo - larguraBarra) / 2;
          return (
            <g key={`${p.rotulo}-${i}`}>
              <title>{`${p.rotulo}: ${formatarCentavos(p.valorCentavos)}`}</title>
              {p.valorCentavos > 0 ? (
                <rect className={c.graficoBarra} x={x} y={BASE - h} width={larguraBarra} height={h} rx="2" />
              ) : (
                <rect className={c.graficoZero} x={x} y={BASE - 2} width={larguraBarra} height={2} rx="1" />
              )}
              {i % cadaQuantos === 0 && (
                <text className={c.graficoRotulo} x={x + larguraBarra / 2} y={BASE + 14} textAnchor="middle">
                  {p.rotulo}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className={c.graficoTotal} role="status" aria-live="polite">
        {total > 0 ? (
          <>
            Recebido em <strong>{rotuloDoPeriodo.toLowerCase()}</strong>: <strong>{formatarCentavos(total)}</strong>
          </>
        ) : (
          <>Nenhum recebimento confirmado em {rotuloDoPeriodo.toLowerCase()} ainda.</>
        )}
      </p>

      <table className="sr-only">
        <caption>Receita recebida, {rotuloDoPeriodo.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Recebido</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p, i) => (
            <tr key={`${p.rotulo}-${i}`}>
              <th scope="row">{p.rotulo}</th>
              <td>{formatarCentavos(p.valorCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
