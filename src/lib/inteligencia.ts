// ═══ LASTRO — Motor de Inteligência (F6) ═══
// Herança direta do sistema anterior, reconstruída do jeito certo: regras
// PURAS que recebem um contexto pronto e devolvem alertas. Sem Firestore,
// sem UI, 100% testável. Dispensar/adiar é preferência PESSOAL do usuário
// (localStorage) — não polui o workspace compartilhado.
import type { Cartao, Centavos, Conta, Lancamento } from '../types/dominio';
import { formatarBRL } from './dinheiro';
import { gastoNoCartaoNoMes, mesDe, saldoDaConta } from './lancamentos';
import { itensDaFatura, mesFatura, pagamentosDaFatura, vencimentoFatura } from './faturas';
import { consumoPorCategoria } from './faturas';
import { progressoMeta, ritmoMensal, type Meta } from './metas';
import { pendentesDoMes } from './recorrencias';
import type { Recorrencia } from '../types/dominio';

export type Severidade = 'info' | 'atencao' | 'critico';

export interface Alerta {
  uid: string;          // estável p/ dispensar (regra + chave contextual)
  sev: Severidade;
  icone: string;
  titulo: string;
  msg: string;
  rota: string;         // para onde a UI navega ao clicar
}

export interface CtxInteligencia {
  hoje: string;                                   // ISO
  contas: Conta[];
  cartoes: Cartao[];
  lancs: Lancamento[];                            // histórico completo
  tetos: Record<string, Centavos>;                // orçamento do mês corrente
  nomeCategoria: (id: string) => string;
  metas: Meta[];
  recorrencias: Recorrencia[];
}

const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000);

type Regra = (ctx: CtxInteligencia) => Alerta[];

