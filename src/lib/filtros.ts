// ═══ LASTRO — Busca & filtros de lançamentos: lógica PURA (F9) ═══
import type { Lancamento, TipoLancamento } from '../types/dominio';

/** Normaliza para busca: minúsculas e sem acentos ('Café' ≡ 'cafe'). */
export function normalizarTexto(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface FiltroLancamentos {
  busca?: string;                       // casa na descrição
  tipo?: TipoLancamento | '';
  categoriaId?: string | '';            // '_sem' = sem categoria
  origem?: string | '';                 // contaId OU 'cartao:{id}'
}

export function filtroAtivo(f: FiltroLancamentos): boolean {
  return !!(normalizarTexto(f.busca ?? '') || f.tipo || f.categoriaId || f.origem);
}

export function correspondeLancamento(l: Lancamento, f: FiltroLancamentos): boolean {
  const q = normalizarTexto(f.busca ?? '');
  if (q && !normalizarTexto(l.descricao ?? '').includes(q)) return false;
  if (f.tipo && l.tipo !== f.tipo) return false;
  if (f.categoriaId) {
    if (f.categoriaId === '_sem') { if (l.categoriaId) return false; }
    else if (l.categoriaId !== f.categoriaId) return false;
  }
  if (f.origem) {
    if (f.origem.startsWith('cartao:')) { if (l.cartaoId !== f.origem.slice(7)) return false; }
    else if (l.contaId !== f.origem && l.contaDestinoId !== f.origem) return false;
  }
  return true;
}

/** Aplica o filtro (E lógico entre critérios), mais recente primeiro. */
export function filtrarLancamentos(lancs: Lancamento[], f: FiltroLancamentos): Lancamento[] {
  return lancs.filter((l) => correspondeLancamento(l, f))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm - a.criadoEm);
}
