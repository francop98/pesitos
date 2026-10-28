// Service worker: deja la app disponible sin conexión.
// Cuando cambies archivos, subí el número de versión para refrescar la caché.

const CACHE = 'pesitos-v8';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/store.js', './js/format.js', './js/categories.js', './js/parser.js',
  './js/calc.js', './js/advisor.js', './js/ui.js', './js/actions.js', './js/demo.js', './js/guide.js', './js/rates.js', './js/live.js', './js/promos-catalog.js', './js/views/tarjetas.js', './js/views/beneficios.js', './js/views/herramientas.js', './js/learn.js', './js/agenda.js', './js/cashflow.js', './js/views/pagos.js',
  './js/views/onboarding.js', './js/views/inicio.js', './js/views/movimientos.js',
  './js/views/sueldo.js', './js/views/ahorro.js', './js/views/asesor.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // cotizaciones y fuentes: siempre de la red
  if (url.pathname.includes('/api/')) return;  // datos del servicio: siempre frescos
  // Comprobante compartido: siempre devolvemos la app
  if (url.searchParams.has('text') || url.searchParams.has('title')) {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
