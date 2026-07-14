// ═══ LASTRO — Membros & Convites (F1) ═══
// Repositório + UI. O aceite de convite é uma TRANSAÇÃO (membro + espelho
// membrosUids + marca de uso) validada pelas Firestore Rules via
// getAfter/existsAfter — seguro sem Cloud Functions (plano gratuito).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Membro, Papel } from '../../types/dominio';
import {
  CONVITE_VALIDADE_MS, MSG_CONVITE, PAPEIS_CONVIDAVEIS,
  podeAlterarMembro, podeSair, validarConvite,
} from '../../lib/convites';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Cartao, Marca } from '../../components/ui/Basicos';

// ── Repositório ──────────────────────────────────────────────────────
export async function listarMembros(ws: string): Promise<Membro[]> {
  const snap = await getDocs(collection(db, 'workspaces', ws, 'membros'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Membro, 'uid'>) }));
}
export async function alterarPapel(ws: string, uid: string, papel: Papel): Promise<void> {
  await updateDoc(doc(db, 'workspaces', ws, 'membros', uid), { papel });
}
export async function removerMembro(ws: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', ws, 'membros', uid));
  await updateDoc(doc(db, 'workspaces', ws), { membrosUids: arrayRemove(uid) });
}
export async function sairDoWorkspace(ws: string, uid: string): Promise<void> {
  // ordem inversa da remoção por admin: primeiro o espelho, depois o membro —
  // enquanto o doc de membro existe, as rules ainda autorizam o update.
  await updateDoc(doc(db, 'workspaces', ws), { membrosUids: arrayRemove(uid) });
  await deleteDoc(doc(db, 'workspaces', ws, 'membros', uid));
}

interface ConviteDoc {
  id: string; workspaceId: string; workspaceNome: string;
  papel: Exclude<Papel, 'dono'>; criadoPor: string;
  criadoEm?: unknown; expiraEm: number; usado: boolean;
}
export async function criarConvite(
  ws: string, wsNome: string, uid: string, papel: Exclude<Papel, 'dono'>,
): Promise<string> {
  const ref = doc(collection(db, 'convites'));
  await setDoc(ref, {
    workspaceId: ws, workspaceNome: wsNome, papel, criadoPor: uid,
    criadoEm: serverTimestamp(), expiraEm: Date.now() + CONVITE_VALIDADE_MS, usado: false,
  });
  return ref.id;
}
export async function listarConvitesPendentes(ws: string): Promise<ConviteDoc[]> {
  const q = query(collection(db, 'convites'), where('workspaceId', '==', ws), where('usado', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConviteDoc, 'id'>) }));
}
export async function revogarConvite(id: string): Promise<void> {
  await deleteDoc(doc(db, 'convites', id));
}
export function linkDoConvite(id: string): string {
  return `${location.origin}${location.pathname}#/convite/${id}`;
}

/** Aceite transacional: valida, cria membro (com conviteId p/ as rules),
 *  adiciona ao espelho membrosUids e marca o convite como usado. */
export async function aceitarConvite(
  conviteId: string, uid: string, nome: string, email: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; msg: string }> {
  try {
    const wsId = await runTransaction(db, async (tx) => {
      const cRef = doc(db, 'convites', conviteId);
      const cSnap = await tx.get(cRef);
      const c = cSnap.exists() ? (cSnap.data() as ConviteDoc) : null;
      const v = validarConvite(c, Date.now());
      if (!v.ok) throw new Error(MSG_CONVITE[v.motivo]);
      const ws = c!.workspaceId;
      tx.set(doc(db, 'workspaces', ws, 'membros', uid), {
        papel: c!.papel, nome, email, entrouEm: serverTimestamp(), conviteId,
      });
      tx.update(doc(db, 'workspaces', ws), { membrosUids: arrayUnion(uid) });
      tx.update(cRef, { usado: true, usadoPor: uid });
      return ws;
    });
    return { ok: true, workspaceId: wsId };
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : '';
    const conhecido = Object.values(MSG_CONVITE).includes(m);
    return { ok: false, msg: conhecido ? m : 'Não foi possível aceitar o convite. Tente novamente.' };
  }
}

