// ═══ LASTRO — Metas (F5) ═══
// Metas com aportes registrados (array no doc — escala pessoal), progresso,
// prazo opcional e ritmo mensal necessário. Editor+ cria metas e aporta.
import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, parseBRL } from '../../lib/dinheiro';
import { hojeISO, mesDe } from '../../lib/lancamentos';
import { progressoMeta, ritmoMensal, type Aporte, type Meta } from '../../lib/metas';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';

// ── repositório ──────────────────────────────────────────────────────
export async function listarMetas(ws: string): Promise<Meta[]> {
  const s = await getDocs(collection(db, 'workspaces', ws, 'metas'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meta, 'id'>) }))
    .sort((a, b) => a.criadoEm - b.criadoEm);
}
async function criarMeta(ws: string, m: Omit<Meta, 'id' | 'aportes' | 'criadoEm'>): Promise<void> {
  await setDoc(doc(collection(db, 'workspaces', ws, 'metas')), { ...m, aportes: [], criadoEm: Date.now() });
}
async function excluirMeta(ws: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', ws, 'metas', id));
}
async function registrarAporte(ws: string, metaId: string, a: Aporte): Promise<void> {
  await updateDoc(doc(db, 'workspaces', ws, 'metas', metaId), { aportes: arrayUnion(a) });
}
async function removerAporte(ws: string, metaId: string, a: Aporte): Promise<void> {
  await updateDoc(doc(db, 'workspaces', ws, 'metas', metaId), { aportes: arrayRemove(a) });
}

