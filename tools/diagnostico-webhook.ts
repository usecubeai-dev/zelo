/**
 * Diagnóstico específico do processarEventoWebhook
 */

import fs from 'fs';
import { processarEventoWebhook, validarTokenWebhook } from '../lib/asaas/webhook';

// 1. Carregar variáveis de ambiente
const dotenv = fs.readFileSync('.env.local', 'utf8');
dotenv.split('\n').forEach((line) => {
  const clean = line.trim();
  if (clean.startsWith('#') || !clean.includes('=')) return;
  const idx = clean.indexOf('=');
  const k = clean.slice(0, idx).trim();
  const v = clean.slice(idx + 1).trim();
  process.env[k] = v;
});

async function main() {
  console.log('--- DIAGNÓSTICO DO WEBHOOK ---');

  // Teste A: Payload com registro inexistente
  console.log('1. Testando evento com registro inexistente...');
  const inicioA = Date.now();
  const resA = await processarEventoWebhook({
    id: `diag_evt_invalido_${Date.now()}`,
    event: 'PAYMENT_RECEIVED',
    dateCreated: new Date().toISOString(),
    payment: {
      id: 'pay_inexistente_123',
      customer: 'cus_inexistente',
      dateCreated: '2026-08-26',
      dueDate: '2026-09-01',
      value: 100,
      billingType: 'PIX',
      status: 'RECEIVED',
      externalReference: 'cobranca_inexistente_id',
    },
  });
  console.log(`✓ Resposta obtida em ${Date.now() - inicioA}ms:`, resA);

  // Teste B: Payload com campos mínimos
  console.log('2. Testando evento genérico de assinatura...');
  const inicioB = Date.now();
  const resB = await processarEventoWebhook({
    id: `diag_evt_sub_${Date.now()}`,
    event: 'SUBSCRIPTION_DELETED',
    dateCreated: new Date().toISOString(),
    subscription: {
      id: 'sub_inexistente',
      customer: 'cus_123',
      value: 29.9,
      nextDueDate: '2026-09-01',
      cycle: 'MONTHLY',
      billingType: 'PIX',
      status: 'INACTIVE',
    },
  });
  console.log(`✓ Resposta obtida em ${Date.now() - inicioB}ms:`, resB);

  // Teste C: Token de webhook
  console.log('3. Testando validação de token...');
  const tokenOk = validarTokenWebhook(process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_API_KEY || null);
  console.log('✓ Validação de token:', { tokenOk });

  console.log('\n--- DIAGNÓSTICO CONCLUÍDO COM SUCESSO ---');
}

main().catch((err) => {
  console.error('ERRO NO DIAGNÓSTICO:', err);
  process.exit(1);
});
