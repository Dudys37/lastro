// ═══ LASTRO — Orçamentos (F3) ═══
// Teto mensal por categoria de despesa, barra de consumo (competência da
// compra — cartão incluído) e cópia do mês anterior.
import { useEffect, useMemo, useState } from 'react';
import type { Lancamento } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, parseBRL, somar } from '../../lib/dinheiro';
import { hojeISO, mesAnterior, mesDe, mesSeguinte, rotuloMes } from '../../lib/lancamentos';
import { consumoPorCategoria } from '../../lib/faturas';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Cartao as Card } from '../../components/ui/Basicos';
import { Categoria, copiarOrcamento, listarCategorias, listarLancamentosDoMes, obterOrcamento, salvarTetoCategoria } from './repo';

export function PaginaOrcamentos() {
  const { ativo, papel } = useWorkspace();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [cats, setCats] = useState<Categoria[]>([]);
  const [tetos, setTetos] = useState<Record<string, number>>({});
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const configuro = podeFazer(papel, 'configurar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try {
      const [c, t, l] = await Promise.all([
        listarCategorias(ativo.id), obterOrcamento(ativo.id, mes), listarLancamentosDoMes(ativo.id, mes),
      ]);
      setCats(c.filter((x) => x.tipo === 'despesa')); setTetos(t); setLancs(l);
    } catch { setErro('Não foi possível carregar os orçamentos.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id, mes]);

  const consumo = useMemo(() => consumoPorCategoria(lancs, mes), [lancs, mes]);
  const comTeto = cats.filter((c) => (tetos[c.id] ?? 0) > 0);
  const totalTeto = somar(...comTeto.map((c) => tetos[c.id]));
  const totalGasto = somar(...comTeto.map((c) => consumo[c.id] ?? 0));
  const pctGeral = totalTeto > 0 ? Math.round((totalGasto / totalTeto) * 100) : 0;

  if (!ativo) return null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesAnterior(mes))} aria-label="Mês anterior">‹</Botao>
          <div className="w-44 text-center text-sm font-bold capitalize">{rotuloMes(mes)}</div>
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesSeguinte(mes))} aria-label="Próximo mês">›</Botao>
        </div>
        {comTeto.length > 0 && (
          <div className="ml-auto text-right">
            <div className="text-[11px] font-bold uppercase text-ink3">Orçado × gasto</div>
            <div className="text-sm font-extrabold">
              {formatarBRL(totalGasto)} <span className="text-ink3">/ {formatarBRL(totalTeto)}</span>
              <span className={`ml-2 ${pctGeral >= 100 ? 'text-neg' : pctGeral >= 80 ? 'text-warn' : 'text-pos'}`}>{pctGeral}%</span>
            </div>
          </div>
        )}
        {configuro && (
          <Botao variante="fantasma" className="h-9 px-3 text-xs" disabled={ocupado} onClick={async () => {
            setOcupado(true); setErro('');
            try {
              const n = await copiarOrcamento(ativo.id, mesAnterior(mes), mes);
              if (n === 0) setErro('O mês anterior não tem tetos para copiar.');
              await carregar();
            } catch { setErro('Não foi possível copiar.'); }
            finally { setOcupado(false); }
          }}>⎘ Copiar do mês anterior</Botao>
        )}
      </Card>

      <Card>
        {cats.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink3">Sem categorias de despesa — visite Contas & Cartões para semear as padrão.</p>}
        {cats.map((c) => (
          <LinhaOrcamento key={c.id} cat={c} teto={tetos[c.id] ?? 0} gasto={consumo[c.id] ?? 0}
            editavel={configuro} ocupado={ocupado}
            onSalvar={async (novo) => {
              setOcupado(true); setErro('');
              try { await salvarTetoCategoria(ativo.id, mes, c.id, novo); await carregar(); }
              catch { setErro('Não foi possível salvar o teto.'); }
              finally { setOcupado(false); }
            }} />
        ))}
        {(consumo['_sem'] ?? 0) > 0 && (
          <div className="flex items-center gap-3 border-t border-line px-5 py-3 text-xs text-ink2">
            <span>📦 Sem categoria</span>
            <span className="ml-auto font-bold">{formatarBRL(consumo['_sem'])}</span>
            <span className="text-ink3">— categorize os lançamentos para orçá-los</span>
          </div>
        )}
      </Card>
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

function LinhaOrcamento({ cat, teto, gasto, editavel, ocupado, onSalvar }: {
  cat: Categoria; teto: number; gasto: number; editavel: boolean; ocupado: boolean;
  onSalvar: (novoTeto: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const pct = teto > 0 ? Math.min(100, Math.round((gasto / teto) * 100)) : 0;
  const estourou = teto > 0 && gasto > teto;
  const cent = parseBRL(texto || '0');

  return (
    <div className="border-b border-line px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{cat.icone} {cat.nome}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm">
            <strong className={estourou ? 'text-neg' : ''}>{formatarBRL(gasto)}</strong>
            <span className="text-ink3"> / {teto > 0 ? formatarBRL(teto) : 'sem teto'}</span>
          </span>
          {editavel && !editando && (
            <Botao variante="fantasma" className="h-8 px-2.5 text-xs" onClick={() => { setTexto(teto ? String(teto / 100).replace('.', ',') : ''); setEditando(true); }}>
              {teto > 0 ? 'Editar' : 'Definir teto'}
            </Botao>
          )}
          {editavel && editando && (
            <span className="flex items-center gap-2">
              <input autoFocus className="h-8 w-28 rounded-lg border border-line bg-card px-2 text-sm"
                value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="0,00"
                onKeyDown={(e) => { if (e.key === 'Enter' && cent !== null) { onSalvar(cent); setEditando(false); } if (e.key === 'Escape') setEditando(false); }} />
              <Botao className="h-8 px-2.5 text-xs" disabled={ocupado || cent === null}
                onClick={() => { onSalvar(cent!); setEditando(false); }}>OK</Botao>
            </span>
          )}
        </div>
      </div>
      {teto > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card2">
          <div className={`h-full rounded-full ${estourou ? 'bg-neg' : pct >= 80 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {estourou && <div className="mt-1 text-[11px] font-bold text-neg">estourado em {formatarBRL(gasto - teto)}</div>}
    </div>
  );
}
