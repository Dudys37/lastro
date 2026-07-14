// ═══ LASTRO — Financeiro: repositório (F2) ═══
// Única porta para o Firestore do núcleo financeiro. Parcelamento usa
// writeBatch: N lançamentos com grupoId comum, valores de dividirParcelas
// (soma EXATA) e datas mensais com clamp — tudo ou nada.
import {
  collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc,
  where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { dividirParcelas } from '../../lib/dinheiro';
import { datasParcelas } from '../../lib/lancamentos';
import type { Cartao, Centavos, Conta, Lancamento, TipoLancamento } from '../../types/dominio';

const col = (ws: string, nome: string) => collection(db, 'workspaces', ws, nome);
const ref = (ws: string, nome: string, id: string) => doc(db, 'workspaces', ws, nome, id);

// ── Contas ───────────────────────────────────────────────────────────
export async function listarContas(ws: string): Promise<Conta[]> {
  const s = await getDocs(col(ws, 'contas'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conta, 'id'>) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
export async function salvarConta(ws: string, c: Omit<Conta, 'id'> & { id?: string }): Promise<void> {
  const id = c.id ?? doc(col(ws, 'contas')).id;
  await setDoc(ref(ws, 'contas', id), { nome: c.nome, tipo: c.tipo, saldoInicial: c.saldoInicial, arquivada: c.arquivada ?? false });
}
export async function excluirConta(ws: string, id: string): Promise<void> {
  await deleteDoc(ref(ws, 'contas', id));
}

// ── Cartões ──────────────────────────────────────────────────────────
export async function listarCartoes(ws: string): Promise<Cartao[]> {
  const s = await getDocs(col(ws, 'cartoes'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cartao, 'id'>) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
export async function salvarCartao(ws: string, c: Omit<Cartao, 'id'> & { id?: string }): Promise<void> {
  const id = c.id ?? doc(col(ws, 'cartoes')).id;
  await setDoc(ref(ws, 'cartoes', id), {
    nome: c.nome, bandeira: c.bandeira, limite: c.limite,
    diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento, arquivado: c.arquivado ?? false,
  });
}
export async function excluirCartao(ws: string, id: string): Promise<void> {
  await deleteDoc(ref(ws, 'cartoes', id));
}

// ── Categorias ───────────────────────────────────────────────────────
export interface Categoria { id: string; nome: string; icone: string; tipo: 'despesa' | 'receita'; ordem: number; }

export const CATEGORIAS_PADRAO: Omit<Categoria, 'id'>[] = [
  { nome: 'Moradia',       icone: '🏠', tipo: 'despesa', ordem: 1 },
  { nome: 'Alimentação',   icone: '🍽️', tipo: 'despesa', ordem: 2 },
  { nome: 'Mercado',       icone: '🛒', tipo: 'despesa', ordem: 3 },
  { nome: 'Transporte',    icone: '🚗', tipo: 'despesa', ordem: 4 },
  { nome: 'Saúde',         icone: '💊', tipo: 'despesa', ordem: 5 },
  { nome: 'Educação',      icone: '📚', tipo: 'despesa', ordem: 6 },
  { nome: 'Lazer',         icone: '🎮', tipo: 'despesa', ordem: 7 },
  { nome: 'Assinaturas',   icone: '📺', tipo: 'despesa', ordem: 8 },
  { nome: 'Vestuário',     icone: '👕', tipo: 'despesa', ordem: 9 },
  { nome: 'Impostos & Taxas', icone: '🧾', tipo: 'despesa', ordem: 10 },
  { nome: 'Outros',        icone: '📦', tipo: 'despesa', ordem: 11 },
  { nome: 'Salário',       icone: '💼', tipo: 'receita', ordem: 1 },
  { nome: 'Freelance',     icone: '🧑‍💻', tipo: 'receita', ordem: 2 },
  { nome: 'Rendimentos',   icone: '📈', tipo: 'receita', ordem: 3 },
  { nome: 'Outras receitas', icone: '✨', tipo: 'receita', ordem: 4 },
];

export async function listarCategorias(ws: string): Promise<Categoria[]> {
  const s = await getDocs(col(ws, 'categorias'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Categoria, 'id'>) }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}
/** Semeia o conjunto padrão na primeira visita de um admin+ (idempotente). */
export async function semearCategoriasPadrao(ws: string): Promise<void> {
  const atuais = await listarCategorias(ws);
  if (atuais.length > 0) return;
  const b = writeBatch(db);
  for (const c of CATEGORIAS_PADRAO) b.set(doc(col(ws, 'categorias')), c);
  await b.commit();
}
export async function salvarCategoria(ws: string, c: Omit<Categoria, 'id'> & { id?: string }): Promise<void> {
  const id = c.id ?? doc(col(ws, 'categorias')).id;
  await setDoc(ref(ws, 'categorias', id), { nome: c.nome, icone: c.icone, tipo: c.tipo, ordem: c.ordem });
}
export async function excluirCategoria(ws: string, id: string): Promise<void> {
  await deleteDoc(ref(ws, 'categorias', id));
}

// ── Lançamentos ──────────────────────────────────────────────────────
export async function listarLancamentosDoMes(ws: string, mes: string): Promise<Lancamento[]> {
  const q = query(col(ws, 'lancamentos'),
    where('data', '>=', `${mes}-01`), where('data', '<=', `${mes}-31`), orderBy('data', 'desc'));
  const s = await getDocs(q);
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lancamento, 'id'>) }));
}
/** Para saldos de conta é preciso o histórico todo (volume pessoal: ok; a
 *  otimização por snapshot de saldo é candidata a fase futura). */
export async function listarTodosLancamentos(ws: string): Promise<Lancamento[]> {
  const s = await getDocs(query(col(ws, 'lancamentos'), orderBy('data', 'desc')));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lancamento, 'id'>) }));
}

