import { describe, it, expect } from 'vitest';
import { addMesesISO, datasParcelas, mesDe, saldoConsolidado, saldoDaConta, resumoLancamentos, gastoNoCartaoNoMes, mesAnterior, mesSeguinte } from './lancamentos';
import { dividirParcelas } from './dinheiro';
import type { Conta, Lancamento } from '../types/dominio';

const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, recorrenciaId: null, importId: null, criadoPor: 'u', criadoEm: 0, ...p,
});

describe('datas e competência', () => {
  it('soma meses com clamp de fim de mês', () => {
    expect(addMesesISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMesesISO('2024-01-31', 1)).toBe('2024-02-29'); // bissexto
    expect(addMesesISO('2026-11-15', 2)).toBe('2027-01-15'); // vira o ano
    expect(addMesesISO('2026-03-01', -1)).toBe('2026-02-01');
  });
  it('gera datas de parcelas mensais', () => {
    expect(datasParcelas('2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('competência e navegação de mês', () => {
    expect(mesDe('2026-07-05')).toBe('2026-07');
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesSeguinte('2025-12')).toBe('2026-01');
  });
});

describe('saldoDaConta', () => {
  const conta: Conta = { id: 'c1', nome: 'Corrente', tipo: 'corrente', saldoInicial: 10000, arquivada: false };
  it('receitas somam, despesas em conta subtraem, cartão NÃO toca a conta', () => {
    const lancs = [
      L({ tipo: 'receita', valor: 5000, contaId: 'c1' }),
      L({ tipo: 'despesa', valor: 3000, contaId: 'c1' }),
      L({ tipo: 'despesa', valor: 9999, contaId: 'c1', cartaoId: 'k1' }), // cartão → fatura (F3)
      L({ tipo: 'despesa', valor: 700, contaId: 'outra' }),
    ];
    expect(saldoDaConta(conta, lancs)).toBe(12000);
  });
  it('transferência move entre contas sem criar dinheiro', () => {
    const destino: Conta = { id: 'c2', nome: 'Poupança', tipo: 'poupanca', saldoInicial: 0, arquivada: false };
    const lancs = [L({ tipo: 'transferencia', valor: 2500, contaId: 'c1', contaDestinoId: 'c2' })];
    expect(saldoDaConta(conta, lancs)).toBe(7500);
    expect(saldoDaConta(destino, lancs)).toBe(2500);
    expect(saldoDaConta(conta, lancs) + saldoDaConta(destino, lancs)).toBe(10000);
  });
});

describe('resumo do mês e cartão', () => {
  it('transferência não é receita nem despesa', () => {
    const r = resumoLancamentos([
      L({ tipo: 'receita', valor: 100 }), L({ tipo: 'despesa', valor: 40 }),
      L({ tipo: 'transferencia', valor: 999 }),
    ]);
    expect(r).toEqual({ receitas: 100, despesas: 40, saldo: 60 });
  });
  it('gasto do cartão filtra por cartão e mês', () => {
    const lancs = [
      L({ cartaoId: 'k1', valor: 100, data: '2026-07-01' }),
      L({ cartaoId: 'k1', valor: 50, data: '2026-08-01' }),
      L({ cartaoId: 'k2', valor: 77, data: '2026-07-15' }),
    ];
    expect(gastoNoCartaoNoMes('k1', '2026-07', lancs)).toBe(100);
  });
});

describe('integração parcelas: valores × datas', () => {
  it('3× de R$ 100,00 fecham exatos com datas mensais', () => {
    const vals = dividirParcelas(10000, 3);
    const datas = datasParcelas('2026-12-31', 3);
    expect(vals.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(datas).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
  });
});

describe('saldoConsolidado (F11)', () => {
  it('exclui contas arquivadas', () => {
    const ativa: Conta = { id: 'a', nome: 'A', tipo: 'corrente', saldoInicial: 1000, arquivada: false };
    const arquivada: Conta = { id: 'b', nome: 'B', tipo: 'corrente', saldoInicial: 500, arquivada: true };
    expect(saldoConsolidado([ativa, arquivada], [])).toBe(1000);
  });
});
