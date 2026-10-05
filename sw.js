/* JB Multiservices — service worker : l'application démarre même sans internet. */
const VERSION = 'jb-1.0.0';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.json', 'js/core.js', 'js/pos.js', 'js/admin.js', 'js/main.js'];
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&display=swap',
  'https://i.postimg.cc/cCx0671R/JB-Multi-Services-Gold-Emblem.png',
  'https://i.postimg.cc/fT6Wf9BK/JB-Bar.png',
  'https://i.postimg.cc/jdGq47ZZ/JB-Barber-shop.png',
  'https://i.postimg.cc/HsfW9yB6/JB-Eau.png',
  'https://i.postimg.cc/tCLRNx2k/JB-studio-de-beaute.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];
// L'API (Google Apps Script) n'est jamais mise en cache : la file d'attente locale s'en charge.
const API_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(EXTERNAL.map(async url => {
      try { const r = await fetch(url, { mode: 'no-cors' }); await c.put(url, r); } catch (err) { /* sera mis en cache plus tard */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (API_HOSTS.includes(url.hostname)) return;

  // Pages : réseau d'abord (mises à jour), cache si hors ligne ou lent
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await Promise.race([fetch(req), timeout(4000)]);
        if (r && r.ok) c.put('index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Fichiers de l'application : cache immédiat + mise à jour en arrière-plan
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  // Ressources externes (polices, logos, Chart.js) : cache d'abord
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req) || await c.match(req.url);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    } catch (err) { return Response.error(); }
  })());
});
