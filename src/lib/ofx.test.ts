import { describe, it, expect } from 'vitest';
import { chaveImport, dataOFXParaISO, parseOFX, valorOFXParaCentavos } from './ofx';

describe('valores OFX (o pântano dos decimais)', () => {
  it('cobre ponto, vírgula, milhar e sinais', () => {
    expect(valorOFXParaCentavos('-123.45')).toBe(-12345);
    expect(valorOFXParaCentavos('-123,45')).toBe(-12345);
    expect(valorOFXParaCentavos('-1.234,56')).toBe(-123456);
    expect(valorOFXParaCentavos('1,234.56')).toBe(123456);
    expect(valorOFXParaCentavos('1234,5')).toBe(123450);
    expect(valorOFXParaCentavos('10')).toBe(1000);
    expect(valorOFXParaCentavos('1.234')).toBe(123400); // milhar, não decimal
    expect(valorOFXParaCentavos('+50,00')).toBe(5000);
  });
  it('rejeita lixo', () => {
    expect(valorOFXParaCentavos('abc')).toBe(null);
    expect(valorOFXParaCentavos('')).toBe(null);
    expect(valorOFXParaCentavos('12.3456')).toBe(null);
  });
});

describe('datas OFX', () => {
  it('recorta os 8 dígitos e valida', () => {
    expect(dataOFXParaISO('20260705')).toBe('2026-07-05');
    expect(dataOFXParaISO('20260705120000' + '[-3' + ':BRT]')).toBe('2026-07-05');
    expect(dataOFXParaISO('20261340')).toBe(null);
    expect(dataOFXParaISO('julho')).toBe(null);
  });
});

const OFX_BANCO = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701120000
<TRNAMT>-150,00
<FITID>ABC001
<MEMO>PIX MERCADO SAO JOSE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260705
<TRNAMT>3500.00
<FITID>ABC002
<NAME>TED SALARIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>quebrado
<TRNAMT>-10,00
<FITID>ABC003
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('parseOFX (SGML 1.x sem fechamento)', () => {
  it('extrai transações, detecta origem banco e conta ignoradas', () => {
    const r = parseOFX(OFX_BANCO);
    expect(r.origem).toBe('banco');
    expect(r.ignoradas).toBe(1);
    expect(r.transacoes).toEqual([
      { fitid: 'ABC001', data: '2026-07-01', valor: -15000, memo: 'PIX MERCADO SAO JOSE' },
      { fitid: 'ABC002', data: '2026-07-05', valor: 350000, memo: 'TED SALARIO' },
    ]);
  });
  it('detecta fatura de cartão', () => {
    expect(parseOFX('<OFX><CREDITCARDMSGSRSV1><CCSTMTRS></CCSTMTRS></CREDITCARDMSGSRSV1></OFX>').origem).toBe('cartao');
  });
  it('chave de dedup une destino e FITID', () => {
    expect(chaveImport('conta:c1', 'ABC001')).toBe('conta:c1:ABC001');
  });
});
