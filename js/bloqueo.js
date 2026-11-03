// =========================================================
// Pesitos — PIN de seguridad y huella / cara
// - El PIN es de tu cuenta (4 a 6 números, se guarda solo su hash PBKDF2): sirve en
//   todos tus dispositivos y se pide cada vez que iniciás sesión. Si querés, también
//   al abrir la app o al volver después de un rato (configurable; por defecto, no).
// - Huella o cara: de cada dispositivo (WebAuthn, sin servidor), reemplaza al PIN ahí.
// - Al volver a la app después de un rato también se pide (configurable).
// - "Olvidé mi PIN": cerrás sesión, volvés a entrar con tu mail o Google y creás otro.
// =========================================================

import { esc } from './formato.js';
import { wordmark, icon, openModal, closeModal, toast } from './interfaz.js';

const clave = (uid) => `pesitos_bloqueo:${uid}`;
const enc = new TextEncoder();
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let uidActual = null;
let ocultoDesde = 0;
let abierto = false;
let intentos = 0;
let esperaHasta = 0;
let alOlvidar = null;
let pinCuenta = null;      // { salt, hash, largo } de la cuenta
let guardarPinCuenta = null;

const leerLocal = () => { try { return JSON.parse(localStorage.getItem(clave(uidActual))) || null; } catch { return null; } };
// la config de este dispositivo (huella, tiempo) + el PIN de la cuenta
const leer = () => { const l = leerLocal() || {}; return { ...l, pin: pinCuenta || null }; };
const guardar = (c) => { try { if (c) { const { pin, ...resto } = c; localStorage.setItem(clave(uidActual), JSON.stringify(resto)); } else localStorage.removeItem(clave(uidActual)); } catch { /* nada */ } };
/** PIN que tenía este dispositivo con la versión anterior (para no pedir uno nuevo). */
export const pinDelDispositivo = (uid) => { try { const c = JSON.parse(localStorage.getItem(clave(uid))); return (c && c.pin) || null; } catch { return null; } };
export const bioActiva = () => Boolean(uidActual && leer().bio);
export const bloqueoActivo = () => Boolean(uidActual && (pinCuenta || leer().bio));
const K_RESET = (uid) => `pesitos_pin_reset:${uid}`;
export const pinParaRehacer = (uid) => { try { return localStorage.getItem(K_RESET(uid)) === '1'; } catch { return false; } };
// sesión ya desbloqueada con el PIN en este dispositivo (se borra al cerrar sesión)
const K_SES = (uid) => `pesitos_sesion_pin:${uid}`;
export const sesionConPin = (uid) => { try { return localStorage.getItem(K_SES(uid)) === '1'; } catch { return false; } };
export const marcarSesionConPin = (uid) => { try { localStorage.setItem(K_SES(uid), '1'); } catch { /* nada */ } };
export const olvidarSesionConPin = (uid) => { try { localStorage.removeItem(K_SES(uid)); } catch { /* nada */ } };
/** ¿Hay que pedir el PIN al abrir la app? Siempre si es un inicio de sesión; si no, según la configuración. */
export function pedirPinAlAbrir(uid) {
  if (!sesionConPin(uid)) return true;
  let m = -1; try { const c = JSON.parse(localStorage.getItem(clave(uid))); if (c && typeof c.minutos === 'number') m = c.minutos; } catch { /* nada */ }
  return m !== -1;
}
export const pinRehecho = (uid) => { try { localStorage.removeItem(K_RESET(uid)); } catch { /* nada */ } };

async function hashPin(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, 256));
}
async function pinCorrecto(pin) {
  const c = leer();
  if (!c || !c.pin) return false;
  return (await hashPin(pin, deB64(c.pin.salt))) === c.pin.hash;
}

export async function bioDisponible() {
  try { return Boolean(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
async function registrarBio(email) {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'Pesitos' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: email || 'pesitos', displayName: email || 'Pesitos' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000,
  } });
  return b64(cred.rawId);
}
async function verificarBio() {
  const c = leer();
  if (!c || !c.bio) return false;
  try {
    const r = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: deB64(c.bio) }], userVerification: 'required', timeout: 60000 } });
    return Boolean(r);
  } catch { return false; }
}

