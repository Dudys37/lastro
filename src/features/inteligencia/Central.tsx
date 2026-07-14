// ═══ LASTRO — Central de Inteligência (F6) ═══
// Consome o motor puro e cuida só de: montar o contexto, navegar ao clicar
// e persistir dispensas/adiamentos POR USUÁRIO+WORKSPACE no localStorage
// (preferência pessoal — não polui o workspace compartilhado).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Cartao, Conta, Lancamento } from '../../types/dominio';
import { hojeISO, mesDe } from '../../lib/lancamentos';
import { aplicarOcultos, runInteligencia, type Alerta, type Ocultos, type Severidade } from '../../lib/inteligencia';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { Cartao as Card } from '../../components/ui/Basicos';
import { Categoria, listarCategorias, obterOrcamento } from '../financeiro/repo';
import { listarMetas } from '../metas/Metas';
import type { Meta } from '../../lib/metas';

const SEV: Record<Severidade, { chip: string; cls: string }> = {
  critico: { chip: 'crítico', cls: 'bg-neg/10 text-neg' },
  atencao: { chip: 'atenção', cls: 'bg-warn/10 text-warn' },
  info:    { chip: 'info',    cls: 'bg-info/10 text-info' },
};

const ADIAR_MS = 7 * 24 * 60 * 60 * 1000;

export function CentralInteligencia({ contas, cartoes, lancs }: {
  contas: Conta[]; cartoes: Cartao[]; lancs: Lancamento[];
}) {
  const { usuario } = useAuth();
  const { ativo } = useWorkspace();
  const nav = useNavigate();
  const [tetos, setTetos] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<Categoria[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const chave = `lastro_intel_${ativo?.id ?? ''}_${usuario?.uid ?? ''}`;
  const [ocultos, setOcultos] = useState<Ocultos>({ dispensados: {}, adiados: {} });

  useEffect(() => {
    try { setOcultos(JSON.parse(localStorage.getItem(chave) ?? '') as Ocultos); }
    catch { setOcultos({ dispensados: {}, adiados: {} }); }
  }, [chave]);

  useEffect(() => {
    (async () => {
      if (!ativo) return;
      try {
        const [t, c, m] = await Promise.all([
          obterOrcamento(ativo.id, mesDe(hojeISO())), listarCategorias(ativo.id), listarMetas(ativo.id),
        ]);
        setTetos(t); setCats(c); setMetas(m);
      } catch { /* sem dados extras, o motor roda com o que tiver */ }
    })();
  }, [ativo]);

  const alertas = useMemo(() => runInteligencia({
    hoje: hojeISO(), contas, cartoes, lancs, tetos, metas,
    nomeCategoria: (id) => { const c = cats.find((x) => x.id === id); return c ? `${c.icone} ${c.nome}` : 'categoria'; },
  }), [contas, cartoes, lancs, tetos, metas, cats]);

  const agora = Date.now();
  const visiveis = aplicarOcultos(alertas, ocultos, agora);
  const nOcultos = alertas.length - visiveis.length;

  function salvar(o: Ocultos) { setOcultos(o); localStorage.setItem(chave, JSON.stringify(o)); }
  const dispensar = (a: Alerta) => salvar({ ...ocultos, dispensados: { ...ocultos.dispensados, [a.uid]: true } });
  const adiar = (a: Alerta) => salvar({ ...ocultos, adiados: { ...ocultos.adiados, [a.uid]: agora + ADIAR_MS } });

  if (alertas.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <span className="text-sm font-bold">🧠 Central de Inteligência</span>
        <span className="rounded-full bg-card2 px-2 py-0.5 text-[11px] font-bold text-ink2">{visiveis.length}</span>
        {nOcultos > 0 && (
          <button className="ml-auto text-[11px] font-semibold text-ink3 hover:text-ink"
            onClick={() => salvar({ dispensados: {}, adiados: {} })}>
            restaurar {nOcultos} oculto(s)
          </button>
        )}
      </div>
      {visiveis.length === 0 && (
        <p className="px-5 py-5 text-center text-xs text-ink3">Tudo tratado por aqui — os ocultados voltam quando você restaurar.</p>
      )}
      {visiveis.slice(0, 6).map((a) => (
        <div key={a.uid} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0">
          <span className="mt-0.5 text-lg" aria-hidden>{a.icone}</span>
          <button className="min-w-0 flex-1 text-left" onClick={() => nav(a.rota)} title="Abrir">
            <div className="text-sm font-semibold hover:text-brand">{a.titulo}</div>
            <div className="text-xs text-ink2">{a.msg}</div>
          </button>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SEV[a.sev].cls}`}>{SEV[a.sev].chip}</span>
          <button className="text-ink3 hover:text-ink" title="Adiar 7 dias" onClick={() => adiar(a)}>💤</button>
          <button className="text-ink3 hover:text-neg" title="Dispensar" onClick={() => dispensar(a)}>✕</button>
        </div>
      ))}
      {visiveis.length > 6 && <div className="px-5 py-2 text-[11px] text-ink3">+ {visiveis.length - 6} alerta(s) de menor prioridade</div>}
    </Card>
  );
}
