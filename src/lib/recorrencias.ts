// ═══ LASTRO — Recorrências: lógica PURA (F7) ═══
// Contas fixas (aluguel, salário, assinaturas). Materialização é MANUAL de
// um clique — decisão alinhada ao "lançamento manual, simples e confiável"
// da descoberta: nada entra nos números sem um humano confirmar, e não há
// corrida entre dispositivos nem escrita por quem só pode ler.
import type { Lancamento, Recorrencia } from '../types/dominio';
import { mesDe } from './lancamentos';

/** Data ISO da ocorrência de uma recorrência num mês (dia 1–28, sem clamp). */
export function dataDaRecorrencia(rec: Pick<Recorrencia, 'diaDoMes'>, mes: string): string {
  return `${mes}-${String(Math.min(28, Math.max(1, rec.diaDoMes))).padStart(2, '0')}`;
}

/** Já existe lançamento deste mês vindo desta recorrência? */
export function jaLancadaNoMes(recId: string, mes: string, lancs: Lancamento[]): boolean {
  return lancs.some((l) => l.recorrenciaId === recId && mesDe(l.data) === mes);
}

/** Recorrências ativas ainda não lançadas no mês. */
export function pendentesDoMes(recs: Recorrencia[], lancs: Lancamento[], mes: string): Recorrencia[] {
  return recs.filter((r) => r.ativo && !jaLancadaNoMes(r.id, mes, lancs));
}
