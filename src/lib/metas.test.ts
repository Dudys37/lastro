import { describe, it, expect } from 'vitest';
import { mesesAte, progressoMeta, ritmoMensal } from './metas';

const ap = (valor: number) => ({ id: 'a', data: '2026-01-01', valor, nota: '', criadoPor: 'u' });

describe('progressoMeta', () => {
  it('soma aportes, calcula pct e faltante', () => {
    expect(progressoMeta({ valorAlvo: 10000, aportes: [ap(2500), ap(2500)] }))
      .toEqual({ total: 5000, pct: 50, faltam: 5000, concluida: false });
  });
  it('conclui ao atingir (ou passar) o alvo', () => {
    const p = progressoMeta({ valorAlvo: 10000, aportes: [ap(12000)] });
    expect(p.concluida).toBe(true);
    expect(p.faltam).toBe(0);
  });
});

describe('mesesAte e ritmoMensal', () => {
  it('conta o mês corrente e vira o ano', () => {
    expect(mesesAte('2026-12', '2026-10')).toBe(3);
    expect(mesesAte('2027-01', '2026-12')).toBe(2);
    expect(mesesAte('2026-05', '2026-07')).toBe(0);
  });
  it('ritmo = teto(faltam / meses)', () => {
    expect(ritmoMensal({ valorAlvo: 100000, aportes: [ap(10000)], prazo: '2026-12' }, '2026-10'))
      .toEqual({ tipo: 'ok', porMes: 30000, meses: 3 });
  });
  it('estados: sem prazo, atrasada, concluída', () => {
    expect(ritmoMensal({ valorAlvo: 100, aportes: [], prazo: null }, '2026-07')).toEqual({ tipo: 'sem_prazo' });
    expect(ritmoMensal({ valorAlvo: 100, aportes: [], prazo: '2026-01' }, '2026-07')).toEqual({ tipo: 'atrasada', faltam: 100 });
    expect(ritmoMensal({ valorAlvo: 100, aportes: [ap(100)], prazo: '2026-01' }, '2026-07')).toEqual({ tipo: 'concluida' });
  });
});