// ---------- pantalla de bloqueo ----------
function pantalla(nota = '') {
  const c = leer();
  return `<div class="bloqueo-caja" role="dialog" aria-modal="true" aria-label="Pesitos está bloqueado">
    <div class="bloqueo-top">${wordmark(30, '#FFFFFF', '#C6F36B')}<span>${icon('lock', 18)} Bloqueado</span></div>
    ${c.pin ? `<div class="pin-puntos" aria-live="polite">${[0, 1, 2, 3, 4, 5].slice(0, c.pin.largo).map((i) => `<i data-i="${i}"></i>`).join('')}</div>
    <p class="bloqueo-nota" role="alert">${esc(nota)}</p>
    <div class="pin-teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-pin="${n}">${n}</button>`).join('')}
      ${c.bio ? `<button type="button" data-bloqueo="bio" aria-label="Usar huella o cara">${icon('eye', 24)}</button>` : '<span></span>'}<button type="button" data-pin="0">0</button><button type="button" data-bloqueo="borrar" aria-label="Borrar">⌫</button></div>`
    : `<p class="bloqueo-nota" role="alert">${esc(nota)}</p><button class="btn lime block" data-bloqueo="bio">${icon('eye', 20)} Desbloquear con huella o cara</button>`}
    <button class="btn ghost small bloqueo-olvide" data-bloqueo="olvide">${c.pin ? 'Olvidé mi PIN / no puedo entrar' : 'No puedo entrar'}</button>
  </div>`;
}

// después de "olvidé mi PIN": al volver a entrar se crea uno nuevo
function olvidado() { try { localStorage.setItem(K_RESET(uidActual), '1'); localStorage.removeItem(K_SES(uidActual)); } catch { /* nada */ } }

/** Muestra el bloqueo y resuelve cuando se desbloquea. */
export function mostrarBloqueo() {
  if (!bloqueoActivo() || abierto) return Promise.resolve();
  abierto = true;
  document.body.classList.add('bloqueado');
  let capa = document.getElementById('bloqueo');
  if (!capa) { capa = document.createElement('div'); capa.id = 'bloqueo'; document.body.appendChild(capa); }
  let pin = '';
  return new Promise((resolver) => {
    const dibujar = (nota = '') => { capa.innerHTML = pantalla(nota); capa.hidden = false; marcar(); };
    const marcar = () => capa.querySelectorAll('.pin-puntos i').forEach((el, i) => el.classList.toggle('on', i < pin.length));
    const cerrarCapa = () => { abierto = false; intentos = 0; capa.hidden = true; capa.innerHTML = ''; document.body.classList.remove('bloqueado'); document.removeEventListener('keydown', teclas); };
    const listo = () => { cerrarCapa(); resolver(); };
    // olvidé el PIN: se cierra la sesión (la app no sigue abriéndose)
    const porOlvido = () => { olvidado(); cerrarCapa(); if (alOlvidar) alOlvidar(); };
    const probarPin = async () => {
      if (Date.now() < esperaHasta) { pin = ''; dibujar(`Esperá ${Math.ceil((esperaHasta - Date.now()) / 1000)} segundos.`); return; }
      if (await pinCorrecto(pin)) { listo(); return; }
      intentos++; pin = '';
      if (intentos >= 10) { porOlvido(); return; }
      if (intentos % 5 === 0) esperaHasta = Date.now() + 30000;
      capa.querySelector('.pin-puntos')?.classList.add('mal');
      dibujar(intentos % 5 === 0 ? 'Demasiados intentos. Esperá 30 segundos.' : `PIN incorrecto. ${intentos >= 5 ? `Te quedan ${10 - intentos} intentos.` : 'Probá de nuevo.'}`);
    };
    const tocar = async (n) => {
      const c = leer();
      if (!c.pin || pin.length >= c.pin.largo) return;
      pin += n; marcar();
      if (pin.length === c.pin.largo) await probarPin();
    };
    const teclas = (e) => { if (/^\d$/.test(e.key)) tocar(e.key); if (e.key === 'Backspace') { pin = pin.slice(0, -1); marcar(); } };
    document.addEventListener('keydown', teclas);
    capa.onclick = async (e) => {
      const p = e.target.closest('[data-pin]');
      if (p) { tocar(p.dataset.pin); return; }
      const b = e.target.closest('[data-bloqueo]');
      if (!b) return;
      if (b.dataset.bloqueo === 'borrar') { pin = pin.slice(0, -1); marcar(); }
      if (b.dataset.bloqueo === 'bio') { if (await verificarBio()) listo(); else dibujar('No se pudo verificar. Probá de nuevo o usá el PIN.'); }
      if (b.dataset.bloqueo === 'olvide') {
        dibujar('Para crear un PIN nuevo, cerrás sesión y volvés a entrar con tu mail y contraseña (o con Google). Tus datos no se pierden. ¿Seguimos?');
        capa.querySelector('.bloqueo-olvide').outerHTML = '<div class="btn-row"><button class="btn" data-bloqueo="cancelar">Cancelar</button><button class="btn lime" data-bloqueo="salir">Iniciar sesión de nuevo</button></div>';
      }
      if (b.dataset.bloqueo === 'cancelar') dibujar();
      if (b.dataset.bloqueo === 'salir') porOlvido();
    };
    dibujar();
    if (leer().bio) setTimeout(async () => { if (abierto && await verificarBio()) listo(); }, 300);
  });
}

