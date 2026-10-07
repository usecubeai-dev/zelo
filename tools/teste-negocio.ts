/**
 * Meu Negócio — regras da visão gerencial: receita, a receber, atraso,
 * previsão, saúde (3 níveis por regra), alertas, clientes, recorrência,
 * série do gráfico, e o isolamento entre empresas (RLS) nas mesmas consultas da tela.
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  avaliarSaude,
  fimDoMes,
  inicioDoMes,
  proporcoesDoFluxo,
  resumirNegocio,
  serieDeReceita,
  textoDaVariacao,
  type EntradaDoNegocio,
} from "../lib/negocio";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = 0;
let falhou = 0;
const t = (nome: string, cond: boolean, detalhe = "") => {
  if (cond) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.log(`  ✗ FALHA: ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};

const HOJE = "2026-10-15";
const meio = (dia: string) => `${dia}T15:00:00Z`; // meio do dia: o mesmo dia em qualquer fuso do Brasil
const base = (extra: Partial<EntradaDoNegocio> = {}): EntradaDoNegocio => ({
  abertas: [],
  pagas: [],
  clientesAtivos: 0,
  clientesNovosNoMes: 0,
  recorrencias: [],
  totalDeCobrancas: 0,
  hoje: HOJE,
  ...extra,
});

async function run() {
  console.log("\n=== MEU NEGÓCIO ===\n");

  console.log("1. Sem dados (primeiro acesso):");
  const vazio = resumirNegocio(base());
  t("sem cobranças e sem clientes: semDados", vazio.semDados === true && vazio.clientesAtivos === 0);
  t("todos os números zerados, sem inventar nada", vazio.receitaMesCentavos === 0 && vazio.aReceberCentavos === 0 && vazio.emAtrasoCentavos === 0 && vazio.previsaoDoMesCentavos === 0);
  t("ticket médio e variação são null (não há base)", vazio.ticketMedioCentavos === null && vazio.variacaoPct === null);
  t("saúde: tudo sob controle (nada atrasado)", vazio.saude.nivel === "ok");
  t("alertas: cadastrar cliente e criar a primeira cobrança", vazio.alertas.some((a) => a.id === "sem-clientes" && a.acao.href === "/app/clientes/novo") && vazio.alertas.some((a) => a.id === "sem-cobranca" && a.acao.href === "/app/cobrancas/nova"));
  t("sem previsão nem aviso de dinheiro inventado", !vazio.alertas.some((a) => a.id === "previsao-do-mes" || a.id === "previsto"));

  console.log("\n2. Com clientes, ainda sem cobrança:");
  const comClientes = resumirNegocio(base({ clientesAtivos: 3, clientesNovosNoMes: 2 }));
  t("clientes ativos e novos no mês", comClientes.clientesAtivos === 3 && comClientes.clientesNovosNoMes === 2);
  t("só falta a primeira cobrança (sem alerta de cliente)", comClientes.alertas.length === 1 && comClientes.alertas[0].id === "sem-cobranca");

  console.log("\n3. Receita, comparação e ticket:");
  const pagas = [
    { valor_pago_centavos: 10000, valor_centavos: 10000, pago_em: meio("2026-10-02") },
    { valor_pago_centavos: 25050, valor_centavos: 25000, pago_em: meio("2026-10-10") }, // pagou com encargos: vale o que ENTROU
    { valor_pago_centavos: null, valor_centavos: 5000, pago_em: meio("2026-10-12") }, // sem valor pago gravado: usa o cobrado
    { valor_pago_centavos: 20000, valor_centavos: 20000, pago_em: meio("2026-09-20") }, // mês anterior
    { valor_pago_centavos: 10000, valor_centavos: 10000, pago_em: meio("2026-08-05") }, // dois meses atrás (só ticket/gráfico)
  ];
  const r1 = resumirNegocio(base({ pagas, totalDeCobrancas: 5, clientesAtivos: 4 }));
  t("receita do mês soma o que realmente entrou (R$ 400,50)", r1.receitaMesCentavos === 10000 + 25050 + 5000);
  t("receita do mês anterior (R$ 200,00)", r1.receitaMesAnteriorCentavos === 20000);
  t("variação: +100% sobre o mês anterior (arredondada)", r1.variacaoPct === Math.round(((40050 - 20000) / 20000) * 100));
  t("texto da variação", textoDaVariacao(r1.variacaoPct) === "+100% em relação ao mês anterior" && textoDaVariacao(-12) === "−12% em relação ao mês anterior" && textoDaVariacao(0) === "igual ao mês anterior" && textoDaVariacao(null) === null);
  t("sem mês anterior: sem variação inventada", resumirNegocio(base({ pagas: [pagas[0]], totalDeCobrancas: 1 })).variacaoPct === null);
  t("ticket médio = média do que entrou nas 5 pagas", r1.ticketMedioCentavos === Math.round((10000 + 25050 + 5000 + 20000 + 10000) / 5));

  console.log("\n4. A receber, atraso e previsão:");
  const abertas = [
    { valor_centavos: 38000, vence_em: "2026-10-07", cliente_id: "A" }, // 8 dias de atraso
    { valor_centavos: 12000, vence_em: "2026-10-01", cliente_id: "A" }, // 14 dias, mesmo cliente
    { valor_centavos: 5000, vence_em: "2026-10-16", cliente_id: "B" }, // amanhã (aviso)
    { valor_centavos: 7000, vence_em: "2026-10-18", cliente_id: "C" }, // em 3 dias (aviso)
    { valor_centavos: 9000, vence_em: "2026-10-25", cliente_id: "D" }, // ainda neste mês, fora do aviso
    { valor_centavos: 40000, vence_em: "2026-11-10", cliente_id: "E" }, // mês que vem
    { valor_centavos: 3000, vence_em: HOJE, cliente_id: "F" }, // vence hoje: NÃO é atraso
  ];
  const r2 = resumirNegocio(base({ abertas, pagas, totalDeCobrancas: 12, clientesAtivos: 6 }));
  t("em atraso: só o vencido antes de hoje (R$ 500,00, 2 cobranças)", r2.emAtrasoCentavos === 50000 && r2.qtdEmAtraso === 2);
  t("vence hoje NÃO conta como atraso", r2.aReceberCentavos === 5000 + 7000 + 9000 + 40000 + 3000);
  t("clientes em atraso: contados uma vez só (A tem 2 cobranças)", r2.clientesEmAtraso === 1);
  t("a mais antiga está atrasada há 14 dias", r2.maisAntigaEmDias === 14);
  t("vencem nos próximos 3 dias: 3 cobranças (hoje, amanhã e em 3 dias)", r2.venceEmBreve.qtd === 3 && r2.venceEmBreve.valorCentavos === 5000 + 7000 + 3000);
  t("previsão do mês = recebido no mês + a vencer até o fim do mês (não conta o mês que vem nem o atrasado)", r2.previsaoDoMesCentavos === 40050 + (5000 + 7000 + 9000 + 3000));
  t("fim e início do mês", fimDoMes("2026-02-10") === "2026-02-28" && inicioDoMes("2026-10-15") === "2026-10-01" && inicioDoMes("2026-01-05", -1) === "2025-12-01");

  console.log("\n5. Saúde do negócio — três níveis, regras claras:");
  t("sem atraso → Tudo sob controle", avaliarSaude({ qtdAtrasadas: 0, atrasadoCentavos: 0, abertoTotalCentavos: 100000, maisAntigaEmDias: 0 }).titulo === "Tudo sob controle");
  t("1 atraso pequeno → Atenção aos recebimentos", avaliarSaude({ qtdAtrasadas: 1, atrasadoCentavos: 5000, abertoTotalCentavos: 100000, maisAntigaEmDias: 3 }).titulo === "Atenção aos recebimentos");
  t("alguns atrasos pequenos → Existem cobranças atrasadas", avaliarSaude({ qtdAtrasadas: 3, atrasadoCentavos: 9000, abertoTotalCentavos: 100000, maisAntigaEmDias: 10 }).titulo === "Existem cobranças atrasadas");
  t("5 ou mais atrasadas → atenção imediata", avaliarSaude({ qtdAtrasadas: 5, atrasadoCentavos: 5000, abertoTotalCentavos: 1000000, maisAntigaEmDias: 2 }).nivel === "imediata");
  t("atraso ≥ 20% do que está em aberto → atenção imediata", avaliarSaude({ qtdAtrasadas: 2, atrasadoCentavos: 20000, abertoTotalCentavos: 100000, maisAntigaEmDias: 2 }).nivel === "imediata");
  t("19% ainda é só atenção", avaliarSaude({ qtdAtrasadas: 2, atrasadoCentavos: 19000, abertoTotalCentavos: 100000, maisAntigaEmDias: 2 }).nivel === "atencao");
  t("atraso há mais de 30 dias → atenção imediata", avaliarSaude({ qtdAtrasadas: 1, atrasadoCentavos: 1000, abertoTotalCentavos: 1000000, maisAntigaEmDias: 31 }).nivel === "imediata");
  t("exatamente 30 dias ainda é atenção", avaliarSaude({ qtdAtrasadas: 1, atrasadoCentavos: 1000, abertoTotalCentavos: 1000000, maisAntigaEmDias: 30 }).nivel === "atencao");
  t("sempre há um MOTIVO escrito (não é uma nota misteriosa)", avaliarSaude({ qtdAtrasadas: 2, atrasadoCentavos: 20000, abertoTotalCentavos: 100000, maisAntigaEmDias: 2 }).motivo.length > 10);
  t("no cenário completo (2 atrasadas, 58% em aberto): atenção imediata", r2.saude.nivel === "imediata");

  console.log("\n6. Alertas — só dado real, cada um com ação:");
  const ids = r2.alertas.map((a) => a.id);
  t("alerta de vencidas com 'Recuperar cobrança'", r2.alertas.find((a) => a.id === "atrasadas")?.acao.rotulo === "Recuperar cobrança" && r2.alertas.find((a) => a.id === "atrasadas")?.texto.includes("2 cobranças vencidas") === true);
  t("o valor em atraso aparece no alerta", r2.alertas.find((a) => a.id === "atrasadas")?.texto.includes("R$ 500,00") === true);
  t("alerta dos próximos 3 dias com ação", r2.alertas.find((a) => a.id === "vencem-em-breve")?.texto.includes("3 cobranças vencem nos próximos 3 dias") === true);
  t("alerta de previsão e de dinheiro previsto", ids.includes("previsao-do-mes") && ids.includes("previsto"));
  t("toda ação tem rótulo e destino dentro do app", r2.alertas.every((a) => a.acao.rotulo.length > 3 && a.acao.href.startsWith("/app")));
  t("nenhum alerta de atraso quando não há atraso", !resumirNegocio(base({ abertas: [abertas[2]], totalDeCobrancas: 1, clientesAtivos: 1 })).alertas.some((a) => a.id === "atrasadas"));
  t("singular: 1 cobrança vencida", resumirNegocio(base({ abertas: [abertas[0]], totalDeCobrancas: 1, clientesAtivos: 1 })).alertas.find((a) => a.id === "atrasadas")?.texto.startsWith("Você tem 1 cobrança vencida") === true);

  console.log("\n7. Recorrência:");
  const rec = resumirNegocio(base({ recorrencias: [{ valor_centavos: 15000 }, { valor_centavos: 9990 }], totalDeCobrancas: 1, clientesAtivos: 2 }));
  t("previsão recorrente = soma do valor mensal das recorrências ativas", rec.recorrente.mensalCentavos === 24990 && rec.recorrente.quantidade === 2);
  t("sem recorrência: quantidade 0 (a tela não mostra o bloco)", resumirNegocio(base()).recorrente.quantidade === 0);

  console.log("\n8. Gráfico:");
  const s7 = serieDeReceita(pagas, "7d", HOJE);
  t("7 dias: 7 pontos, do mais antigo ao de hoje", s7.length === 7 && s7[6].rotulo === "15/10" && s7[0].rotulo === "09/10");
  t("7 dias: o recebimento do dia 10 e do dia 12 aparecem; o resto é zero (não inventa)", s7.find((p) => p.rotulo === "10/10")?.valorCentavos === 25050 && s7.find((p) => p.rotulo === "12/10")?.valorCentavos === 5000 && s7.find((p) => p.rotulo === "13/10")?.valorCentavos === 0);
  const sm = serieDeReceita(pagas, "mes", HOJE);
  t("mês: um ponto por dia até hoje (15)", sm.length === 15 && sm[1].valorCentavos === 10000 && sm.reduce((tt, p) => tt + p.valorCentavos, 0) === 40050);
  const s3 = serieDeReceita(pagas, "3m", HOJE);
  t("3 meses: ago, set e out com o total de cada mês", s3.map((p) => p.rotulo).join(",") === "ago,set,out" && s3[0].valorCentavos === 10000 && s3[1].valorCentavos === 20000 && s3[2].valorCentavos === 40050);
  t("sem recebimentos: tudo zero", serieDeReceita([], "7d", HOJE).every((p) => p.valorCentavos === 0));

  console.log("\n9. Fluxo de dinheiro:");
  const pf = proporcoesDoFluxo({ recebidoCentavos: 8400, aReceberCentavos: 2100, emAtrasoCentavos: 650 });
  t("proporções somam 100%", pf.recebido + pf.aReceber + pf.emAtraso === 100 && pf.recebido > pf.aReceber && pf.aReceber > pf.emAtraso);
  t("sem dinheiro nenhum: tudo 0 (barra vazia)", proporcoesDoFluxo({ recebidoCentavos: 0, aReceberCentavos: 0, emAtrasoCentavos: 0 }).recebido === 0);

  console.log("\n10. Isolamento entre empresas (as consultas da tela, com a sessão de cada uma):");
  const criar = async (rotulo: string) => {
    const email = `negocio_${rotulo}_${Date.now()}@zelo.test`;
    const { data: u } = await admin.auth.admin.createUser({ email, password: "senha_teste_negocio_12345", email_confirm: true });
    const { data: m } = await admin.from("membros").select("empresa_id").eq("user_id", u.user!.id).single();
    await admin.from("empresas").update({ assinatura_status: "ativa" }).eq("id", m!.empresa_id);
    const sessao = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await sessao.auth.signInWithPassword({ email, password: "senha_teste_negocio_12345" });
    return { userId: u.user!.id, empresaId: m!.empresa_id as string, sessao };
  };
  const A = await criar("a");
  const B = await criar("b");
  try {
    const { data: cliA } = await admin.from("clientes").insert({ empresa_id: A.empresaId, nome: "Cliente de A" }).select("id").single();
    const { error: cobErro } = await admin.from("cobrancas").insert([
      { empresa_id: A.empresaId, cliente_id: cliA!.id, descricao: "Atrasada de A", valor_centavos: 99900, vence_em: "2020-01-01", status: "pendente" },
      { empresa_id: A.empresaId, cliente_id: cliA!.id, descricao: "Paga de A", valor_centavos: 12300, vence_em: "2020-01-01", status: "paga", pago_em: new Date().toISOString(), valor_pago_centavos: 12300, pago_via: "asaas" },
    ]);
    const { error: recErro } = await admin.from("recorrencias").insert({ empresa_id: A.empresaId, cliente_id: cliA!.id, descricao: "Rec A", valor_centavos: 5000, dia_vencimento: 5, inicia_em: "2026-01-05", status: "ativa" });

    const consultas = async (sessao: typeof A.sessao, empresaId: string) => {
      const abertasQ = await sessao.from("cobrancas").select("valor_centavos, vence_em, cliente_id").eq("empresa_id", empresaId).in("status", ["pendente", "enviada"]);
      const pagasQ = await sessao.from("cobrancas").select("valor_pago_centavos, valor_centavos, pago_em").eq("empresa_id", empresaId).eq("status", "paga");
      const cli = await sessao.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
      const recs = await sessao.from("recorrencias").select("valor_centavos").eq("empresa_id", empresaId).eq("status", "ativa");
      return { abertas: abertasQ.data ?? [], pagas: pagasQ.data ?? [], clientes: cli.count ?? 0, recs: recs.data ?? [] };
    };
    const dA = await consultas(A.sessao, A.empresaId);
    t("A vê as próprias cobranças, clientes e recorrências", dA.abertas.length === 1 && dA.pagas.length === 1 && dA.clientes === 1 && dA.recs.length === 1, JSON.stringify({ a: dA.abertas.length, p: dA.pagas.length, c: dA.clientes, r: dA.recs.length, errRec: recErro, cobErro: cobErro?.message }));
    const dB = await consultas(B.sessao, B.empresaId);
    t("B (empresa vazia) não vê NADA de A", dB.abertas.length === 0 && dB.pagas.length === 0 && dB.clientes === 0 && dB.recs.length === 0);
    const dBqueTentaA = await consultas(B.sessao, A.empresaId);
    t("B pedindo explicitamente o empresa_id de A também não recebe nada (RLS)", dBqueTentaA.abertas.length === 0 && dBqueTentaA.pagas.length === 0 && dBqueTentaA.clientes === 0 && dBqueTentaA.recs.length === 0);
    const rB = resumirNegocio({ abertas: dB.abertas, pagas: dB.pagas, clientesAtivos: dB.clientes, clientesNovosNoMes: 0, recorrencias: dB.recs, totalDeCobrancas: 0 });
    t("o resumo de B é de primeiro acesso: zero em tudo", rB.semDados && rB.receitaMesCentavos === 0 && rB.emAtrasoCentavos === 0 && rB.recorrente.quantidade === 0);
    const rA = resumirNegocio({ abertas: dA.abertas, pagas: dA.pagas as never, clientesAtivos: dA.clientes, clientesNovosNoMes: 1, recorrencias: dA.recs, totalDeCobrancas: 2 });
    t("o resumo de A mostra os números de A", rA.emAtrasoCentavos === 99900 && rA.receitaMesCentavos === 12300 && rA.recorrente.mensalCentavos === 5000);
  } finally {
    for (const e of [A.empresaId, B.empresaId]) {
      await admin.from("recorrencias").delete().eq("empresa_id", e);
      await admin.from("cobrancas").delete().eq("empresa_id", e);
      await admin.from("clientes").delete().eq("empresa_id", e);
    }
    await admin.auth.admin.deleteUser(A.userId);
    await admin.auth.admin.deleteUser(B.userId);
  }

  console.log(`\n=== ${ok} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e);
  process.exit(1);
});
