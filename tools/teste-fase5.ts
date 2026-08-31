/**
 * Bateria de Testes da Fase 5 — Integração Asaas & Webhooks
 *
 * Valida contratos, segurança de token, processamento de webhooks e idempotência.
 */

import fs from 'fs';
import { getAsaasConfiguration, ASAAS_URLS } from '../lib/asaas/config';
import { criarCobrancaAsaas } from '../lib/asaas/cobranca';
import { criarClienteAsaas } from '../lib/asaas/cliente';
import { criarAssinaturaAsaas } from '../lib/asaas/assinatura';
import { processarEventoWebhook, validarTokenWebhook } from '../lib/asaas/webhook';
import { AsaasWebhookPayload } from '../lib/asaas/tipos';

// 1. Carregar variáveis de ambiente
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
dotenv.split('\n').forEach((line) => {
  const clean = line.trim();
  if (clean.startsWith('#') || !clean.includes('=')) return;
  const idx = clean.indexOf('=');
  const k = clean.slice(0, idx).trim();
  const v = clean.slice(idx + 1).trim();
  env[k] = v;
  process.env[k] = v;
});

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '') as string;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '') as string;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERRO: Variáveis do Supabase não encontradas em .env.local');
  process.exit(1);
}

// Configurar temporariamente token de webhook para teste se não houver
if (!process.env.ASAAS_WEBHOOK_TOKEN) {
  process.env.ASAAS_WEBHOOK_TOKEN = 'token_secreto_webhook_teste_123';
}

