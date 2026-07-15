// ═══ LASTRO — Lançamentos (F2) ═══
// Navegação por mês, criação (receita/despesa/transferência, à vista ou
// parcelado) e lista com edição de descrição/categoria e exclusão
// (individual ou do grupo inteiro de parcelas).
import { useEffect, useMemo, useState } from 'react';
import type { Cartao, Conta, Lancamento, Recorrencia, TipoLancamento } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { dividirParcelas, formatarBRL, parseBRL } from '../../lib/dinheiro';
import { hojeISO, mesAnterior, mesDe, mesSeguinte, resumoLancamentos, rotuloMes } from '../../lib/lancamentos';
import { dataDaRecorrencia, pendentesDoMes } from '../../lib/recorrencias';
import { filtrarLancamentos, filtroAtivo, type FiltroLancamentos } from '../../lib/filtros';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';
import {
  Categoria, atualizarLancamento, criarLancamento, excluirGrupoParcelas, excluirLancamento,
  excluirRecorrencia, lancarRecorrencia, listarCartoes, listarCategorias, listarContas,
  listarLancamentosDoMes, listarRecorrencias, listarTodosLancamentos, salvarRecorrencia,
} from './repo';

export function PaginaLancamentos() {
  const { usuario } = useAuth();
  const { ativo, papel } = useWorkspace();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [recs, setRecs] = useState<Recorrencia[]>([]);
  const [filtro, setFiltro] = useState<FiltroLancamentos>({});
  const [historico, setHistorico] = useState<Lancamento[] | null>(null); // carregado ao ativar filtros
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lanco = podeFazer(papel, 'lancar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try {
      const [l, c1, c2, c3, r] = await Promise.all([
        listarLancamentosDoMes(ativo.id, mes), listarContas(ativo.id), listarCartoes(ativo.id),
        listarCategorias(ativo.id), listarRecorrencias(ativo.id),
      ]);
      setLancs(l); setContas(c1); setCartoes(c2); setCats(c3); setRecs(r);
    } catch { setErro('Não foi possível carregar os lançamentos.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id, mes]);

  const buscando = filtroAtivo(filtro);
  useEffect(() => {
    (async () => {
      if (!ativo || !buscando || historico !== null) return;
      try { setHistorico(await listarTodosLancamentos(ativo.id)); }
      catch { setErro('Não foi possível buscar no histórico.'); }
    })();
    // eslint-disable-next-line
  }, [ativo?.id, buscando]);

  const resultados = useMemo(
    () => (buscando ? filtrarLancamentos(historico ?? [], filtro) : lancs),
    [buscando, historico, filtro, lancs],
  );
  const resumo = useMemo(() => resumoLancamentos(resultados), [resultados]);
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—';
  const cat = (id: string | null) => cats.find((c) => c.id === id);

  if (!ativo) return null;

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try {
      await fn(); await carregar();
      if (historico !== null && ativo) setHistorico(await listarTodosLancamentos(ativo.id));
    }
    catch { setErro('Ação não permitida (papel insuficiente) ou falha de conexão.'); }
    finally { setOcupado(false); }
  }

  return (
    <div className="grid max-w-4xl gap-4">
      {/* navegação de mês (ou modo busca) + resumo */}
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        {buscando ? (
          <div className="flex items-center gap-2 text-sm font-bold">
            🔎 Busca no histórico completo
            <span className="rounded-full bg-card2 px-2 py-0.5 text-[11px] font-bold text-ink2">{resultados.length} resultado(s)</span>
          </div>
        ) : (
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesAnterior(mes))} aria-label="Mês anterior">‹</Botao>
          <div className="w-44 text-center text-sm font-bold capitalize">{rotuloMes(mes)}</div>
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesSeguinte(mes))} aria-label="Próximo mês">›</Botao>
        </div>
        )}
        <div className="ml-auto flex gap-5 text-right text-sm">
          <div><div className="text-[11px] font-bold uppercase text-ink3">Receitas</div><div className="font-extrabold text-pos">{formatarBRL(resumo.receitas)}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-ink3">Despesas</div><div className="font-extrabold text-neg">{formatarBRL(resumo.despesas)}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-ink3">Saldo do mês</div><div className={`font-extrabold ${resumo.saldo < 0 ? 'text-neg' : 'text-pos'}`}>{formatarBRL(resumo.saldo)}</div></div>
        </div>
      </Card>

      <BarraFiltros filtro={filtro} setFiltro={setFiltro} cats={cats} contas={contas} cartoes={cartoes} />

      {lanco && !buscando && (
        <FormLancamento contas={contas} cartoes={cartoes} cats={cats} ocupado={ocupado}
          onCriar={(n) => void acao(() => criarLancamento(ativo.id, usuario!.uid, n))} />
      )}

      {!buscando && <PainelRecorrencias recs={recs} lancs={lancs} mes={mes} contas={contas} cartoes={cartoes} cats={cats}
        lanco={lanco} ocupado={ocupado}
        onLancar={(r) => void acao(() => lancarRecorrencia(ativo.id, usuario!.uid, r, dataDaRecorrencia(r, mes)))}
        onLancarTodas={(pend) => void acao(async () => {
          for (const r of pend) await lancarRecorrencia(ativo.id, usuario!.uid, r, dataDaRecorrencia(r, mes));
        })}
        onSalvar={(r) => void acao(() => salvarRecorrencia(ativo.id, r))}
        onExcluir={(id) => void acao(() => excluirRecorrencia(ativo.id, id))} />}

      <Card>
        {resultados.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink3">
            {buscando ? (historico === null ? 'Buscando no histórico…' : 'Nada encontrado com esses filtros.') : `Nenhum lançamento em ${rotuloMes(mes)}.`}
          </p>
        )}
        {resultados.slice(0, 150).map((l) => (
          <LinhaLancamento key={l.id} l={l} cats={cats} lanco={lanco} ocupado={ocupado}
            legenda={
              l.tipo === 'transferencia'
                ? `${nomeConta(l.contaId)} → ${nomeConta(l.contaDestinoId)}`
                : l.cartaoId
                  ? `💳 ${cartoes.find((k) => k.id === l.cartaoId)?.nome ?? 'cartão'}`
                  : nomeConta(l.contaId)}
            icone={l.tipo === 'receita' ? '💰' : l.tipo === 'transferencia' ? '🔁' : l.tipo === 'pagamento' ? '💵' : cat(l.categoriaId)?.icone ?? '💸'}
            onSalvar={(campos) => void acao(() => atualizarLancamento(ativo.id, l.id, campos))}
            onExcluir={() => {
              if (l.parcelas && confirm(`Este lançamento é a parcela ${l.parcelas.numero}/${l.parcelas.total}.\n\nOK = excluir TODAS as ${l.parcelas.total} parcelas\nCancelar = não excluir nada`)) {
                void acao(() => excluirGrupoParcelas(ativo.id, l.parcelas!.grupoId));
              } else if (!l.parcelas && confirm('Excluir este lançamento?')) {
                void acao(() => excluirLancamento(ativo.id, l.id));
              }
            }} />
        ))}
        {buscando && resultados.length > 150 && (
          <p className="px-5 py-3 text-[11px] text-ink3">Mostrando os 150 mais recentes de {resultados.length} — refine os filtros.</p>
        )}
      </Card>
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

