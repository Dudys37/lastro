import { describe, it, expect } from 'vitest';
import { validarConvite, podeAlterarMembro, podeSair, podeTransferirPosse, PAPEIS_CONVIDAVEIS } from './convites';

const base = { workspaceId: 'w1', papel: 'editor', usado: false, expiraEm: 1000 };

describe('validarConvite', () => {
  it('aceita convite válido', () => {
    expect(validarConvite(base, 999)).toEqual({ ok: true });
  });
  it('rejeita usado, expirado e malformado', () => {
    expect(validarConvite({ ...base, usado: true }, 1)).toEqual({ ok: false, motivo: 'usado' });
    expect(validarConvite(base, 1000)).toEqual({ ok: false, motivo: 'expirado' });
    expect(validarConvite(null, 1)).toEqual({ ok: false, motivo: 'malformado' });
    expect(validarConvite({ papel: 'editor' }, 1)).toEqual({ ok: false, motivo: 'malformado' });
  });
});

describe('podeAlterarMembro — matriz de proteções', () => {
  it('ninguém mexe no dono nem promove a dono', () => {
    expect(podeAlterarMembro('admin', false, 'dono')).toBe(false);
    expect(podeAlterarMembro('dono', false, 'editor', 'dono')).toBe(false);
  });
  it('ninguém gere a si mesmo', () => {
    expect(podeAlterarMembro('dono', true, 'dono')).toBe(false);
    expect(podeAlterarMembro('admin', true, 'admin')).toBe(false);
  });
  it('admin gere editor/leitor mas não outro admin; dono gere admin', () => {
    expect(podeAlterarMembro('admin', false, 'editor', 'leitor')).toBe(true);
    expect(podeAlterarMembro('admin', false, 'admin', 'editor')).toBe(false);
    expect(podeAlterarMembro('dono', false, 'admin', 'editor')).toBe(true);
  });
  it('editor e leitor não gerem ninguém', () => {
    expect(podeAlterarMembro('editor', false, 'leitor', 'editor')).toBe(false);
    expect(podeAlterarMembro('leitor', false, 'leitor')).toBe(false);
  });
});

describe('podeSair e papéis conviáveis', () => {
  it('dono não sai; demais saem', () => {
    expect(podeSair('dono')).toBe(false);
    expect(podeSair('admin')).toBe(true);
    expect(podeSair('leitor')).toBe(true);
  });
  it('convite nunca concede dono', () => {
    expect(PAPEIS_CONVIDAVEIS).not.toContain('dono');
  });
});

describe('podeTransferirPosse (F11)', () => {
  it('só o dono, para outro membro', () => {
    expect(podeTransferirPosse('dono', 'b', 'a', true)).toBe(true);
    expect(podeTransferirPosse('admin', 'b', 'a', true)).toBe(false);
    expect(podeTransferirPosse('dono', 'a', 'a', true)).toBe(false);   // a si mesmo, não
    expect(podeTransferirPosse('dono', 'b', 'a', false)).toBe(false);  // não-membro, não
  });
});
