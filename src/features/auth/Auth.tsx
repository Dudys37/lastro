// ═══ LASTRO — Autenticação (F0) ═══
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile, type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { Botao, Campo, Cartao, Marca } from '../../components/ui/Basicos';

interface AuthCtx { usuario: User | null; carregando: boolean; sair: () => Promise<void>; }
const Ctx = createContext<AuthCtx>({ usuario: null, carregando: true, sair: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUsuario(u); setCarregando(false); }), []);
  return (
    <Ctx.Provider value={{ usuario, carregando, sair: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}

const MSG_ERRO: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já tem conta — use "Entrar".',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/popup-closed-by-user': 'Login com Google cancelado.',
};

export function PaginaLogin() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function acao(fn: () => Promise<unknown>) {
    setErro(''); setOcupado(true);
    try { await fn(); }
    catch (e: unknown) {
      const cod = (e as { code?: string })?.code ?? '';
      setErro(MSG_ERRO[cod] ?? 'Não foi possível entrar. Tente novamente.');
    }
    finally { setOcupado(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <Cartao className="w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center"><Marca tam="lg" /></div>
        <p className="mb-6 text-center text-sm text-ink2">
          Gestão financeira com lastro: contas, cartões, orçamentos e metas — juntos.
        </p>
        <div className="grid gap-3">
          {modo === 'criar' && (
            <Campo rotulo="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como te chamamos?" />
          )}
          <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          <Campo rotulo="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" erro={erro || undefined} />
          <Botao disabled={ocupado} onClick={() => acao(async () => {
            if (modo === 'entrar') { await signInWithEmailAndPassword(auth, email, senha); }
            else {
              const cred = await createUserWithEmailAndPassword(auth, email, senha);
              if (nome.trim()) await updateProfile(cred.user, { displayName: nome.trim() });
            }
          })}>
            {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Botao>
          <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => signInWithPopup(auth, googleProvider))}>
            Continuar com Google
          </Botao>
        </div>
        <button
          className="mt-5 w-full text-center text-xs font-semibold text-brand hover:underline"
          onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(''); }}
        >
          {modo === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
        </button>
      </Cartao>
    </div>
  );
}
