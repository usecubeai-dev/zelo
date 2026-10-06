/**
 * Exportação dos dados do profissional em CSV (clientes, cobranças,
 * recebimentos) — oferecida ANTES de excluir a conta, e útil por si só
 * (portabilidade).
 *
 * A parte de montar o CSV é pura (sem banco): ponto e vírgula e BOM UTF-8
 * (é o que o Excel brasileiro abre sem estragar acentos) e proteção contra
 * injeção de fórmula — texto que começa com `=`, `+`, `-`, `@`, tab ou CR
 * ganha um apóstrofo, senão uma planilha aberta no Excel executaria o que o
 * cliente digitou no cadastro.
 */

export type TipoExportacao = "clientes" | "cobrancas" | "recebimentos";

export const TIPOS_DE_EXPORTACAO: readonly TipoExportacao[] = ["clientes", "cobrancas", "recebimentos"];

export function ehTipoDeExportacao(v: unknown): v is TipoExportacao {
  return typeof v === "string" && (TIPOS_DE_EXPORTACAO as readonly string[]).includes(v);
}

/** Texto seguro para uma célula de planilha (neutraliza fórmulas). */
export function celulaSegura(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function escaparCsv(texto: string): string {
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Centavos → "380,50" (número, não texto de planilha — por isso não passa por `celulaSegura`). */
export function reaisCsv(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "";
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export function paraCsv(colunas: string[], linhas: (string | number | null | undefined)[][], numericas: Set<number> = new Set()): string {
  const cabecalho = colunas.map((c) => escaparCsv(celulaSegura(c))).join(";");
  const corpo = linhas.map((l) =>
    l.map((v, i) => (numericas.has(i) ? escaparCsv(String(v ?? "")) : escaparCsv(celulaSegura(v)))).join(";")
  );
  return "﻿" + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}
