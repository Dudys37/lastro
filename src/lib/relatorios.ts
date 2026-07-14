// ═══ LASTRO — Relatórios: séries e exportação, lógica PURA (F4) ═══
import type { Centavos, Conta, Lancamento } from '../types/dominio';
import { mesAnterior, mesDe, resumoLancamentos, saldoDaConta } from './lancamentos';

/** Últimos n meses terminando em mesRef (inclusive), em ordem cronológica. */
export function ultimosMeses(n: number, mesRef: string): string[] {
  const r: string[] = [mesRef];
  for (let i = 1; i < n; i++) r.unshift(mesAnterior(r[0]));
  return r;
}

export interface PontoFluxo { mes: string; receitas: Centavos; despesas: Centavos; }
/** Receitas × despesas por mês (transferências e pagamentos fora, como sempre). */
export function serieFluxoMensal(lancs: Lancamento[], meses: string[]): PontoFluxo[] {
  return meses.map((mes) => {
    const doMes = lancs.filter((l) => mesDe(l.data) === mes);
    const r = resumoLancamentos(doMes);
    return { mes, receitas: r.receitas, despesas: r.despesas };
  });
}

/** Saldo consolidado ao FIM de cada mês (todas as contas, histórico até lá). */
export function serieSaldoConsolidado(contas: Conta[], lancs: Lancamento[], meses: string[]): { mes: string; saldo: Centavos }[] {
  return meses.map((mes) => {
    const ate = lancs.filter((l) => mesDe(l.data) <= mes);
    return { mes, saldo: contas.reduce((s, c) => s + saldoDaConta(c, ate), 0) };
  });
}

/** Total de despesas por categoria num mês, ordenado do maior. */
export function topCategorias(lancs: Lancamento[], mes: string): { categoriaId: string; total: Centavos }[] {
  const m: Record<string, Centavos> = {};
  for (const l of lancs) {
    if (l.tipo !== 'despesa' || mesDe(l.data) !== mes) continue;
    const k = l.categoriaId ?? '_sem';
    m[k] = (m[k] ?? 0) + l.valor;
  }
  return Object.entries(m).map(([categoriaId, total]) => ({ categoriaId, total }))
    .sort((a, b) => b.total - a.total);
}

/** CSV pt-BR (separador ';', decimal ',', BOM p/ Excel abrir com acentos). */
export function gerarCSV(
  lancs: Lancamento[],
  nomes: { categoria: (id: string | null) => string; conta: (id: string | null) => string; cartao: (id: string | null) => string },
): string {
  const TIPO: Record<string, string> = { receita: 'Receita', despesa: 'Despesa', transferencia: 'Transferência', pagamento: 'Pagamento de fatura' };
  const esc = (s: string) => /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  const linhas = [
    ['Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Categoria', 'Conta', 'Cartão', 'Parcela'].join(';'),
    ...lancs.map((l) => [
      l.data,
      TIPO[l.tipo] ?? l.tipo,
      esc(l.descricao ?? ''),
      (l.valor / 100).toFixed(2).replace('.', ','),
      esc(l.categoriaId ? nomes.categoria(l.categoriaId) : ''),
      esc(nomes.conta(l.contaId)),
      esc(nomes.cartao(l.cartaoId)),
      l.parcelas ? `${l.parcelas.numero}/${l.parcelas.total}` : '',
    ].join(';')),
  ];
  return '\ufeff' + linhas.join('\r\n');
}
