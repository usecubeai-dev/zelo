/**
 * Teste do comportamento de indexação por ambiente (Etapa 3A do staging).
 *
 * Sem banco, sem rede: testa diretamente `lib/ambiente.ts`, a mesma
 * função que `app/robots.ts` usa para decidir entre bloquear tudo
 * (`disallow: "/"`) e liberar o robots.txt normal. Não importa
 * `app/robots.ts` nem `app/layout.tsx` de propósito — eles puxam
 * `next/font/google` e `globals.css`, que só existem dentro do pipeline
 * de build do Next e não rodam fora dele (confirmado ao tentar).
 */

import { indexavelPorAmbiente } from "../lib/ambiente";

let passou = 0;
let falhou = 0;
function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

console.log("Indexação por ambiente (NEXT_PUBLIC_PERMITIR_INDEXACAO)\n");

delete process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO;
ok("variável ausente → bloqueado (fail-safe)", indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = "";
ok("variável vazia → bloqueado", indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = "false";
ok('"false" → bloqueado', indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = "1";
ok('"1" não libera — só a string exata "true"', indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = "True";
ok('"True" com maiúscula não libera (comparação estrita, sem normalização)', indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = " true";
ok('"true" com espaço não libera (sem trim — precisa ser exato)', indexavelPorAmbiente() === false);

process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO = "true";
ok('"true" explícito → liberado', indexavelPorAmbiente() === true);

delete process.env.NEXT_PUBLIC_PERMITIR_INDEXACAO;

console.log(`\n${passou} passaram, ${falhou} falharam.`);
if (falhou > 0) process.exit(1);
