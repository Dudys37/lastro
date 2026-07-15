// ═══ LASTRO — Parser OFX: lógica PURA (F10) ═══
// OFX de banco brasileiro é hostil: 1.x é SGML sem fechamento de tags,
// encoding costuma ser latin-1, decimal ora '.', ora ','. O parser é
// tolerante por regex de blocos <STMTTRN> — nunca confia em XML válido.
import type { Centavos } from '../types/dominio';

export interface TransacaoOFX {
  fitid: string;
  data: string;          // ISO 'YYYY-MM-DD'
  valor: Centavos;       // COM sinal (negativo = saída)
  memo: string;
}
export interface ResultadoOFX {
  origem: 'banco' | 'cartao' | 'desconhecida';
  transacoes: TransacaoOFX[];
  ignoradas: number;     // blocos STMTTRN que não deu para entender
}

/** '-1.234,56' | '-1234.56' | '1234,5' | '10' → centavos inteiros com sinal. */
export function valorOFXParaCentavos(bruto: string): Centavos | null {
  let s = (bruto ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  let sinal = 1;
  if (s.startsWith('-')) { sinal = -1; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const ultPonto = s.lastIndexOf('.'), ultVirg = s.lastIndexOf(',');
  const sep = Math.max(ultPonto, ultVirg);
  let inteiros: string, decimais: string;
  if (sep === -1) { inteiros = s; decimais = '00'; }
  else {
    inteiros = s.slice(0, sep).replace(/[.,]/g, '');
    decimais = s.slice(sep + 1);
    if (!/^\d{1,2}$/.test(decimais)) {
      // três+ dígitos após o separador = separador de milhar ('1.234')
      if (/^\d{3}$/.test(decimais)) { inteiros += decimais; decimais = '00'; }
      else return null;
    }
  }
  if (inteiros === '') inteiros = '0';
  if (!/^\d+$/.test(inteiros)) return null;
  return sinal * (parseInt(inteiros, 10) * 100 + parseInt(decimais.padEnd(2, '0'), 10));
}

/** '20260705120000' + '[-3' + ':BRT]' → '2026-07-05' (só os 8 primeiros dígitos valem). */
export function dataOFXParaISO(bruto: string): string | null {
  const m = (bruto ?? '').trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, a, mes, d] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${a}-${mes}-${d}`;
}

function campo(bloco: string, tag: string): string {
  // SGML: valor vai até a próxima '<' ou fim de linha
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

export function parseOFX(texto: string): ResultadoOFX {
  const t = texto ?? '';
  const origem: ResultadoOFX['origem'] =
    /CREDITCARDMSGSRSV1|<CCSTMTRS>/i.test(t) ? 'cartao'
    : /BANKMSGSRSV1|<STMTRS>/i.test(t) ? 'banco'
    : 'desconhecida';

  const transacoes: TransacaoOFX[] = [];
  let ignoradas = 0;
  const blocos = t.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const corpo = b.split(/<\/STMTTRN>/i)[0];
    const valor = valorOFXParaCentavos(campo(corpo, 'TRNAMT'));
    const data = dataOFXParaISO(campo(corpo, 'DTPOSTED'));
    const fitid = campo(corpo, 'FITID');
    const memo = campo(corpo, 'MEMO') || campo(corpo, 'NAME');
    if (valor === null || !data || !fitid) { ignoradas++; continue; }
    transacoes.push({ fitid, data, valor, memo });
  }
  return { origem, transacoes, ignoradas };
}

/** Decodifica bytes de um .ofx: tenta UTF-8; excesso de '\ufffd' → latin-1. */
export function decodificarOFX(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const ruins = (utf8.match(/\ufffd/g) ?? []).length;
  if (ruins === 0) return utf8;
  return new TextDecoder('windows-1252').decode(bytes);
}

/** Chave de dedup: mesma transação do mesmo destino nunca entra duas vezes. */
export function chaveImport(destino: string, fitid: string): string {
  return `${destino}:${fitid}`;
}
