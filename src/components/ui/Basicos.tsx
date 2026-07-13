// ═══ LASTRO — UI básicos (F0) ═══ Componentes mínimos sobre os tokens.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Botao({ variante = 'primario', className = '', ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'fantasma' | 'perigo' }) {
  const base = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const v = {
    primario: 'bg-brand text-white hover:bg-brand-dim',
    fantasma: 'border border-line bg-card2 text-ink2 hover:text-ink hover:border-line2',
    perigo: 'bg-neg/10 text-neg border border-neg/30 hover:bg-neg/20',
  }[variante];
  return <button className={`${base} ${v} ${className}`} {...p} />;
}

export function Campo({ rotulo, erro, className = '', ...p }:
  InputHTMLAttributes<HTMLInputElement> & { rotulo?: string; erro?: string }) {
  return (
    <label className="block">
      {rotulo && <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">{rotulo}</span>}
      <input
        className={`h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink placeholder:text-ink3 focus:border-brand ${erro ? 'border-neg' : ''} ${className}`}
        {...p}
      />
      {erro && <span className="mt-1 block text-xs text-neg">{erro}</span>}
    </label>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card ${className}`} style={{ boxShadow: 'var(--shadow-1)' }}>
      {children}
    </div>
  );
}

export function Marca({ tam = 'md' }: { tam?: 'md' | 'lg' }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold tracking-tight ${tam === 'lg' ? 'text-3xl' : 'text-xl'}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white" aria-hidden>⚓</span>
      <span>Lastro</span>
    </div>
  );
}
