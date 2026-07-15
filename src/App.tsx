// ═══ LASTRO — App shell e roteamento (F0) ═══
import { useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, PaginaLogin, useAuth } from './features/auth/Auth';
import { CriarPrimeiroWorkspace, WorkspaceProvider, useWorkspace } from './features/workspaces/Workspaces';
import { PaginaAceitarConvite, PaginaMembros } from './features/membros/Membros';
import { PaginaContasCartoes } from './features/financeiro/ContasCartoes';
import { PaginaLancamentos } from './features/financeiro/Lancamentos';
import { PaginaFaturas } from './features/financeiro/Faturas';
import { PaginaOrcamentos } from './features/financeiro/Orcamentos';
import { PaginaImportarOFX } from './features/financeiro/ImportarOFX';
import { PaginaRelatorios } from './features/relatorios/PaginaRelatorios';
import { PaginaMetas } from './features/metas/Metas';
import { PaginaInvestimentos } from './features/investimentos/Investimentos';
import { CentralInteligencia } from './features/inteligencia/Central';
import { listarCartoes } from './features/financeiro/repo';
import { itensDaFatura, mesFatura, pagamentosDaFatura } from './lib/faturas';
import { hojeISO, mesDe } from './lib/lancamentos';
import { serieFluxoMensal, ultimosMeses } from './lib/relatorios';
import { BarrasFluxo } from './features/relatorios/Graficos';
import type { Cartao as CartaoTipo } from './types/dominio';
import { listarContas, listarTodosLancamentos } from './features/financeiro/repo';
import { formatarBRL } from './lib/dinheiro';
import { saldoDaConta } from './lib/lancamentos';
import { useEffect } from 'react';
import type { Conta, Lancamento } from './types/dominio';
import { Botao, Cartao, Marca } from './components/ui/Basicos';
import { alternarTema, aplicarTema, temaAtual } from './lib/tema';

aplicarTema(temaAtual());

const MENU = [
  { rota: '/', rotulo: 'Visão Geral', icone: '📊' },
  { rota: '/lancamentos', rotulo: 'Lançamentos', icone: '💸' },
  { rota: '/contas', rotulo: 'Contas & Cartões', icone: '💳' },
  { rota: '/faturas', rotulo: 'Faturas', icone: '🧾' },
  { rota: '/orcamentos', rotulo: 'Orçamentos', icone: '🎯' },
  { rota: '/metas', rotulo: 'Metas', icone: '🏁' },
  { rota: '/investimentos', rotulo: 'Investimentos', icone: '📊' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: '📈' },
  { rota: '/importar', rotulo: 'Importar OFX', icone: '📥' },
  { rota: '/membros', rotulo: 'Membros', icone: '👥' },
];

