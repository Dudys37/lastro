// ═══ LASTRO — Gráficos SVG (F4) ═══
// Zero dependências: SVG desenhado à mão sobre os design tokens — os dois
// temas funcionam de graça. Componentes pequenos e burros: recebem séries
// prontas (a matemática vive em src/lib/relatorios.ts, testada).
import { formatarBRL } from '../../lib/dinheiro';

export const PALETA = [
  'rgb(var(--brand))', 'rgb(var(--info))', 'rgb(var(--warn))',
  'rgb(var(--pos))', 'rgb(var(--neg))', 'rgb(var(--ink3))',
];

const rotuloCurto = (mes: string) =>
  new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

/** Barras duplas por mês: receitas (verde) × despesas (vermelho). */
export function BarrasFluxo({ dados }: { dados: { mes: string; receitas: number; despesas: number }[] }) {
  const W = 560, H = 180, pad = 8, baseY = H - 24;
  const max = Math.max(1, ...dados.flatMap((d) => [d.receitas, d.despesas]));
  const grupoW = (W - pad * 2) / Math.max(1, dados.length);
  const barW = Math.min(26, grupoW * 0.32);
  const h = (v: number) => Math.round((v / max) * (baseY - 16));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Receitas e despesas por mês">
      <line x1={pad} y1={baseY} x2={W - pad} y2={baseY} stroke="rgb(var(--line))" />
      {dados.map((d, i) => {
        const cx = pad + grupoW * i + grupoW / 2;
        return (
          <g key={d.mes}>
            <rect x={cx - barW - 2} y={baseY - h(d.receitas)} width={barW} height={h(d.receitas)} rx={3} fill="rgb(var(--pos))">
              <title>{`${rotuloCurto(d.mes)}: receitas ${formatarBRL(d.receitas)}`}</title>
            </rect>
            <rect x={cx + 2} y={baseY - h(d.despesas)} width={barW} height={h(d.despesas)} rx={3} fill="rgb(var(--neg))">
              <title>{`${rotuloCurto(d.mes)}: despesas ${formatarBRL(d.despesas)}`}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="rgb(var(--ink3))" className="capitalize">{rotuloCurto(d.mes)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Linha/área da evolução do saldo consolidado. */
export function LinhaSaldo({ dados }: { dados: { mes: string; saldo: number }[] }) {
  const W = 560, H = 160, pad = 10, baseY = H - 24, topo = 14;
  const vals = dados.map((d) => d.saldo);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, dados.length - 1);
  const y = (v: number) => baseY - ((v - min) / (max - min || 1)) * (baseY - topo);
  const pts = dados.map((d, i) => `${x(i)},${y(d.saldo)}`).join(' ');
  const area = `${pad},${baseY} ${pts} ${x(dados.length - 1)},${baseY}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução do saldo consolidado">
      {min < 0 && <line x1={pad} y1={y(0)} x2={W - pad} y2={y(0)} stroke="rgb(var(--line2))" strokeDasharray="4 4" />}
      <polygon points={area} fill="rgb(var(--brand))" opacity={0.12} />
      <polyline points={pts} fill="none" stroke="rgb(var(--brand))" strokeWidth={2.5} strokeLinejoin="round" />
      {dados.map((d, i) => (
        <g key={d.mes}>
          <circle cx={x(i)} cy={y(d.saldo)} r={3.5} fill="rgb(var(--brand))">
            <title>{`${rotuloCurto(d.mes)}: ${formatarBRL(d.saldo)}`}</title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="rgb(var(--ink3))" className="capitalize">{rotuloCurto(d.mes)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Donut de fatias com legenda ao lado. */
export function Donut({ fatias }: { fatias: { rotulo: string; valor: number }[] }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  const R = 56, C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36" role="img" aria-label="Despesas por categoria">
        <circle cx={70} cy={70} r={R} fill="none" stroke="rgb(var(--card2))" strokeWidth={18} />
        {fatias.map((f, i) => {
          const frac = f.valor / total;
          const el = (
            <circle key={f.rotulo} cx={70} cy={70} r={R} fill="none"
              stroke={PALETA[i % PALETA.length]} strokeWidth={18}
              strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acumulado * C}
              transform="rotate(-90 70 70)" strokeLinecap="butt">
              <title>{`${f.rotulo}: ${formatarBRL(f.valor)} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          );
          acumulado += frac;
          return el;
        })}
      </svg>
      <div className="grid gap-1.5 text-xs">
        {fatias.map((f, i) => (
          <div key={f.rotulo} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />
            <span className="text-ink2">{f.rotulo}</span>
            <span className="ml-auto font-bold">{formatarBRL(f.valor)}</span>
            <span className="w-9 text-right text-ink3">{Math.round((f.valor / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