async function run() {
  console.log('====================================================');
  console.log(' BATERIA DE TESTES — FASE 5 (INTEGRAÇÃO ASAAS)');
  console.log('====================================================\n');

  let totalTestes = 0;
  let sucessos = 0;

  function assert(condicao: boolean, titulo: string) {
    totalTestes++;
    if (condicao) {
      sucessos++;
      console.log(`  ✓ ${titulo}`);
    } else {
      console.error(`  ✗ FALHA: ${titulo}`);
    }
  }

  // --- SEÇÃO 1: CONFIGURAÇÃO E DESACOPLAMENTO ---
  console.log('1. Configuração e Tratamento Desacoplado:');

  const config = getAsaasConfiguration();
  assert(config.baseUrl === ASAAS_URLS.sandbox || config.baseUrl === ASAAS_URLS.production, 'Configuração: URL base oficial do Asaas (v3)');

  // Chamada de API sem API Key configurada não quebra, retorna 503 seguro
  if (!config.apiKey) {
    const resCli = await criarClienteAsaas({ name: 'Cliente Teste' });
    assert(!resCli.ok && resCli.status === 503, 'Segurança: Chamada a clientes sem API Key retorna 503 amigável');

    const resCob = await criarCobrancaAsaas({ customer: 'cus_123', valorCentavos: 1000, dueDate: '2026-09-01', description: 'Teste' });
    assert(!resCob.ok && resCob.status === 503, 'Segurança: Chamada a cobranças sem API Key retorna 503 amigável');

    const resAss = await criarAssinaturaAsaas({ customer: 'cus_123', valorCentavos: 2990, nextDueDate: '2026-09-01', description: 'Zelo' });
    assert(!resAss.ok && resAss.status === 503, 'Segurança: Chamada a assinaturas sem API Key retorna 503 amigável');
  } else {
    console.log('  ℹ API Key real detectada no ambiente.');
  }

  // --- SEÇÃO 2: VALIDAÇÃO DE TOKEN DO WEBHOOK ---
  console.log('\n2. Autenticação e Segurança do Webhook:');

  assert(!validarTokenWebhook(null), 'Token nulo -> rejeitado (401)');
  assert(!validarTokenWebhook(''), 'Token vazio -> rejeitado (401)');
  assert(!validarTokenWebhook('token_falso_incorreto'), 'Token inválido -> rejeitado (401)');
  assert(validarTokenWebhook('token_secreto_webhook_teste_123'), 'Token correto -> autenticado com sucesso');

  // --- SEÇÃO 3: PROCESSAMENTO DE EVENTOS E IDEMPOTÊNCIA ---
  console.log('\n3. Processamento de Webhooks e Atualização no Banco:');

  const adminHeaders: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // 3.1 Setup de dados para teste: Usuário, Empresa, Cliente e Cobrança
  const emailUser = `teste_asaas_${Date.now()}@zelo.test`;
  const userRes = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: emailUser, password: 'senha_teste_12345', email_confirm: true, user_metadata: { nome: 'Empresa Webhook' } }),
  })).json();

  const userId = userRes.id || userRes.user?.id;
  const membros = await (await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userId}`, { headers: adminHeaders })).json();
  const empresaId = membros[0]?.empresa_id;

  /* Fase 6: o webhook resolve o tenant por `account.id`. A empresa de
     teste precisa estar vinculada a uma conta Asaas, senão o evento é
     recusado — que é o comportamento correto, não uma falha. */
  const contaAsaas = `acc_teste_fase5_${Date.now()}`;
  await fetch(`${SUPABASE_URL}/rest/v1/empresas?id=eq.${empresaId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ asaas_account_id: contaAsaas, asaas_status: 'ativa' }),
  });

  const cli = (await (await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ empresa_id: empresaId, nome: 'Cliente Pagador' }),
  })).json())[0];

  const cob = (await (await fetch(`${SUPABASE_URL}/rest/v1/cobrancas`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      empresa_id: empresaId,
      cliente_id: cli.id,
      descricao: 'Mensalidade Webhook',
      valor_centavos: 25000,
      vence_em: '2026-09-10',
      status: 'pendente',
    }),
  })).json())[0];

  assert(Boolean(cob && cob.id && cob.status === 'pendente'), 'Cobrança de teste criada com status pendente');

  // 3.2 Simular Webhook PAYMENT_RECEIVED do Asaas
  const asaasPaymentId = `pay_test_${Date.now()}`;
  const asaasEventId = `evt_test_${Date.now()}`;

  const payloadPagamento: AsaasWebhookPayload = {
    id: asaasEventId,
    event: 'PAYMENT_RECEIVED',
    dateCreated: new Date().toISOString(),
    account: { id: contaAsaas },
    payment: {
      id: asaasPaymentId,
      customer: 'cus_test_123',
      dateCreated: '2026-08-26',
      dueDate: '2026-09-10',
      value: 250.00, // 250 reais = 25000 centavos
      billingType: 'PIX',
      status: 'RECEIVED',
      paymentDate: '2026-08-26T14:30:00Z',
      externalReference: cob.id, // vincula com o ID da cobrança no Zelo
    },
  };

  const processado1 = await processarEventoWebhook(payloadPagamento);
  assert(processado1.ok === true, 'Webhook PAYMENT_RECEIVED processado com sucesso');

  // Verificar se o banco foi atualizado
  const cobAtualizada = (await (await fetch(`${SUPABASE_URL}/rest/v1/cobrancas?id=eq.${cob.id}`, { headers: adminHeaders })).json())[0];
  assert(cobAtualizada.status === 'paga', 'Banco: status da cobrança atualizado para "paga"');
  assert(cobAtualizada.valor_pago_centavos === 25000, 'Banco: valor_pago_centavos gravado corretamente como 25000');
  assert(cobAtualizada.asaas_payment_id === asaasPaymentId, 'Banco: asaas_payment_id vinculado');
  assert(Boolean(cobAtualizada.pago_em), 'Banco: data de pagamento (pago_em) registrada');

  // 3.3 Testar Idempotência (reenvio do mesmo evento)
  const processado2 = await processarEventoWebhook(payloadPagamento);
  assert(processado2.ok === true, 'Reenvio do mesmo evento tratado com sucesso sem erro');

  // 3.4 Simular Webhook PAYMENT_DELETED
  const cob2 = (await (await fetch(`${SUPABASE_URL}/rest/v1/cobrancas`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      empresa_id: empresaId,
      cliente_id: cli.id,
      descricao: 'Cobrança a cancelar',
      valor_centavos: 8000,
      vence_em: '2026-09-10',
      status: 'pendente',
    }),
  })).json())[0];

  const payloadCancelamento: AsaasWebhookPayload = {
    id: `evt_cancel_${Date.now()}`,
    event: 'PAYMENT_DELETED',
    dateCreated: new Date().toISOString(),
    account: { id: contaAsaas },
    payment: {
      id: `pay_cancel_${Date.now()}`,
      customer: 'cus_test_123',
      dateCreated: '2026-08-26',
      dueDate: '2026-09-10',
      value: 80.00,
      billingType: 'BOLETO',
      status: 'DELETED',
      externalReference: cob2.id,
    },
  };

  await processarEventoWebhook(payloadCancelamento);
  const cob2Cancelada = (await (await fetch(`${SUPABASE_URL}/rest/v1/cobrancas?id=eq.${cob2.id}`, { headers: adminHeaders })).json())[0];
  assert(cob2Cancelada.status === 'cancelada', 'Banco: status da cobrança cancelada via webhook atualizado para "cancelada"');

  // --- SEÇÃO 4: LIMPEZA DOS DADOS DE TESTE ---
  console.log('\n4. Limpeza:');
  if (userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders });
  }
  console.log('  ✓ Dados e usuário de teste removidos');

  console.log('\n====================================================');
  console.log(` RESULTADO: ${sucessos}/${totalTestes} TESTES PASSARAM COM SUCESSO`);
  console.log('====================================================\n');

  if (sucessos !== totalTestes) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Erro ao executar testes:', e);
  process.exit(1);
});
