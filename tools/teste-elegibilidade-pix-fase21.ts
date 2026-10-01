/**
 * Fase 21 — elegibilidade de Pix Automático, dois modos de cobrança,
 * fallback de inelegibilidade.
 *
 * UNIT — sem banco, sem Asaas, sem `.env.local`. Testa só funções puras:
 * `lib/core/elegibilidade-pix.ts` (validação de status + texto de UX),
 * `lib/core/metodo-cobranca.ts` (decisão de método) e
 * `interpretarEventoElegibilidade` de `lib/asaas/webhook.ts` (parsing do
 * payload do webhook, sem tocar banco). As funções que LEEM/ESCREVEM no
 * Supabase (`obterElegibilidadePix`, `gravarElegibilidadePix`) não são
 * exercitadas aqui de propósito — dependem da migration
 * `supabase/migrations/20260909000000_pix_automatico_elegibilidade.sql`,
 * que ainda NÃO foi aplicada (ver ZELO_LAUNCH_BLOCKERS.md). Cobertura de
 * integração real fica para depois de aplicada, seguindo o padrão dos
 * demais `tools/teste-*.ts` (empresa sintética + limpeza no fim).
 */

import {
  ehStatusElegibilidadeValido,
  descricaoElegibilidadePix,
  StatusElegibilidadePix,
} from "../lib/core/elegibilidade-pix";
import { determinarMetodoDeCobranca, podeSolicitarPixAutomatico } from "../lib/core/metodo-cobranca";
import { interpretarEventoElegibilidade } from "../lib/asaas/webhook";

