// ═══ LASTRO — Faturas (F3) ═══
// Fatura por ciclo real de fechamento: seleção de cartão, navegação por mês
// de fatura, itens do ciclo, status (aberta/fechada/parcial/paga) e registro
// de pagamento debitando uma conta — sem duplicar despesa.
import { useEffect, useMemo, useState } from 'react';
import type { Cartao, Conta, Lancamento } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { formatarBRL, parseBRL, somar } from '../../lib/dinheiro';
import { hojeISO, mesAnterior, mesSeguinte, rotuloMes } from '../../lib/lancamentos';
import { itensDaFatura, mesFatura, pagamentosDaFatura, statusFatura, vencimentoFatura, type StatusFatura } from '../../lib/faturas';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';
import { listarCartoes, listarContas, listarLancamentosDoCiclo, listarPagamentosDoCartao, registrarPagamentoFatura } from './repo';

const CHIP: Record<StatusFatura, { r: string; cls: string }> = {
  aberta:  { r: 'Aberta',  cls: 'bg-info/10 text-info' },
  fechada: { r: 'Fechada', cls: 'bg-warn/10 text-warn' },
  parcial: { r: 'Parcialmente paga', cls: 'bg-warn/10 text-warn' },
  paga:    { r: 'Paga ✓', cls: 'bg-pos/10 text-pos' },
};

