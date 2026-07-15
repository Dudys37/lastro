import { describe, it, expect } from 'vitest';
import { dataDaRecorrencia, jaLancadaNoMes, pendentesDoMes } from './recorrencias';
import type { Lancamento, Recorrencia } from '../types/dominio';

const R = (p: Partial<Recorrencia>): Recorrencia => ({
  id: 'r1', tipo: 'despesa', descricao: 'Aluguel', valor: 150000, diaDoMes: 5,
  categoriaId: null, contaId: 'c1', cartaoId: null, ativo: true, criadoPor: 'u', ...p,
});
const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, recorrenciaId: null, importId: null, criadoPor: 'u', criadoEm: 0, ...p,
});

describe('recorrências', () => {
  it('data da ocorrência respeita o dia (limitado a 1–28)', () => {
    expect(dataDaRecorrencia(R({ diaDoMes: 5 }), '2026-07')).toBe('2026-07-05');
    expect(dataDaRecorrencia(R({ diaDoMes: 31 }), '2026-02')).toBe('2026-02-28');
  });
  it('detecta lançamento do mês pela origem, não pela descrição', () => {
    const lancs = [L({ recorrenciaId: 'r1', data: '2026-07-05' })];
    expect(jaLancadaNoMes('r1', '2026-07', lancs)).toBe(true);
    expect(jaLancadaNoMes('r1', '2026-08', lancs)).toBe(false);
  });
  it('pendentes = ativas e não lançadas no mês', () => {
    const recs = [R({}), R({ id: 'r2', descricao: 'Netflix' }), R({ id: 'r3', ativo: false })];
    const lancs = [L({ recorrenciaId: 'r1', data: '2026-07-05' })];
    expect(pendentesDoMes(recs, lancs, '2026-07').map((r) => r.id)).toEqual(['r2']);
  });
});