export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  valorTotal: Centavos;          // total (será dividido se parcelado)
  dataPrimeira: string;          // ISO
  categoriaId: string | null;
  contaId: string | null;
  contaDestinoId: string | null;
  cartaoId: string | null;
  nParcelas: number;             // 1 = à vista
}

export async function criarLancamento(ws: string, uid: string, n: NovoLancamento): Promise<void> {
  const nP = Math.max(1, Math.floor(n.nParcelas));
  const valores = dividirParcelas(n.valorTotal, nP);
  const datas = datasParcelas(n.dataPrimeira, nP);
  const grupoId = doc(col(ws, 'lancamentos')).id;
  const b = writeBatch(db);
  for (let i = 0; i < nP; i++) {
    const d = doc(col(ws, 'lancamentos'));
    b.set(d, {
      tipo: n.tipo,
      descricao: n.descricao,
      valor: valores[i],
      data: datas[i],
      categoriaId: n.categoriaId,
      contaId: n.contaId,
      contaDestinoId: n.contaDestinoId,
      cartaoId: n.cartaoId,
      parcelas: nP > 1 ? { total: nP, numero: i + 1, grupoId } : null,
      criadoPor: uid,
      criadoEm: Date.now(),
    });
  }
  await b.commit();
}

export async function atualizarLancamento(
  ws: string, id: string,
  campos: Partial<Pick<Lancamento, 'descricao' | 'valor' | 'data' | 'categoriaId'>>,
): Promise<void> {
  await updateDoc(ref(ws, 'lancamentos', id), campos);
}
export async function excluirLancamento(ws: string, id: string): Promise<void> {
  await deleteDoc(ref(ws, 'lancamentos', id));
}
/** Exclui TODAS as parcelas de um grupo (tudo ou nada). */
export async function excluirGrupoParcelas(ws: string, grupoId: string): Promise<void> {
  const s = await getDocs(query(col(ws, 'lancamentos'), where('parcelas.grupoId', '==', grupoId)));
  const b = writeBatch(db);
  s.docs.forEach((d) => b.delete(d.ref));
  await b.commit();
}
