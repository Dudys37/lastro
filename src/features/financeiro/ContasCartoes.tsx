// ═══ LASTRO — Contas & Cartões (F2) ═══
import { useEffect, useState } from 'react';
import type { Cartao, Conta } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, parseBRL } from '../../lib/dinheiro';
import { gastoNoCartaoNoMes, hojeISO, mesDe, saldoDaConta } from '../../lib/lancamentos';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';
import {
  Categoria, CATEGORIAS_PADRAO, excluirCartao, excluirCategoria, excluirConta,
  listarCartoes, listarCategorias, listarContas, listarTodosLancamentos,
  salvarCartao, salvarCategoria, salvarConta, semearCategoriasPadrao,
} from './repo';
import type { Lancamento } from '../../types/dominio';

const TIPOS_CONTA = { corrente: '🏦 Corrente', poupanca: '🐷 Poupança', dinheiro: '💵 Dinheiro', investimento: '📈 Investimento' } as const;

export function PaginaContasCartoes() {
  const { ativo, papel } = useWorkspace();
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const configuro = podeFazer(papel, 'configurar');

  async function carregar() {
    if (!ativo) return;
    setErro('');
    try {
      if (configuro) await semearCategoriasPadrao(ativo.id);
      const [c1, c2, c3, c4] = await Promise.all([
        listarContas(ativo.id), listarCartoes(ativo.id), listarCategorias(ativo.id), listarTodosLancamentos(ativo.id),
      ]);
      setContas(c1); setCartoes(c2); setCats(c3); setLancs(c4);
    } catch { setErro('Não foi possível carregar. Verifique a conexão.'); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [ativo?.id, configuro]);

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('');
    try { await fn(); await carregar(); }
    catch { setErro('Ação não permitida (papel insuficiente) ou falha de conexão.'); }
    finally { setOcupado(false); }
  }

  if (!ativo) return null;
  const mesAtual = mesDe(hojeISO());

  return (
    <div className="grid max-w-4xl gap-4">
      {/* ── Contas ── */}
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h1 className="text-base font-bold">🏦 Contas</h1>
          {configuro && <FormConta onSalvar={(c) => void acao(() => salvarConta(ativo.id, c))} ocupado={ocupado} />}
        </div>
        {contas.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink3">Nenhuma conta ainda — crie a primeira acima.</p>}
        {contas.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{c.nome}</div>
              <div className="text-xs text-ink2">{TIPOS_CONTA[c.tipo]}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-extrabold ${saldoDaConta(c, lancs) < 0 ? 'text-neg' : 'text-pos'}`}>
                {formatarBRL(saldoDaConta(c, lancs))}
              </div>
              <div className="text-[11px] text-ink3">inicial {formatarBRL(c.saldoInicial)}</div>
            </div>
            {configuro && (
              <Botao variante="perigo" className="h-8 px-3 text-xs" disabled={ocupado}
                onClick={() => { if (confirm(`Excluir a conta "${c.nome}"? Os lançamentos dela permanecem no histórico.`)) void acao(() => excluirConta(ativo.id, c.id)); }}>
                Excluir
              </Botao>
            )}
          </div>
        ))}
      </Card>

      {/* ── Cartões ── */}
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">💳 Cartões de crédito</h2>
          {configuro && <FormCartao onSalvar={(c) => void acao(() => salvarCartao(ativo.id, c))} ocupado={ocupado} />}
        </div>
        {cartoes.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink3">Nenhum cartão ainda.</p>}
        {cartoes.map((k) => {
          const gasto = gastoNoCartaoNoMes(k.id, mesAtual, lancs);
          const pct = k.limite > 0 ? Math.min(100, Math.round((gasto / k.limite) * 100)) : 0;
          return (
            <div key={k.id} className="border-b border-line px-5 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{k.nome} <span className="text-xs font-normal text-ink3">{k.bandeira}</span></div>
                  <div className="text-xs text-ink2">fecha dia {k.diaFechamento} · vence dia {k.diaVencimento}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold">{formatarBRL(gasto)} <span className="text-xs font-normal text-ink3">/ {formatarBRL(k.limite)}</span></div>
                  <div className="text-[11px] text-ink3">gasto no mês (fatura por ciclo chega na F3)</div>
                </div>
                {configuro && (
                  <Botao variante="perigo" className="h-8 px-3 text-xs" disabled={ocupado}
                    onClick={() => { if (confirm(`Excluir o cartão "${k.nome}"?`)) void acao(() => excluirCartao(ativo.id, k.id)); }}>
                    Excluir
                  </Botao>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card2">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-neg' : pct >= 70 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── Categorias ── */}
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">🏷️ Categorias</h2>
          {configuro && <FormCategoria onSalvar={(c) => void acao(() => salvarCategoria(ativo.id, c))} ocupado={ocupado} proximaOrdem={cats.length + 1} />}
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {cats.map((c) => (
            <span key={c.id} className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-card2 px-3 py-1.5 text-xs font-semibold">
              {c.icone} {c.nome}
              <span className={`text-[10px] ${c.tipo === 'receita' ? 'text-pos' : 'text-ink3'}`}>{c.tipo === 'receita' ? '↑' : '↓'}</span>
              {configuro && (
                <button className="ml-1 hidden text-neg group-hover:inline" title="Excluir categoria" disabled={ocupado}
                  onClick={() => { if (confirm(`Excluir "${c.nome}"? Lançamentos existentes ficam sem categoria.`)) void acao(() => excluirCategoria(ativo.id, c.id)); }}>✕</button>
              )}
            </span>
          ))}
          {cats.length === 0 && <span className="text-sm text-ink3">As categorias padrão ({CATEGORIAS_PADRAO.length}) serão criadas quando um admin abrir esta página.</span>}
        </div>
      </Card>
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

// ── Formulários compactos (expandem inline) ─────────────────────────
function FormConta({ onSalvar, ocupado }: { onSalvar: (c: Omit<Conta, 'id'>) => void; ocupado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Conta['tipo']>('corrente');
  const [saldo, setSaldo] = useState('');
  if (!aberto) return <Botao className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Nova conta</Botao>;
  const cent = parseBRL(saldo || '0');
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nubank, Carteira…" className="h-9 w-40" />
      <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Tipo</span>
        <select className="h-9 rounded-lg border border-line bg-card px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as Conta['tipo'])}>
          {Object.entries(TIPOS_CONTA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      <Campo rotulo="Saldo inicial" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" className="h-9 w-28" erro={saldo && cent === null ? 'valor inválido' : undefined} />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !nome.trim() || cent === null}
        onClick={() => { onSalvar({ nome: nome.trim(), tipo, saldoInicial: cent ?? 0, arquivada: false }); setAberto(false); setNome(''); setSaldo(''); }}>Salvar</Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </div>
  );
}

function FormCartao({ onSalvar, ocupado }: { onSalvar: (c: Omit<Cartao, 'id'>) => void; ocupado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [bandeira, setBandeira] = useState('Visa');
  const [limite, setLimite] = useState('');
  const [fecha, setFecha] = useState('10');
  const [vence, setVence] = useState('17');
  if (!aberto) return <Botao className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Novo cartão</Botao>;
  const cent = parseBRL(limite || '0');
  const dia = (v: string) => Math.min(28, Math.max(1, parseInt(v) || 1));
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nubank Ultravioleta" className="h-9 w-44" />
      <Campo rotulo="Bandeira" value={bandeira} onChange={(e) => setBandeira(e.target.value)} className="h-9 w-24" />
      <Campo rotulo="Limite" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="5.000,00" className="h-9 w-28" erro={limite && cent === null ? 'inválido' : undefined} />
      <Campo rotulo="Fecha dia" type="number" min={1} max={28} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 w-20" />
      <Campo rotulo="Vence dia" type="number" min={1} max={28} value={vence} onChange={(e) => setVence(e.target.value)} className="h-9 w-20" />
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !nome.trim() || cent === null}
        onClick={() => { onSalvar({ nome: nome.trim(), bandeira: bandeira.trim(), limite: cent ?? 0, diaFechamento: dia(fecha), diaVencimento: dia(vence), arquivado: false }); setAberto(false); setNome(''); setLimite(''); }}>Salvar</Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </div>
  );
}

function FormCategoria({ onSalvar, ocupado, proximaOrdem }: { onSalvar: (c: Omit<Categoria, 'id'>) => void; ocupado: boolean; proximaOrdem: number }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [icone, setIcone] = useState('🏷️');
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  if (!aberto) return <Botao className="h-9 px-3 text-xs" onClick={() => setAberto(true)}>+ Nova categoria</Botao>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Ícone" value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={4} className="h-9 w-16 text-center" />
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pets, Doações…" className="h-9 w-36" />
      <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Tipo</span>
        <select className="h-9 rounded-lg border border-line bg-card px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as 'despesa' | 'receita')}>
          <option value="despesa">↓ Despesa</option><option value="receita">↑ Receita</option>
        </select>
      </label>
      <Botao className="h-9 px-3 text-xs" disabled={ocupado || !nome.trim()}
        onClick={() => { onSalvar({ nome: nome.trim(), icone: icone || '🏷️', tipo, ordem: proximaOrdem }); setAberto(false); setNome(''); }}>Salvar</Botao>
      <Botao variante="fantasma" className="h-9 px-3 text-xs" onClick={() => setAberto(false)}>Cancelar</Botao>
    </div>
  );
}
