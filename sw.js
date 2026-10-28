// Service worker: deja la app disponible sin conexión.
// Cuando cambies archivos, subí el número de versión para refrescar la caché.

const CACHE = 'pesitos-v12';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles.css', './main.js',
  './js/acciones.js', './js/agenda.js', './js/ahorro.js', './js/almacenamiento.js', './js/aprender.js',
  './js/asesor.js', './js/autenticacion.js', './js/beneficios.js', './js/bienvenida.js', './js/calculos.js',
  './js/categorias.js', './js/cifrado.js', './js/clave.js', './js/cotizaciones.js', './js/datosvivos.js',
  './js/economista.js', './js/ejemplo.js', './js/feriados.js', './js/firebaseconfig.js', './js/flujo.js',
  './js/formato.js', './js/guia.js', './js/herramientas.js', './js/inicio.js', './js/interfaz.js',
  './js/interprete.js', './js/menu.js', './js/movimientos.js', './js/pagos.js', './js/promosrespaldo.js',
  './js/rendimientos.js', './js/sincronizacion.js', './js/sueldo.js', './js/tarjetas.js', './js/tema.js',
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
