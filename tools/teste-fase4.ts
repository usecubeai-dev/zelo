/**
 * Bateria de Testes da Fase 4 — Recorrências
 *
 * Testa regras de negócio, integridade no banco, RLS e isolamento multi-tenant.
 */

import fs from 'fs';
import {
  calcularPrimeiroVencimento,
  calcularProximoVencimento,
  validarRecorrencia,
  recorrenciaParaBanco,
} from '../lib/recorrencia';

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
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') as string;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '') as string;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('ERRO: Variáveis do Supabase não encontradas em .env.local');
  process.exit(1);
}

async function run() {
  console.log('====================================================');
  console.log(' BATERIA DE TESTES — FASE 4 (RECORRÊNCIAS)');
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

  // --- SEÇÃO 1: TESTES UNITÁRIOS ---
  console.log('1. Regras de Negócio e Cálculos:');

  const errVazio = validarRecorrencia({
    cliente_id: '',
    servico_id: '',
    descricao: '',
    valor: '',
    dia_vencimento: '30',
    inicia_em: 'data-invalida',
  });
  assert(Boolean(errVazio.cliente_id), 'Validação: exige cliente');
  assert(Boolean(errVazio.descricao), 'Validação: exige descrição');
  assert(Boolean(errVazio.valor), 'Validação: exige valor válido');
  assert(Boolean(errVazio.dia_vencimento), 'Validação: bloqueia dia > 28');
  assert(Boolean(errVazio.inicia_em), 'Validação: bloqueia data inválida');

  assert(calcularPrimeiroVencimento('2026-09-01', 10) === '2026-09-10', '1º Vencimento: início antes do dia -> mesmo mês');
  assert(calcularPrimeiroVencimento('2026-09-10', 10) === '2026-09-10', '1º Vencimento: início no próprio dia -> mesmo mês');
  assert(calcularPrimeiroVencimento('2026-09-15', 10) === '2026-10-10', '1º Vencimento: início após o dia -> mês seguinte');
  assert(calcularPrimeiroVencimento('2026-12-25', 5) === '2027-01-05', '1º Vencimento: virada de ano tratada corretamente');

  assert(calcularProximoVencimento('2026-09-10', 10) === '2026-10-10', 'Próximo Ciclo: avança 1 mês');
  assert(calcularProximoVencimento('2026-12-10', 10) === '2027-01-10', 'Próximo Ciclo: virada de ano');

  const banco = recorrenciaParaBanco({
    cliente_id: 'cli-1',
    servico_id: '',
    descricao: '  Plano   Mensal  ',
    valor: '29,90',
    dia_vencimento: '15',
    inicia_em: '2026-09-01',
  });
  assert(banco.valor_centavos === 2990, 'Conversão para banco: valor em centavos correto (2990)');
  assert(banco.descricao === 'Plano Mensal', 'Conversão para banco: descrição sanitizada');
  assert(banco.dia_vencimento === 15, 'Conversão para banco: dia de vencimento inteiro');

  // --- SEÇÃO 2: BANCO DE DADOS & SEGURANÇA VIA API DIRETA ---
  console.log('\n2. Integridade no Banco e Isolamento RLS (API direta):');

  // 2.1 Anônimo não pode ler nem escrever em recorrencias
  const anonGet = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    headers: { apikey: ANON_KEY },
  });
  const anonGetData = await anonGet.json();
  assert(anonGet.status === 200 && Array.isArray(anonGetData) && anonGetData.length === 0, 'Anônimo lê recorrencias -> retorna vazio (RLS ativo)');

  const anonPost = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      descricao: 'Tentativa hacker',
      valor_centavos: 1000,
      dia_vencimento: 10,
    }),
  });
  assert(anonPost.status === 401 || anonPost.status === 403 || anonPost.status === 42501, 'Anônimo insere recorrencia -> bloqueado');

  // 2.2 Setup de 2 Usuários / Empresas com e-mail confirmado via Admin
  const adminHeaders: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const emailA = `teste_fase4_a_${Date.now()}@zelo.test`;
  const emailB = `teste_fase4_b_${Date.now()}@zelo.test`;
  const senha = 'senha_teste_12345';

  const userResA = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: emailA, password: senha, email_confirm: true, user_metadata: { nome: 'Empresa A' } }),
  })).json();

  const userResB = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: emailB, password: senha, email_confirm: true, user_metadata: { nome: 'Empresa B' } }),
  })).json();

  const userIdA = userResA.id || userResA.user?.id;
  const userIdB = userResB.id || userResB.user?.id;

  // Login de A e B para obter os JWTs de sessão
  const loginA = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailA, password: senha }),
  })).json();

  const loginB = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailB, password: senha }),
  })).json();

  const tokenA = loginA.access_token;
  const tokenB = loginB.access_token;

  // Buscar empresa_id de A e B
  const membrosA = await (await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userIdA}`, { headers: adminHeaders })).json();
  const membrosB = await (await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userIdB}`, { headers: adminHeaders })).json();

  const empresaIdA = membrosA[0]?.empresa_id;
  const empresaIdB = membrosB[0]?.empresa_id;

  assert(Boolean(empresaIdA && empresaIdB), 'Empresas A e B criadas pelo trigger de auth com membros vinculados');

  const headersA: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${tokenA}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const headersB: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${tokenB}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // Criar cliente para Empresa A via token de A
  const cliA = (await (await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ empresa_id: empresaIdA, nome: 'Cliente de A' }),
  })).json())[0];

  // Criar cliente para Empresa B via token de B
  const cliB = (await (await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ empresa_id: empresaIdB, nome: 'Cliente de B' }),
  })).json())[0];

  assert(Boolean(cliA && cliA.id && cliB && cliB.id), 'Clientes criados com sucesso sob seus respectivos tenants');

  // 2.3 Usuário A cria recorrência para seu próprio cliente
  const recA = (await (await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdA,
      cliente_id: cliA.id,
      descricao: 'Mensalidade A',
      valor_centavos: 15000,
      periodicidade: 'mensal',
      dia_vencimento: 10,
      inicia_em: '2026-09-01',
      status: 'ativa',
    }),
  })).json())[0];

  assert(Boolean(recA && recA.id), 'Usuário A insere recorrência na sua própria empresa -> permitido');

  // 2.4 Usuário A cria cobrança vinculada a essa recorrência (ciclo 1)
  const cobA = (await (await fetch(`${SUPABASE_URL}/rest/v1/cobrancas`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdA,
      cliente_id: cliA.id,
      recorrencia_id: recA.id,
      descricao: 'Mensalidade A',
      valor_centavos: 15000,
      vence_em: '2026-09-10',
      status: 'pendente',
    }),
  })).json())[0];

  assert(Boolean(cobA && cobA.id && cobA.recorrencia_id === recA.id), 'Cobrança do ciclo 1 vinculada com recorrencia_id criada');

  // 2.5 Vulnerabilidade de tenant: Usuário A tenta inserir recorrência com cliente_id de B
  const tentativaCrossCliente = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdA,
      cliente_id: cliB.id, // cliente de B!
      descricao: 'Ataque cliente cruzado',
      valor_centavos: 10000,
      dia_vencimento: 5,
      inicia_em: '2026-09-01',
    }),
  });
  assert(tentativaCrossCliente.status >= 400, 'Usuário A tenta associar recorrência ao cliente de B -> bloqueado por FK composta / RLS');

  // 2.6 Vulnerabilidade de tenant: Usuário A tenta inserir com empresa_id de B
  const tentativaCrossEmpresa = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdB, // empresa de B!
      cliente_id: cliA.id,
      descricao: 'Ataque empresa cruzada',
      valor_centavos: 10000,
      dia_vencimento: 5,
      inicia_em: '2026-09-01',
    }),
  });
  assert(tentativaCrossEmpresa.status >= 400, 'Usuário A tenta inserir com empresa_id de B -> bloqueado por with check no RLS');

  // 2.7 Usuário B tenta ler recorrência de A
  const consultaB = await (await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, {
    headers: headersB,
  })).json();
  assert(Array.isArray(consultaB) && consultaB.length === 0, 'Usuário B tenta ler recorrência de A -> não vê nada (0 linhas)');

  // 2.8 Usuário B tenta alterar recorrência de A
  const updateB = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, {
    method: 'PATCH',
    headers: headersB,
    body: JSON.stringify({ descricao: 'Hackeado por B' }),
  });
  const recAAtualizada = (await (await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, { headers: adminHeaders })).json())[0];
  assert(recAAtualizada.descricao === 'Mensalidade A', 'Usuário B tenta alterar recorrência de A -> bloqueado');

  // 2.9 Usuário A pausa sua recorrência
  const pausaA = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ status: 'pausada' }),
  });
  const recPausada = (await (await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, { headers: headersA })).json())[0];
  assert(recPausada.status === 'pausada', 'Usuário A pausa recorrência com sucesso');

  // 2.10 Usuário A reativa sua recorrência
  const reativaA = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ status: 'ativa' }),
  });
  const recAtiva = (await (await fetch(`${SUPABASE_URL}/rest/v1/recorrencias?id=eq.${recA.id}`, { headers: headersA })).json())[0];
  assert(recAtiva.status === 'ativa', 'Usuário A reativa recorrência com sucesso');

  // 2.11 Constraints de integridade no banco
  const valorInvalido = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdA,
      cliente_id: cliA.id,
      descricao: 'Valor negativo',
      valor_centavos: -500,
      dia_vencimento: 10,
      inicia_em: '2026-09-01',
    }),
  });
  assert(valorInvalido.status >= 400, 'Constraint do banco: valor_centavos <= 0 recusado');

  const diaInvalido = await fetch(`${SUPABASE_URL}/rest/v1/recorrencias`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      empresa_id: empresaIdA,
      cliente_id: cliA.id,
      descricao: 'Dia 31',
      valor_centavos: 1000,
      dia_vencimento: 31,
      inicia_em: '2026-09-01',
    }),
  });
  assert(diaInvalido.status >= 400, 'Constraint do banco: dia_vencimento 31 recusado (apenas 1 a 28)');

  // 2.12 Deletar cliente com cobrança/recorrência associada -> bloqueado por FK ON DELETE RESTRICT
  const deleteCliA = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${cliA.id}`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(deleteCliA.status >= 400, 'Integridade: cliente com recorrência/cobrança ativa não pode ser excluído fisicamente (23503)');

  // --- SEÇÃO 3: LIMPEZA DOS DADOS DE TESTE ---
  console.log('\n3. Limpeza dos usuários e dados de teste:');
  if (userIdA) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userIdA}`, { method: 'DELETE', headers: adminHeaders });
  }
  if (userIdB) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userIdB}`, { method: 'DELETE', headers: adminHeaders });
  }
  console.log('  ✓ Usuários e empresas de teste removidos em cascata');

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
