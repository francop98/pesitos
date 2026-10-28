// Punto de entrada: estado, navegación entre pantallas y eventos.

import { load, save } from './store.js';
import { commonActions, addPendingFromText } from './actions.js';
import { guideActions } from './guide.js';
import { refreshRates } from './rates.js';
import { refreshLive } from './live.js';
import { openModal, closeModal, toast, hydrateNavIcons } from './ui.js';
import * as onboarding from './views/onboarding.js';
import * as inicio from './views/inicio.js';
import * as movimientos from './views/movimientos.js';
import * as sueldo from './views/sueldo.js';
import * as ahorro from './views/ahorro.js';
import * as asesor from './views/asesor.js';
import * as tarjetas from './views/tarjetas.js';
import * as beneficios from './views/beneficios.js';
import * as herramientas from './views/herramientas.js';
import * as pagos from './views/pagos.js';
import { notifyDue } from './agenda.js';
import { setCustomCategories, setCustomWallets } from './categories.js';

const views = { inicio, movimientos, sueldo, ahorro, asesor, tarjetas, beneficios, herramientas, pagos };
const NAV_ORDER = ['inicio', 'movimientos', 'sueldo', 'ahorro', 'asesor'];

let state = load();
const main = document.getElementById('app');
const nav = document.getElementById('nav');
const trail = [];          // historial interno de pantallas
let lastRoute = null;
let goingBack = false;

const isTyping = () => { const a = document.activeElement; return a && main.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };

const ctx = {
  get state() { return state; },
  commit(mutate) { mutate(state); save(state); render(); },
  // Guarda sin redibujar si estás escribiendo
  update(mutate) { mutate(state); save(state); if (!isTyping()) render(); },
  replace(next) { state = next; save(state); trail.length = 0; render(); refreshAll(true); },
  render,
  go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); },
  openModal, closeModal, toast,
};

function currentRoute() {
  const r = location.hash.replace(/^#\//, '');
  return views[r] ? r : 'inicio';
}

function render() {
  setCustomCategories(state.customCategories);
  setCustomWallets(state.customWallets);
  document.body.classList.toggle('no-nav', !state.ready);
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

const actions = Object.assign({}, commonActions, guideActions, onboarding.actions, inicio.actions, movimientos.actions, sueldo.actions, ahorro.actions, asesor.actions, tarjetas.actions, beneficios.actions, herramientas.actions, pagos.actions, {
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
  if (!state.ready || document.visibilityState === 'hidden') return;
  refreshRates(ctx, force);
  refreshLive(ctx, force);
  notifyDue(ctx);
}
document.addEventListener('visibilitychange', () => refreshAll());
window.addEventListener('focus', () => refreshAll());
window.addEventListener('online', () => refreshAll(true));
setInterval(() => refreshAll(), 5 * 60 * 1000);

hydrateNavIcons();
handleShare();
trail.push(currentRoute());
render();
refreshAll();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
