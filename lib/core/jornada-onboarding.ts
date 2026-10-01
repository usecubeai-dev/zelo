/**
 * Caso de uso: jornada de onboarding até o primeiro recebimento —
 * Fase 14 do Core Financeiro.
 *
 * Nenhum passo é um flag persistido (não existe "current_step" na
 * empresa) — cada um é DERIVADO do estado real do banco, sempre. Isso
 * é o que torna a jornada automaticamente retomável (refresh, logout,
 * login em outro dispositivo — tudo mostra o progresso real, nunca um
 * checkpoint que pode ficar desatualizado) e o que garante que nenhum
 * dado já preenchido é perguntado de novo: o passo já concluído nunca
 * aparece como pendência.
 *
 * Os passos não são estritamente sequenciais na prática — um
 * profissional pode criar uma cobrança avulsa sem nunca configurar
 * recorrência/Pix Automático. Por isso cada passo é computado
 * independentemente, não em cadeia ("só checa o passo 5 se o 4 estiver
 * concluído"). O `proximoPasso` é só o primeiro pendente na ordem
 * sugerida — uma sugestão, não um bloqueio.
 */

import { supabaseAdmin, supabaseConfigurado } from "../supabase/admin";
import { obterContaFinanceira } from "./onboarding";
import { prontaParaCobrar, descricaoDoEstado } from "./conta-financeira";

export type PassoJornada = {
  id: string;
  titulo: string;
  concluido: boolean;
  href: string;
  /** Só quando pendente e há algo específico a explicar (ex.: conta recusada) — nunca inventado, vem de `descricaoDoEstado()`. */
  detalhe?: string;
};

export type JornadaOnboarding = {
  passos: PassoJornada[];
  completa: boolean;
  proximoPasso: PassoJornada | null;
  /** Fase 23 — subconjunto de 3 passos da mesma jornada, priorizados como
      "ativação": primeiro cliente, primeira cobrança, cobrança enviada.
      Não é uma segunda jornada — os dois primeiros passos são
      literalmente `primeiro_cliente`/`primeira_cobranca` acima; só o
      terceiro ("envio") é novo aqui. Existe porque o objetivo do
      onboarding completo (9 passos, inclui configuração financeira) é
      diferente do objetivo de "mostrar o produto funcionando rápido". */
  ativacaoRapida: AtivacaoRapida;
};

export type AtivacaoRapida = {
  passos: PassoJornada[];
  completa: boolean;
};

