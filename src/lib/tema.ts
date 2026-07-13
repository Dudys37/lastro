// Tema claro/escuro com persistência local e classe .dark no <html>
export type Tema = 'claro' | 'escuro';

export function temaAtual(): Tema {
  return (localStorage.getItem('lastro_tema') as Tema) || 'claro';
}
export function aplicarTema(t: Tema) {
  document.documentElement.classList.toggle('dark', t === 'escuro');
  localStorage.setItem('lastro_tema', t);
}
export function alternarTema(): Tema {
  const novo: Tema = temaAtual() === 'claro' ? 'escuro' : 'claro';
  aplicarTema(novo);
  return novo;
}
