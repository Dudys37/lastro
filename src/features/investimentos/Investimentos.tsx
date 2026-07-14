// ═══ LASTRO — Investimentos (F5) ═══
// Posições MANUAIS (v1 é lançamento manual por decisão de escopo): nome,
// classe, valor atual editável com carimbo de atualização, total e
// distribuição por classe reaproveitando o Donut da F4.
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Centavos } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, parseBRL, somar } from '../../lib/dinheiro';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';
import { Donut } from '../relatorios/Graficos';

export const CLASSES = {
  renda_fixa: '🏦 Renda fixa', acoes: '📈 Ações', fiis: '🏢 FIIs',
  exterior: '🌎 Exterior', cripto: '🪙 Cripto', outro: '📦 Outro',
} as const;
type Classe = keyof typeof CLASSES;

interface Posicao { id: string; nome: string; classe: Classe; valorAtual: Centavos; nota: string; atualizadoEm: number; }

async function listarPosicoes(ws: string): Promise<Posicao[]> {
  const s = await getDocs(collection(db, 'workspaces', ws, 'investimentos'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Posicao, 'id'>) }))
    .sort((a, b) => b.valorAtual - a.valorAtual);
}
async function criarPosicao(ws: string, p: Omit<Posicao, 'id' | 'atualizadoEm'>): Promise<void> {
  await setDoc(doc(collection(db, 'workspaces', ws, 'investimentos')), { ...p, atualizadoEm: Date.now() });
}
async function atualizarValor(ws: string, id: string, valorAtual: Centavos): Promise<void> {
  await updateDoc(doc(db, 'workspaces', ws, 'investimentos', id), { valorAtual, atualizadoEm: Date.now() });
}
async function excluirPosicao(ws: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', ws, 'investimentos', id));
}

export function PaginaInvestimentos() {
  const { ativo, papel } = useWorkspace();
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lanco = podeFazer(papel, 'lancar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try { setPosicoes(await listarPosicoes(ativo.id)); }
    catch { setErro('Não foi possível carregar. Se persistir, confira se as regras da F5 foram publicadas.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id]);

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try { await fn(); await carregar(); }
    catch { setErro('Ação não permitida ou falha de conexão (regras da F5 publicadas?).'); }
    finally { setOcupado(false); }
  }

  const total = somar(...posicoes.map((p) => p.valorAtual));
  const porClasse = useMemo(() => {
    const m: Record<string, Centavos> = {};
    for (const p of posicoes) m[p.classe] = (m[p.classe] ?? 0) + p.valorAtual;
    return Object.entries(m).map(([classe, valor]) => ({ rotulo: CLASSES[classe as Classe] ?? classe, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [posicoes]);

  if (!ativo) return null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h1 className="text-base font-bold">📊 Investimentos</h1>
        <div className="ml-auto text-right">
          <div className="text-[11px] font-bold uppercase text-ink3">Total investido</div>
          <div className="text-xl font-extrabold">{formatarBRL(total)}</div>
        </div>
      </Card>

      {lanco && <FormPosicao ocupado={ocupado} onCriar={(p) => void acao(() => criarPosicao(ativo.id, p))} />}

      {posicoes.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-xs font-bold text-ink2">Distribuição por classe</div>
          <Donut fatias={porClasse} />
        </Card>
      )}

      <Card>
        {posicoes.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-ink2">
            Nenhuma posição ainda. Cadastre CDBs, ações, FIIs — e atualize o valor quando quiser tirar a foto do patrimônio.
          </p>
        )}
        {posicoes.map((p) => (
          <LinhaPosicao key={p.id} p={p} lanco={lanco} ocupado={ocupado}
            onAtualizar={(v) => void acao(() => atualizarValor(ativo.id, p.id, v))}
            onExcluir={() => { if (confirm(`Excluir a posição "${p.nome}"?`)) void acao(() => excluirPosicao(ativo.id, p.id)); }} />
        ))}
      </Card>
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

function LinhaPosicao({ p, lanco, ocupado, onAtualizar, onExcluir }: {
  p: Posicao; lanco: boolean; ocupado: boolean;
  onAtualizar: (v: Centavos) => void; onExcluir: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const cent = parseBRL(texto);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{p.nome}</div>
        <div className="text-xs text-ink2">{CLASSES[p.classe] ?? p.classe}{p.nota && ` · ${p.nota}`}</div>
      </div>
      {!editando ? (
        <div className="text-right">
          <div className="text-sm font-extrabold">{formatarBRL(p.valorAtual)}</div>
          <div className="text-[10px] text-ink3">atualizado {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}</div>
        </div>
      ) : (
        <span className="flex items-center gap-2">
          <input autoFocus className="h-8 w-32 rounded-lg border border-line bg-card px-2 text-sm"
            value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="0,00"
            onKeyDown={(e) => { if (e.key === 'Enter' && cent !== null) { onAtualizar(cent); setEditando(false); } if (e.key === 'Escape') setEditando(false); }} />
          <Botao className="h-8 px-2.5 text-xs" disabled={ocupado || cent === null} onClick={() => { onAtualizar(cent!); setEditando(false); }}>OK</Botao>
        </span>
      )}
      {lanco && !editando && (
        <Botao variante="fantasma" className="h-8 px-2.5 text-xs"
          onClick={() => { setTexto(String(p.valorAtual / 100).replace('.', ',')); setEditando(true); }}>Atualizar</Botao>
      )}
      {lanco && <Botao variante="perigo" className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={onExcluir}>✕</Botao>}
    </div>
  );
}

function FormPosicao({ ocupado, onCriar }: { ocupado: boolean; onCriar: (p: { nome: string; classe: Classe; valorAtual: Centavos; nota: string }) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [classe, setClasse] = useState<Classe>('renda_fixa');
  const [valor, setValor] = useState('');
  const [nota, setNota] = useState('');
  const cent = parseBRL(valor);
  if (!aberto) return <div><Botao className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Nova posição</Botao></div>;
  return (
    <Card className="flex flex-wrap items-end gap-2 p-5">
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="CDB Banco X 110% CDI" className="h-9 w-52" />
      <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Classe</span>
        <select className="h-9 rounded-lg border border-line bg-card px-2 text-sm" value={classe} onChange={(e) => setClasse(e.target.value as Classe)}>
          {Object.entries(CLASSES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      <Campo rotulo="Valor atual" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="5.000,00" className="h-9 w-28"
        erro={valor && cent === null ? 'inválido' : undefined} />
      <Campo rotulo="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="vence 2028…" className="h-9 w-36" />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !nome.trim() || cent === null || cent < 0}
        onClick={() => { onCriar({ nome: nome.trim(), classe, valorAtual: cent!, nota: nota.trim() }); setAberto(false); setNome(''); setValor(''); setNota(''); }}>
        Salvar
      </Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </Card>
  );
}
