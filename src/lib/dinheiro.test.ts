import { describe, it, expect } from 'vitest';
import { formatarBRL, parseBRL, dividirParcelas, somar } from './dinheiro';
import { podeFazer } from '../types/dominio';

describe('dinheiro em centavos', () => {
  it('formata pt-BR', () => {
    expect(formatarBRL(123456).replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56');
    expect(formatarBRL(0).replace(/\u00a0/g, ' ')).toBe('R$ 0,00');
  });
  it('parseia formatos brasileiros e variantes', () => {
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('1234,56')).toBe(123456);
    expect(parseBRL('1234.56')).toBe(123456);
    expect(parseBRL('R$ 1.234,56')).toBe(123456);
    expect(parseBRL('1.234')).toBe(123400);   // ponto de milhar
    expect(parseBRL('1234')).toBe(123400);
    expect(parseBRL('-50,10')).toBe(-5010);
  });
  it('rejeita entrada inválida sem explodir', () => {
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('12,34,56')).toBeNull();
  });
  it('divide parcelas somando EXATAMENTE o total', () => {
    expect(dividirParcelas(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(dividirParcelas(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(dividirParcelas(1, 3)).toEqual([1, 0, 0]);
    expect(dividirParcelas(-10000, 3)).toEqual([-3334, -3333, -3333]);
    for (const [t, n] of [[999999, 7], [123457, 12], [100, 100]] as const) {
      expect(dividirParcelas(t, n).reduce((a, b) => a + b, 0)).toBe(t);
    }
  });
  it('soma tolera nulos', () => {
    expect(somar(100, null, undefined, 50)).toBe(150);
  });
});

describe('papéis e permissões', () => {
  it('leitor só lê; editor lança; admin configura; só dono exclui', () => {
    expect(podeFazer('leitor', 'ler')).toBe(true);
    expect(podeFazer('leitor', 'lancar')).toBe(false);
    expect(podeFazer('editor', 'lancar')).toBe(true);
    expect(podeFazer('editor', 'configurar')).toBe(false);
    expect(podeFazer('admin', 'configurar')).toBe(true);
    expect(podeFazer('admin', 'excluirWorkspace')).toBe(false);
    expect(podeFazer('dono', 'excluirWorkspace')).toBe(true);
    expect(podeFazer(null, 'ler')).toBe(false);
  });
});
