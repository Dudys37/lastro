// ═══ LASTRO — Dinheiro (F0) ═══
// Centavos inteiros, formatação pt-BR e divisão de parcelas SEM perder centavo.
import type { Centavos } from '../types/dominio';

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 → "R$ 1.234,56" */
export function formatarBRL(c: Centavos): string {
  return fmtBRL.format(c / 100);
}

/** Converte entrada do usuário em centavos.
 *  Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "1234".
 *  Retorna null para entrada inválida — quem chama decide o que fazer. */
export function parseBRL(texto: string): Centavos | null {
  if (typeof texto !== 'string') return null;
  let t = texto.trim().replace(/^R\$\s*/i, '');
  if (!t) return null;
  const negativo = /^-/.test(t);
  t = t.replace(/^-/, '');
  if (!/^[\d.,\s]+$/.test(t)) return null;
  t = t.replace(/\s/g, '');
  const temVirgula = t.includes(',');
  const temPonto = t.includes('.');
  if (temVirgula) {
    // vírgula é o decimal; pontos são milhar: "1.234,56"
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    // só ponto: decimal se houver 1 ponto com 1–2 casas ("1234.56"); senão milhar ("1.234")
    const partes = t.split('.');
    const ultima = partes[partes.length - 1];
    if (partes.length === 2 && ultima.length <= 2) {
      // decimal — mantém
    } else {
      t = partes.join('');
    }
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const cent = Math.round(n * 100);
  return negativo ? -cent : cent;
}

/** Divide um total em N parcelas inteiras que SOMAM EXATAMENTE o total.
 *  O resto (centavos que não dividem) vai para as PRIMEIRAS parcelas —
 *  padrão de mercado: 10.000 em 3 → [3334, 3333, 3333]. */
export function dividirParcelas(total: Centavos, n: number): Centavos[] {
  if (!Number.isInteger(total) || !Number.isInteger(n) || n < 1) {
    throw new Error('dividirParcelas: total inteiro (centavos) e n ≥ 1');
  }
  const sinal = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / n);
  const resto = abs - base * n;
  return Array.from({ length: n }, (_, i) => sinal * (base + (i < resto ? 1 : 0)));
}

/** Soma segura de centavos (evita acidentes com undefined). */
export function somar(...valores: Array<Centavos | null | undefined>): Centavos {
  return valores.reduce<number>((a, v) => a + (v ?? 0), 0);
}
