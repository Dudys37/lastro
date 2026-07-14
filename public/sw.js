// ═══ LASTRO — Service Worker (F8) ═══
// Estratégia deliberadamente simples: network-first com fallback ao cache.
// O app é online-first (Firestore); o SW existe para instalabilidade PWA e
// para reabrir o shell em oscilações de rede — nunca para servir dado velho.
const CACHE = 'lastro-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return; // Firestore/CDNs passam direto
  e.respondWith(
    fetch(req).then((resp) => {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      return resp;
    }).catch(() => caches.match(req).then((hit) => hit ?? caches.match('./index.html')))
  );
});
