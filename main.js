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
import { cifradoDisponible, llaveDelDispositivo, guardarEnDispositivo, borrarDelDispositivo } from './js/cifrado.js';
import { crearClave, pedirClave, abrirGestionClave, claveActions } from './js/clave.js';
import { iniciarBloqueo, terminarBloqueo, mostrarBloqueo, bloqueoActions } from './js/bloqueo.js';
import { publicarAgenda } from './js/avisos.js';
import { menuActions } from './js/menu.js';
import { ticketActions } from './js/ticket.js';
import { importarActions } from './js/importar.js';
import { ciudadActions } from './js/ciudades.js';
import { ayudaActions, tutorialPendiente } from './js/ayuda.js';
import { aplicarTema, aplicarLetra } from './js/tema.js';
import { commonActions, addPendingFromText } from './js/acciones.js';
import { guideActions } from './js/guia.js';
import { refreshRates } from './js/cotizaciones.js';
import { refreshLive } from './js/datosvivos.js';
import { refreshRendimientos } from './js/rendimientos.js';
import { refreshFeriados, usarFeriados } from './js/feriados.js';
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
import * as buscar from './js/buscar.js';
import * as presupuestos from './js/presupuestos.js';
import * as cuentas from './js/miscuentas.js';
import * as deudas from './js/deudas.js';
import * as estadisticas from './js/estadisticas.js';
import { notifyDue } from './js/agenda.js';
import { setCustomCategories, setCustomWallets } from './js/categorias.js';

const views = { inicio, movimientos, sueldo, ahorro, asesor, tarjetas, beneficios, herramientas, pagos, buscar, presupuestos, cuentas, deudas, estadisticas };
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
  get uid() { return uidActual; },
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
  usarFeriados(state);
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

  const navRoute = { tarjetas: 'movimientos', beneficios: 'inicio', herramientas: 'inicio', pagos: 'movimientos', buscar: 'movimientos', presupuestos: 'inicio', cuentas: 'inicio', deudas: 'inicio', estadisticas: 'inicio' }[route] || route;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.route === navRoute) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  refreshAll();
  if (route === 'inicio') tutorialPendiente(ctx);
}

