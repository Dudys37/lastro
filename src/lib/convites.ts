// ═══ LASTRO — Convites: lógica PURA (F1) ═══
// Sem Firestore aqui — só regras de negócio testáveis. O aceite em si
// (transação) vive no repositório de membros.
import type { Papel } from '../types/dominio';

export const CONVITE_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type MotivoConviteInvalido = 'usado' | 'expirado' | 'malformado';

export function validarConvite(
  c: { usado?: boolean; expiraEm?: number; workspaceId?: string; papel?: string } | null | undefined,
  agora: number,
): { ok: true } | { ok: false; motivo: MotivoConviteInvalido } {
  if (!c || !c.workspaceId || !c.papel || typeof c.expiraEm !== 'number') {
    return { ok: false, motivo: 'malformado' };
  }
  if (c.usado) return { ok: false, motivo: 'usado' };
  if (agora >= c.expiraEm) return { ok: false, motivo: 'expirado' };
  return { ok: true };
}

export const MSG_CONVITE: Record<MotivoConviteInvalido, string> = {
  usado: 'Este convite já foi utilizado. Peça um novo link a quem te convidou.',
  expirado: 'Este convite expirou (validade de 7 dias). Peça um novo link.',
  malformado: 'Convite inválido ou não encontrado. Confira o link.',
};

/** Papéis que um convite pode conceder (nunca 'dono'). */
export const PAPEIS_CONVIDAVEIS: Exclude<Papel, 'dono'>[] = ['admin', 'editor', 'leitor'];

/** Regras de gestão de papéis na tela de Membros:
 *  - só admin+ gere membros;
 *  - ninguém mexe no dono (nem o próprio dono se rebaixa aqui — transferência
 *    de posse é fluxo futuro, deliberadamente separado);
 *  - ninguém promove a 'dono';
 *  - admin não mexe em outro admin (só o dono pode);
 *  - ninguém gere a si mesmo (sair do workspace é ação própria, separada). */
export function podeAlterarMembro(
  meuPapel: Papel, souEu: boolean, papelAlvo: Papel, novoPapel?: Papel,
): boolean {
  if (souEu) return false;
  if (papelAlvo === 'dono') return false;
  if (novoPapel === 'dono') return false;
  if (!(meuPapel === 'dono' || meuPapel === 'admin')) return false;
  if (papelAlvo === 'admin' && meuPapel !== 'dono') return false;
  return true;
}

/** Sair do workspace: qualquer membro, exceto o dono (posse não fica órfã). */
export function podeSair(papel: Papel): boolean {
  return papel !== 'dono';
}

/** Transferência de posse (F11): só o dono, para OUTRO membro atual. */
export function podeTransferirPosse(meuPapel: Papel, alvoUid: string, meuUid: string, alvoEMembro: boolean): boolean {
  return meuPapel === 'dono' && alvoEMembro && alvoUid !== meuUid;
}
