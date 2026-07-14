// ═══ LASTRO — Relatórios (F4) ═══
// Período configurável (3/6/12 meses), fluxo mensal, evolução do saldo,
// despesas por categoria do mês e exportação CSV pt-BR.
import { useEffect, useMemo, useState } from 'react';
import type { Cartao, Conta, Lancamento } from '../../types/dominio';
import { formatarBRL } from '../../lib/dinheiro';
import { hojeISO, mesDe, rotuloMes } from '../../lib/lancamentos';
import { gerarCSV, serieFluxoMensal, serieSaldoConsolidado, topCategorias, ultimosMeses } from '../../lib/relatorios';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Cartao as Card } from '../../components/ui/Basicos';
import { Categoria, listarCartoes, listarCategorias, listarContas, listarTodosLancamentos } from '../financeiro/repo';
import { BarrasFluxo, Donut, LinhaSaldo } from './Graficos';

export function PaginaRelatorios() {
  const { ativo } = useWorkspace();
  const [nMeses, setNMeses] = useState(6);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      if (!ativo) return;
      setErro('');
      try {
        const [l, c1, c2, c3] = await Promise.all([
          listarTodosLancamentos(ativo.id), listarContas(ativo.id), listarCartoes(ativo.id), listarCategorias(ativo.id),
        ]);
        setLancs(l); setContas(c1); setCartoes(c2); setCats(c3);
      } catch { setErro('Não foi possível carregar os dados.'); }
    })();
  }, [ativo]);

  const mesAtual = mesDe(hojeISO());
  const meses = useMemo(() => ultimosMeses(nMeses, mesAtual), [nMeses, mesAtual]);
  const fluxo = useMemo(() => serieFluxoMensal(lancs, meses), [lancs, meses]);
  const saldo = useMemo(() => serieSaldoConsolidado(contas, lancs, meses), [contas, lancs, meses]);
  const top = useMemo(() => topCategorias(lancs, mesAtual), [lancs, mesAtual]);

  const nomeCat = (id: string | null) => id === '_sem' ? '📦 Sem categoria'
    : (cats.find((c) => c.id === id) ? `${cats.find((c) => c.id === id)!.icone} ${cats.find((c) => c.id === id)!.nome}` : '—');

  function exportar() {
    const noPeriodo = lancs.filter((l) => mesDe(l.data) >= meses[0] && mesDe(l.data) <= mesAtual)
      .sort((a, b) => a.data.localeCompare(b.data));
    const csv = gerarCSV(noPeriodo, {
      categoria: (id) => cats.find((c) => c.id === id)?.nome ?? '',
      conta: (id) => contas.find((c) => c.id === id)?.nome ?? '',
      cartao: (id) => cartoes.find((k) => k.id === id)?.nome ?? '',
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lastro-lancamentos-${meses[0]}_a_${mesAtual}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  if (!ativo) return null;

  return (
    <div className="grid max-w-4xl gap-4">
      <Card className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h1 className="text-base font-bold">📈 Relatórios</h1>
        <div className="ml-auto inline-flex rounded-lg border border-line bg-card2 p-1">
          {[3, 6, 12].map((n) => (
            <button key={n} onClick={() => setNMeses(n)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${nMeses === n ? 'bg-brand text-white' : 'text-ink2 hover:text-ink'}`}>
              {n} meses
            </button>
          ))}
        </div>
        <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={exportar} disabled={lancs.length === 0}>
          ⇩ Exportar CSV
        </Botao>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-4 text-xs font-bold text-ink2">
          <span>Fluxo mensal</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pos" /> receitas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neg" /> despesas</span>
        </div>
        <BarrasFluxo dados={fluxo} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 text-xs font-bold text-ink2">Evolução do saldo consolidado (fim de cada mês)</div>
        <LinhaSaldo dados={saldo} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 text-xs font-bold text-ink2">Despesas por categoria — <span className="capitalize">{rotuloMes(mesAtual)}</span></div>
        {top.length === 0
          ? <p className="py-6 text-center text-sm text-ink3">Sem despesas neste mês.</p>
          : <Donut fatias={top.slice(0, 6).map((t) => ({ rotulo: nomeCat(t.categoriaId), valor: t.total }))} />}
        {top.length > 6 && (
          <p className="mt-3 text-[11px] text-ink3">
            + {top.length - 6} categoria(s) menores somando {formatarBRL(top.slice(6).reduce((s, t) => s + t.total, 0))}
          </p>
        )}
      </Card>
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}