/** Activa el control: bloquea al volver a la app después de un rato. */
export function iniciarBloqueo(uid, { onOlvido, pin, guardarPin } = {}) {
  uidActual = uid; alOlvidar = onOlvido || null; pinCuenta = pin || null; guardarPinCuenta = guardarPin || null;
}
export function terminarBloqueo() { uidActual = null; pinCuenta = null; const c = document.getElementById('bloqueo'); if (c) { c.hidden = true; c.innerHTML = ''; } document.body.classList.remove('bloqueado'); abierto = false; }

document.addEventListener('visibilitychange', () => {
  if (!bloqueoActivo()) return;
  if (document.visibilityState === 'hidden') {
    ocultoDesde = Date.now();
    // si el bloqueo es inmediato, se tapa ya (así el selector de apps no muestra tus números)
    if ((leer().minutos ?? -1) === 0) document.body.classList.add('bloqueado');
    return;
  }
  const min = leer().minutos ?? -1;
  if (min >= 0 && ocultoDesde && Date.now() - ocultoDesde >= min * 60000) mostrarBloqueo();
  else if (!abierto) document.body.classList.remove('bloqueado');
});

// ---------- configuración (menú) ----------
export async function abrirConfigBloqueo(email) {
  const c = leer();
  const bio = await bioDisponible();
  openModal('PIN de seguridad', `
    <p class="text muted" style="margin:0">Te pido el PIN cada vez que iniciás sesión. Es el mismo en todos tus dispositivos.</p>
    <div class="card">
      <div class="split"><span><b>PIN</b><br><span class="small muted">${c.pin ? `Activado (${c.pin.largo} números)` : 'Sin PIN'}</span></span><button class="btn small" data-action="bloqueoPin">${c.pin ? 'Cambiar' : 'Crear PIN'}</button></div>
      <div class="split"><span><b>Huella o cara</b><br><span class="small muted">${!bio ? 'Este dispositivo no tiene o el navegador no lo permite' : c.bio ? 'Activada en este dispositivo: la uso en lugar del PIN' : 'Desactivada'}</span></span>${bio ? `<button class="btn small" data-action="bloqueoBio">${c.bio ? 'Desactivar' : 'Activar'}</button>` : ''}</div>
    </div>
    <div class="field"><label for="bl-t">¿Cuándo te lo pido?</label><select id="bl-t" data-change="bloqueoTiempo">${[[-1, 'Solo cuando iniciás sesión'], [-2, 'También cada vez que abro la app'], [5, 'Al abrir y al volver después de 5 minutos'], [1, 'Al abrir y al volver después de 1 minuto'], [0, 'Al abrir y cada vez que vuelvo a la app']].map(([v, l]) => `<option value="${v}" ${(c.minutos ?? -1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <p class="small muted" style="margin:0">¿Te olvidaste el PIN? En la pantalla del PIN tocá "Olvidé mi PIN": volvés a entrar con tu mail o Google y creás otro. Tus datos no se pierden.</p>
  `, { push: true });
  window.__pesitosEmail = email;
}

function pedirPinNuevo() {
  return new Promise((resolver) => {
    openModal('Elegí un PIN', `<form class="form" id="f-pin" autocomplete="off">
      <div class="field"><label for="pin-1">PIN de 4 a 6 números</label><input id="pin-1" name="a" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" required autocomplete="new-password"></div>
      <div class="field"><label for="pin-2">Repetilo</label><input id="pin-2" name="b" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" required autocomplete="new-password"></div>
      <p class="auth-error" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Guardar PIN</button></form>`, { push: true });
    const f = document.getElementById('f-pin');
    f.onsubmit = (e) => {
      e.preventDefault();
      const err = f.querySelector('.auth-error');
      if (!/^\d{4,6}$/.test(f.a.value)) { err.textContent = 'Tienen que ser de 4 a 6 números.'; err.hidden = false; return; }
      if (f.a.value !== f.b.value) { err.textContent = 'No coinciden.'; err.hidden = false; return; }
      resolver(f.a.value);
    };
  });
}

export const bloqueoActions = {
  async bloqueoPin() {
    const pin = await pedirPinNuevo();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const datos = { salt: b64(salt), hash: await hashPin(pin, salt), largo: pin.length };
    pinCuenta = datos;
    try { if (guardarPinCuenta) await guardarPinCuenta(datos); } catch { toast('Sin conexión: el PIN nuevo se guarda en tu cuenta cuando vuelva internet'); }
    closeModal(); toast('PIN cambiado: vale en todos tus dispositivos');
  },
  async bloqueoBio() {
    const c = leer() || {};
    if (c.bio) { guardar({ ...c, bio: null }); closeModal(); toast('Huella o cara desactivada'); return; }
    try {
      const id = await registrarBio(window.__pesitosEmail);
      guardar({ ...c, bio: id });
      closeModal(); toast('Listo: en este dispositivo podés entrar con huella, cara o PIN');
    } catch { toast('No se pudo activar. Probá de nuevo.'); }
  },
  bloqueoTiempo(ctx, el) { const c = leer() || {}; guardar({ ...c, minutos: Number(el.value) }); toast('Guardado'); },
};
