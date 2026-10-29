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
import { usuarioActual, abrirMiCuenta, salir, verLegal } from './autenticacion.js';
import { reglaDeCobro, textoDeCobro, fechaDeCobro } from './feriados.js';
import { abrirConfigBloqueo } from './bloqueo.js';
import { avisosActivos, avisosSoportados, activarAvisos, desactivarAvisos } from './avisos.js';
import { campoCiudad, activarCiudades } from './ciudades.js';

// Cuándo cobrás: tipo + número (día del mes o número de día hábil)
export function campoCobro(profile) {
  const r = reglaDeCobro(profile);
  const n = r.tipo === 'dia' ? r.dia : r.tipo === 'habil' ? r.n : '';
  const prox = (() => {
    const t = new Date(); const hoy = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    let f = fechaDeCobro(profile, t.getFullYear(), t.getMonth());
    if (f < hoy) { const nx = new Date(t.getFullYear(), t.getMonth() + 1, 1); f = fechaDeCobro(profile, nx.getFullYear(), nx.getMonth()); }
    return f;
  })();
  return `<div class="field"><label for="s-pt">¿Cuándo cobrás?</label>
    <div class="field-row"><select id="s-pt" name="payTipo" data-change="payTipoChanged">
      <option value="dia" ${r.tipo === 'dia' ? 'selected' : ''}>Un día fijo del mes</option>
      <option value="habil" ${r.tipo === 'habil' ? 'selected' : ''}>Un día hábil (1.º, 2.º, 5.º…)</option>
      <option value="ultimoHabil" ${r.tipo === 'ultimoHabil' ? 'selected' : ''}>El último día hábil</option>
      <option value="ultimo" ${r.tipo === 'ultimo' ? 'selected' : ''}>El último día del mes</option>
      <option value="varia" ${r.tipo === 'varia' ? 'selected' : ''}>Varía</option></select>
    <input name="payN" inputmode="numeric" aria-label="Número de día" value="${n}" placeholder="${r.tipo === 'habil' ? 'N.º de día hábil' : 'Día'}" ${['dia', 'habil'].includes(r.tipo) ? '' : 'hidden'}></div>
    <span class="hint">Hoy: ${esc(textoDeCobro(profile))}${r.tipo === 'varia' ? '' : ` · próximo cobro: ${prox.getDate()}/${prox.getMonth() + 1}`}. Cuento fines de semana y feriados.</span></div>`;
}
export function reglaDesdeForm(d) {
  const n = parseInt(d.payN, 10);
  switch (d.payTipo) {
    case 'dia': return n >= 1 && n <= 31 ? (n === 31 ? { tipo: 'ultimo' } : { tipo: 'dia', dia: n }) : null;
    case 'habil': return n >= 1 && n <= 22 ? { tipo: 'habil', n } : null;
    case 'ultimoHabil': case 'ultimo': case 'varia': return { tipo: d.payTipo };
    default: return null;
  }
}

