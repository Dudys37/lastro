// ═══ LASTRO — Importar OFX (F10) ═══
// Fluxo: arquivo → destino (conta ou cartão) → preview com dedup por FITID →
// importar selecionadas. Reimportar o mesmo arquivo é seguro: duplicadas
// aparecem travadas como "já importada".
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Cartao, Conta, Lancamento } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, somar } from '../../lib/dinheiro';
import { chaveImport, decodificarOFX, parseOFX, type ResultadoOFX } from '../../lib/ofx';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Cartao as Card } from '../../components/ui/Basicos';
import { importarLancamentos, listarCartoes, listarContas, listarTodosLancamentos, type ItemImportacao } from './repo';

export function PaginaImportarOFX() {
  const { usuario } = useAuth();
  const { ativo, papel } = useWorkspace();
  const nav = useNavigate();
  const lanco = podeFazer(papel, 'lancar');

  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [ofx, setOfx] = useState<ResultadoOFX | null>(null);
  const [destino, setDestino] = useState('');           // contaId ou 'cartao:{id}'
  const [inverter, setInverter] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [fase, setFase] = useState<'inicio' | 'preview' | 'importando' | 'feito'>('inicio');
  const [resultado, setResultado] = useState(0);

  useEffect(() => {
    (async () => {
      if (!ativo) return;
      try {
        const [c, k, todos] = await Promise.all([
          listarContas(ativo.id), listarCartoes(ativo.id), listarTodosLancamentos(ativo.id),
        ]);
        setContas(c); setCartoes(k);
        setExistentes(new Set(todos.map((l: Lancamento) => l.importId).filter(Boolean) as string[]));
      } catch { setErro('Não foi possível carregar contas e histórico.'); }
    })();
  }, [ativo]);

  const ehCartao = destino.startsWith('cartao:');
  const chaveDestino = ehCartao ? `cartao:${destino.slice(7)}` : `conta:${destino}`;

  const linhas = useMemo(() => {
    if (!ofx || !destino) return [];
    return ofx.transacoes.map((t) => {
      const valor = inverter ? -t.valor : t.valor;
      const chave = chaveImport(chaveDestino, t.fitid);
      return {
        ...t,
        chave,
        tipoFinal: (valor >= 0 ? 'receita' : 'despesa') as 'receita' | 'despesa',
        valorAbs: Math.abs(valor),
        duplicada: existentes.has(chave),
      };
    });
  }, [ofx, destino, inverter, existentes, chaveDestino]);

  // pré-marca tudo que não é duplicado sempre que o conjunto muda
  useEffect(() => {
    setMarcadas(new Set(linhas.filter((l) => !l.duplicada).map((l) => l.chave)));
  }, [linhas]);

  const selecionadas = linhas.filter((l) => marcadas.has(l.chave) && !l.duplicada);
  const totalSel = somar(...selecionadas.map((l) => (l.tipoFinal === 'despesa' ? -l.valorAbs : l.valorAbs)));

  async function aoEscolherArquivo(f: File) {
    setErro(''); setNomeArquivo(f.name);
    try {
      const texto = decodificarOFX(await f.arrayBuffer());
      const r = parseOFX(texto);
      if (r.transacoes.length === 0) { setErro('Nenhuma transação reconhecida — o arquivo é OFX mesmo?'); return; }
      setOfx(r); setFase('preview');
      // palpite de destino pelo tipo do arquivo
      if (r.origem === 'cartao' && cartoes[0]) setDestino(`cartao:${cartoes[0].id}`);
      else if (r.origem === 'banco' && contas[0]) setDestino(contas[0].id);
    } catch { setErro('Não foi possível ler o arquivo.'); }
  }

  async function importar() {
    if (!ativo || !usuario || selecionadas.length === 0) return;
    setFase('importando'); setErro('');
    try {
      const itens: ItemImportacao[] = selecionadas.map((l) => ({
        tipo: l.tipoFinal, descricao: l.memo, valor: l.valorAbs, data: l.data,
        contaId: ehCartao ? null : destino, cartaoId: ehCartao ? destino.slice(7) : null,
        importId: l.chave,
      }));
      const n = await importarLancamentos(ativo.id, usuario.uid, itens);
      setResultado(n); setFase('feito');
    } catch { setErro('Falha ao importar — nada parcial foi perdido além do lote atual; reimporte com segurança (dedup).'); setFase('preview'); }
  }

  if (!ativo) return null;
  if (!lanco) return <Card className="max-w-2xl p-8 text-center text-sm text-ink2">Seu papel atual (leitor) não permite importar lançamentos.</Card>;

  return (
    <div className="grid max-w-4xl gap-4">
      <Card className="px-5 py-4">
        <h1 className="text-base font-bold">📥 Importar extrato OFX</h1>
        <p className="mt-0.5 text-xs text-ink2">
          Exporte o extrato da conta ou a fatura do cartão no seu banco em formato OFX e traga tudo para cá.
          Reimportar o mesmo arquivo é seguro — transações já importadas são detectadas e puladas.
        </p>
      </Card>

      {fase === 'inicio' && (
        <Card className="p-8 text-center">
          <label className="inline-flex cursor-pointer flex-col items-center gap-3">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-3xl">📄</span>
            <span className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white">Escolher arquivo .ofx</span>
            <input type="file" accept=".ofx,.OFX,application/x-ofx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void aoEscolherArquivo(f); }} />
            <span className="text-xs text-ink3">O arquivo é lido AQUI no seu navegador — não sobe para lugar nenhum antes do preview.</span>
          </label>
        </Card>
      )}

      {(fase === 'preview' || fase === 'importando') && ofx && (
        <>
          <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
            <div className="text-xs text-ink2">
              <div className="font-bold text-ink">{nomeArquivo}</div>
              {ofx.transacoes.length} transação(ões) · origem: {ofx.origem === 'cartao' ? '💳 fatura de cartão' : ofx.origem === 'banco' ? '🏦 extrato bancário' : 'desconhecida'}
              {ofx.ignoradas > 0 && <span className="text-warn"> · {ofx.ignoradas} bloco(s) ilegível(is) ignorado(s)</span>}
            </div>
            <label className="ml-auto block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Lançar em</span>
              <select className="h-10 rounded-lg border border-line bg-card px-2 text-sm" value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Selecione o destino…</option>
                {contas.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>🏦 {c.nome}</option>)}
                {cartoes.filter((k) => !k.arquivado).map((k) => <option key={k.id} value={`cartao:${k.id}`}>💳 {k.nome}</option>)}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 text-xs font-semibold text-ink2">
              <input type="checkbox" checked={inverter} onChange={(e) => setInverter(e.target.checked)} />
              Inverter sinais
            </label>
            <Botao variante="fantasma" className="h-10 px-3 text-xs" onClick={() => { setOfx(null); setDestino(''); setFase('inicio'); }}>Trocar arquivo</Botao>
          </Card>

          {destino && (
            <Card>
              <div className="flex items-center gap-3 border-b border-line px-5 py-3 text-xs font-bold text-ink2">
                <input type="checkbox" aria-label="Marcar todas"
                  checked={selecionadas.length > 0 && selecionadas.length === linhas.filter((l) => !l.duplicada).length}
                  onChange={(e) => setMarcadas(e.target.checked ? new Set(linhas.filter((l) => !l.duplicada).map((l) => l.chave)) : new Set())} />
                <span className="flex-1">Transação</span>
                <span>Valor</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {linhas.map((l) => (
                  <div key={l.chave} className={`flex items-center gap-3 border-b border-line px-5 py-2.5 text-sm last:border-0 ${l.duplicada ? 'opacity-45' : ''}`}>
                    <input type="checkbox" disabled={l.duplicada} checked={marcadas.has(l.chave) && !l.duplicada}
                      onChange={(e) => { const m = new Set(marcadas); e.target.checked ? m.add(l.chave) : m.delete(l.chave); setMarcadas(m); }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{l.memo || '(sem descrição)'}
                        {l.duplicada && <span className="ml-2 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-ink3">já importada</span>}
                      </div>
                      <div className="text-xs text-ink3">{new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className={`font-bold ${l.tipoFinal === 'receita' ? 'text-pos' : 'text-neg'}`}>
                      {l.tipoFinal === 'despesa' ? '−' : '+'}{formatarBRL(l.valorAbs)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
                <span className="text-xs text-ink2">
                  <strong>{selecionadas.length}</strong> selecionada(s) · saldo do lote: <strong className={totalSel < 0 ? 'text-neg' : 'text-pos'}>{formatarBRL(totalSel)}</strong>
                </span>
                <Botao className="ml-auto" disabled={fase === 'importando' || selecionadas.length === 0} onClick={() => void importar()}>
                  {fase === 'importando' ? 'Importando…' : `Importar ${selecionadas.length} lançamento(s)`}
                </Botao>
              </div>
            </Card>
          )}
        </>
      )}

      {fase === 'feito' && (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-pos/10 text-2xl">✅</div>
          <h2 className="text-lg font-bold">{resultado} lançamento(s) importado(s)</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink2">
            Eles chegaram <strong>sem categoria</strong> — use a busca "📦 Sem categoria" em Lançamentos para classificar em minutos.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Botao onClick={() => nav('/lancamentos')}>Ver lançamentos</Botao>
            <Botao variante="fantasma" onClick={() => { setOfx(null); setDestino(''); setFase('inicio'); setNomeArquivo(''); }}>Importar outro arquivo</Botao>
          </div>
        </Card>
      )}
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}
