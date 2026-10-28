// =========================================================
// Pesitos — arranque, cuenta, navegación entre pantallas y eventos
// 1. Sin sesión: pantalla de ingreso (js/autenticacion.js).
// 2. Con sesión: se trae tu información de la nube (js/sincronizacion.js)
//    y se abre la app. Cada cambio se guarda en el dispositivo y en tu cuenta.
// Rutas: #/inicio, #/movimientos, #/sueldo, #/ahorro, #/asesor,
//        #/tarjetas, #/beneficios, #/herramientas, #/pagos
// =========================================================

import { load, save, useAccount, loadLegacy, clearLegacy, hasLocal, emptyState, clear } from './js/almacenamiento.js';
import { firebaseListo } from './js/firebaseconfig.js';
import * as cuenta from './js/autenticacion.js';
import * as nube from './js/sincronizacion.js';
import { menuActions } from './js/menu.js';
import { aplicarTema, aplicarLetra } from './js/tema.js';
import { commonActions, addPendingFromText } from './js/acciones.js';
import { guideActions } from './js/guia.js';
import { refreshRates } from './js/cotizaciones.js';
import { refreshLive } from './js/datosvivos.js';
import { openModal, closeModal, toast, hydrateNavIcons } from './js/interfaz.js';
import * as onboarding from './js/bienvenida.js';
import * as inicio from './js/inicio.js';
import * as movimientos from './js/movimientos.js';
import * as sueldo from './js/sueldo.js';
import * as ahorro from './js/ahorro.js';
import * as asesor from './js/asesor.js';
import * as tarjetas from './js/tarjetas.js';
import * as beneficios from './js/beneficios.js';
import * as herramientas from './js/herramientas.js';
import * as pagos from './js/pagos.js';
import { notifyDue } from './js/agenda.js';
import { setCustomCategories, setCustomWallets } from './js/categorias.js';

const views = { inicio, movimientos, sueldo, ahorro, asesor, tarjetas, beneficios, herramientas, pagos };
const NAV_ORDER = ['inicio', 'movimientos', 'sueldo', 'ahorro', 'asesor'];

let state = emptyState();
let ready = false;          // hay sesión y datos cargados
let syncStatus = 'ok';
const main = document.getElementById('app');
const nav = document.getElementById('nav');
const trail = [];          // historial interno de pantallas
let lastRoute = null;
let goingBack = false;

const isTyping = () => { const a = document.activeElement; return a && main.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };

// guarda en el dispositivo y en tu cuenta
function persist() { save(state); nube.guardar(state); }

const ctx = {
  get state() { return state; },
  get syncStatus() { return syncStatus; },
  commit(mutate) { mutate(state); persist(); render(); },
  // Guarda sin redibujar si estás escribiendo
  update(mutate) { mutate(state); persist(); if (!isTyping()) render(); },
  replace(next) { state = next; persist(); trail.length = 0; render(); refreshAll(true); },
  render,
  go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); },
  openModal, closeModal, toast,
};

function currentRoute() {
  const r = location.hash.replace(/^#\//, '');
  return views[r] ? r : 'inicio';
}

function render() {
  if (!ready) return;
  setCustomCategories(state.customCategories);
  setCustomWallets(state.customWallets);
  document.body.classList.toggle('no-nav', !state.ready);
  document.body.classList.remove('sin-sesion');
  if (!state.ready) {
    nav.hidden = true;
    main.innerHTML = onboarding.render(state);
    const field = main.querySelector('[data-autofocus]');
    if (field && window.matchMedia('(pointer: fine)').matches) field.focus({ preventScroll: true });
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }
  nav.hidden = false;
  const route = currentRoute();
  main.innerHTML = views[route].render(state);

  // efecto de transición al cambiar de pantalla
  if (lastRoute && lastRoute !== route) {
    const back = goingBack || NAV_ORDER.indexOf(route) < NAV_ORDER.indexOf(lastRoute);
    main.classList.remove('slide-in', 'slide-back');
    void main.offsetWidth;
    main.classList.add(back ? 'slide-back' : 'slide-in');
  }
  goingBack = false;
  lastRoute = route;

  const navRoute = { tarjetas: 'movimientos', beneficios: 'inicio', herramientas: 'inicio', pagos: 'movimientos' }[route] || route;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.route === navRoute) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  refreshAll();
}

