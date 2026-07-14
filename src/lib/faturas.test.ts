import { describe, it, expect } from 'vitest';
import { cicloDaFatura, consumoPorCategoria, itensDaFatura, mesFatura, pagamentosDaFatura, statusFatura, vencimentoFatura } from './faturas';
import { saldoDaConta, resumoLancamentos } from './lancamentos';
import type { Cartao, Conta, Lancamento } from '../types/dominio';

const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, criadoPor: 'u', criadoEm: 0, ...p,
});
const K: Cartao = { id: 'k1', nome: 'Nu', bandeira: 'MC', limite: 500000, diaFechamento: 10, diaVencimento: 17, arquivado: false };

describe('ciclo da fatura', () => {
  it('dia ≤ fechamento → fatura do mês; dia > fechamento → mês seguinte', () => {
    expect(mesFatura('2026-07-10', 10)).toBe('2026-07');
    expect(mesFatura('2026-07-11', 10)).toBe('2026-08');
    expect(mesFatura('2026-12-31', 10)).toBe('2027-01'); // vira o ano
  });
  it('intervalo do ciclo fecha com a regra do mesFatura', () => {
    expect(cicloDaFatura('2026-08', 10)).toEqual({ inicio: '2026-07-11', fim: '2026-08-10' });
  });
  it('borda: fechamento 28 atravessa fevereiro sem gerar data inexistente', () => {
    expect(cicloDaFatura('2026-03', 28)).toEqual({ inicio: '2026-03-01', fim: '2026-03-28' }); // 2026 não-bissexto
    expect(cicloDaFatura('2024-03', 28)).toEqual({ inicio: '2024-02-29', fim: '2024-03-28' }); // bissexto
  });
  it('vencimento no mesmo mês se vence após fechar; senão mês seguinte', () => {
    expect(vencimentoFatura('2026-07', 10, 17)).toBe('2026-07-17');
    expect(vencimentoFatura('2026-07', 25, 5)).toBe('2026-08-05');
  });
});

describe('itens, pagamentos e status', () => {
  const lancs = [
    L({ id: 'a', cartaoId: 'k1', valor: 1000, data: '2026-07-05' }),  // fatura 07
    L({ id: 'b', cartaoId: 'k1', valor: 2000, data: '2026-07-11' }),  // fatura 08
    L({ id: 'c', cartaoId: 'k2', valor: 999, data: '2026-07-05' }),   // outro cartão
    L({ id: 'p', tipo: 'pagamento', cartaoId: 'k1', faturaMes: '2026-07', contaId: 'c1', valor: 1000 }),
  ];
  it('filtra itens do cartão pelo ciclo', () => {
    expect(itensDaFatura(K, '2026-07', lancs).map((l) => l.id)).toEqual(['a']);
    expect(itensDaFatura(K, '2026-08', lancs).map((l) => l.id)).toEqual(['b']);
  });
  it('pagamentos casam cartão + mês da fatura', () => {
    expect(pagamentosDaFatura('k1', '2026-07', lancs).map((l) => l.id)).toEqual(['p']);
  });
  it('status: aberta → fechada → parcial → paga', () => {
    expect(statusFatura('2026-07', 10, '2026-07-01', 5000, 0)).toBe('aberta');
    expect(statusFatura('2026-07', 10, '2026-07-15', 5000, 0)).toBe('fechada');
    expect(statusFatura('2026-07', 10, '2026-07-15', 5000, 2000)).toBe('parcial');
    expect(statusFatura('2026-07', 10, '2026-07-15', 5000, 5000)).toBe('paga');
  });
});

describe('pagamento de fatura não duplica despesa', () => {
  const conta: Conta = { id: 'c1', nome: 'Corrente', tipo: 'corrente', saldoInicial: 10000, arquivada: false };
  const lancs = [
    L({ cartaoId: 'k1', valor: 3000, data: '2026-07-05' }),                                  // compra no cartão
    L({ tipo: 'pagamento', cartaoId: 'k1', faturaMes: '2026-07', contaId: 'c1', valor: 3000, data: '2026-07-17' }),
  ];
  it('debita a conta só no pagamento; despesas do mês contam só a compra', () => {
    expect(saldoDaConta(conta, lancs)).toBe(7000);
    expect(resumoLancamentos(lancs)).toEqual({ receitas: 0, despesas: 3000, saldo: -3000 });
  });
});

describe('consumo por categoria (orçamentos)', () => {
  it('soma despesas do mês por categoria, cartão incluído', () => {
    const lancs = [
      L({ categoriaId: 'alim', valor: 100, data: '2026-07-01' }),
      L({ categoriaId: 'alim', valor: 50, data: '2026-07-20', cartaoId: 'k1' }),
      L({ categoriaId: 'alim', valor: 999, data: '2026-08-01' }),
      L({ valor: 30, data: '2026-07-02' }),
      L({ tipo: 'pagamento', valor: 5000, data: '2026-07-17', contaId: 'c1', cartaoId: 'k1', faturaMes: '2026-07' }),
    ];
    expect(consumoPorCategoria(lancs, '2026-07')).toEqual({ alim: 150, _sem: 30 });
  });
});