// ── página ───────────────────────────────────────────────────────────
export function PaginaMetas() {
  const { usuario } = useAuth();
  const { ativo, papel } = useWorkspace();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lanco = podeFazer(papel, 'lancar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try { setMetas(await listarMetas(ativo.id)); }
    catch { setErro('Não foi possível carregar as metas.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id]);

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try { await fn(); await carregar(); }
    catch { setErro('Ação não permitida ou falha de conexão.'); }
    finally { setOcupado(false); }
  }

  if (!ativo) return null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h1 className="text-base font-bold">🏁 Metas</h1>
        {lanco && <FormMeta ocupado={ocupado} onCriar={(m) => void acao(() => criarMeta(ativo.id, m))} />}
      </Card>

      {metas.length === 0 && (
        <Card className="p-10 text-center text-sm text-ink2">
          Nenhuma meta ainda. Reserva de emergência, viagem, entrada do apartamento — dê um nome ao dinheiro e ele anda mais rápido.
        </Card>
      )}

      {metas.map((m) => (
        <CardMeta key={m.id} meta={m} lanco={lanco} ocupado={ocupado}
          onAporte={(a) => void acao(() => registrarAporte(ativo.id, m.id, a))}
          onRemoverAporte={(a) => void acao(() => removerAporte(ativo.id, m.id, a))}
          onExcluir={() => { if (confirm(`Excluir a meta "${m.nome}" e seu histórico de aportes?`)) void acao(() => excluirMeta(ativo.id, m.id)); }}
          uid={usuario?.uid ?? ''} />
      ))}
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

function CardMeta({ meta, lanco, ocupado, onAporte, onRemoverAporte, onExcluir, uid }: {
  meta: Meta; lanco: boolean; ocupado: boolean; uid: string;
  onAporte: (a: Aporte) => void; onRemoverAporte: (a: Aporte) => void; onExcluir: () => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const p = progressoMeta(meta);
  const r = ritmoMensal(meta, mesDe(hojeISO()));
  const aportes = [...(meta.aportes ?? [])].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Card>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl" aria-hidden>{meta.icone}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{meta.nome}
              {p.concluida && <span className="ml-2 rounded-full bg-pos/10 px-2 py-0.5 text-[10px] font-bold text-pos">Concluída ✓</span>}
              {r.tipo === 'atrasada' && <span className="ml-2 rounded-full bg-neg/10 px-2 py-0.5 text-[10px] font-bold text-neg">Prazo vencido</span>}
            </div>
            <div className="text-xs text-ink2">
              {formatarBRL(p.total)} de {formatarBRL(meta.valorAlvo)}
              {meta.prazo && ` · até ${meta.prazo.split('-').reverse().join('/')}`}
              {r.tipo === 'ok' && <span className="text-brand"> · {formatarBRL(r.porMes)}/mês por {r.meses} mês(es)</span>}
            </div>
          </div>
          <div className="text-right text-lg font-extrabold">{p.pct}%</div>
          {lanco && <Botao variante="fantasma" className="h-8 px-2.5 text-xs" onClick={() => setExpandida(!expandida)}>{expandida ? 'Fechar' : '+ Aporte'}</Botao>}
          {lanco && <Botao variante="perigo" className="h-8 px-2.5 text-xs" disabled={ocupado} onClick={onExcluir}>✕</Botao>}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-card2">
          <div className={`h-full rounded-full transition-all ${p.concluida ? 'bg-pos' : 'bg-brand'}`} style={{ width: `${Math.min(100, p.pct)}%` }} />
        </div>
      </div>

      {expandida && (
        <div className="border-t border-line bg-card2/40 px-5 py-4">
          <FormAporte ocupado={ocupado} uid={uid} onAporte={onAporte} />
          {aportes.length > 0 && (
            <div className="mt-3 grid gap-1">
              {aportes.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-xs text-ink2">
                  <span>{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR')}</span>
                  <span className="min-w-0 flex-1 truncate">{a.nota}</span>
                  <span className="font-bold text-pos">+{formatarBRL(a.valor)}</span>
                  <button className="text-neg" title="Remover aporte" disabled={ocupado} onClick={() => onRemoverAporte(a)}>✕</button>
                </div>
              ))}
              {aportes.length > 8 && <div className="text-[11px] text-ink3">+ {aportes.length - 8} aporte(s) anteriores</div>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function FormMeta({ ocupado, onCriar }: { ocupado: boolean; onCriar: (m: Omit<Meta, 'id' | 'aportes' | 'criadoEm'>) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [icone, setIcone] = useState('🏁');
  const [alvo, setAlvo] = useState('');
  const [prazo, setPrazo] = useState('');
  const cent = parseBRL(alvo);
  if (!aberto) return <Botao className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Nova meta</Botao>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Ícone" value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={4} className="h-9 w-16 text-center" />
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Reserva de emergência" className="h-9 w-48" />
      <Campo rotulo="Valor alvo" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="10.000,00" className="h-9 w-28"
        erro={alvo && cent === null ? 'inválido' : undefined} />
      <Campo rotulo="Prazo (opcional)" type="month" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-9 w-36" />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !nome.trim() || cent === null || cent <= 0}
        onClick={() => { onCriar({ nome: nome.trim(), icone: icone || '🏁', valorAlvo: cent!, prazo: prazo || null }); setAberto(false); setNome(''); setAlvo(''); setPrazo(''); }}>
        Criar
      </Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </div>
  );
}

function FormAporte({ ocupado, uid, onAporte }: { ocupado: boolean; uid: string; onAporte: (a: Aporte) => void }) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [nota, setNota] = useState('');
  const cent = parseBRL(valor);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Valor do aporte" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500,00" className="h-9 w-28"
        erro={valor && cent === null ? 'inválido' : undefined} />
      <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 w-40" />
      <Campo rotulo="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="13º, bônus…" className="h-9 w-40" />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || cent === null || cent <= 0 || !data}
        onClick={() => {
          onAporte({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, data, valor: cent!, nota: nota.trim(), criadoPor: uid });
          setValor(''); setNota('');
        }}>
        Aportar
      </Botao>
      <p className="w-full text-[11px] text-ink3">Dica: se o dinheiro sai de uma conta, registre também a transferência/despesa em Lançamentos — a meta acompanha o compromisso, a conta acompanha o caixa.</p>
    </div>
  );
}
