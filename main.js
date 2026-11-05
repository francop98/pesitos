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
import { llaveDelDispositivo, borrarDelDispositivo } from './js/cifrado.js';
import { crearPin, pedirClaveMigracion, claveActions } from './js/clave.js';
import { iniciarBloqueo, terminarBloqueo, mostrarBloqueo, bloqueoActions, pinDelDispositivo, pinParaRehacer, pinRehecho, pedirPinAlAbrir, marcarSesionConPin, olvidarSesionConPin } from './js/bloqueo.js';
import { publicarAgenda } from './js/avisos.js';
import { menuActions, usarCtxMenu } from './js/menu.js';
import { ticketActions } from './js/ticket.js';
import { importarActions } from './js/importar.js';
import { ciudadActions } from './js/ciudades.js';
import { ayudaActions, tutorialPendiente } from './js/ayuda.js';
import { aplicarTema, aplicarLetra } from './js/tema.js';
import { commonActions, addPendingFromText } from './js/acciones.js';
import { guideActions } from './js/guia.js';
import { habitosActions } from './js/habitos.js';
import { monedaActions } from './js/moneda.js';
import { espacioActions, misEspacios, recordarEspacios, kModo } from './js/espacios.js';
import { refreshRates } from './js/cotizaciones.js';
import { setMoneda } from './js/formato.js';
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
import * as proyectos from './js/proyectos.js';
import * as reintegros from './js/reintegros.js';
import { actions as inversionesActions } from './js/inversiones.js';
import { notifyDue } from './js/agenda.js';
import { setCustomCategories, setCustomWallets } from './js/categorias.js';

// rutas viejas que ahora son pestañas de otra pantalla
const vistaDe = (mod, v) => ({ render: (s) => mod.renderVista(s, v) });
const views = { inicio, movimientos, ahorro, asesor, beneficios, herramientas, pagos, buscar, presupuestos,
  cuentas: vistaDe(ahorro, 'cuentas'), sueldo: vistaDe(ahorro, 'sueldo'), tarjetas: vistaDe(pagos, 'tarjetas'), deudas, proyectos, estadisticas, reintegros };
const NAV_ORDER = ['inicio', 'movimientos', 'pagos', 'ahorro', 'herramientas'];

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
  get miNombre() { const u = cuenta.usuarioActual(); return ((u && u.displayName) || '').split(' ')[0]; },
  abrirModo: (id, nombre, op) => abrirModo(id, nombre, op),
  commit(mutate) { mutate(state); persist(); render(); },
  // Guarda sin redibujar si estás escribiendo
  update(mutate) { mutate(state); persist(); if (!isTyping()) render(); },
  replace(next) { state = next; persist(); trail.length = 0; render(); refreshAll(true); },
  render,
  go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); },
  openModal, closeModal, toast,
};

usarCtxMenu(ctx);

function currentRoute() {
  const r = location.hash.replace(/^#\//, '');
  return views[r] ? r : 'inicio';
}

function render() {
  if (!ready) return;
  setMoneda((state.settings || {}).moneda);
  usarFeriados(state);
  setCustomCategories(state.customCategories, (state.catPrefs || {}).eliminadas || []);
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

  const navRoute = { tarjetas: 'pagos', beneficios: 'inicio', buscar: 'movimientos', presupuestos: 'inicio', cuentas: 'ahorro', sueldo: 'ahorro', deudas: 'herramientas', proyectos: 'herramientas', reintegros: 'ahorro', estadisticas: 'inicio', asesor: 'inicio' }[route] || route;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.route === navRoute) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  refreshAll();
  if (route === 'inicio') tutorialPendiente(ctx);
}

