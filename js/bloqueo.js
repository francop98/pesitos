// =========================================================
// Pesitos — bloqueo con huella / cara o PIN
// Se guarda solo en este dispositivo (cada celular tiene su propio bloqueo).
// - PIN de 4 a 6 números (guardado como hash PBKDF2, nunca el PIN).
// - Huella o cara con el lector del celular (WebAuthn, sin servidor).
// - Se bloquea al abrir la app y al volver después de un rato.
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

const leer = () => { try { return JSON.parse(localStorage.getItem(clave(uidActual))) || null; } catch { return null; } };
const guardar = (c) => { try { if (c) localStorage.setItem(clave(uidActual), JSON.stringify(c)); else localStorage.removeItem(clave(uidActual)); } catch { /* nada */ } };
export const bloqueoActivo = () => Boolean(uidActual && leer() && (leer().pin || leer().bio));

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
    <button class="btn ghost small bloqueo-olvide" data-bloqueo="olvide">Olvidé mi PIN / no puedo entrar</button>
  </div>`;
}

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
    const listo = () => { abierto = false; intentos = 0; capa.hidden = true; capa.innerHTML = ''; document.body.classList.remove('bloqueado'); document.removeEventListener('keydown', teclas); resolver(); };
    const probarPin = async () => {
      if (Date.now() < esperaHasta) { pin = ''; dibujar(`Esperá ${Math.ceil((esperaHasta - Date.now()) / 1000)} segundos.`); return; }
      if (await pinCorrecto(pin)) { listo(); return; }
      intentos++; pin = '';
      if (intentos >= 10) { guardar(null); listo(); if (alOlvidar) alOlvidar(); return; }
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
        dibujar('Para entrar sin el PIN tenés que volver a iniciar sesión y escribir tu clave de Pesitos. ¿Seguimos?');
        capa.querySelector('.bloqueo-olvide').outerHTML = '<div class="btn-row"><button class="btn" data-bloqueo="cancelar">Cancelar</button><button class="btn lime" data-bloqueo="salir">Iniciar sesión de nuevo</button></div>';
      }
      if (b.dataset.bloqueo === 'cancelar') dibujar();
      if (b.dataset.bloqueo === 'salir') { guardar(null); listo(); if (alOlvidar) alOlvidar(); }
    };
    dibujar();
    if (leer().bio) setTimeout(async () => { if (abierto && await verificarBio()) listo(); }, 300);
  });
}

/** Activa el control: bloquea al volver a la app después de un rato. */
export function iniciarBloqueo(uid, { onOlvido } = {}) {
  uidActual = uid; alOlvidar = onOlvido || null;
}
export function terminarBloqueo() { uidActual = null; const c = document.getElementById('bloqueo'); if (c) { c.hidden = true; c.innerHTML = ''; } document.body.classList.remove('bloqueado'); abierto = false; }

document.addEventListener('visibilitychange', () => {
  if (!bloqueoActivo()) return;
  if (document.visibilityState === 'hidden') {
    ocultoDesde = Date.now();
    // si el bloqueo es inmediato, se tapa ya (así el selector de apps no muestra tus números)
    if ((leer().minutos ?? 1) === 0) document.body.classList.add('bloqueado');
    return;
  }
  const min = leer().minutos ?? 1;
  if (ocultoDesde && Date.now() - ocultoDesde >= min * 60000) mostrarBloqueo();
  else if (!abierto) document.body.classList.remove('bloqueado');
});

// ---------- configuración (menú) ----------
export async function abrirConfigBloqueo(email) {
  const c = leer() || {};
  const bio = await bioDisponible();
  openModal('Bloqueo de la app', `
    <p class="text muted" style="margin:0">Pedí tu huella, tu cara o un PIN para abrir Pesitos en este dispositivo. Así nadie que agarre tu celular ve tu plata.</p>
    <div class="card">
      <div class="split"><span><b>PIN</b><br><span class="small muted">${c.pin ? `Activado (${c.pin.largo} números)` : 'Desactivado'}</span></span><button class="btn small" data-action="bloqueoPin">${c.pin ? 'Cambiar' : 'Crear PIN'}</button></div>
      <div class="split"><span><b>Huella o cara</b><br><span class="small muted">${!bio ? 'Este dispositivo no tiene o el navegador no lo permite' : c.bio ? 'Activado' : 'Desactivado'}</span></span>${bio ? `<button class="btn small" data-action="bloqueoBio">${c.bio ? 'Desactivar' : 'Activar'}</button>` : ''}</div>
    </div>
    ${c.pin || c.bio ? `<div class="field"><label for="bl-t">Bloquear cuando vuelvo a la app después de</label><select id="bl-t" data-change="bloqueoTiempo">${[[0, 'Siempre (al instante)'], [1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos']].map(([v, l]) => `<option value="${v}" ${(c.minutos ?? 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <button class="btn ghost small danger" data-action="bloqueoQuitar">Quitar el bloqueo</button>` : ''}
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
    const c = leer() || {};
    guardar({ ...c, pin: { salt: b64(salt), hash: await hashPin(pin, salt), largo: pin.length }, minutos: c.minutos ?? 1 });
    closeModal(); toast('PIN activado: te lo voy a pedir al abrir Pesitos');
  },
  async bloqueoBio() {
    const c = leer() || {};
    if (c.bio) { guardar({ ...c, bio: null }); closeModal(); toast('Huella o cara desactivada'); return; }
    try {
      const id = await registrarBio(window.__pesitosEmail);
      guardar({ ...c, bio: id, minutos: c.minutos ?? 1 });
      closeModal(); toast(c.pin ? 'Listo: podés entrar con huella, cara o PIN' : 'Listo. Te recomiendo crear también un PIN por si falla el lector');
    } catch { toast('No se pudo activar. Probá de nuevo.'); }
  },
  bloqueoTiempo(ctx, el) { const c = leer() || {}; guardar({ ...c, minutos: Number(el.value) }); toast('Guardado'); },
  bloqueoQuitar() { guardar(null); closeModal(); toast('Bloqueo quitado'); },
};