const actions = Object.assign({ recargar: () => location.reload() }, commonActions, ticketActions, importarActions, ciudadActions, ayudaActions, guideActions, menuActions, claveActions, bloqueoActions, onboarding.actions, inicio.actions, movimientos.actions, sueldo.actions, ahorro.actions, asesor.actions, tarjetas.actions, beneficios.actions, herramientas.actions, pagos.actions, buscar.actions, presupuestos.actions, cuentas.actions, deudas.actions, estadisticas.actions, {
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

// mientras escribís (búsqueda en vivo), con una pequeña espera
let inputTimer = null;
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el || !actions[el.dataset.input]) return;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(() => actions[el.dataset.input](ctx, el, e), 250);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

window.addEventListener('hashchange', () => {
  const r = currentRoute();
  if (trail[trail.length - 1] !== r) trail.push(r);
  closeModal(); render(); window.scrollTo(0, 0);
});

// Atajos del ícono (mantener apretado): ?accion=gasto | ticket
function handleAtajo() {
  const params = new URLSearchParams(location.search);
  const accion = params.get('accion');
  if (!accion || !state.ready) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (accion === 'gasto') setTimeout(() => { const i = document.getElementById('q-home'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } }, 300);
  if (accion === 'ticket' && actions.openTicket) setTimeout(() => actions.openTicket(ctx), 300);
}

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
  refreshRendimientos(ctx, force);
  refreshFeriados(ctx);
  notifyDue(ctx);
  publicarAgenda(state, uidActual);
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
let perfilActual = null; // { llave, creado } de la cuenta abierta
let uidActual = null;
const session = {
  async onNombre(n) { ctx.commit((st) => { st.profile.name = n; }); },
  async onEliminar() {
    const u = cuenta.usuarioActual();
    await nube.borrarNube();
    await nube.detener({ borrarLocal: true });
    clear(); clearLegacy();
    if (u) { try { localStorage.removeItem(`pesitos:v1:${u.uid}`); } catch { /* nada */ } await borrarDelDispositivo(u.uid); }
  },
  abrirClave() {
    const u = cuenta.usuarioActual();
    if (!u || !perfilActual || !perfilActual.llave) return;
    abrirGestionClave(perfilActual.llave, { guardarLlave: async (llave) => { await nube.guardarLlave(u, llave, perfilActual.creado); perfilActual.llave = llave; } });
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
  if (!cifradoDisponible()) { main.innerHTML = '<div class="loading"><p class="text">Este navegador no permite cifrar tus datos. Abrí Pesitos con Chrome, Safari, Edge o Firefox actualizados.</p></div>'; return; }

  // la llave que cifra tus datos: en este dispositivo, o se abre con tu clave de Pesitos
  let perfil = { llave: null, creado: null };
  let key = await llaveDelDispositivo(u.uid);
  try { perfil = await nube.leerPerfil(u); } catch (e) { if (!key) { main.innerHTML = '<div class="loading"><p class="text">No hay conexión. Para abrir tus datos en este dispositivo por primera vez necesito internet.</p><button class="btn primary" data-action="recargar">Reintentar</button></div>'; return; } }
  const salir = () => cuenta.salir();
  if (!perfil.llave && !key) {
    const r = await crearClave(main, { nombre: (u.displayName || '').split(' ')[0] });
    await nube.guardarLlave(u, r.llave, perfil.creado);
    perfil.llave = r.llave; key = r.key;
    await guardarEnDispositivo(u.uid, key);
  } else if (!key) {
    const r = await pedirClave(main, perfil.llave, { email: u.email, onSalir: salir });
    if (r.llave !== perfil.llave) { await nube.guardarLlave(u, r.llave, perfil.creado); perfil.llave = r.llave; }
    key = r.key;
    await guardarEnDispositivo(u.uid, key);
  }
  perfilActual = perfil;
  uidActual = u.uid;
  // que el navegador no borre tu sesión ni tu llave para liberar espacio
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* nada */ }
  // bloqueo con huella o PIN (de este dispositivo)
  iniciarBloqueo(u.uid, { onOlvido: async () => { await borrarDelDispositivo(u.uid); cuenta.salir(); } });
  await mostrarBloqueo();
  main.onclick = null; main.onsubmit = null; main.onchange = null;
  pantallaCarga();

  useAccount(u.uid);
  const local = hasLocal() ? load() : null;
  let inicio;
  try { inicio = await nube.iniciar(u, { local, legacy: loadLegacy(), onStatus: (st) => { syncStatus = st; }, key, perfil }); }
  catch (e) {
    // la llave de este dispositivo no abre los datos (por ejemplo, cambió en otro lado): se pide la clave de nuevo
    console.warn(e); await borrarDelDispositivo(u.uid); await nube.detener();
    return conSesion(u);
  }
  const { state: inicial, origen } = inicio;
  state = inicial;
  if (!state.profile.name && u.displayName) state.profile.name = u.displayName.split(' ')[0];
  if (!state.legal || state.legal.version !== cuenta.LEGAL_VERSION) state.legal = { version: cuenta.LEGAL_VERSION, fecha: new Date().toISOString().slice(0, 10) };
  save(state);
  if (origen === 'migrado') { clearLegacy(); setTimeout(() => toast('Listo: tus datos quedaron guardados y cifrados en tu cuenta'), 600); }
  if (origen === 'cifrado') setTimeout(() => toast('Listo: tus datos ahora están cifrados'), 600);
  ready = true;
  document.title = 'Pesitos · Tu economista de bolsillo';
  trail.length = 0; trail.push(currentRoute());
  render();
  refreshAll(true);
  handleShare();
  handleAtajo();
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
    // la llave se borra de este dispositivo: para volver a entrar se pide la clave de Pesitos
    if (uidActual) await borrarDelDispositivo(uidActual);
    uidActual = null;
    terminarBloqueo();
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