export async function obterJornadaOnboarding(empresaId: string): Promise<JornadaOnboarding> {
  if (!supabaseConfigurado()) {
    return { passos: [], completa: true, proximoPasso: null, ativacaoRapida: { passos: [], completa: true } };
  }

  const admin = supabaseAdmin();

  const [empresaRow, conta, clientesCount, servicosCount, recorrenciasCount, autorizacaoAtivaCount, cobrancasCount, recebimentoCount, cobrancasEnviadasCount] = await Promise.all([
    admin.from("empresas").select("documento").eq("id", empresaId).maybeSingle(),
    obterContaFinanceira(empresaId),
    admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    admin.from("servicos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    admin.from("recorrencias").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    admin.from("autorizacoes_pix").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ACTIVE"),
    admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    admin.from("cobrancas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("pago_via", "asaas"),
    /* Fase 23 — "enviei pro cliente": status já saiu de pendente (o
       profissional clicou em "Marcar como enviada", ou o webhook já
       confirmou pagamento/cancelamento) OU já tem `asaas_payment_id`
       (foi sincronizada com o parceiro financeiro mesmo ainda pendente —
       nesse caso o cliente já pode pagar, mesmo sem o clique manual). */
    admin
      .from("cobrancas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .or("status.neq.pendente,asaas_payment_id.not.is.null"),
  ]);

  const passos: PassoJornada[] = [
    { id: "conta_criada", titulo: "Criar sua conta", concluido: true, href: "/app" },
    {
      id: "negocio_configurado",
      // Fase 21: título antes dizia "(CPF ou CNPJ)", sugerindo que os dois
      // documentos dão acesso às mesmas formas de cobrança — não é
      // verdade para Pix Automático, cuja elegibilidade quem decide é o
      // Asaas (ver `lib/core/elegibilidade-pix.ts`). O campo em si aceita
      // os dois (é dado cadastral, não promessa de recurso).
      titulo: "Configurar seu negócio",
      concluido: !!empresaRow.data?.documento,
      href: "/app/configuracoes",
    },
    {
      id: "conta_financeira_pronta",
      titulo: "Conectar e aprovar sua conta financeira",
      concluido: conta ? prontaParaCobrar(conta) : false,
      href: "/app/configuracoes",
      // Reaproveita a mesma descrição da tela de Configurações (Fase 3) —
      // não inventa um texto novo pro mesmo estado. `situacao=null`: sem
      // chamada ao Asaas aqui (o painel não deveria depender de uma
      // chamada externa pra carregar) — a versão detalhada, com a
      // situação ao vivo, é a própria tela de Configurações.
      detalhe: conta && !prontaParaCobrar(conta) ? descricaoDoEstado(conta, null).detalhe : undefined,
    },
    {
      id: "primeiro_cliente",
      titulo: "Cadastrar seu primeiro cliente",
      concluido: (clientesCount.count ?? 0) > 0,
      href: "/app/clientes/novo",
    },
    {
      id: "primeiro_servico",
      titulo: "Cadastrar seu primeiro serviço",
      concluido: (servicosCount.count ?? 0) > 0,
      href: "/app/servicos/novo",
    },
    {
      id: "primeira_recorrencia",
      titulo: "Criar sua primeira recorrência",
      concluido: (recorrenciasCount.count ?? 0) > 0,
      href: "/app/recorrencias/nova",
    },
    {
      id: "autorizacao_pix",
      titulo: "Ativar uma autorização Pix Automático",
      concluido: (autorizacaoAtivaCount.count ?? 0) > 0,
      href: "/app/recorrencias",
    },
    {
      id: "primeira_cobranca",
      titulo: "Gerar sua primeira cobrança",
      concluido: (cobrancasCount.count ?? 0) > 0,
      href: "/app/cobrancas/nova",
    },
    {
      id: "primeiro_recebimento",
      titulo: "Receber seu primeiro pagamento confirmado",
      concluido: (recebimentoCount.count ?? 0) > 0,
      href: "/app/recebimentos",
    },
  ];

  const completa = passos.every((p) => p.concluido);
  const proximoPasso = passos.find((p) => !p.concluido) ?? null;

  /* Fase 23 — mesmos dois primeiros passos de cima (`primeiro_cliente`,
     `primeira_cobranca`), reaproveitados por referência, não recalculados
     nem reescritos: uma única fonte de verdade por passo, mesmo aparecendo
     em dois lugares. Só "envio" é exclusivo deste subconjunto. */
  const passoCliente = passos.find((p) => p.id === "primeiro_cliente")!;
  const passoCobranca = passos.find((p) => p.id === "primeira_cobranca")!;
  const passoEnvio: PassoJornada = {
    id: "cobranca_enviada",
    titulo: "Enviar a cobrança para o cliente",
    concluido: (cobrancasEnviadasCount.count ?? 0) > 0,
    href: "/app/cobrancas",
  };
  const ativacaoRapida: AtivacaoRapida = {
    passos: [
      { ...passoCliente, titulo: "Cadastre seu primeiro cliente" },
      { ...passoCobranca, titulo: "Crie sua primeira cobrança" },
      passoEnvio,
    ],
    completa: passoCliente.concluido && passoCobranca.concluido && passoEnvio.concluido,
  };

  return { passos, completa, proximoPasso, ativacaoRapida };
}