function VisaoGeral() {
  const { ativo } = useWorkspace();
  const [contas, setContas] = useState<Conta[]>([]);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [cartoes, setCartoes] = useState<CartaoTipo[]>([]);
  useEffect(() => {
    (async () => {
      if (!ativo) return;
      try {
        const [c, l, k] = await Promise.all([listarContas(ativo.id), listarTodosLancamentos(ativo.id), listarCartoes(ativo.id)]);
        setContas(c); setLancs(l); setCartoes(k);
      } catch { /* leitor sem rede etc. — cards ficam zerados */ }
    })();
  }, [ativo]);
  const consolidado = contas.reduce((s, c) => s + saldoDaConta(c, lancs), 0);
  // fatura corrente (aberta hoje) somada de todos os cartões, descontando pagamentos
  const faturaAberta = cartoes.reduce((s, k) => {
    const mf = mesFatura(hojeISO(), k.diaFechamento);
    const tot = itensDaFatura(k, mf, lancs).reduce((a, i) => a + i.valor, 0);
    const pago = pagamentosDaFatura(k.id, mf, lancs).reduce((a, p) => a + p.valor, 0);
    return s + Math.max(0, tot - pago);
  }, 0);
  return (
    <div className="grid gap-4">
      <Cartao className="p-6">
        <h1 className="text-xl font-extrabold tracking-tight">Bem-vindo ao {ativo?.nome ?? 'Lastro'} ⚓</h1>
        <p className="mt-1 text-sm text-ink2">
          Lance receitas, despesas (à vista ou parceladas) e transferências em Lançamentos;
          gerencie contas, cartões e categorias em Contas & Cartões.
        </p>
      </Cartao>
      <CentralInteligencia contas={contas} cartoes={cartoes} lancs={lancs} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Cartao className="relative overflow-hidden p-5">
          <span className="absolute inset-x-0 top-0 h-1 bg-pos" aria-hidden />
          <div className="text-xs font-bold uppercase tracking-wide text-ink2">Saldo consolidado</div>
          <div className={`mt-2 text-2xl font-extrabold ${consolidado < 0 ? 'text-neg' : ''}`}>{formatarBRL(consolidado)}</div>
          <div className="mt-1 text-[11px] text-ink3">{contas.length} conta(s)</div>
        </Cartao>
        <Cartao className="relative overflow-hidden p-5">
          <span className="absolute inset-x-0 top-0 h-1 bg-warn" aria-hidden />
          <div className="text-xs font-bold uppercase tracking-wide text-ink2">Fatura em aberto</div>
          <div className="mt-2 text-2xl font-extrabold">{formatarBRL(faturaAberta)}</div>
          <div className="mt-1 text-[11px] text-ink3">{cartoes.length} cartão(ões) · ciclo atual</div>
        </Cartao>
        <Cartao className="relative overflow-hidden p-5">
          <span className="absolute inset-x-0 top-0 h-1 bg-info" aria-hidden />
          <div className="text-xs font-bold uppercase tracking-wide text-ink2">Orçamentos</div>
          <div className="mt-2 text-2xl font-extrabold">🎯</div>
          <div className="mt-1 text-[11px] text-ink3">defina tetos por categoria na aba Orçamentos</div>
        </Cartao>
      </div>
      <Cartao className="p-5">
        <div className="mb-3 flex items-center gap-4 text-xs font-bold text-ink2">
          <span>Fluxo dos últimos 6 meses</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pos" /> receitas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neg" /> despesas</span>
        </div>
        <BarrasFluxo dados={serieFluxoMensal(lancs, ultimosMeses(6, mesDe(hojeISO())))} />
      </Cartao>
    </div>
  );
}

function Shell() {
  const { usuario, sair } = useAuth();
  const { ativo, workspaces, trocar } = useWorkspace();
  const [tema, setTema] = useState(temaAtual());
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <div className="flex min-h-screen">
      {/* topbar mobile (F8): no celular a sidebar vira gaveta */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-card px-4 md:hidden">
        <button aria-label="Abrir menu" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-lg"
          onClick={() => setMenuAberto(true)}>☰</button>
        <Marca />
      </header>
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-hidden onClick={() => setMenuAberto(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-line bg-card p-4 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between px-1">
          <Marca />
          <button aria-label="Fechar menu" className="text-ink3 md:hidden" onClick={() => setMenuAberto(false)}>✕</button>
        </div>
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
            <NavLink key={m.rota} to={m.rota} end={m.rota === '/'} onClick={() => setMenuAberto(false)}
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
      <main className="flex-1 bg-bg p-4 pt-[4.5rem] md:p-8 md:pt-8">
        <Routes>
          <Route path="/" element={<VisaoGeral />} />
          <Route path="/lancamentos" element={<PaginaLancamentos />} />
          <Route path="/contas" element={<PaginaContasCartoes />} />
          <Route path="/faturas" element={<PaginaFaturas />} />
          <Route path="/orcamentos" element={<PaginaOrcamentos />} />
          <Route path="/metas" element={<PaginaMetas />} />
          <Route path="/investimentos" element={<PaginaInvestimentos />} />
          <Route path="/relatorios" element={<PaginaRelatorios />} />
          <Route path="/importar" element={<PaginaImportarOFX />} />
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