// ── Formulário de novo lançamento ────────────────────────────────────
function FormLancamento({ contas, cartoes, cats, ocupado, onCriar }: {
  contas: Conta[]; cartoes: Cartao[]; cats: Categoria[]; ocupado: boolean;
  onCriar: (n: import('./repo').NovoLancamento) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [categoriaId, setCategoriaId] = useState('');
  const [origem, setOrigem] = useState('');           // conta OU 'cartao:{id}'
  const [contaDestinoId, setContaDestinoId] = useState('');
  const [nParcelas, setNParcelas] = useState(1);

  const cent = parseBRL(valor);
  const catsDoTipo = cats.filter((c) => c.tipo === (tipo === 'receita' ? 'receita' : 'despesa'));
  const ehCartao = origem.startsWith('cartao:');
  const podeParcelar = tipo === 'despesa';
  const valido = cent !== null && cent > 0 && data
    && (tipo === 'transferencia'
      ? (origem && contaDestinoId && !ehCartao && origem !== contaDestinoId)
      : !!origem);

  const previewParcela = podeParcelar && nParcelas > 1 && cent ? dividirParcelas(cent, nParcelas)[0] : null;

  function submeter() {
    if (!valido || cent === null) return;
    onCriar({
      tipo, descricao: descricao.trim(), valorTotal: cent, dataPrimeira: data,
      categoriaId: tipo === 'transferencia' ? null : (categoriaId || null),
      contaId: ehCartao ? null : (origem || null),
      contaDestinoId: tipo === 'transferencia' ? contaDestinoId : null,
      cartaoId: ehCartao ? origem.slice(7) : null,
      nParcelas: podeParcelar ? nParcelas : 1,
    });
    setDescricao(''); setValor(''); setNParcelas(1);
  }

  const abas: { v: TipoLancamento; r: string }[] = [
    { v: 'despesa', r: '💸 Despesa' }, { v: 'receita', r: '💰 Receita' }, { v: 'transferencia', r: '🔁 Transferência' },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 inline-flex rounded-lg border border-line bg-card2 p-1">
        {abas.map((a) => (
          <button key={a.v} onClick={() => { setTipo(a.v); setOrigem(''); setNParcelas(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${tipo === a.v ? 'bg-brand text-white' : 'text-ink2 hover:text-ink'}`}>
            {a.r}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Mercado do mês…" className="h-10 w-52" />
        <Campo rotulo={nParcelas > 1 ? 'Valor TOTAL' : 'Valor'} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00"
          className="h-10 w-32" erro={valor && cent === null ? 'valor inválido' : undefined} />
        <Campo rotulo={nParcelas > 1 ? '1ª parcela' : 'Data'} type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-10 w-40" />

        {tipo !== 'transferencia' && (
          <Sel rotulo="Categoria" value={categoriaId} onChange={setCategoriaId}
            opcoes={[{ v: '', r: 'Sem categoria' }, ...catsDoTipo.map((c) => ({ v: c.id, r: `${c.icone} ${c.nome}` }))]} />
        )}
        <Sel rotulo={tipo === 'transferencia' ? 'De (origem)' : tipo === 'receita' ? 'Recebe em' : 'Paga com'} value={origem} onChange={setOrigem}
          opcoes={[
            { v: '', r: 'Selecione…' },
            ...contas.filter((c) => !c.arquivada).map((c) => ({ v: c.id, r: `🏦 ${c.nome}` })),
            ...(tipo === 'despesa' ? cartoes.filter((k) => !k.arquivado).map((k) => ({ v: `cartao:${k.id}`, r: `💳 ${k.nome}` })) : []),
          ]} />
        {tipo === 'transferencia' && (
          <Sel rotulo="Para (destino)" value={contaDestinoId} onChange={setContaDestinoId}
            opcoes={[{ v: '', r: 'Selecione…' }, ...contas.filter((c) => !c.arquivada && c.id !== origem).map((c) => ({ v: c.id, r: `🏦 ${c.nome}` }))]} />
        )}
        {podeParcelar && (
          <Campo rotulo="Parcelas (1 = à vista)" type="number" min={1} max={60} step={1}
            value={String(nParcelas)} className="h-10 w-28"
            onChange={(e) => setNParcelas(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))} />
        )}
        <Botao disabled={ocupado || !valido} onClick={submeter}>Lançar</Botao>
      </div>
      {previewParcela !== null && (
        <p className="mt-2 text-xs text-ink2">
          {nParcelas}× de ~{formatarBRL(previewParcela)} — a soma fecha EXATAMENTE {formatarBRL(cent!)} (o resto vai nas primeiras parcelas).
        </p>
      )}
    </Card>
  );
}

function Sel({ rotulo, value, onChange, opcoes }: {
  rotulo: string; value: string; onChange: (v: string) => void; opcoes: { v: string; r: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">{rotulo}</span>
      <select className="h-10 rounded-lg border border-line bg-card px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
      </select>
    </label>
  );
}

// ── Linha com edição inline (F7) ─────────────────────────────────────
function LinhaLancamento({ l, cats, lanco, ocupado, legenda, icone, onSalvar, onExcluir }: {
  l: Lancamento; cats: Categoria[]; lanco: boolean; ocupado: boolean; legenda: string; icone: string;
  onSalvar: (campos: { descricao?: string; valor?: number; data?: string; categoriaId?: string | null }) => void;
  onExcluir: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const cent = parseBRL(valor);
  const catsDoTipo = cats.filter((c) => c.tipo === (l.tipo === 'receita' ? 'receita' : 'despesa'));
  const cat = (id: string | null) => cats.find((c) => c.id === id);
  const editavel = lanco && (l.tipo === 'receita' || l.tipo === 'despesa'); // transf./pagamento: excluir e refazer

  if (editando) {
    return (
      <div className="flex flex-wrap items-end gap-2 border-b border-line bg-card2/40 px-5 py-3 last:border-0">
        <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-9 w-44" />
        <Campo rotulo="Valor" value={valor} onChange={(e) => setValor(e.target.value)} className="h-9 w-28"
          erro={valor && cent === null ? 'inválido' : undefined} />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 w-40" />
        <Sel rotulo="Categoria" value={categoriaId} onChange={setCategoriaId}
          opcoes={[{ v: '', r: 'Sem categoria' }, ...catsDoTipo.map((c) => ({ v: c.id, r: `${c.icone} ${c.nome}` }))]} />
        <Botao className="h-9 px-3 text-xs" disabled={ocupado || cent === null || !data}
          onClick={() => { onSalvar({ descricao: descricao.trim(), valor: cent!, data, categoriaId: categoriaId || null }); setEditando(false); }}>
          Salvar
        </Botao>
        <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setEditando(false)}>Cancelar</Botao>
        {l.parcelas && <p className="w-full text-[11px] text-ink3">Editando SÓ a parcela {l.parcelas.numero}/{l.parcelas.total} — as demais não mudam.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      <span className="text-lg" aria-hidden>{icone}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {l.descricao || (l.tipo === 'transferencia' ? 'Transferência' : cat(l.categoriaId)?.nome ?? 'Lançamento')}
          {l.parcelas && <span className="ml-2 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-ink2">{l.parcelas.numero}/{l.parcelas.total}</span>}
          {l.recorrenciaId && <span className="ml-2 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-ink2">🔁</span>}
        </div>
        <div className="truncate text-xs text-ink2">
          {new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')} · {legenda}
          {l.categoriaId && l.tipo !== 'transferencia' && ` · ${cat(l.categoriaId)?.nome ?? ''}`}
        </div>
      </div>
      <div className={`text-sm font-extrabold ${l.tipo === 'receita' ? 'text-pos' : l.tipo === 'despesa' ? 'text-neg' : 'text-ink2'}`}>
        {l.tipo === 'despesa' ? '−' : l.tipo === 'receita' ? '+' : ''}{formatarBRL(l.valor)}
      </div>
      {editavel && (
        <Botao variante="fantasma" className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={() => {
          setDescricao(l.descricao ?? ''); setValor(String(l.valor / 100).replace('.', ',')); setData(l.data); setCategoriaId(l.categoriaId ?? ''); setEditando(true);
        }}>✎</Botao>
      )}
      {lanco && <Botao variante="perigo" className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={onExcluir}>✕</Botao>}
    </div>
  );
}

// ── Painel de recorrências do mês (F7) ───────────────────────────────
function PainelRecorrencias({ recs, lancs, mes, contas, cartoes, cats, lanco, ocupado, onLancar, onLancarTodas, onSalvar, onExcluir }: {
  recs: Recorrencia[]; lancs: Lancamento[]; mes: string;
  contas: Conta[]; cartoes: Cartao[]; cats: Categoria[]; lanco: boolean; ocupado: boolean;
  onLancar: (r: Recorrencia) => void; onLancarTodas: (pend: Recorrencia[]) => void;
  onSalvar: (r: Omit<Recorrencia, 'id'> & { id?: string }) => void; onExcluir: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [gerindo, setGerindo] = useState(false);
  const pend = pendentesDoMes(recs, lancs, mes);
  if (recs.length === 0 && !lanco) return null;

  return (
    <Card>
      <button className="flex w-full items-center gap-2 px-5 py-3.5 text-left" onClick={() => setAberto(!aberto)}>
        <span className="text-sm font-bold">🔁 Recorrências</span>
        {pend.length > 0
          ? <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-bold text-warn">{pend.length} pendente(s) no mês</span>
          : recs.length > 0 && <span className="rounded-full bg-pos/10 px-2 py-0.5 text-[11px] font-bold text-pos">mês em dia ✓</span>}
        <span className="ml-auto text-ink3">{aberto ? '▴' : '▾'}</span>
      </button>
      {aberto && (
        <div className="border-t border-line">
          {recs.length === 0 && <p className="px-5 py-5 text-center text-xs text-ink3">Cadastre aluguel, salário, assinaturas — e lance o mês com um clique.</p>}
          {recs.map((r) => {
            const pendente = pend.some((p) => p.id === r.id);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-sm last:border-0">
                <span className={r.ativo ? '' : 'opacity-50'}>
                  {r.tipo === 'receita' ? '💰' : '💸'} <strong>{r.descricao}</strong>
                  <span className="ml-2 text-xs text-ink2">dia {r.diaDoMes} · {formatarBRL(r.valor)}
                    {r.cartaoId ? ` · 💳 ${cartoes.find((k) => k.id === r.cartaoId)?.nome ?? ''}` : r.contaId ? ` · ${contas.find((c) => c.id === r.contaId)?.nome ?? ''}` : ''}
                  </span>
                  {!r.ativo && <span className="ml-2 text-[10px] font-bold text-ink3">pausada</span>}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {lanco && r.ativo && (pendente
                    ? <Botao className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={() => onLancar(r)}>Lançar no mês</Botao>
                    : <span className="text-[11px] font-bold text-pos">lançada ✓</span>)}
                  {lanco && gerindo && (
                    <>
                      <Botao variante="fantasma" className="h-8 px-2.5 text-xs" disabled={ocupado}
                        onClick={() => onSalvar({ ...r, ativo: !r.ativo })}>{r.ativo ? 'Pausar' : 'Reativar'}</Botao>
                      <Botao variante="perigo" className="h-8 px-2.5 text-xs" disabled={ocupado}
                        onClick={() => { if (confirm(`Excluir a recorrência "${r.descricao}"? Lançamentos já feitos permanecem.`)) onExcluir(r.id); }}>✕</Botao>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {lanco && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
              {pend.length > 1 && <Botao className="h-9 px-3 text-xs" disabled={ocupado} onClick={() => onLancarTodas(pend)}>Lançar todas ({pend.length})</Botao>}
              <FormRecorrencia contas={contas} cartoes={cartoes} cats={cats} ocupado={ocupado} onSalvar={onSalvar} />
              <button className="ml-auto text-[11px] font-semibold text-ink3 hover:text-ink" onClick={() => setGerindo(!gerindo)}>
                {gerindo ? 'concluir gestão' : 'gerenciar'}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function FormRecorrencia({ contas, cartoes, cats, ocupado, onSalvar }: {
  contas: Conta[]; cartoes: Cartao[]; cats: Categoria[]; ocupado: boolean;
  onSalvar: (r: Omit<Recorrencia, 'id'>) => void;
}) {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('5');
  const [categoriaId, setCategoriaId] = useState('');
  const [origem, setOrigem] = useState('');
  const cent = parseBRL(valor);
  const ehCartao = origem.startsWith('cartao:');
  const catsDoTipo = cats.filter((c) => c.tipo === tipo);
  if (!aberto) return <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Nova recorrência</Botao>;
  return (
    <div className="flex w-full flex-wrap items-end gap-2 pt-1">
      <Sel rotulo="Tipo" value={tipo} onChange={(v) => { setTipo(v as 'receita' | 'despesa'); setOrigem(''); }}
        opcoes={[{ v: 'despesa', r: '💸 Despesa' }, { v: 'receita', r: '💰 Receita' }]} />
      <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Aluguel, Netflix…" className="h-9 w-40" />
      <Campo rotulo="Valor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="h-9 w-24"
        erro={valor && cent === null ? 'inválido' : undefined} />
      <Campo rotulo="Dia (1–28)" type="number" min={1} max={28} value={dia} onChange={(e) => setDia(e.target.value)} className="h-9 w-20" />
      <Sel rotulo="Categoria" value={categoriaId} onChange={setCategoriaId}
        opcoes={[{ v: '', r: 'Sem categoria' }, ...catsDoTipo.map((c) => ({ v: c.id, r: `${c.icone} ${c.nome}` }))]} />
      <Sel rotulo={tipo === 'receita' ? 'Recebe em' : 'Paga com'} value={origem} onChange={setOrigem}
        opcoes={[{ v: '', r: 'Selecione…' },
          ...contas.filter((c) => !c.arquivada).map((c) => ({ v: c.id, r: `🏦 ${c.nome}` })),
          ...(tipo === 'despesa' ? cartoes.filter((k) => !k.arquivado).map((k) => ({ v: `cartao:${k.id}`, r: `💳 ${k.nome}` })) : [])]} />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !descricao.trim() || cent === null || cent <= 0 || !origem}
        onClick={() => {
          onSalvar({ tipo, descricao: descricao.trim(), valor: cent!, diaDoMes: Math.min(28, Math.max(1, parseInt(dia) || 1)),
            categoriaId: categoriaId || null, contaId: ehCartao ? null : origem, cartaoId: ehCartao ? origem.slice(7) : null,
            ativo: true, criadoPor: usuario?.uid ?? '' });
          setAberto(false); setDescricao(''); setValor('');
        }}>Salvar</Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </div>
  );
}

// ── Barra de busca & filtros (F9) ────────────────────────────────────
function BarraFiltros({ filtro, setFiltro, cats, contas, cartoes }: {
  filtro: FiltroLancamentos; setFiltro: (f: FiltroLancamentos) => void;
  cats: Categoria[]; contas: Conta[]; cartoes: Cartao[];
}) {
  const ativo = filtroAtivo(filtro);
  return (
    <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="block min-w-40 flex-1">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">🔎 Buscar</span>
        <input className="h-10 w-full rounded-lg border border-line bg-card px-3 text-sm"
          value={filtro.busca ?? ''} onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
          placeholder="mercado, aluguel, uber… (ignora acentos)" />
      </label>
      <Sel rotulo="Tipo" value={filtro.tipo ?? ''} onChange={(v) => setFiltro({ ...filtro, tipo: v as FiltroLancamentos['tipo'] })}
        opcoes={[{ v: '', r: 'Todos' }, { v: 'despesa', r: '💸 Despesa' }, { v: 'receita', r: '💰 Receita' },
          { v: 'transferencia', r: '🔁 Transferência' }, { v: 'pagamento', r: '💵 Pagamento de fatura' }]} />
      <Sel rotulo="Categoria" value={filtro.categoriaId ?? ''} onChange={(v) => setFiltro({ ...filtro, categoriaId: v })}
        opcoes={[{ v: '', r: 'Todas' }, { v: '_sem', r: '📦 Sem categoria' },
          ...cats.map((c) => ({ v: c.id, r: `${c.icone} ${c.nome}` }))]} />
      <Sel rotulo="Conta / cartão" value={filtro.origem ?? ''} onChange={(v) => setFiltro({ ...filtro, origem: v })}
        opcoes={[{ v: '', r: 'Todos' },
          ...contas.map((c) => ({ v: c.id, r: `🏦 ${c.nome}` })),
          ...cartoes.map((k) => ({ v: `cartao:${k.id}`, r: `💳 ${k.nome}` }))]} />
      {ativo && (
        <Botao variante="fantasma" className="h-10 px-3 text-xs" onClick={() => setFiltro({})}>✕ Limpar filtros</Botao>
      )}
    </Card>
  );
}
