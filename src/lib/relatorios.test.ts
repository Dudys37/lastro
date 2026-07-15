import { describe, it, expect } from 'vitest';
import { gerarCSV, serieFluxoMensal, serieSaldoConsolidado, topCategorias, ultimosMeses } from './relatorios';
import type { Conta, Lancamento } from '../types/dominio';

const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, recorrenciaId: null, importId: null, criadoPor: 'u', criadoEm: 0, ...p,
});

describe('séries', () => {
  it('ultimosMeses em ordem cronológica, atravessando o ano', () => {
    expect(ultimosMeses(3, '2026-01')).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('fluxo mensal separa por competência', () => {
    const lancs = [
      L({ tipo: 'receita', valor: 100, data: '2026-06-01' }),
      L({ valor: 40, data: '2026-06-15' }),
      L({ valor: 70, data: '2026-07-01' }),
      L({ tipo: 'pagamento', valor: 999, data: '2026-07-05', contaId: 'c', cartaoId: 'k', faturaMes: '2026-07' }),
    ];
    expect(serieFluxoMensal(lancs, ['2026-06', '2026-07'])).toEqual([
      { mes: '2026-06', receitas: 100, despesas: 40 },
      { mes: '2026-07', receitas: 0, despesas: 70 },
    ]);
  });
  it('saldo consolidado acumula até o fim de cada mês', () => {
    const contas: Conta[] = [{ id: 'c1', nome: 'C', tipo: 'corrente', saldoInicial: 1000, arquivada: false }];
    const lancs = [
      L({ tipo: 'receita', valor: 500, contaId: 'c1', data: '2026-06-10' }),
      L({ valor: 200, contaId: 'c1', data: '2026-07-10' }),
    ];
    expect(serieSaldoConsolidado(contas, lancs, ['2026-05', '2026-06', '2026-07'])).toEqual([
      { mes: '2026-05', saldo: 1000 }, { mes: '2026-06', saldo: 1500 }, { mes: '2026-07', saldo: 1300 },
    ]);
  });
  it('topCategorias ordena do maior', () => {
    const lancs = [
      L({ categoriaId: 'a', valor: 10, data: '2026-07-01' }),
      L({ categoriaId: 'b', valor: 90, data: '2026-07-02' }),
      L({ valor: 5, data: '2026-07-03' }),
    ];
    expect(topCategorias(lancs, '2026-07')).toEqual([
      { categoriaId: 'b', total: 90 }, { categoriaId: 'a', total: 10 }, { categoriaId: '_sem', total: 5 },
    ]);
  });
});

describe('CSV', () => {
  it('formato pt-BR com BOM, escape de aspas e parcela', () => {
    const csv = gerarCSV(
      [L({ descricao: 'Mercado; "extra"', valor: 123456, categoriaId: 'a', contaId: 'c1', parcelas: { total: 3, numero: 1, grupoId: 'g' } })],
      { categoria: () => 'Alimentação', conta: () => 'Corrente', cartao: () => '' },
    );
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('1234,56');
    expect(csv).toContain('"Mercado; ""extra"""');
    expect(csv).toContain('1/3');
  });
});