// Instalar como app (Chrome/Android avisa que se puede)
let instalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalar = e; });
window.addEventListener('appinstalled', () => { instalar = null; document.querySelectorAll('.card-instalar').forEach((c) => c.remove()); toast('¡Pesitos quedó instalada!'); });
export const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

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
      <span class="meta sync">${icon(ic, 14)} ${s.demo ? 'Datos de ejemplo: no se guardan en tu cuenta' : esc(estado)}</span></span><span class="menu-cuenta-cta">Mi cuenta ${icon('chevron', 16)}</span></button>

    <div class="menu-grupo verde"><span class="menu-label">Tu plata</span>
      ${item('openMisDatos', 'user', 'Mis datos', 'Nombre, cuándo cobrás, provincia y ciudad')}
      ${item('openWallets', 'wallet', 'Mis medios de pago', 'Bancos, billeteras y tarjetas')}
      ${item('openDatosVivos', 'refresh', 'Datos que se actualizan solos', 'Dólar, inflación y promos')}
    </div>

    <div class="menu-grupo lima"><span class="menu-label">La app</span>
      ${item('openAyuda', 'help', 'Ayuda y tutorial', 'Cómo usar Pesitos y preguntas frecuentes')}
      <div class="menu-item static"><span class="menu-ic">${icon('sun', 20)}</span><span class="grow"><span class="name">Tema</span>${seg('setTema', temaActual(), [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']])}</span></div>
      <div class="menu-item static"><span class="menu-ic">${icon('text', 20)}</span><span class="grow"><span class="name">Tamaño de letra</span>${seg('setLetra', letraActual(), [['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Más grande']])}</span></div>
      ${instalada() ? '' : item('instalarApp', 'phone', 'Instalar Pesitos como app', 'En la pantalla de inicio del celular')}
      ${item('openImportar', 'upload', 'Importar movimientos', 'Resumen de tarjeta (PDF) o Excel del banco')}
      ${item('openCopia', 'download', 'Copia de seguridad', 'Descargar o restaurar tus datos')}
    </div>

    <div class="menu-grupo ambar"><span class="menu-label">Tu cuenta y seguridad</span>
      ${item('openMiCuenta', 'user', 'Mi cuenta', 'Nombre, contraseña, clave de Pesitos y eliminar cuenta')}
      ${item('openBloqueo', 'lock', 'Bloqueo con huella o PIN', 'Que nadie abra Pesitos sin vos')}
      ${item('openAvisos', 'bell', 'Avisos en el celular', avisosActivos(ctx.uid) ? 'Activados' : 'Vencimientos, cierres y cobros, aunque no abras la app')}
      ${item('openSeguridad', 'shield', 'Seguridad y privacidad', 'Cómo se cuidan tus datos')}
      <button class="menu-item salir" data-action="cerrarSesion"><span class="menu-ic">${icon('logout', 20)}</span><span class="grow"><span class="name">Cerrar sesión</span></span></button>
    </div>`;
}

export const menuActions = {
  openMenu(ctx) { openModal('Menú', menuHtml(ctx)); },

  openMiCuenta(ctx) { abrirMiCuenta(ctx.session); },
  openAvisos(ctx) {
    const on = avisosActivos(ctx.uid);
    openModal('Avisos en el celular', `<p class="text" style="margin:0">Te aviso a la mañana cuando:</p>
      <div class="card"><span class="small">📅 Mañana o hoy vence un pago (fijos, tarjetas, pagos programados)</span><span class="small">💳 Hoy cierra tu tarjeta</span><span class="small">💸 Hoy es día de cobro</span><span class="small">🤝 Vence una deuda o préstamo</span></div>
      <p class="small muted" style="margin:0">🔒 Para poder avisarte con la app cerrada, el servidor guarda solo <b>qué días</b> hay algo y cuántas cosas (por ejemplo, "2 vencimientos el 5/11"). Nunca montos, nombres ni comercios: eso sigue cifrado.</p>
      ${avisosSoportados() ? `<button class="btn ${on ? '' : 'primary'} block" data-action="${on ? 'avisosOff' : 'avisosOn'}">${on ? 'Desactivar avisos' : 'Activar avisos'}</button>` : '<p class="text"><b>Este navegador no permite avisos.</b> En iPhone, primero instalá Pesitos en la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.</p>'}`, { push: true });
  },
  async avisosOn(ctx) { try { if (await activarAvisos(ctx.state, ctx.uid)) { closeModal(); toast('Listo: te aviso a la mañana cuando haya algo'); } } catch (e) { console.warn(e); toast('No se pudieron activar los avisos. Probá de nuevo.'); } },
  async avisosOff(ctx) { await desactivarAvisos(ctx.uid); closeModal(); toast('Avisos desactivados'); },
  openBloqueo() { const u = usuarioActual(); abrirConfigBloqueo(u && u.email); },

  cerrarSesion() { closeModal(); salir(); },

  setTema(ctx, el) { aplicarTema(el.dataset.v); openModal('Menú', menuHtml(ctx)); },
  setLetra(ctx, el) { aplicarLetra(el.dataset.v); openModal('Menú', menuHtml(ctx)); },

  openMisDatos(ctx) {
    const s = ctx.state;
    openModal('Mis datos', `<form class="form" data-submit="saveSettings">
      <div class="field"><label for="s-name">Tu nombre</label><input id="s-name" name="name" value="${esc(s.profile.name)}"></div>
      ${campoCobro(s.profile)}
      <div class="field"><label for="s-prov">Provincia (para las promos de tu zona)</label><select id="s-prov" name="province" data-change="ciudadProvincia"><option value="">Sin elegir: solo promos de todo el país</option>${PROVINCES.map((p) => `<option value="${esc(p)}" ${s.profile.province === p ? 'selected' : ''}>${esc(provinceLabel(p))}</option>`).join('')}</select></div>
      <div class="field"><label for="s-city">Ciudad (algunas promos son solo de una ciudad)</label>${campoCiudad({ id: 's-city', prov: s.profile.province, valor: s.profile.city || '' })}</div>
      <button class="btn primary block" type="submit">Guardar</button>
    </form>`, { push: true });
    activarCiudades(document.getElementById('modal'));
  },
  payTipoChanged(ctx, el) {
    const i = el.closest('.field').querySelector('[name=payN]');
    if (!i) return;
    i.hidden = !['dia', 'habil'].includes(el.value);
    i.placeholder = el.value === 'habil' ? 'N.º de día hábil' : 'Día';
  },
  saveSettings(ctx, d) {
    ctx.commit((s) => {
      s.profile.name = d.name.trim();
      const regla = reglaDesdeForm(d);
      if (regla) { s.profile.payRule = regla; s.profile.paydayVaries = regla.tipo === 'varia'; s.profile.payday = regla.tipo === 'dia' ? regla.dia : regla.tipo === 'ultimo' ? 31 : 1; }
      s.profile.province = PROVINCES.includes(d.province) ? d.province : '';
      s.profile.city = String(d.city || '').trim().slice(0, 40);
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
      <span class="small">🔐 <b>Cifrado de extremo a extremo:</b> tus datos se cifran en este dispositivo antes de guardarse. En la nube solo hay texto ilegible.</span>
      <span class="small">👀 <b>Nadie más puede verlos:</b> ni otras personas, ni quien administra Pesitos. Solo se abren con tu clave de Pesitos o tu código de recuperación.</span>
      <span class="small">🚫 No se venden, no se comparten y no hay publicidad ni seguimiento.</span>
      <span class="small">📵 Pesitos no se conecta a tu banco ni te pide claves bancarias.</span>
      <span class="small">🗑 Podés descargar una copia o eliminar tu cuenta y todos tus datos cuando quieras, desde Mi cuenta.</span></div>
      <button class="btn block" data-action="openMiCuenta">🔐 Clave de Pesitos y código de recuperación</button>
      <div class="btn-row"><button class="btn small" data-action="verLegalMenu" data-cual="privacidad">Política de privacidad</button><button class="btn small" data-action="verLegalMenu" data-cual="terminos">Términos y condiciones</button></div>`, { push: true });
  },
  verLegalMenu(ctx, el) { verLegal(el.dataset.cual); },
};

export const exportName = () => `pesitos-${todayISO()}.json`;
