import fs from 'fs';
import {
  calcularPrimeiroVencimento,
  calcularProximoVencimento,
  validarRecorrencia,
} from './lib/recorrencia.js';

console.log('--- Testes Unitários de Lógica de Recorrência ---');

// 1. Validação de dados de entrada
const erroVazio = validarRecorrencia({
  cliente_id: '',
  descricao: '',
  valor: '',
  dia_vencimento: '35',
  inicia_em: 'data-invalida',
});

console.assert(erroVazio.cliente_id, 'Deve exigir cliente');
console.assert(erroVazio.descricao, 'Deve exigir descrição');
console.assert(erroVazio.valor, 'Deve exigir valor válido');
console.assert(erroVazio.dia_vencimento, 'Deve barrar dia > 28');
console.assert(erroVazio.inicia_em, 'Deve barrar data inválida');
console.log('✓ Validação de campos inválidos funcionando');

// 2. Cálculo do primeiro vencimento
// Início dia 01/09, vencimento dia 10 -> vence em 10/09 (mesmo mês)
const v1 = calcularPrimeiroVencimento('2026-09-01', 10);
console.assert(v1 === '2026-09-10', `Esperado 2026-09-10, obtido ${v1}`);

// Início dia 15/09, vencimento dia 10 -> vence em 10/10 (mês seguinte)
const v2 = calcularPrimeiroVencimento('2026-09-15', 10);
console.assert(v2 === '2026-10-10', `Esperado 2026-10-10, obtido ${v2}`);

// Início dia 10/09, vencimento dia 10 -> vence em 10/09 (mesmo dia)
const v3 = calcularPrimeiroVencimento('2026-09-10', 10);
console.assert(v3 === '2026-09-10', `Esperado 2026-09-10, obtido ${v3}`);

// Início dia 20/12, vencimento dia 05 -> vence em 05/01 do ano seguinte
const v4 = calcularPrimeiroVencimento('2026-12-20', 5);
console.assert(v4 === '2027-01-05', `Esperado 2027-01-05, obtido ${v4}`);

console.log('✓ Cálculo do 1º vencimento testado para todos os cenários');

// 3. Cálculo do próximo vencimento
const p1 = calcularProximoVencimento('2026-09-10', 10);
console.assert(p1 === '2026-10-10', `Esperado 2026-10-10, obtido ${p1}`);

const p2 = calcularProximoVencimento('2026-12-10', 10);
console.assert(p2 === '2027-01-10', `Esperado 2027-01-10, obtido ${p2}`);

console.log('✓ Cálculo de próximo ciclo mensal testado (inclusive virada de ano)');
