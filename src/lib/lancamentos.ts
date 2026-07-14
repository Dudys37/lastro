// ═══ LASTRO — Lançamentos: lógica PURA (F2) ═══
// Saldos, competência mensal e datas de parcelas. Sem Firestore, sem UI.
import type { Centavos, Conta, Lancamento } from '../types/dominio';

/** 'YYYY-MM' de uma data ISO 'YYYY-MM-DD' (competência do lançamento). */
export function mesDe(dataISO: string): string {
  return (dataISO || '').slice(0, 7);
}

/** Hoje em ISO local (não UTC — o dia do usuário é o que vale). */
export function hojeISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Soma meses a uma data ISO, com clamp de fim de mês:
 *  '2026-01-31' +1 → '2026-02-28' (não estoura para março). */
export function addMesesISO(dataISO: string, meses: number): string {
  const [a, m, d] = dataISO.split('-').map(Number);
  const totalMeses = (a * 12 + (m - 1)) + meses;
  const ano = Math.floor(totalMeses / 12);
  const mes = (totalMeses % 12) + 1;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Datas das N parcelas a partir da primeira (mensal, com clamp). */
export function datasParcelas(primeiraISO: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMesesISO(primeiraISO, i));
}

/** Rótulo pt-BR de um mês 'YYYY-MM' → 'janeiro de 2026'. */
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
export function mesAnterior(mes: string): string { return addMesesISO(mes + '-01', -1).slice(0, 7); }
export function mesSeguinte(mes: string): string { return addMesesISO(mes + '-01', 1).slice(0, 7); }

/** Saldo atual de uma conta: inicial + receitas − despesas ± transferências.
 *  Lançamentos em CARTÃO não tocam saldo de conta (a fatura é quem paga, F3). */
export function saldoDaConta(conta: Conta, lancs: Lancamento[]): Centavos {
  let s = conta.saldoInicial;
  for (const l of lancs) {
    if (l.tipo === 'receita' && l.contaId === conta.id) s += l.valor;
    else if (l.tipo === 'despesa' && l.contaId === conta.id && !l.cartaoId) s -= l.valor;
    else if (l.tipo === 'transferencia') {
      if (l.contaId === conta.id) s -= l.valor;
      if (l.contaDestinoId === conta.id) s += l.valor;
    }
  }
  return s;
}

/** Resumo de um conjunto de lançamentos (tipicamente: um mês). */
export function resumoLancamentos(lancs: Lancamento[]): { receitas: Centavos; despesas: Centavos; saldo: Centavos } {
  let receitas = 0, despesas = 0;
  for (const l of lancs) {
    if (l.tipo === 'receita') receitas += l.valor;
    else if (l.tipo === 'despesa') despesas += l.valor;
    // transferências não são receita nem despesa — só movem dinheiro de lugar
  }
  return { receitas, despesas, saldo: receitas - despesas };
}

/** Gasto no cartão dentro de um mês (competência da DATA; ciclo real é F3). */
export function gastoNoCartaoNoMes(cartaoId: string, mes: string, lancs: Lancamento[]): Centavos {
  return lancs
    .filter((l) => l.tipo === 'despesa' && l.cartaoId === cartaoId && mesDe(l.data) === mes)
    .reduce((s, l) => s + l.valor, 0);
}
