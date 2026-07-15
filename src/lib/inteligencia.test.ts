import { describe, it, expect } from 'vitest';
import { aplicarOcultos, runInteligencia, type CtxInteligencia } from './inteligencia';
import type { Cartao, Conta, Lancamento } from '../types/dominio';

const L = (p: Partial<Lancamento>): Lancamento => ({
  id: 'x', tipo: 'despesa', descricao: '', valor: 0, data: '2026-07-10',
  categoriaId: null, contaId: null, contaDestinoId: null, cartaoId: null,
  parcelas: null, faturaMes: null, recorrenciaId: null, importId: null, criadoPor: 'u', criadoEm: 0, ...p,
});
const K = (p: Partial<Cartao>): Cartao => ({ id: 'k1', nome: 'Nu', bandeira: 'MC', limite: 0, diaFechamento: 10, diaVencimento: 17, arquivado: false, ...p });
const CONTA: Conta = { id: 'c1', nome: 'Corrente', tipo: 'corrente', saldoInicial: 10000, arquivada: false };

const base: CtxInteligencia = {
  hoje: '2026-07-15', contas: [], cartoes: [], lancs: [], tetos: {},
  nomeCategoria: (id) => id, metas: [], recorrencias: [],
};
const ids = (ctx: Partial<CtxInteligencia>) => runInteligencia({ ...base, ...ctx }).map((a) => a.uid);

describe('regras de fatura', () => {
  it('fechada e não paga com vencimento próximo → atenção; vencida → crítico', () => {
    const lancs = [L({ cartaoId: 'k1', valor: 5000, data: '2026-07-05' })]; // fatura 2026-07, fecha 10/07
    expect(ids({ cartoes: [K({})], lancs, hoje: '2026-07-14' })).toContain('fatura.vence:k1:2026-07');
    expect(ids({ cartoes: [K({})], lancs, hoje: '2026-07-20' })).toContain('fatura.vencida:k1:2026-07');
  });
  it('paga não alerta; corrente fechando em ≤3 dias informa', () => {
    const lancs = [
      L({ cartaoId: 'k1', valor: 5000, data: '2026-07-05' }),
      L({ tipo: 'pagamento', cartaoId: 'k1', faturaMes: '2026-07', contaId: 'c1', valor: 5000, data: '2026-07-12' }),
      L({ cartaoId: 'k1', valor: 700, data: '2026-08-01' }), // ciclo corrente (fatura 08)
    ];
    const r = ids({ cartoes: [K({})], lancs, hoje: '2026-08-08' });
    expect(r.some((u) => u.startsWith('fatura.venc'))).toBe(false);
    expect(r).toContain('fatura.fecha:k1:2026-08');
  });
});

describe('limite, orçamento, conta e categoria', () => {
  it('cartão ≥90% do limite', () => {
    const lancs = [L({ cartaoId: 'k1', valor: 9500, data: '2026-07-05' })];
    expect(ids({ cartoes: [K({ limite: 10000 })], lancs })).toContain('cartao.limite:k1:2026-07');
  });
  it('orçamento a 80% → atenção; estourado → crítico', () => {
    const lancs = [L({ categoriaId: 'a', valor: 850, data: '2026-07-01' })];
    expect(ids({ tetos: { a: 1000 }, lancs })).toContain('orc.perto:a:2026-07');
    expect(ids({ tetos: { a: 800 }, lancs })).toContain('orc.estouro:a:2026-07');
  });
  it('conta negativa e gastos sem categoria', () => {
    const lancs = [L({ contaId: 'c1', valor: 20000, data: '2026-07-01' })];
    const r = ids({ contas: [CONTA], lancs });
    expect(r).toContain('conta.negativa:c1');
    expect(r).toContain('sem_categoria:2026-07');
  });
});

describe('recorrências pendentes', () => {
  const rec = { id: 'r1', tipo: 'despesa' as const, descricao: 'Aluguel', valor: 1000, diaDoMes: 5,
    categoriaId: null, contaId: 'c1', cartaoId: null, ativo: true, criadoPor: 'u' };
  it('cobra a partir do dia 8; some quando lançada', () => {
    expect(ids({ recorrencias: [rec], hoje: '2026-07-05' })).not.toContain('rec.pendentes:2026-07');
    expect(ids({ recorrencias: [rec], hoje: '2026-07-15' })).toContain('rec.pendentes:2026-07');
    expect(ids({ recorrencias: [rec], hoje: '2026-07-15', lancs: [L({ recorrenciaId: 'r1', data: '2026-07-05' })] }))
      .not.toContain('rec.pendentes:2026-07');
  });
});

describe('metas e ocultações', () => {
  it('meta com prazo vencido e meta parada há 60 dias', () => {
    const metas = [
      { id: 'm1', nome: 'A', icone: '🏁', valorAlvo: 1000, prazo: '2026-01', aportes: [], criadoEm: 0 },
      { id: 'm2', nome: 'B', icone: '🏁', valorAlvo: 1000, prazo: null, aportes: [{ id: 'a', data: '2026-04-01', valor: 100, nota: '', criadoPor: 'u' }], criadoEm: 0 },
    ];
    const r = ids({ metas });
    expect(r).toContain('meta.atrasada:m1');
    expect(r).toContain('meta.parada:m2');
  });
  it('ordena por severidade e aplica dispensa/adiamento', () => {
    const lancs = [L({ contaId: 'c1', valor: 20000, data: '2026-07-01' })]; // crítico + info
    const alertas = runInteligencia({ ...base, contas: [CONTA], lancs });
    expect(alertas[0].sev).toBe('critico');
    const visiveis = aplicarOcultos(alertas, { dispensados: { [alertas[0].uid]: true }, adiados: { [alertas[1].uid]: Date.now() + 1000 } }, Date.now());
    expect(visiveis.length).toBe(alertas.length - 2);
  });
});
