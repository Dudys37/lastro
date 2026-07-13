// ═══ LASTRO — Workspaces (F0/F1) ═══
// Todo dado do Lastro vive dentro de um workspace. O usuário pode ter vários;
// membros entram com papéis. Este arquivo é a ÚNICA porta para o Firestore
// nesta feature (padrão repositório — facilita a migração futura de backend).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Papel, Workspace } from '../../types/dominio';
import { useAuth } from '../auth/Auth';
import { Botao, Campo, Cartao, Marca } from '../../components/ui/Basicos';

// ── Repositório ──────────────────────────────────────────────────────
export async function criarWorkspace(uid: string, nomeUsuario: string, email: string, nome: string): Promise<string> {
  const ws = await addDoc(collection(db, 'workspaces'), {
    nome, criadoPor: uid, criadoEm: serverTimestamp(), moeda: 'BRL',
    // espelho de membros p/ consulta barata de "meus workspaces" (regras validam)
    membrosUids: [uid],
  });
  await setDoc(doc(db, 'workspaces', ws.id, 'membros', uid), {
    papel: 'dono' satisfies Papel, nome: nomeUsuario, email, entrouEm: serverTimestamp(),
  });
  return ws.id;
}

export async function listarMeusWorkspaces(uid: string): Promise<Workspace[]> {
  const q = query(collection(db, 'workspaces'), where('membrosUids', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workspace, 'id'>) }));
}

// ── Contexto do workspace ativo ─────────────────────────────────────
interface WsCtx {
  workspaces: Workspace[];
  ativo: Workspace | null;
  carregando: boolean;
  trocar: (id: string) => void;
  recarregar: () => Promise<void>;
}
const Ctx = createContext<WsCtx>({ workspaces: [], ativo: null, carregando: true, trocar: () => {}, recarregar: async () => {} });
export const useWorkspace = () => useContext(Ctx);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [ativoId, setAtivoId] = useState<string | null>(localStorage.getItem('lastro_ws'));
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    if (!usuario) { setWorkspaces([]); setCarregando(false); return; }
    setCarregando(true);
    try {
      const lista = await listarMeusWorkspaces(usuario.uid);
      setWorkspaces(lista);
    } catch (e) {
      console.error('Falha ao listar workspaces', e);
      setWorkspaces([]); // não deixa a UI presa em "Abrindo workspace…"
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { void recarregar(); /* eslint-disable-next-line */ }, [usuario?.uid]);

  const ativo = workspaces.find((w) => w.id === ativoId) ?? workspaces[0] ?? null;
  function trocar(id: string) { setAtivoId(id); localStorage.setItem('lastro_ws', id); }

  return (
    <Ctx.Provider value={{ workspaces, ativo, carregando, trocar, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Onboarding: primeiro workspace ──────────────────────────────────
export function CriarPrimeiroWorkspace() {
  const { usuario } = useAuth();
  const { recarregar } = useWorkspace();
  const [nome, setNome] = useState('Minhas Finanças');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <Cartao className="w-full max-w-sm p-8">
        <div className="mb-4 flex justify-center"><Marca /></div>
        <h1 className="mb-1 text-center text-lg font-bold">Crie o seu primeiro workspace</h1>
        <p className="mb-6 text-center text-sm text-ink2">
          É o espaço onde vivem contas, cartões e lançamentos. Depois você poderá convidar pessoas com papéis (admin, editor, leitor) e criar outros espaços.
        </p>
        <div className="grid gap-3">
          <Campo rotulo="Nome do workspace" value={nome} onChange={(e) => setNome(e.target.value)} erro={erro || undefined} />
          <Botao disabled={ocupado || !nome.trim()} onClick={async () => {
            if (!usuario) return;
            setOcupado(true); setErro('');
            try {
              await criarWorkspace(usuario.uid, usuario.displayName ?? 'Você', usuario.email ?? '', nome.trim());
              await recarregar();
            } catch { setErro('Não foi possível criar. Verifique sua conexão.'); }
            finally { setOcupado(false); }
          }}>
            {ocupado ? 'Criando…' : 'Começar'}
          </Botao>
        </div>
      </Cartao>
    </div>
  );
}
