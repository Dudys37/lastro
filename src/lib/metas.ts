// ═══ LASTRO — Metas: lógica PURA (F5) ═══
import type { Centavos } from '../types/dominio';

export interface Aporte { id: string; data: string; valor: Centavos; nota: string; criadoPor: string; }
export interface Meta {
  id: string; nome: string; icone: string;
  valorAlvo: Centavos;
  prazo: string | null;           // 'YYYY-MM' opcional
  aportes: Aporte[];
  criadoEm: number;
}

export function progressoMeta(m: Pick<Meta, 'valorAlvo' | 'aportes'>): { total: Centavos; pct: number; faltam: Centavos; concluida: boolean } {
  const total = (m.aportes ?? []).reduce((s, a) => s + a.valor, 0);
  const pct = m.valorAlvo > 0 ? Math.min(999, Math.round((total / m.valorAlvo) * 100)) : 0;
  const faltam = Math.max(0, m.valorAlvo - total);
  return { total, pct, faltam, concluida: m.valorAlvo > 0 && total >= m.valorAlvo };
}

/** Meses restantes até o prazo, contando o mês corrente (mínimo 1 se o prazo
 *  ainda não passou; 0 se já passou). */
export function mesesAte(prazo: string, mesAtual: string): number {
  const [pa, pm] = prazo.split('-').map(Number);
  const [aa, am] = mesAtual.split('-').map(Number);
  return Math.max(0, (pa * 12 + pm) - (aa * 12 + am) + 1);
}

/** Quanto aportar POR MÊS para chegar ao alvo até o prazo.
 *  null = sem prazo; 'atrasada' = prazo passou e ainda falta. */
export function ritmoMensal(m: Pick<Meta, 'valorAlvo' | 'aportes' | 'prazo'>, mesAtual: string):
  { tipo: 'sem_prazo' } | { tipo: 'concluida' } | { tipo: 'atrasada'; faltam: Centavos } | { tipo: 'ok'; porMes: Centavos; meses: number } {
  const { faltam, concluida } = progressoMeta(m);
  if (concluida) return { tipo: 'concluida' };
  if (!m.prazo) return { tipo: 'sem_prazo' };
  const meses = mesesAte(m.prazo, mesAtual);
  if (meses === 0) return { tipo: 'atrasada', faltam };
  return { tipo: 'ok', porMes: Math.ceil(faltam / meses), meses };
}
