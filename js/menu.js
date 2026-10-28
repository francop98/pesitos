// =========================================================
// Pesitos — menú (☰)
// Tu plata: Mis datos, Mis medios de pago, Datos que se actualizan solos
// La app:  Tema, Tamaño de letra, Instalar, Copia de seguridad
// Tu cuenta: Mi cuenta, Seguridad y privacidad, Cerrar sesión
// =========================================================

import { esc, todayISO } from './formato.js';
import { icon, openModal, closeModal, toast } from './interfaz.js';
import { PROVINCES, provinceLabel } from './categorias.js';
import { ratesAge } from './cotizaciones.js';
import { lastIpc, refreshLive } from './datosvivos.js';
import { promosStatus } from './economista.js';
import { temaActual, letraActual, aplicarTema, aplicarLetra } from './tema.js';
import { usuarioActual, abrirMiCuenta, salir } from './autenticacion.js';

// Instalar como app (Chrome/Android avisa que se puede)
let instalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalar = e; });
window.addEventListener('appinstalled', () => { instalar = null; toast('¡Pesitos quedó instalada!'); });
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const ESTADOS = {
  ok: ['cloud', 'Todo guardado en tu cuenta'],
  enviando: ['refresh', 'Guardando en tu cuenta…'],
  pendiente: ['refresh', 'Guardando en tu cuenta…'],
  'sin-conexion': ['cloud', 'Sin conexión: se guarda solo cuando vuelva internet'],
};

const item = (action, ic, title, sub = '', extra = '') => `<button class="menu-item" data-action="${action}" ${extra}>
  <span class="menu-ic">${icon(ic, 20)}</span><span class="grow"><span class="name">${esc(title)}</span>${sub ? `<span class="meta">${esc(sub)}</span>` : ''}</span>${icon('chevron', 18)}</button>`;

const seg = (action, actual, opciones) => `<div class="tabs" style="grid-template-columns:repeat(${opciones.length},minmax(0,1fr))">${opciones.map(([v, l]) => `<button type="button" data-action="${action}" data-v="${v}" aria-pressed="${actual === v}">${l}</button>`).join('')}</div>`;

function menuHtml(ctx) {
  const s = ctx.state;
  const u = usuarioActual();
  const nombre = (u && u.displayName) || s.profile.name || 'Tu cuenta';
  const [ic, estado] = ESTADOS[ctx.syncStatus] || ESTADOS.ok;
  return `
    <button class="menu-cuenta" data-action="openMiCuenta">
      <span class="avatar">${esc(nombre.trim().charAt(0).toUpperCase() || 'P')}</span>
      <span class="grow"><span class="name">${esc(nombre)}</span><span class="meta">${esc((u && u.email) || '')}</span>
      <span class="meta sync">${icon(ic, 14)} ${s.demo ? 'Datos de ejemplo: no se guardan en tu cuenta' : esc(estado)}</span></span>${icon('chevron', 18)}</button>

    <div class="menu-grupo"><span class="menu-label">Tu plata</span>
      ${item('openMisDatos', 'user', 'Mis datos', 'Nombre, día de cobro y provincia')}
      ${item('openWallets', 'wallet', 'Mis medios de pago', 'Bancos, billeteras y tarjetas')}
      ${item('openDatosVivos', 'refresh', 'Datos que se actualizan solos', 'Dólar, inflación y promos')}
    </div>

    <div class="menu-grupo"><span class="menu-label">La app</span>
      <div class="menu-item static"><span class="menu-ic">${icon('sun', 20)}</span><span class="grow"><span class="name">Tema</span>${seg('setTema', temaActual(), [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']])}</span></div>
      <div class="menu-item static"><span class="menu-ic">${icon('text', 20)}</span><span class="grow"><span class="name">Tamaño de letra</span>${seg('setLetra', letraActual(), [['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Más grande']])}</span></div>
      ${instalada() ? '' : item('instalarApp', 'phone', 'Instalar Pesitos como app', 'En la pantalla de inicio del celular')}
      ${item('openCopia', 'download', 'Copia de seguridad', 'Descargar o restaurar tus datos')}
    </div>

    <div class="menu-grupo"><span class="menu-label">Tu cuenta</span>
      ${item('openMiCuenta', 'user', 'Mi cuenta', 'Nombre, contraseña y eliminar cuenta')}
      ${item('openSeguridad', 'shield', 'Seguridad y privacidad', 'Cómo se cuidan tus datos')}
      <button class="menu-item" data-action="cerrarSesion"><span class="menu-ic">${icon('logout', 20)}</span><span class="grow"><span class="name">Cerrar sesión</span></span></button>
    </div>`;
}

