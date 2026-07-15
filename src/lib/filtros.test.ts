import { describe, it, expect } from 'vitest';
import { correspondeLancamento, filtrarLancamentos, filtroAtivo, normalizarTexto } from './filtros';
import type { Lancamento } from '../types/dominio';

const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, recorrenciaId: null, criadoPor: 'u', criadoEm: 0, ...p,
});

describe('normalização e busca', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizarTexto('  CAFÉ com Açúcar ')).toBe('cafe com acucar');
    expect(correspondeLancamento(L({ descricao: 'Café da manhã' }), { busca: 'cafe' })).toBe(true);
    expect(correspondeLancamento(L({ descricao: 'Padaria' }), { busca: 'cafe' })).toBe(false);
  });
});

describe('filtros combinados (E lógico)', () => {
  const lancs = [
    L({ id: 'a', descricao: 'Mercado', tipo: 'despesa', categoriaId: 'alim', cartaoId: 'k1', data: '2026-07-01' }),
    L({ id: 'b', descricao: 'Mercado', tipo: 'despesa', categoriaId: 'alim', contaId: 'c1', data: '2026-06-01' }),
    L({ id: 'c', descricao: 'Salário', tipo: 'receita', contaId: 'c1', data: '2026-07-05' }),
    L({ id: 'd', descricao: 'Sem cat', tipo: 'despesa', data: '2026-05-01' }),
    L({ id: 'e', tipo: 'transferencia', contaId: 'c1', contaDestinoId: 'c2', valor: 10, data: '2026-07-02' }),
  ];
  it('tipo + origem cartão', () => {
    expect(filtrarLancamentos(lancs, { tipo: 'despesa', origem: 'cartao:k1' }).map((l) => l.id)).toEqual(['a']);
  });
  it('origem conta casa origem E destino de transferência', () => {
    expect(filtrarLancamentos(lancs, { origem: 'c1' }).map((l) => l.id)).toEqual(['c', 'e', 'b']);
  });
  it('categoria _sem acha os sem categoria (só despesas/receitas fazem sentido, mas o filtro é honesto)', () => {
    expect(filtrarLancamentos(lancs, { categoriaId: '_sem', tipo: 'despesa' }).map((l) => l.id)).toEqual(['d']);
  });
  it('busca + tipo, ordenado do mais recente', () => {
    expect(filtrarLancamentos(lancs, { busca: 'mercado' }).map((l) => l.id)).toEqual(['a', 'b']);
  });
  it('filtroAtivo detecta qualquer critério', () => {
    expect(filtroAtivo({})).toBe(false);
    expect(filtroAtivo({ busca: '  ' })).toBe(false);
    expect(filtroAtivo({ tipo: 'receita' })).toBe(true);
  });
});