const regras: Regra[] = [
  // ── Fatura fechada com vencimento chegando / vencida ──
  (ctx) => ctx.cartoes.flatMap((k): Alerta[] => {
    const mf = mesFatura(ctx.hoje, k.diaFechamento);
    // a fatura "anterior à corrente" é a que está fechada e possivelmente a pagar
    const anteriores = [mf, addMes(mf, -1)];
    return anteriores.flatMap((m): Alerta[] => {
      const fechamento = `${m}-${String(k.diaFechamento).padStart(2, '0')}`;
      if (ctx.hoje <= fechamento) return []; // ainda aberta
      const total = itensDaFatura(k, m, ctx.lancs).reduce((s, i) => s + i.valor, 0);
      const pago = pagamentosDaFatura(k.id, m, ctx.lancs).reduce((s, p) => s + p.valor, 0);
      const resta = total - pago;
      if (resta <= 0) return [];
      const venc = vencimentoFatura(m, k.diaFechamento, k.diaVencimento);
      const dias = diasEntre(ctx.hoje, venc);
      if (dias < 0) return [{ uid: `fatura.vencida:${k.id}:${m}`, sev: 'critico', icone: '🚨',
        titulo: `Fatura do ${k.nome} vencida`, msg: `${formatarBRL(resta)} em aberto — venceu ${new Date(venc + 'T12:00').toLocaleDateString('pt-BR')}.`, rota: '/faturas' }];
      if (dias <= 5) return [{ uid: `fatura.vence:${k.id}:${m}`, sev: 'atencao', icone: '💳',
        titulo: `Fatura do ${k.nome} vence ${dias === 0 ? 'HOJE' : `em ${dias} dia(s)`}`, msg: `${formatarBRL(resta)} a pagar até ${new Date(venc + 'T12:00').toLocaleDateString('pt-BR')}.`, rota: '/faturas' }];
      return [];
    });
  }),

  // ── Fatura corrente fecha em breve (últimas compras do ciclo) ──
  (ctx) => ctx.cartoes.flatMap((k): Alerta[] => {
    const mf = mesFatura(ctx.hoje, k.diaFechamento);
    const fechamento = `${mf}-${String(k.diaFechamento).padStart(2, '0')}`;
    const dias = diasEntre(ctx.hoje, fechamento);
    if (dias < 0 || dias > 3) return [];
    const total = itensDaFatura(k, mf, ctx.lancs).reduce((s, i) => s + i.valor, 0);
    if (total === 0) return [];
    return [{ uid: `fatura.fecha:${k.id}:${mf}`, sev: 'info', icone: '🗓️',
      titulo: `Fatura do ${k.nome} fecha ${dias === 0 ? 'hoje' : `em ${dias} dia(s)`}`,
      msg: `Já são ${formatarBRL(total)} no ciclo — compras a partir de agora podem cair na próxima.`, rota: '/faturas' }];
  }),

  // ── Cartão perto do limite ──
  (ctx) => ctx.cartoes.flatMap((k): Alerta[] => {
    if (k.limite <= 0) return [];
    const gasto = gastoNoCartaoNoMes(k.id, mesDe(ctx.hoje), ctx.lancs);
    const pct = Math.round((gasto / k.limite) * 100);
    if (pct < 90) return [];
    return [{ uid: `cartao.limite:${k.id}:${mesDe(ctx.hoje)}`, sev: 'atencao', icone: '📛',
      titulo: `${k.nome} a ${pct}% do limite`, msg: `${formatarBRL(gasto)} de ${formatarBRL(k.limite)} no mês.`, rota: '/contas' }];
  }),

  // ── Orçamento: perto do teto ou estourado ──
  (ctx) => {
    const consumo = consumoPorCategoria(ctx.lancs, mesDe(ctx.hoje));
    return Object.entries(ctx.tetos).flatMap(([catId, teto]): Alerta[] => {
      if (teto <= 0) return [];
      const gasto = consumo[catId] ?? 0;
      const pct = Math.round((gasto / teto) * 100);
      const nome = ctx.nomeCategoria(catId);
      if (gasto > teto) return [{ uid: `orc.estouro:${catId}:${mesDe(ctx.hoje)}`, sev: 'critico', icone: '🎯',
        titulo: `Orçamento de ${nome} estourado`, msg: `${formatarBRL(gasto)} de ${formatarBRL(teto)} — ${formatarBRL(gasto - teto)} acima.`, rota: '/orcamentos' }];
      if (pct >= 80) return [{ uid: `orc.perto:${catId}:${mesDe(ctx.hoje)}`, sev: 'atencao', icone: '🎯',
        titulo: `${nome} a ${pct}% do orçamento`, msg: `${formatarBRL(gasto)} de ${formatarBRL(teto)} no mês.`, rota: '/orcamentos' }];
      return [];
    });
  },

  // ── Conta no vermelho ──
  (ctx) => ctx.contas.flatMap((c): Alerta[] => {
    const s = saldoDaConta(c, ctx.lancs);
    if (s >= 0) return [];
    return [{ uid: `conta.negativa:${c.id}`, sev: 'critico', icone: '🔻',
      titulo: `${c.nome} está negativa`, msg: `Saldo atual: ${formatarBRL(s)}.`, rota: '/contas' }];
  }),

  // ── Metas: prazo vencido ou parada há 60 dias ──
  (ctx) => ctx.metas.flatMap((m): Alerta[] => {
    const r = ritmoMensal(m, mesDe(ctx.hoje));
    if (r.tipo === 'atrasada') return [{ uid: `meta.atrasada:${m.id}`, sev: 'atencao', icone: '🏁',
      titulo: `Meta "${m.nome}" passou do prazo`, msg: `Faltam ${formatarBRL(r.faltam)} — redefina o prazo ou reforce os aportes.`, rota: '/metas' }];
    const p = progressoMeta(m);
    if (p.concluida || (m.aportes ?? []).length === 0) return [];
    const ultimo = [...m.aportes].sort((a, b) => b.data.localeCompare(a.data))[0];
    if (diasEntre(ultimo.data, ctx.hoje) >= 60) return [{ uid: `meta.parada:${m.id}`, sev: 'info', icone: '💤',
      titulo: `Meta "${m.nome}" sem aportes há 2+ meses`, msg: `Último aporte em ${new Date(ultimo.data + 'T12:00').toLocaleDateString('pt-BR')} — ${p.pct}% concluída.`, rota: '/metas' }];
    return [];
  }),

  // ── Recorrências pendentes com o mês avançando ──
  (ctx) => {
    const dia = Number(ctx.hoje.slice(8, 10));
    if (dia < 8) return []; // início de mês: sem cobrança
    const pend = pendentesDoMes(ctx.recorrencias, ctx.lancs, mesDe(ctx.hoje));
    if (pend.length === 0) return [];
    const nomes = pend.slice(0, 3).map((r) => r.descricao).join(', ');
    return [{ uid: `rec.pendentes:${mesDe(ctx.hoje)}`, sev: 'atencao', icone: '🔁',
      titulo: `${pend.length} recorrência(s) sem lançar este mês`,
      msg: `${nomes}${pend.length > 3 ? '…' : ''} — lance com um clique em Lançamentos.`, rota: '/lancamentos' }];
  },

  // ── Gastos sem categoria no mês ──
  (ctx) => {
    const semCat = consumoPorCategoria(ctx.lancs, mesDe(ctx.hoje))['_sem'] ?? 0;
    if (semCat <= 0) return [];
    return [{ uid: `sem_categoria:${mesDe(ctx.hoje)}`, sev: 'info', icone: '📦',
      titulo: 'Gastos sem categoria neste mês', msg: `${formatarBRL(semCat)} sem classificação — categorize para orçar e enxergar melhor.`, rota: '/lancamentos' }];
  },
];

function addMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

const PESO: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2 };

/** Roda todas as regras e ordena por severidade. */
export function runInteligencia(ctx: CtxInteligencia): Alerta[] {
  return regras.flatMap((r) => r(ctx)).sort((a, b) => PESO[a.sev] - PESO[b.sev]);
}

// ── Ocultações pessoais (dispensar ✕ / adiar 💤 7 dias) ────────────────
export interface Ocultos { dispensados: Record<string, true>; adiados: Record<string, number>; }

export function aplicarOcultos(alertas: Alerta[], o: Ocultos, agoraMs: number): Alerta[] {
  return alertas.filter((a) => !o.dispensados[a.uid] && !(o.adiados[a.uid] && o.adiados[a.uid] > agoraMs));
}
export function contarOcultos(alertas: Alerta[], o: Ocultos, agoraMs: number): number {
  return alertas.length - aplicarOcultos(alertas, o, agoraMs).length;
}
