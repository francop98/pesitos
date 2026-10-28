// Service worker: deja la app disponible sin conexión.
// Cuando cambies archivos, subí el número de versión para refrescar la caché.

const CACHE = 'pesitos-v13';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles.css', './main.js',
  './js/acciones.js', './js/agenda.js', './js/ahorro.js', './js/almacenamiento.js', './js/aprender.js',
  './js/asesor.js', './js/autenticacion.js', './js/avisos.js', './js/beneficios.js', './js/bienvenida.js',
  './js/bloqueo.js', './js/buscar.js', './js/calculos.js', './js/categorias.js', './js/cifrado.js',
  './js/clave.js', './js/cotizaciones.js', './js/cuentas.js', './js/datosvivos.js', './js/deudas.js',
  './js/economista.js', './js/ejemplo.js', './js/estadisticas.js', './js/exportar.js', './js/feriados.js',
  './js/firebaseconfig.js', './js/flujo.js', './js/formato.js', './js/guia.js', './js/herramientas.js',
  './js/importar.js', './js/inicio.js', './js/interfaz.js', './js/interprete.js', './js/menu.js',
  './js/miscuentas.js', './js/movimientos.js', './js/pagos.js', './js/presupuestos.js', './js/promosrespaldo.js',
  './js/rendimientos.js', './js/sincronizacion.js', './js/sueldo.js', './js/tarjetas.js', './js/tema.js',
  './js/ticket.js',
  './pages/terminos.html', './pages/privacidad.html', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
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
  // Firebase (cuenta y nube): se guarda para que la app abra aunque no haya internet
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }
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

// ---------- avisos (notificaciones push) ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Pesitos', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Pesitos', {
    body: d.body || 'Tenés novedades en Pesitos.',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: d.tag || 'pesitos',
    data: { url: d.url || './#/pagos' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