const actions = Object.assign({ recargar: () => location.reload() }, commonActions, habitosActions, monedaActions, espacioActions, ticketActions, importarActions, ciudadActions, ayudaActions, guideActions, menuActions, claveActions, bloqueoActions, onboarding.actions, inicio.actions, movimientos.actions, sueldo.actions, ahorro.actions, asesor.actions, tarjetas.actions, beneficios.actions, herramientas.actions, pagos.actions, buscar.actions, presupuestos.actions, cuentas.actions, deudas.actions, estadisticas.actions, proyectos.actions, inversionesActions, reintegros.actions, reintegros.confirmarActions, {
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
  if (!state.espacio) publicarAgenda(state, uidActual); // los avisos al celular son de tu plata personal
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
// en un espacio compartido, cada 20 segundos me fijo si la otra persona cargó algo
setInterval(() => { if (state.espacio) traerDeOtroDispositivo(); }, 20000);

// ---------- modos: tu plata personal o un espacio compartido ----------
async function abrirModo(espId, nombre = null, { nuevo = false, quitar = null } = {}) {
  const u = cuenta.usuarioActual(); if (!u) return;
  const antes = state;
  if (!antes.espacio) recordarEspacios(u.uid, misEspacios(u.uid, antes));
  ready = false;
  pantallaCarga(espId ? `Abriendo ${nombre || 'el espacio compartido'}…` : 'Abriendo tu plata…');
  save(state);
  await nube.detener();
  useAccount(espId ? `esp_${espId}` : u.uid);
  const local = hasLocal() ? load() : null;
  let r;
  try {
    r = await nube.iniciar(u, { local, espacio: espId, onStatus: (st) => { syncStatus = st; },
      onRemoto: (m) => { state = m; save(state); if (!isTyping() && document.getElementById('modal').hidden) render(); } });
  } catch (e) {
    console.warn(e); toast('No pude abrir ese modo. Revisá tu conexión.');
    useAccount(u.uid); r = await nube.iniciar(u, { local: load(), onStatus: (st) => { syncStatus = st; } }); espId = null;
  }
  state = r.state;
  if (espId) {
    // espacio nuevo o recién sumado: arranca listo, con tu provincia y tu día de cobro como punto de partida
    if (!state.ready || nuevo) {
      state.ready = true; state.tutorialVisto = true;
      state.profile = { ...state.profile, name: nombre || 'Familia', payRule: antes.profile.payRule, payday: antes.profile.payday, paydayVaries: antes.profile.paydayVaries, province: antes.profile.province, city: antes.profile.city };
      state.settings = { ...state.settings, moneda: (antes.settings || {}).moneda || 'ARS' };
    }
    state.espacio = { id: espId, nombre: nombre || (state.espacio && state.espacio.nombre) || 'Familia' };
    for (const k of ['rates', 'live', 'rendimientos', 'feriados', 'ipcAuto']) if (antes[k] !== undefined && state[k] === undefined) state[k] = antes[k];
    persist();
  } else {
    delete state.espacio;
    if (quitar) { state.espacios = (state.espacios || []).filter((e) => e.id !== quitar); persist(); }
    else { const lista = misEspacios(u.uid, state); if (JSON.stringify(lista) !== JSON.stringify(state.espacios || [])) { state.espacios = lista; persist(); } }
  }
  try { if (espId) localStorage.setItem(kModo(u.uid), espId); else localStorage.removeItem(kModo(u.uid)); } catch { /* nada */ }
  save(state);
  ready = true;
  trail.length = 0; location.hash = '#/inicio'; trail.push('inicio');
  render();
  refreshAll(true);
}

// ---------- arranque con cuenta ----------
let uidActual = null;
const session = {
  async onNombre(n) { ctx.commit((st) => { st.profile.name = n; }); },
  async onEliminar() {
    const u = cuenta.usuarioActual();
    await nube.borrarNube();
    await nube.detener({ borrarLocal: true });
    clear(); clearLegacy();
    if (u) { try { localStorage.removeItem(`pesitos:v1:${u.uid}`); localStorage.removeItem(`pesitos_pin:${u.uid}`); } catch { /* nada */ } await borrarDelDispositivo(u.uid); }
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

  // perfil de la cuenta (PIN de seguridad). Sin conexión, el PIN guardado en este dispositivo.
  const kPin = `pesitos_pin:${u.uid}`;
  const pinLocal = () => { try { return JSON.parse(localStorage.getItem(kPin)); } catch { return null; } };
  const guardarPinLocal = (p) => { try { localStorage.setItem(kPin, JSON.stringify(p)); } catch { /* nada */ } };
  let perfil = { llave: null, pin: null };
  let online = true;
  try { perfil = await nube.leerPerfil(u); } catch (e) { online = false; perfil.pin = pinLocal(); }
  if (!online && !perfil.pin) { main.innerHTML = '<div class="loading"><p class="text">No hay conexión. Para entrar por primera vez en este dispositivo necesito internet.</p><button class="btn primary" data-action="recargar">Reintentar</button></div>'; return; }
  const salir = () => cuenta.salir();

  // versión anterior: datos cifrados. Se abren con la llave de este dispositivo o, si no está, con la clave (una última vez).
  let key = await llaveDelDispositivo(u.uid);
  if (online && perfil.llave && !key) {
    let cifrado = true;
    try { cifrado = await nube.hayCifrado(u); } catch { /* sigo */ }
    if (cifrado) {
      const r = await pedirClaveMigracion(main, perfil.llave, { email: u.email, onSalir: salir });
      if (r.empezarDeCero) { await nube.borrarDatosViejos(u); toast('Listo: empezás de cero'); } else key = r.key;
    }
  }

  // PIN de seguridad: se crea la primera vez (o después de olvidarlo); si no, se pide.
  const guardarPin = async (p) => { guardarPinLocal(p); await nube.guardarPin(u, p); };
  const rehacer = pinParaRehacer(u.uid);
  if (!perfil.pin || rehacer) {
    // si este dispositivo ya tenía un PIN (versión anterior), se usa ese
    const previo = !rehacer && pinDelDispositivo(u.uid);
    const p = previo || await crearPin(main, { nombre: (u.displayName || '').split(' ')[0], nuevo: rehacer });
    perfil.pin = p;
    try { await guardarPin(p); } catch (e) { console.warn('PIN sin guardar en la nube todavía:', e); try { localStorage.setItem(`pesitos_pin_pend:${u.uid}`, '1'); } catch { /* nada */ } }
    pinRehecho(u.uid);
    iniciarBloqueo(u.uid, { pin: p, guardarPin, onOlvido: () => cuenta.salir() });
  } else {
    guardarPinLocal(perfil.pin);
    // si quedó un PIN sin subir (se creó sin conexión), se sube ahora
    try { if (localStorage.getItem(`pesitos_pin_pend:${u.uid}`) === '1' && online) { const pl = pinLocal(); if (pl) { await nube.guardarPin(u, pl); perfil.pin = pl; } localStorage.removeItem(`pesitos_pin_pend:${u.uid}`); } } catch { /* después */ }
    iniciarBloqueo(u.uid, { pin: perfil.pin, guardarPin, onOlvido: () => cuenta.salir() });
    // el PIN se pide al iniciar sesión (y al abrir la app solo si lo elegiste)
    if (pedirPinAlAbrir(u.uid)) { main.innerHTML = ''; await mostrarBloqueo(); }
  }
  marcarSesionConPin(u.uid);
  uidActual = u.uid;
  // que el navegador no borre tu sesión para liberar espacio
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* nada */ }
  main.onclick = null; main.onsubmit = null; main.onchange = null;
  pantallaCarga();

  useAccount(u.uid);
  const local = hasLocal() ? load() : null;
  let inicio;
  try { inicio = await nube.iniciar(u, { local, legacy: loadLegacy(), onStatus: (st) => { syncStatus = st; }, key, onMigrado: () => borrarDelDispositivo(u.uid) }); }
  catch (e) {
    // la llave de este dispositivo no abre los datos viejos (cambió en otro lado): se pide la clave
    console.warn(e); await borrarDelDispositivo(u.uid); await nube.detener();
    return conSesion(u);
  }
  const { state: inicial, origen } = inicio;
  state = inicial;
  if (!state.profile.name && u.displayName) state.profile.name = u.displayName.split(' ')[0];
  if (!state.legal || state.legal.version !== cuenta.LEGAL_VERSION) state.legal = { version: cuenta.LEGAL_VERSION, fecha: new Date().toISOString().slice(0, 10) };
  save(state);
  if (origen === 'migrado') { clearLegacy(); setTimeout(() => toast('Listo: tus datos quedaron guardados en tu cuenta'), 600); }
  if (origen === 'descifrado') setTimeout(() => toast('Listo: ya no necesitás la clave de Pesitos. Desde ahora entrás con tu PIN.'), 600);
  ready = true;
  document.title = 'Pesitos · Tu economista de bolsillo';
  trail.length = 0; trail.push(currentRoute());
  render();
  refreshAll(true);
  handleShare();
  handleAtajo();
  // si la última vez estabas en un espacio compartido, vuelvo a abrirlo
  try {
    const m = localStorage.getItem(kModo(u.uid));
    const e = m && misEspacios(u.uid, state).find((x) => x.id === m);
    if (e && !state.demo) await abrirModo(e.id, e.nombre);
  } catch (err) { console.warn(err); }
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
    if (uidActual) olvidarSesionConPin(uidActual); // la próxima vez que entres, te pido el PIN
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
