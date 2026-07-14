// ═══ LASTRO — Faturas: lógica PURA (F3) ═══
// A fatura é identificada pelo MÊS DE FECHAMENTO ('YYYY-MM').
// Regra do ciclo: compra com dia ≤ diaFechamento entra na fatura que fecha
// naquele mês; dia > diaFechamento empurra para a fatura do mês seguinte.
import type { Cartao, Centavos, Lancamento } from '../types/dominio';
import { addMesesISO, mesDe } from './lancamentos';

/** Mês da fatura ('YYYY-MM' do fechamento) de uma compra. */
export function mesFatura(dataISO: string, diaFechamento: number): string {
  const dia = Number(dataISO.slice(8, 10));
  const mes = mesDe(dataISO);
  return dia <= diaFechamento ? mes : addMesesISO(mes + '-01', 1).slice(0, 7);
}

/** Dia seguinte a uma data ISO (aritmética real — cobre fim de mês/bissexto). */
export function diaSeguinteISO(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(a, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Intervalo [inicio, fim] de datas de compra que caem na fatura do mês dado. */
export function cicloDaFatura(mesFat: string, diaFechamento: number): { inicio: string; fim: string } {
  const dd = String(diaFechamento).padStart(2, '0');
  const fim = `${mesFat}-${dd}`;
  const inicio = diaSeguinteISO(addMesesISO(fim, -1)); // ex.: fecha 28/fev (clamp) → começa 01/mar? não: 29/fev em bissexto, 01/mar fora dele
  return { inicio, fim };
}

/** Data de vencimento: mesmo mês se vence depois de fechar; senão, mês seguinte. */
export function vencimentoFatura(mesFat: string, diaFechamento: number, diaVencimento: number): string {
  const dd = String(diaVencimento).padStart(2, '0');
  return diaVencimento > diaFechamento ? `${mesFat}-${dd}` : addMesesISO(`${mesFat}-01`, 1).slice(0, 7) + `-${dd}`;
}

/** Itens (despesas do cartão) que pertencem à fatura do mês dado. */
export function itensDaFatura(cartao: Cartao, mesFat: string, lancs: Lancamento[]): Lancamento[] {
  return lancs
    .filter((l) => l.tipo === 'despesa' && l.cartaoId === cartao.id && mesFatura(l.data, cartao.diaFechamento) === mesFat)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Pagamentos já registrados para a fatura. */
export function pagamentosDaFatura(cartaoId: string, mesFat: string, lancs: Lancamento[]): Lancamento[] {
  return lancs.filter((l) => l.tipo === 'pagamento' && l.cartaoId === cartaoId && l.faturaMes === mesFat);
}

export type StatusFatura = 'aberta' | 'fechada' | 'parcial' | 'paga';

export function statusFatura(
  mesFat: string, diaFechamento: number, hojeISO: string, total: Centavos, pago: Centavos,
): StatusFatura {
  if (total > 0 && pago >= total) return 'paga';
  const fechamento = `${mesFat}-${String(diaFechamento).padStart(2, '0')}`;
  if (hojeISO <= fechamento) return pago > 0 ? 'parcial' : 'aberta';
  return pago > 0 ? 'parcial' : 'fechada';
}

/** Consumo do mês (competência da compra) por categoria — orçamentos. */
export function consumoPorCategoria(lancs: Lancamento[], mes: string): Record<string, Centavos> {
  const r: Record<string, Centavos> = {};
  for (const l of lancs) {
    if (l.tipo !== 'despesa' || mesDe(l.data) !== mes) continue;
    const k = l.categoriaId ?? '_sem';
    r[k] = (r[k] ?? 0) + l.valor;
  }
  return r;
}
