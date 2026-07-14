// ═══ LASTRO — Lançamentos (F2) ═══
// Navegação por mês, criação (receita/despesa/transferência, à vista ou
// parcelado) e lista com edição de descrição/categoria e exclusão
// (individual ou do grupo inteiro de parcelas).
import { useEffect, useMemo, useState } from 'react';
import type { Cartao, Conta, Lancamento, TipoLancamento } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { dividirParcelas, formatarBRL, parseBRL } from '../../lib/dinheiro';
import { hojeISO, mesAnterior, mesDe, mesSeguinte, resumoLancamentos, rotuloMes } from '../../lib/lancamentos';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';
import {
  Categoria, criarLancamento, excluirGrupoParcelas, excluirLancamento,
  listarCartoes, listarCategorias, listarContas, listarLancamentosDoMes,
} from './repo';

export function PaginaLancamentos() {
  const { usuario } = useAuth();
  const { ativo, papel } = useWorkspace();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lanco = podeFazer(papel, 'lancar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try {
      const [l, c1, c2, c3] = await Promise.all([
        listarLancamentosDoMes(ativo.id, mes), listarContas(ativo.id), listarCartoes(ativo.id), listarCategorias(ativo.id),
      ]);
      setLancs(l); setContas(c1); setCartoes(c2); setCats(c3);
    } catch { setErro('Não foi possível carregar os lançamentos.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id, mes]);

  const resumo = useMemo(() => resumoLancamentos(lancs), [lancs]);
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—';
  const cat = (id: string | null) => cats.find((c) => c.id === id);

  if (!ativo) return null;

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try { await fn(); await carregar(); }
    catch { setErro('Ação não permitida (papel insuficiente) ou falha de conexão.'); }
    finally { setOcupado(false); }
  }

  return (
    <div className="grid max-w-4xl gap-4">
      {/* navegação de mês + resumo */}
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesAnterior(mes))} aria-label="Mês anterior">‹</Botao>
          <div className="w-44 text-center text-sm font-bold capitalize">{rotuloMes(mes)}</div>
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMes(mesSeguinte(mes))} aria-label="Próximo mês">›</Botao>
        </div>
        <div className="ml-auto flex gap-5 text-right text-sm">
          <div><div className="text-[11px] font-bold uppercase text-ink3">Receitas</div><div className="font-extrabold text-pos">{formatarBRL(resumo.receitas)}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-ink3">Despesas</div><div className="font-extrabold text-neg">{formatarBRL(resumo.despesas)}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-ink3">Saldo do mês</div><div className={`font-extrabold ${resumo.saldo < 0 ? 'text-neg' : 'text-pos'}`}>{formatarBRL(resumo.saldo)}</div></div>
        </div>
      </Card>

      {lanco && (
        <FormLancamento contas={contas} cartoes={cartoes} cats={cats} ocupado={ocupado}
          onCriar={(n) => void acao(() => criarLancamento(ativo.id, usuario!.uid, n))} />
      )}

      <Card>
        {lancs.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink3">Nenhum lançamento em {rotuloMes(mes)}.</p>}
        {lancs.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
            <span className="text-lg" aria-hidden>
              {l.tipo === 'receita' ? '💰' : l.tipo === 'transferencia' ? '🔁' : cat(l.categoriaId)?.icone ?? '💸'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {l.descricao || (l.tipo === 'transferencia' ? 'Transferência' : cat(l.categoriaId)?.nome ?? 'Lançamento')}
                {l.parcelas && <span className="ml-2 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-ink2">{l.parcelas.numero}/{l.parcelas.total}</span>}
              </div>
              <div className="truncate text-xs text-ink2">
                {new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')} ·{' '}
                {l.tipo === 'transferencia'
                  ? `${nomeConta(l.contaId)} → ${nomeConta(l.contaDestinoId)}`
                  : l.cartaoId
                    ? `💳 ${cartoes.find((k) => k.id === l.cartaoId)?.nome ?? 'cartão'}`
                    : nomeConta(l.contaId)}
                {l.categoriaId && l.tipo !== 'transferencia' && ` · ${cat(l.categoriaId)?.nome ?? ''}`}
              </div>
            </div>
            <div className={`text-sm font-extrabold ${l.tipo === 'receita' ? 'text-pos' : l.tipo === 'despesa' ? 'text-neg' : 'text-ink2'}`}>
              {l.tipo === 'despesa' ? '−' : l.tipo === 'receita' ? '+' : ''}{formatarBRL(l.valor)}
            </div>
            {lanco && (
              <Botao variante="perigo" className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={() => {
                if (l.parcelas && confirm(`Este lançamento é a parcela ${l.parcelas.numero}/${l.parcelas.total}.\n\nOK = excluir TODAS as ${l.parcelas.total} parcelas\nCancelar = não excluir nada`)) {
                  void acao(() => excluirGrupoParcelas(ativo.id, l.parcelas!.grupoId));
                } else if (!l.parcelas && confirm('Excluir este lançamento?')) {
                  void acao(() => excluirLancamento(ativo.id, l.id));
                }
              }}>✕</Botao>
            )}
          </div>
        ))}
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
            ...contas.map((c) => ({ v: c.id, r: `🏦 ${c.nome}` })),
            ...(tipo === 'despesa' ? cartoes.map((k) => ({ v: `cartao:${k.id}`, r: `💳 ${k.nome}` })) : []),
          ]} />
        {tipo === 'transferencia' && (
          <Sel rotulo="Para (destino)" value={contaDestinoId} onChange={setContaDestinoId}
            opcoes={[{ v: '', r: 'Selecione…' }, ...contas.filter((c) => c.id !== origem).map((c) => ({ v: c.id, r: `🏦 ${c.nome}` }))]} />
        )}
        {podeParcelar && (
          <Sel rotulo="Parcelas" value={String(nParcelas)} onChange={(v) => setNParcelas(parseInt(v))}
            opcoes={[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => ({ v: String(n), r: n === 1 ? 'À vista' : `${n}×` }))} />
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