export const menuActions = {
  openMenu(ctx) { openModal('Menú', menuHtml(ctx)); },

  openMiCuenta(ctx) { abrirMiCuenta(ctx.session); },

  cerrarSesion() { closeModal(); salir(); },

  setTema(ctx, el) { aplicarTema(el.dataset.v); openModal('Menú', menuHtml(ctx)); },
  setLetra(ctx, el) { aplicarLetra(el.dataset.v); openModal('Menú', menuHtml(ctx)); },

  openMisDatos(ctx) {
    const s = ctx.state;
    openModal('Mis datos', `<form class="form" data-submit="saveSettings">
      <div class="field"><label for="s-name">Tu nombre</label><input id="s-name" name="name" value="${esc(s.profile.name)}"></div>
      <div class="field"><label for="s-pay">Día de cobro</label><input id="s-pay" name="payday" inputmode="numeric" value="${s.profile.payday}"></div>
      <div class="field"><label for="s-prov">Provincia (para las promos de tu zona)</label><select id="s-prov" name="province"><option value="">Sin elegir: solo promos de todo el país</option>${PROVINCES.map((p) => `<option value="${esc(p)}" ${s.profile.province === p ? 'selected' : ''}>${esc(provinceLabel(p))}</option>`).join('')}</select></div>
      <button class="btn primary block" type="submit">Guardar</button>
    </form>`, { push: true });
  },
  saveSettings(ctx, d) {
    ctx.commit((s) => {
      s.profile.name = d.name.trim();
      s.profile.payday = Math.min(31, Math.max(1, parseInt(d.payday, 10) || 1));
      s.profile.province = PROVINCES.includes(d.province) ? d.province : '';
    });
    closeModal(); toast('Datos guardados');
    refreshLive(ctx, true);
  },

  openDatosVivos(ctx) {
    const s = ctx.state;
    const l = lastIpc(s);
    openModal('Datos que se actualizan solos', `<div class="card">
      <span class="small"><b>Cotizaciones</b> (dólar blue de DolarHoy, monedas, cripto y oro): ${esc(ratesAge(s))}.</span>
      <span class="small"><b>Inflación del INDEC:</b> ${l ? `último dato ${l.mk.split('-').reverse().join('/')} (${String(l.value).replace('.', ',')}%)` : 'esperando el primer dato'}.</span>
      <span class="small"><b>Promos:</b> ${esc(promosStatus(s))}</span></div>
      <p class="small muted" style="margin:0">No tenés que cargar nada de esto: Pesitos lo busca solo.</p>`, { push: true });
  },

  instalarApp() {
    if (instalar) { instalar.prompt(); instalar.userChoice.finally(() => { instalar = null; }); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    openModal('Instalar Pesitos', `<p class="text" style="margin:0">${ios
      ? 'En Safari tocá <b>Compartir</b> (el cuadrado con la flecha) y después <b>Agregar a inicio</b>.'
      : 'En Chrome tocá el menú <b>⋮</b> y después <b>Agregar a pantalla de inicio</b> o <b>Instalar app</b>.'}</p>
      <p class="small muted" style="margin:0">Así la abrís como cualquier app y podés usar "Compartir → Pesitos" con tus comprobantes.</p>`, { push: true });
  },

  openCopia(ctx) {
    openModal('Copia de seguridad', `<p class="text" style="margin:0">Tus datos ya se guardan solos en tu cuenta. Si además querés un archivo propio, descargalo acá.</p>
      <div class="btn-row"><button class="btn small" data-action="exportData">${icon('download', 18)} Descargar copia</button><label class="btn small" for="import-file">Restaurar copia</label></div>
      <input id="import-file" type="file" accept="application/json" class="sr-only" data-change="importData">
      ${ctx.state.ready ? '' : '<button class="btn small" data-action="loadDemo">Ver la app con datos de ejemplo</button>'}
      <button class="btn small ghost danger" data-action="resetAll">Borrar todos mis datos y empezar de cero</button>`, { push: true });
  },

  openSeguridad() {
    openModal('Seguridad y privacidad', `<div class="card">
      <span class="small">🔒 Tus datos se guardan en tu cuenta (Google Firebase) y <b>solo vos</b> podés verlos: lo aseguran las reglas de la base de datos.</span>
      <span class="small">📵 Pesitos no se conecta a tu banco ni pide claves bancarias. Lo que sabe es lo que cargás vos.</span>
      <span class="small">🚫 No vendemos ni compartimos tus datos, y no hay publicidad.</span>
      <span class="small">🗑 Podés descargar una copia o eliminar tu cuenta y todos tus datos cuando quieras, desde Mi cuenta.</span></div>
      <div class="btn-row"><a class="btn small" href="pages/privacidad.html" target="_blank" rel="noopener">Política de privacidad</a><a class="btn small" href="pages/terminos.html" target="_blank" rel="noopener">Términos y condiciones</a></div>`, { push: true });
  },
};

export const exportName = () => `pesitos-${todayISO()}.json`;