let passou = 0,
  falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n} ${d}`);
  }
};

console.log("\n=== ELEGIBILIDADE PIX AUTOMÁTICO — VALIDAÇÃO DE STATUS ===\n");
{
  t("ELIGIBLE é válido", ehStatusElegibilidadeValido("ELIGIBLE"));
  t("INELIGIBLE é válido", ehStatusElegibilidadeValido("INELIGIBLE"));
  t("PENDING é válido", ehStatusElegibilidadeValido("PENDING"));
  t("UNKNOWN é válido", ehStatusElegibilidadeValido("UNKNOWN"));
  t("string arbitrária é inválida", !ehStatusElegibilidadeValido("eligible")); // case-sensitive: minúsculo não é o enum real
  t("valor vazio é inválido", !ehStatusElegibilidadeValido(""));
  t("null é inválido", !ehStatusElegibilidadeValido(null));
  t("número é inválido", !ehStatusElegibilidadeValido(42));
}

console.log("\n=== TEXTO DE UX — NUNCA MENCIONA ASAAS, ENDPOINT OU JARGÃO TÉCNICO ===\n");
{
  const PROIBIDAS = ["asaas", "endpoint", "api", "webhook", "stack", "http", "erro 4", "erro 5"];
  const ESTADOS: StatusElegibilidadePix[] = ["ELIGIBLE", "INELIGIBLE", "PENDING", "UNKNOWN"];
  for (const status of ESTADOS) {
    const texto = descricaoElegibilidadePix({ status });
    const junto = `${texto.titulo} ${texto.detalhe}`.toLowerCase();
    const achouProibida = PROIBIDAS.find((p) => junto.includes(p));
    t(`${status}: texto não vaza jargão técnico`, !achouProibida, achouProibida ? `(achou "${achouProibida}")` : "");
    t(`${status}: título não vazio`, texto.titulo.trim().length > 0);
    t(`${status}: detalhe não vazio`, texto.detalhe.trim().length > 0);
    t(`${status}: tom é um dos 4 válidos`, ["neutro", "atencao", "sucesso", "erro"].includes(texto.tom));
  }

  const ineligivel = descricaoElegibilidadePix({ status: "INELIGIBLE" });
  t("INELIGIBLE menciona Pix comum como alternativa", ineligivel.detalhe.toLowerCase().includes("pix comum"));
  t("INELIGIBLE promete avisar quando voltar", ineligivel.detalhe.toLowerCase().includes("avis"));
}

console.log("\n=== DETERMINAR MÉTODO DE COBRANÇA — CRITÉRIO É ELEGIBILIDADE, NUNCA PROFISSÃO ===\n");
{
  t(
    "elegível + autorização ativa -> PIX_AUTOMATICO",
    determinarMetodoDeCobranca({ elegibilidadePix: "ELIGIBLE", autorizacaoAtivaId: "auth-1" }) === "PIX_AUTOMATICO"
  );
  t(
    "unknown + autorização ativa -> PIX_AUTOMATICO (ausência de sinal não é inelegibilidade)",
    determinarMetodoDeCobranca({ elegibilidadePix: "UNKNOWN", autorizacaoAtivaId: "auth-1" }) === "PIX_AUTOMATICO"
  );
  t(
    "pending + autorização ativa -> PIX_AUTOMATICO",
    determinarMetodoDeCobranca({ elegibilidadePix: "PENDING", autorizacaoAtivaId: "auth-1" }) === "PIX_AUTOMATICO"
  );
  t(
    "inelegível + autorização ativa -> PIX_COMUM (autorização será cancelada pelo próprio Asaas)",
    determinarMetodoDeCobranca({ elegibilidadePix: "INELIGIBLE", autorizacaoAtivaId: "auth-1" }) === "PIX_COMUM"
  );
  t(
    "elegível SEM autorização -> PIX_COMUM (não força autorizar sozinho)",
    determinarMetodoDeCobranca({ elegibilidadePix: "ELIGIBLE", autorizacaoAtivaId: null }) === "PIX_COMUM"
  );
  t(
    "sem autorização nenhuma -> sempre PIX_COMUM, qualquer elegibilidade",
    (["ELIGIBLE", "INELIGIBLE", "PENDING", "UNKNOWN"] as StatusElegibilidadePix[]).every(
      (e) => determinarMetodoDeCobranca({ elegibilidadePix: e, autorizacaoAtivaId: null }) === "PIX_COMUM"
    )
  );

  t("pode solicitar quando ELIGIBLE", podeSolicitarPixAutomatico("ELIGIBLE"));
  t("pode solicitar quando UNKNOWN", podeSolicitarPixAutomatico("UNKNOWN"));
  t("pode solicitar quando PENDING", podeSolicitarPixAutomatico("PENDING"));
  t("NÃO pode solicitar quando INELIGIBLE", !podeSolicitarPixAutomatico("INELIGIBLE"));
}

console.log("\n=== PARSING DO WEBHOOK DE ELEGIBILIDADE — NUNCA INVENTA DADO AUSENTE ===\n");
{
  const semEligibility = interpretarEventoElegibilidade({});
  t("payload sem `eligibility` -> null (degrada, não inventa)", semEligibility === null);

  const statusInvalido = interpretarEventoElegibilidade({ eligibility: { status: "QUALQUER_COISA" as any } });
  t("status fora do enum real -> null", statusInvalido === null);

  const eligible = interpretarEventoElegibilidade({ eligibility: { status: "ELIGIBLE" } });
  t("ELIGIBLE sem motivos -> status correto", eligible?.status === "ELIGIBLE");
  t("ELIGIBLE sem motivos -> motivo null", eligible?.motivo === null);

  const ineligibleSemMotivo = interpretarEventoElegibilidade({ eligibility: { status: "INELIGIBLE", ineligibleReasons: [] } });
  t("INELIGIBLE com lista vazia -> motivo null (não inventa texto)", ineligibleSemMotivo?.motivo === null);

  const ineligibleComMotivo = interpretarEventoElegibilidade({
    eligibility: { status: "INELIGIBLE", ineligibleReasons: ["CNPJ inativo", "CNAE não compatível"] },
  });
  t(
    "INELIGIBLE com motivos -> concatena exatamente o que o Asaas mandou",
    ineligibleComMotivo?.motivo === "CNPJ inativo; CNAE não compatível"
  );

  const motivoGigante = interpretarEventoElegibilidade({
    eligibility: { status: "INELIGIBLE", ineligibleReasons: [Array(1000).fill("x").join("")] },
  });
  t("motivo é truncado em 500 caracteres (proteção contra payload gigante)", (motivoGigante?.motivo?.length ?? 0) <= 500);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
process.exit(falhou > 0 ? 1 : 0);