export function PaginaFaturas() {
  const { usuario } = useAuth();
  const { ativo, papel } = useWorkspace();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartaoId, setCartaoId] = useState('');
  const [mesFat, setMesFat] = useState('');
  const [doCiclo, setDoCiclo] = useState<Lancamento[]>([]);
  const [pagamentos, setPagamentos] = useState<Lancamento[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lanco = podeFazer(papel, 'lancar');

  const cartao = cartoes.find((k) => k.id === cartaoId) ?? null;

  useEffect(() => {
    (async () => {
      if (!ativo) return;
      try {
        const [ks, cs] = await Promise.all([listarCartoes(ativo.id), listarContas(ativo.id)]);
        setCartoes(ks); setContas(cs);
        if (ks.length && !cartaoId) {
          setCartaoId(ks[0].id);
          setMesFat(mesFatura(hojeISO(), ks[0].diaFechamento)); // fatura corrente
        }
      } catch { setErro('Não foi possível carregar os cartões.'); }
    })();
    // eslint-disable-next-line
  }, [ativo?.id]);

  async function carregarFatura() {
    if (!ativo || !cartao || !mesFat) return;
    setErro('');
    try {
      const [ciclo, pgs] = await Promise.all([
        listarLancamentosDoCiclo(ativo.id, mesFat, cartao.diaFechamento),
        listarPagamentosDoCartao(ativo.id, cartao.id),
      ]);
      setDoCiclo(ciclo); setPagamentos(pgs);
    } catch { setErro('Não foi possível carregar a fatura.'); }
  }
  useEffect(() => { void carregarFatura(); /* eslint-disable-next-line */ }, [ativo?.id, cartaoId, mesFat]);

  const itens = useMemo(() => (cartao ? itensDaFatura(cartao, mesFat, doCiclo) : []), [cartao, mesFat, doCiclo]);
  const pgsDaFat = useMemo(() => (cartao ? pagamentosDaFatura(cartao.id, mesFat, pagamentos) : []), [cartao, mesFat, pagamentos]);
  const total = somar(...itens.map((i) => i.valor));
  const pago = somar(...pgsDaFat.map((p) => p.valor));
  const restante = Math.max(0, total - pago);
  const status = cartao ? statusFatura(mesFat, cartao.diaFechamento, hojeISO(), total, pago) : 'aberta';

  if (!ativo) return null;
  if (cartoes.length === 0) {
    return <Card className="max-w-2xl p-8 text-center text-sm text-ink2">Nenhum cartão cadastrado — crie um em <strong>Contas & Cartões</strong> e as faturas aparecem aqui.</Card>;
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="flex flex-wrap items-center gap-3 px-5 py-4">
        <select className="h-10 rounded-lg border border-line bg-card px-2 text-sm font-semibold"
          value={cartaoId} aria-label="Cartão"
          onChange={(e) => { setCartaoId(e.target.value); const k = cartoes.find((x) => x.id === e.target.value)!; setMesFat(mesFatura(hojeISO(), k.diaFechamento)); }}>
          {cartoes.map((k) => <option key={k.id} value={k.id}>💳 {k.nome}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMesFat(mesAnterior(mesFat))} aria-label="Fatura anterior">‹</Botao>
          <div className="w-40 text-center text-sm font-bold capitalize">{mesFat && rotuloMes(mesFat)}</div>
          <Botao variante="fantasma" className="h-9 w-9 px-0" onClick={() => setMesFat(mesSeguinte(mesFat))} aria-label="Próxima fatura">›</Botao>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${CHIP[status].cls}`}>{CHIP[status].r}</span>
      </Card>

      {cartao && (
        <Card>
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-ink3">Total da fatura</div>
              <div className="text-2xl font-extrabold">{formatarBRL(total)}</div>
            </div>
            <div className="text-xs text-ink2">
              fecha em {new Date(`${mesFat}-${String(cartao.diaFechamento).padStart(2, '0')}T12:00`).toLocaleDateString('pt-BR')}<br />
              vence em {new Date(vencimentoFatura(mesFat, cartao.diaFechamento, cartao.diaVencimento) + 'T12:00').toLocaleDateString('pt-BR')}
            </div>
            {pago > 0 && (
              <div className="ml-auto text-right text-xs">
                <div className="text-pos">pago {formatarBRL(pago)}</div>
                {restante > 0 && <div className="text-warn">restam {formatarBRL(restante)}</div>}
              </div>
            )}
          </div>

          {itens.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink3">Sem compras neste ciclo.</p>}
          {itens.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
              <span className="w-20 text-xs text-ink3">{new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{l.descricao || 'Compra'}
                {l.parcelas && <span className="ml-2 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-ink2">{l.parcelas.numero}/{l.parcelas.total}</span>}
              </span>
              <span className="text-sm font-bold">{formatarBRL(l.valor)}</span>
            </div>
          ))}

          {pgsDaFat.length > 0 && (
            <div className="border-t border-line bg-card2/50 px-5 py-3">
              {pgsDaFat.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1 text-xs text-ink2">
                  <span>💵 {new Date(p.data + 'T12:00').toLocaleDateString('pt-BR')} — pagamento de {contas.find((c) => c.id === p.contaId)?.nome ?? 'conta'}</span>
                  <span className="ml-auto font-bold text-pos">{formatarBRL(p.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {lanco && cartao && restante > 0 && total > 0 && (
        <FormPagamento contas={contas} restante={restante} ocupado={ocupado} onPagar={async (contaId, valor, dataISO) => {
          setOcupado(true); setErro('');
          try {
            await registrarPagamentoFatura(ativo.id, usuario!.uid, {
              cartaoId: cartao.id, faturaMes: mesFat, contaId, valor, dataISO,
              descricao: `Pagamento fatura ${cartao.nome} — ${rotuloMes(mesFat)}`,
            });
            await carregarFatura();
          } catch { setErro('Não foi possível registrar o pagamento.'); }
          finally { setOcupado(false); }
        }} />
      )}
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}

function FormPagamento({ contas, restante, ocupado, onPagar }: {
  contas: Conta[]; restante: number; ocupado: boolean;
  onPagar: (contaId: string, valor: number, dataISO: string) => void;
}) {
  const [contaId, setContaId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const cent = valor ? parseBRL(valor) : restante;
  const valido = contaId && cent !== null && cent > 0 && data;
  return (
    <Card className="flex flex-wrap items-end gap-3 p-5">
      <div className="w-full text-sm font-bold">💵 Registrar pagamento</div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Debitar de</span>
        <select className="h-10 rounded-lg border border-line bg-card px-2 text-sm" value={contaId} onChange={(e) => setContaId(e.target.value)}>
          <option value="">Selecione a conta…</option>
          {contas.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>🏦 {c.nome}</option>)}
        </select>
      </label>
      <Campo rotulo="Valor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={formatarBRL(restante)}
        className="h-10 w-32" erro={valor && parseBRL(valor) === null ? 'inválido' : undefined} />
      <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-10 w-40" />
      <Botao disabled={ocupado || !valido} onClick={() => { onPagar(contaId, cent!, data); setValor(''); }}>
        Pagar {formatarBRL(cent ?? 0)}
      </Botao>
      <p className="w-full text-xs text-ink3">O pagamento debita a conta sem duplicar despesas — as compras já contaram no mês de cada uma.</p>
    </Card>
  );
}