// ── UI: página de Membros ────────────────────────────────────────────
const ROTULO_PAPEL: Record<Papel, string> = { dono: '👑 Dono', admin: '🛡️ Admin', editor: '✏️ Editor', leitor: '👁️ Leitor' };

export function PaginaMembros() {
  const { usuario } = useAuth();
  const { ativo, recarregar } = useWorkspace();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<ConviteDoc[]>([]);
  const [papelNovo, setPapelNovo] = useState<Exclude<Papel, 'dono'>>('editor');
  const [linkGerado, setLinkGerado] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const meuPapel = (membros.find((m) => m.uid === usuario?.uid)?.papel ?? null) as Papel | null;
  const souAdminMais = meuPapel === 'dono' || meuPapel === 'admin';

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try {
      setMembros(await listarMembros(ativo.id));
      // convites só para admin+ (as rules negariam de qualquer forma)
      try { setConvites(await listarConvitesPendentes(ativo.id)); } catch { setConvites([]); }
    } catch { setErro('Não foi possível carregar os membros.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id]);

  if (!ativo || !usuario) return null;

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try { await fn(); await carregar(); }
    catch { setErro('Ação não permitida ou falha de conexão.'); }
    finally { setOcupado(false); }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Cartao>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h1 className="text-base font-bold">👥 Membros de {ativo.nome}</h1>
          <span className="text-xs text-ink3">{membros.length} membro(s)</span>
        </div>
        {membros.map((m) => {
          const souEu = m.uid === usuario.uid;
          const podeGerir = meuPapel ? podeAlterarMembro(meuPapel, souEu, m.papel) : false;
          return (
            <div key={m.uid} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.nome || m.email}{souEu && <span className="ml-2 text-xs font-normal text-ink3">(você)</span>}</div>
                <div className="truncate text-xs text-ink2">{m.email}</div>
              </div>
              {podeGerir ? (
                <select
                  className="h-9 rounded-lg border border-line bg-card2 px-2 text-sm"
                  value={m.papel} disabled={ocupado}
                  onChange={(e) => void acao(() => alterarPapel(ativo.id, m.uid, e.target.value as Papel))}
                  aria-label={`Papel de ${m.nome}`}
                >
                  {PAPEIS_CONVIDAVEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
                </select>
              ) : (
                <span className="rounded-full bg-card2 px-3 py-1 text-xs font-bold text-ink2">{ROTULO_PAPEL[m.papel]}</span>
              )}
              {podeGerir && (
                <Botao variante="perigo" className="h-9 px-3 text-xs" disabled={ocupado}
                  onClick={() => { if (confirm(`Remover ${m.nome || m.email} do workspace?`)) void acao(() => removerMembro(ativo.id, m.uid)); }}>
                  Remover
                </Botao>
              )}
              {souEu && meuPapel && podeSair(meuPapel) && (
                <Botao variante="fantasma" className="h-9 px-3 text-xs" disabled={ocupado}
                  onClick={() => { if (confirm('Sair deste workspace? Você perderá o acesso.')) void acao(async () => { await sairDoWorkspace(ativo.id, usuario.uid); await recarregar(); }); }}>
                  Sair
                </Botao>
              )}
            </div>
          );
        })}
        {erro && <div className="px-5 py-3 text-xs text-neg">{erro}</div>}
      </Cartao>

      {souAdminMais && (
        <Cartao>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-bold">✉️ Convidar pessoas</h2>
            <p className="mt-0.5 text-xs text-ink2">Gere um link com papel definido — validade de 7 dias, uso único.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <select className="h-10 rounded-lg border border-line bg-card2 px-2 text-sm"
              value={papelNovo} onChange={(e) => setPapelNovo(e.target.value as Exclude<Papel, 'dono'>)} aria-label="Papel do convite">
              {PAPEIS_CONVIDAVEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
            </select>
            <Botao disabled={ocupado} onClick={() => void acao(async () => {
              const id = await criarConvite(ativo.id, ativo.nome, usuario.uid, papelNovo);
              setLinkGerado(linkDoConvite(id)); setCopiado(false);
            })}>
              Gerar link de convite
            </Botao>
          </div>
          {linkGerado && (
            <div className="mx-5 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <code className="min-w-0 flex-1 break-all text-xs">{linkGerado}</code>
              <Botao variante="fantasma" className="h-8 px-3 text-xs" onClick={() => {
                void navigator.clipboard.writeText(linkGerado).then(() => setCopiado(true));
              }}>
                {copiado ? '✓ Copiado' : 'Copiar'}
              </Botao>
            </div>
          )}
          {convites.length > 0 && (
            <div className="border-t border-line">
              <div className="px-5 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-ink3">Convites pendentes</div>
              {convites.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="rounded-full bg-card2 px-3 py-1 text-xs font-bold text-ink2">{ROTULO_PAPEL[c.papel]}</span>
                  <span className="flex-1 text-xs text-ink2">
                    expira {new Date(c.expiraEm).toLocaleDateString('pt-BR')}
                    {Date.now() >= c.expiraEm && <span className="ml-2 font-bold text-warn">expirado</span>}
                  </span>
                  <Botao variante="fantasma" className="h-8 px-3 text-xs" onClick={() => {
                    void navigator.clipboard.writeText(linkDoConvite(c.id));
                  }}>Copiar link</Botao>
                  <Botao variante="perigo" className="h-8 px-3 text-xs" disabled={ocupado}
                    onClick={() => void acao(() => revogarConvite(c.id))}>Revogar</Botao>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      )}
    </div>
  );
}

// ── UI: página de aceite (/convite/:id) ─────────────────────────────
export function PaginaAceitarConvite() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const { trocar, recarregar } = useWorkspace();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ nome: string; papel: Papel } | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'aceitando' | 'erro'>('carregando');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) { setEstado('erro'); setMsg(MSG_CONVITE.malformado); return; }
      try {
        const snap = await getDoc(doc(db, 'convites', id));
        const c = snap.exists() ? snap.data() : null;
        const v = validarConvite(c as never, Date.now());
        if (!v.ok) { setEstado('erro'); setMsg(MSG_CONVITE[v.motivo]); return; }
        setInfo({ nome: (c as { workspaceNome?: string }).workspaceNome ?? 'um workspace', papel: (c as { papel: Papel }).papel });
        setEstado('pronto');
      } catch { setEstado('erro'); setMsg(MSG_CONVITE.malformado); }
    })();
  }, [id]);

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <Cartao className="w-full max-w-sm p-8 text-center">
        <div className="mb-4 flex justify-center"><Marca /></div>
        {estado === 'carregando' && <p className="text-sm text-ink2">Verificando convite…</p>}
        {estado === 'erro' && (
          <>
            <p className="text-sm text-neg">{msg}</p>
            <Botao variante="fantasma" className="mt-4" onClick={() => nav('/')}>Ir para o início</Botao>
          </>
        )}
        {(estado === 'pronto' || estado === 'aceitando') && info && usuario && (
          <>
            <h1 className="text-lg font-bold">Você foi convidado! 🎉</h1>
            <p className="mt-1 text-sm text-ink2">
              Entrar em <strong>{info.nome}</strong> como <strong>{ROTULO_PAPEL[info.papel]}</strong>, com a conta {usuario.email}.
            </p>
            <Botao className="mt-5 w-full" disabled={estado === 'aceitando'} onClick={() => {
              setEstado('aceitando');
              void aceitarConvite(id!, usuario.uid, usuario.displayName ?? '', usuario.email ?? '').then(async (r) => {
                if (r.ok) { await recarregar(); trocar(r.workspaceId); nav('/'); }
                else { setEstado('erro'); setMsg(r.msg); }
              });
            }}>
              {estado === 'aceitando' ? 'Entrando…' : 'Aceitar convite'}
            </Botao>
          </>
        )}
      </Cartao>
    </div>
  );
}
