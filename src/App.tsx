// ═══ LASTRO — App shell e roteamento (F0) ═══
import { useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, PaginaLogin, useAuth } from './features/auth/Auth';
import { CriarPrimeiroWorkspace, WorkspaceProvider, useWorkspace } from './features/workspaces/Workspaces';
import { PaginaAceitarConvite, PaginaMembros } from './features/membros/Membros';
import { Botao, Cartao, Marca } from './components/ui/Basicos';
import { alternarTema, aplicarTema, temaAtual } from './lib/tema';

aplicarTema(temaAtual());

const MENU = [
  { rota: '/', rotulo: 'Visão Geral', icone: '📊' },
  { rota: '/lancamentos', rotulo: 'Lançamentos', icone: '💸' },
  { rota: '/contas', rotulo: 'Contas & Cartões', icone: '💳' },
  { rota: '/orcamentos', rotulo: 'Orçamentos', icone: '🎯' },
  { rota: '/membros', rotulo: 'Membros', icone: '👥' },
];

function EmBreve({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <Cartao className="p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl">🧱</div>
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink2">
        Este módulo chega na {fase} do plano de construção do Lastro.
      </p>
    </Cartao>
  );
}

function VisaoGeral() {
  const { ativo } = useWorkspace();
  return (
    <div className="grid gap-4">
      <Cartao className="p-6">
        <h1 className="text-xl font-extrabold tracking-tight">Bem-vindo ao {ativo?.nome ?? 'Lastro'} ⚓</h1>
        <p className="mt-1 text-sm text-ink2">
          Fundação (F0) pronta: autenticação, workspaces com papéis, dois temas e testes.
          A F2 traz contas, cartões e lançamentos com parcelamento exato em centavos.
        </p>
      </Cartao>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Saldo consolidado', 'F2', 'pos'],
          ['Fatura do mês', 'F3', 'warn'],
          ['Orçamento usado', 'F3', 'info'],
        ].map(([t, f, cor]) => (
          <Cartao key={t} className="relative overflow-hidden p-5">
            <span className={`absolute inset-x-0 top-0 h-1 bg-${cor}`} aria-hidden />
            <div className="text-xs font-bold uppercase tracking-wide text-ink2">{t}</div>
            <div className="mt-2 text-2xl font-extrabold text-ink3">— {f}</div>
          </Cartao>
        ))}
      </div>
    </div>
  );
}

function Shell() {
  const { usuario, sair } = useAuth();
  const { ativo, workspaces, trocar } = useWorkspace();
  const [tema, setTema] = useState(temaAtual());
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-line bg-card p-4 md:flex">
        <div className="mb-6 px-1"><Marca /></div>
        {workspaces.length > 1 && (
          <select
            className="mb-4 h-9 rounded-lg border border-line bg-card2 px-2 text-sm"
            value={ativo?.id} onChange={(e) => trocar(e.target.value)} aria-label="Trocar workspace"
          >
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}
          </select>
        )}
        <nav className="grid gap-1">
          {MENU.map((m) => (
            <NavLink key={m.rota} to={m.rota} end={m.rota === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-card2 hover:text-ink'}`}>
              <span aria-hidden>{m.icone}</span>{m.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-line pt-4">
          <Botao variante="fantasma" onClick={() => setTema(alternarTema())}>
            {tema === 'claro' ? '🌙 Tema escuro' : '☀️ Tema claro'}
          </Botao>
          <div className="truncate px-1 text-xs text-ink3">{usuario?.email}</div>
          <Botao variante="fantasma" onClick={() => void sair()}>Sair</Botao>
        </div>
      </aside>
      <main className="flex-1 bg-bg p-4 md:p-8">
        <Routes>
          <Route path="/" element={<VisaoGeral />} />
          <Route path="/lancamentos" element={<EmBreve titulo="Lançamentos" fase="F2" />} />
          <Route path="/contas" element={<EmBreve titulo="Contas & Cartões" fase="F2" />} />
          <Route path="/orcamentos" element={<EmBreve titulo="Orçamentos" fase="F3" />} />
          <Route path="/membros" element={<PaginaMembros />} />
        </Routes>
      </main>
    </div>
  );
}

function Portao() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <div className="grid min-h-screen place-items-center text-ink2">Carregando…</div>;
  if (!usuario) return <PaginaLogin />; // após logar, o hash (#/convite/…) é preservado
  return (
    <WorkspaceProvider>
      <Routes>
        {/* aceite de convite ANTES do portão de onboarding: um convidado
            recém-chegado tem zero workspaces e precisa alcançar esta rota */}
        <Route path="/convite/:id" element={<PaginaAceitarConvite />} />
        <Route path="*" element={<PortaoWorkspace />} />
      </Routes>
    </WorkspaceProvider>
  );
}
function PortaoWorkspace() {
  const { carregando, workspaces } = useWorkspace();
  if (carregando) return <div className="grid min-h-screen place-items-center text-ink2">Abrindo workspace…</div>;
  if (workspaces.length === 0) return <CriarPrimeiroWorkspace />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Portao />
      </HashRouter>
    </AuthProvider>
  );
}