const actions = Object.assign({}, commonActions, guideActions, menuActions, onboarding.actions, inicio.actions, movimientos.actions, sueldo.actions, ahorro.actions, asesor.actions, tarjetas.actions, beneficios.actions, herramientas.actions, pagos.actions, {
  goBack() {
    trail.pop();
    const prev = trail.pop() || 'inicio';
    goingBack = true;
    ctx.go(prev);
  },
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(ctx, el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  const fn = actions[form.dataset.submit];
  if (!fn) return;
  const data = Object.fromEntries(new FormData(form));
  if (e.submitter && e.submitter.name) data[e.submitter.name] = e.submitter.value;
  fn(ctx, data, form);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](ctx, el, e);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

window.addEventListener('hashchange', () => {
  const r = currentRoute();
  if (trail[trail.length - 1] !== r) trail.push(r);
  closeModal(); render(); window.scrollTo(0, 0);
});

// Comprobantes compartidos desde otras apps (Web Share Target, ver manifest)
function handleShare() {
  const params = new URLSearchParams(location.search);
  const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');
  if (!shared) return;
  history.replaceState(null, '', location.pathname + '#/movimientos');
  if (!state.ready) return;
  if (addPendingFromText(ctx, shared)) toast('Comprobante recibido: confirmalo en Movimientos');
  else toast('No encontré un monto en lo que compartiste');
}

// Actualización automática: al abrir, al volver a la app, al recuperar
// conexión y cada 5 minutos mientras está abierta.
function refreshAll(force = false) {
  if (!ready || !state.ready || document.visibilityState === 'hidden') return;
  refreshRates(ctx, force);
  refreshLive(ctx, force);
  notifyDue(ctx);
}
// al volver a la app: cambios hechos desde otro dispositivo
async function traerDeOtroDispositivo() {
  if (!ready || state.demo || document.visibilityState !== 'visible') return;
  const nuevo = await nube.traerCambios();
  if (nuevo && !isTyping() && document.getElementById('modal').hidden) { state = nuevo; save(state); render(); }
}
document.addEventListener('visibilitychange', () => { refreshAll(); traerDeOtroDispositivo(); });
window.addEventListener('focus', () => refreshAll());
window.addEventListener('online', () => refreshAll(true));
setInterval(() => refreshAll(), 5 * 60 * 1000);

// ---------- arranque con cuenta ----------
const session = {
  async onNombre(n) { ctx.commit((st) => { st.profile.name = n; }); await nube.guardarPerfil({ nombre: n }); },
  async onEliminar() {
    const u = cuenta.usuarioActual();
    await nube.borrarNube();
    await nube.detener({ borrarLocal: true });
    clear(); clearLegacy();
    if (u) try { localStorage.removeItem(`pesitos:v1:${u.uid}`); } catch { /* nada */ }
  },
};
ctx.session = session;

function pantallaCarga(texto = 'Cargando tu plata…') {
  document.body.classList.add('sin-sesion', 'no-nav');
  nav.hidden = true;
  main.innerHTML = `<div class="loading"><div class="loading-dot"></div><p class="small muted">${texto}</p></div>`;
}

function sinSesion() {
  ready = false;
  closeModal();
  nav.hidden = true;
  document.body.classList.add('sin-sesion', 'no-nav');
  document.title = 'Pesitos · Ingresá';
  cuenta.renderPantalla(main, 'ingresar');
}

async function conSesion(u) {
  if (cuenta.necesitaVerificar(u)) { ready = false; nav.hidden = true; document.body.classList.add('sin-sesion', 'no-nav'); cuenta.renderVerificar(main, conSesion); return; }
  pantallaCarga();
  main.onclick = null; main.onsubmit = null;
  useAccount(u.uid);
  const local = hasLocal() ? load() : null;
  const { state: inicial, origen } = await nube.iniciar(u, { local, legacy: loadLegacy(), onStatus: (st) => { syncStatus = st; } });
  state = inicial;
  if (!state.profile.name && u.displayName) state.profile.name = u.displayName.split(' ')[0];
  save(state);
  if (origen === 'migrado') { clearLegacy(); setTimeout(() => toast('Listo: tus datos quedaron guardados en tu cuenta'), 600); }
  ready = true;
  document.title = 'Pesitos · Tu economista de bolsillo';
  trail.length = 0; trail.push(currentRoute());
  render();
  refreshAll(true);
  handleShare();
}

async function arrancar() {
  aplicarTema(); aplicarLetra();
  hydrateNavIcons();
  if (!firebaseListo()) {
    document.body.classList.add('sin-sesion', 'no-nav');
    main.innerHTML = '<div class="loading"><p class="text">Falta conectar Pesitos con Firebase: completá <b>js/firebaseconfig.js</b>.</p></div>';
    return;
  }
  pantallaCarga('Abriendo Pesitos…');
  const u = await cuenta.iniciar(async (nuevo) => {
    if (nuevo) { await conSesion(nuevo); return; }
    const anterior = state;
    const quedan = await nube.detener({ borrarLocal: true });
    // al cerrar sesión no queda la copia local en el dispositivo (salvo cambios que no llegaron a la nube)
    if (!quedan) { try { Object.keys(localStorage).filter((k) => k.startsWith('pesitos:v1:')).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ } }
    else save(anterior);
    state = emptyState();
    sinSesion();
  });
  if (u) await conSesion(u); else sinSesion();
}

arrancar();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
