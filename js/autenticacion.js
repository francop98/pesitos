// =========================================================
// Pesitos — cuenta de usuario (Firebase Authentication)
// La cuenta es obligatoria: sin sesión iniciada se muestra esta pantalla.
// - Ingresar o crear cuenta con mail y contraseña (con verificación de mail).
// - Ingresar con Google.
// - Recuperar la contraseña.
// - Mi cuenta: nombre, cambiar contraseña, cerrar sesión y eliminar la cuenta.
// =========================================================

import { firebase } from './firebaseconfig.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
  deleteUser, signOut, setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { esc } from './formato.js';
import { wordmark, icon, sprout, openModal, closeModal, toast } from './interfaz.js';

let actual = null;
let errorPendiente = '';

const auth = () => firebase().auth;
export const usuarioActual = () => actual;
export const esPorMail = (u = actual) => Boolean(u && (u.providerData || []).some((p) => p.providerId === 'password'));
export const necesitaVerificar = (u = actual) => Boolean(u && esPorMail(u) && !u.emailVerified);

function traducir(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-credential': 'El mail o la contraseña no coinciden.',
    'auth/wrong-password': 'La contraseña no es correcta.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese mail.',
    'auth/invalid-email': 'El mail no parece válido.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese mail. Probá ingresar.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/missing-password': 'Escribí tu contraseña.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
    'auth/network-request-failed': 'No hay conexión. Revisá internet y probá de nuevo.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
    'auth/requires-recent-login': 'Por seguridad, volvé a confirmar tu identidad.',
    'auth/unauthorized-domain': 'Este dominio todavía no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
    'auth/operation-not-allowed': 'Este método de ingreso no está activado en Firebase (Authentication → Método de acceso).',
    'auth/account-exists-with-different-credential': 'Ese mail ya tiene una cuenta con otro método. Ingresá con mail y contraseña.',
  }[c];
  return m || (e && e.message ? `No se pudo completar: ${e.message}` : 'Algo salió mal. Probá de nuevo.');
}

/** Resuelve con el usuario (o null) cuando se sabe si hay sesión. Después avisa cada cambio. */
export function iniciar(alCambiar) {
  const a = auth();
  setPersistence(a, browserLocalPersistence).catch(() => {});
  getRedirectResult(a).catch((e) => { errorPendiente = traducir(e); });
  return new Promise((resolver) => {
    let primera = true;
    onAuthStateChanged(a, (u) => {
      actual = u;
      if (primera) { primera = false; resolver(u); return; }
      alCambiar(u);
    });
  });
}

// ---------- acciones ----------
async function ingresar(email, clave) { await signInWithEmailAndPassword(auth(), email.trim(), clave); }

async function crear(nombre, email, clave) {
  if (!nombre.trim()) throw new Error('Escribí tu nombre.');
  const cred = await createUserWithEmailAndPassword(auth(), email.trim(), clave);
  await updateProfile(cred.user, { displayName: nombre.trim().slice(0, 40) });
  await sendEmailVerification(cred.user).catch(() => {});
}

async function conGoogle() {
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth(), proveedor); }
  catch (e) {
    // algunos navegadores (o la app instalada) bloquean la ventana: se hace por redirección
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await signInWithRedirect(auth(), proveedor);
    else throw e;
  }
}

export async function salir() { await signOut(auth()); }

// ---------- pantalla de ingreso: charla, como la bienvenida ----------
// pasos: hola → (crear) nombre → mail → clave · (ingresar) mail → clave · recuperar
let flujo = 'crear';      // 'crear' | 'ingresar'
let paso = 'hola';
let datos = { nombre: '', email: '' };
let charla = [];          // [{ q, a }] lo ya respondido
let aviso = '';           // mensaje de error o novedad, dicho por Pesitos
let ocupado = false;
let aceptado = false;     // aceptó Términos y Privacidad en esta pantalla
export const LEGAL_VERSION = '2.0';
export const aceptoLegales = () => aceptado;

const googleIcon = () => '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const primerNombre = () => (datos.nombre || '').trim().split(' ')[0];
const chip = (que, label, extra = '', attrs = '') => `<button type="button" class="chip big ${extra}" data-auth="${que}" ${attrs}>${esc(label)}</button>`;
const send = () => `<button type="submit" class="icon-btn green" aria-label="Seguir">${icon('send', 20, 2.2)}</button>`;
const entrada = (name, placeholder, type = 'text', extra = '') => `<form class="quick" data-auth-form="${name}" autocomplete="on" novalidate>
    <label for="a-${name}" class="sr-only">${esc(placeholder)}</label>
    <input id="a-${name}" name="value" type="${type}" placeholder="${esc(placeholder)}" ${extra} data-autofocus enterkeyhint="next" required>
    ${type === 'password' ? `<button type="button" class="pass-eye inline" data-auth="ver" aria-label="Mostrar contraseña">${icon('eye', 20)}</button>` : ''}
    ${send()}</form>`;
const legal = () => `<p class="small muted auth-legal">Al ${flujo === 'crear' ? 'crear tu cuenta' : 'usar Pesitos'} aceptás los <button type="button" class="link" data-auth="terminos">Términos y condiciones</button> y la <button type="button" class="link" data-auth="privacidad">Política de privacidad</button>.</p>`;

function actual_() {
  switch (paso) {
    case 'hola': return {
      bubbles: ['¡Hola! Soy Pesitos, tu economista de bolsillo.', 'Antes de arrancar armemos tu cuenta: así tu plata queda guardada y la ves desde cualquier dispositivo. Es gratis.',
        '🔒 Tus datos son tuyos: se cifran en tu celular antes de guardarse, así que nadie más puede verlos, ni siquiera quien administra Pesitos. No se venden, no se comparten y no hay publicidad.'],
      controls: `<label class="check legal-check"><input type="checkbox" id="a-acepto" ${aceptado ? 'checked' : ''}> <span>Leí y acepto los <button type="button" class="link" data-auth="terminos">Términos y condiciones</button> y la <button type="button" class="link" data-auth="privacidad">Política de privacidad</button></span></label>
        <button type="button" class="btn block google" data-auth="google" ${aceptado ? '' : 'disabled'}>${googleIcon()} Seguir con Google</button>
        <div class="chips">${chip('nuevo', 'Crear cuenta con mail', 'primary', aceptado ? '' : 'disabled')}${chip('tengo', 'Ya tengo cuenta')}</div>
        ${aceptado ? '' : '<p class="small muted auth-legal">Para crear tu cuenta, primero aceptá los términos. Si ya tenés cuenta, tocá "Ya tengo cuenta".</p>'}`,
    };
    case 'nombre': return { bubbles: ['¡Buenísimo! ¿Cómo te llamo?'], controls: entrada('nombre', 'Tu nombre', 'text', 'autocomplete="given-name" maxlength="40"') };
    case 'mail': return {
      bubbles: [flujo === 'crear' ? `Un gusto, ${primerNombre()}. ¿Cuál es tu mail?` : '¡Qué bueno verte de nuevo! ¿Con qué mail entrás?'],
      controls: entrada('mail', 'tunombre@gmail.com', 'email', `autocomplete="email" inputmode="email" value="${esc(datos.email)}"`),
    };
    case 'clave': return {
      bubbles: [flujo === 'crear' ? 'Ahora elegí una contraseña para entrar. Al menos 8 caracteres, con letras y números.' : '¿Y tu contraseña?'],
      controls: `${entrada('clave', 'Contraseña', 'password', `autocomplete="${flujo === 'crear' ? 'new-password' : 'current-password'}" minlength="6"`)}
        ${flujo === 'ingresar' ? `<div class="chips">${chip('olvide', 'Olvidé mi contraseña')}${chip('otromail', 'Usar otro mail')}</div>` : ''}${flujo === 'crear' ? legal() : ''}`,
    };
    case 'recuperar': return {
      bubbles: ['Tranqui, pasa. Te mando un link para elegir una contraseña nueva. ¿A qué mail?'],
      controls: entrada('recuperar', 'tunombre@gmail.com', 'email', `autocomplete="email" inputmode="email" value="${esc(datos.email)}"`),
    };
    default: return { bubbles: [flujo === 'crear' ? 'Creando tu cuenta…' : 'Entrando…'], controls: '' };
  }
}

function pantalla() {
  const c = actual_();
  const atras = paso !== 'hola' && !ocupado;
  return `<section class="guide auth">
    <header class="guide-top">
      ${atras ? `<button class="icon-btn back on-green" data-auth="atras" aria-label="Volver">${icon('back', 20, 2.2)}</button>` : '<span style="width:44px"></span>'}
      <div class="guide-brand">${wordmark(26, '#FFFFFF', '#C6F36B')}<span>Tu economista de bolsillo</span></div>
      <span style="width:44px"></span></header>
    <div class="chat guide-chat">
      ${charla.map((t) => `<div class="bubble bot faded">${esc(t.q)}</div><div class="bubble me">${esc(t.a)}</div>`).join('')}
      ${c.bubbles.map((b, i) => `<div class="bot-row">${i === 0 ? `<span class="bot-avatar">${sprout(18)}</span>` : '<span class="bot-avatar ghost"></span>'}<div class="bubble bot">${esc(b)}</div></div>`).join('')}
      ${aviso ? `<div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot aviso" role="alert">${esc(aviso)}</div></div>` : ''}
    </div>
    <div class="guide-controls">${c.controls}</div>
  </section>`;
}

let contenedor = null;
function dibujar() {
  contenedor.innerHTML = pantalla();
  const f = contenedor.querySelector('[data-autofocus]');
  if (f && window.matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
  window.scrollTo(0, document.body.scrollHeight);
}
function ir(nuevo, respuesta) {
  if (respuesta !== undefined) charla.push({ paso, q: actual_().bubbles.slice(-1)[0], a: respuesta });
  paso = nuevo; aviso = ''; dibujar();
}
function reiniciar() { flujo = 'crear'; paso = 'hola'; datos = { nombre: '', email: '' }; charla = []; aviso = ''; ocupado = false; }

/** Muestra los Términos o la Política de privacidad dentro de la app. */
export async function verLegal(cual) {
  const titulo = cual === 'terminos' ? 'Términos y condiciones' : 'Política de privacidad';
  openModal(titulo, '<p class="text muted">Cargando…</p>');
  try {
    const html = await (await fetch(`pages/${cual}.html`)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.querySelector('.legal-content');
    const ver = doc.querySelector('.subtitle');
    openModal(titulo, `${ver ? `<span class="small muted">${esc(ver.textContent)}</span>` : ''}<div class="legal-content">${body ? body.innerHTML : ''}</div><button class="btn primary block" data-action="closeModal">Entendido</button>`);
  } catch { openModal(titulo, `<p class="text">No pude abrirlo sin conexión. Podés leerlo en <a href="pages/${cual}.html" target="_blank" rel="noopener">esta página</a>.</p>`); }
}

async function enviarCuenta() {
  ocupado = true; const anterior = paso; paso = 'enviando'; dibujar();
  try {
    if (flujo === 'crear') await crear(datos.nombre, datos.email, datos.clave);
    else await ingresar(datos.email, datos.clave);
    // si salió bien, main.js recibe la sesión y sigue solo
  } catch (err) {
    ocupado = false;
    const code = err.code || '';
    if (code === 'auth/email-already-in-use') { flujo = 'ingresar'; paso = 'clave'; aviso = 'Ya hay una cuenta con ese mail. Si es tuya, escribí tu contraseña para entrar.'; }
    else if (code === 'auth/invalid-email') { paso = 'mail'; aviso = traducir(err); }
    else { paso = anterior; aviso = err.code ? traducir(err) : err.message; }
    charla = charla.filter((t) => t.paso !== 'clave');
    dibujar();
  }
}

/** Dibuja la charla de ingreso en el contenedor. */
export function renderPantalla(cont, modoInicial) {
  contenedor = cont;
  if (modoInicial) reiniciar();
  if (errorPendiente) { aviso = errorPendiente; errorPendiente = ''; }
  dibujar();
  cont.onclick = async (e) => {
    const el = e.target.closest('[data-auth]');
    if (!el || ocupado) return;
    const que = el.dataset.auth;
    if (que === 'terminos' || que === 'privacidad') { verLegal(que); return; }
    if ((que === 'nuevo' || que === 'google') && !aceptado) return;
    if (que === 'nuevo') { flujo = 'crear'; ir('nombre', 'Crear cuenta con mail'); }
    if (que === 'tengo') { flujo = 'ingresar'; ir('mail', 'Ya tengo cuenta'); }
    if (que === 'otromail') { charla = charla.filter((t) => t.paso !== 'mail'); ir('mail'); }
    if (que === 'olvide') ir('recuperar', 'Olvidé mi contraseña');
    if (que === 'ver') { const i = cont.querySelector('input[type=password], input[data-visible]'); if (i) { if (i.type === 'password') { i.type = 'text'; i.dataset.visible = '1'; } else i.type = 'password'; } }
    if (que === 'atras') { const t = charla.pop(); paso = t ? t.paso : 'hola'; if (paso === 'hola') flujo = 'crear'; aviso = ''; dibujar(); }
    if (que === 'google') {
      ocupado = true; aviso = '';
      try { await conGoogle(); } catch (err) { ocupado = false; aviso = traducir(err); dibujar(); }
    }
  };
  cont.onchange = (e) => { if (e.target.id === 'a-acepto') { aceptado = e.target.checked; try { sessionStorage.setItem('pesitos_legales', aceptado ? LEGAL_VERSION : ''); } catch { /* nada */ } dibujar(); } };
  cont.onsubmit = async (e) => {
    const f = e.target.closest('[data-auth-form]');
    if (!f) return;
    e.preventDefault();
    if (ocupado) return;
    const v = String(f.value.value || '').trim();
    switch (f.dataset.authForm) {
      case 'nombre': if (!v) return; datos.nombre = v.slice(0, 40); ir('mail', v); break;
      case 'mail':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { aviso = 'Ese mail no parece válido. Fijate que esté bien escrito.'; dibujar(); return; }
        datos.email = v.toLowerCase(); ir('clave', datos.email); break;
      case 'clave':
        if (flujo === 'crear' && (f.value.value.length < 8 || !/[a-záéíóúñ]/i.test(f.value.value) || !/\d/.test(f.value.value))) { aviso = 'Usá al menos 8 caracteres, con letras y números.'; dibujar(); return; }
        if (f.value.value.length < 6) { aviso = 'Revisá la contraseña: tiene al menos 6 caracteres.'; dibujar(); return; }
        datos.clave = f.value.value;
        charla.push({ paso: 'clave', q: actual_().bubbles.slice(-1)[0], a: '••••••' });
        await enviarCuenta(); break;
      case 'recuperar':
        try {
          await sendPasswordResetEmail(auth(), v);
          datos.email = v.toLowerCase();
          charla = charla.filter((t) => t.paso !== 'recuperar');
          flujo = 'ingresar'; paso = 'clave';
          aviso = `Listo: te mandé el link a ${v}. Revisá también spam. Cuando elijas la contraseña nueva, escribila acá.`;
          dibujar();
        } catch (err) { aviso = traducir(err); dibujar(); }
        break;
      default: break;
    }
  };
}

// ---------- verificación de mail (también como charla) ----------
export function renderVerificar(cont, alVerificar) {
  const u = actual;
  let nota = '';
  const n = (u.displayName || '').split(' ')[0];
  const html = () => `<section class="guide auth">
    <header class="guide-top"><span style="width:44px"></span>
      <div class="guide-brand">${wordmark(26, '#FFFFFF', '#C6F36B')}<span>Tu economista de bolsillo</span></div><span style="width:44px"></span></header>
    <div class="chat guide-chat">
      <div class="bot-row"><span class="bot-avatar">${sprout(18)}</span><div class="bubble bot">${esc(`¡Listo${n ? ', ' + n : ''}! Te mandé un mail a ${u.email} para confirmar que es tuyo.`)}</div></div>
      <div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot">Tocá el link del mail y después volvé acá. Si no lo ves, buscalo en spam o promociones.</div></div>
      ${nota ? `<div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot aviso" role="alert">${esc(nota)}</div></div>` : ''}
    </div>
    <div class="guide-controls"><div class="chips stack">${chip('listo', 'Ya lo confirmé', 'primary')}${chip('reenviar', 'Mandame el mail de nuevo')}${chip('otra', 'Usar otra cuenta')}</div></div>
  </section>`;
  cont.innerHTML = html();
  cont.onsubmit = null;
  cont.onclick = async (e) => {
    const el = e.target.closest('[data-auth]');
    if (!el) return;
    if (el.dataset.auth === 'listo') {
      await u.reload().catch(() => {});
      if (auth().currentUser && auth().currentUser.emailVerified) { await auth().currentUser.getIdToken(true).catch(() => {}); alVerificar(auth().currentUser); return; }
      nota = 'Todavía no figura confirmado. Tocá el link del mail y probá de nuevo.';
    }
    if (el.dataset.auth === 'reenviar') {
      try { await sendEmailVerification(u); nota = 'Te lo mandé de nuevo. Puede tardar un par de minutos.'; } catch (x) { nota = traducir(x); }
    }
    if (el.dataset.auth === 'otra') { reiniciar(); await salir(); return; }
    cont.innerHTML = html();
  };
}

// ---------- Mi cuenta ----------
export function abrirMiCuenta({ onNombre, onEliminar, abrirClave } = {}) {
  const u = actual;
  if (!u) return;
  const mail = esPorMail(u);
  openModal('Mi cuenta', `
    <div class="card"><span class="small muted">Ingresaste con ${mail ? 'mail y contraseña' : 'Google'}</span><strong style="overflow-wrap:anywhere">${esc(u.email || '')}</strong></div>
    <button class="btn block" data-cuenta="clave">🔐 Clave de Pesitos y código de recuperación</button>
    <form class="form" id="f-nombre"><div class="field"><label for="c-nombre">Tu nombre</label><input id="c-nombre" name="nombre" value="${esc(u.displayName || '')}" maxlength="40"></div>
      <button class="btn small" type="submit">Guardar nombre</button></form>
    ${mail ? `<form class="form" id="f-clave"><strong>Cambiar contraseña</strong>
      <div class="field"><label for="c-actual">Contraseña actual</label><input id="c-actual" name="actual" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="c-nueva">Contraseña nueva</label><input id="c-nueva" name="nueva" type="password" autocomplete="new-password" minlength="8" required><span class="hint">Al menos 8 caracteres. Es la de ingreso; tu clave de Pesitos no cambia.</span></div>
      <p class="auth-error" role="alert" hidden></p>
      <button class="btn small" type="submit">Cambiar contraseña</button></form>` : ''}
    <button class="btn block" data-cuenta="salir">${icon('logout', 20)} Cerrar sesión</button>
    <button class="btn ghost small danger" data-cuenta="eliminar">Eliminar mi cuenta y mis datos</button>`);
  cuentaHandlers = { onNombre, onEliminar, abrirClave };
}

// Los formularios de "Mi cuenta" se atienden desde el documento: así siguen
// andando aunque la hoja se vuelva a dibujar (por ejemplo, al volver atrás).
let cuentaHandlers = {};
document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (!['f-nombre', 'f-clave', 'f-eliminar'].includes(f.id)) return;
  e.preventDefault();
  const u = actual;
  const err = f.querySelector('.auth-error');
  const fallar = (x) => { if (err) { err.textContent = x.code ? traducir(x) : x.message; err.hidden = false; } else toast(traducir(x)); };
  try {
    if (f.id === 'f-nombre') {
      const n = f.nombre.value.trim().slice(0, 40);
      await updateProfile(u, { displayName: n });
      if (cuentaHandlers.onNombre) await cuentaHandlers.onNombre(n);
      toast('Nombre guardado');
    }
    if (f.id === 'f-clave') {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, f.actual.value));
      await updatePassword(u, f.nueva.value);
      f.reset(); toast('Contraseña cambiada');
    }
    if (f.id === 'f-eliminar') {
      if (f.conf.value.trim().toUpperCase() !== 'ELIMINAR') throw new Error('Escribí ELIMINAR para confirmar.');
      if (esPorMail(u)) await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, f.clave.value));
      else await reauthenticateWithPopup(u, new GoogleAuthProvider());
      if (cuentaHandlers.onEliminar) await cuentaHandlers.onEliminar(); // borra los datos de la nube y del dispositivo
      await deleteUser(u);
      closeModal(); toast('Tu cuenta fue eliminada');
    }
  } catch (x) { fallar(x); }
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-cuenta]');
  if (!el) return;
  e.preventDefault();
  if (el.dataset.cuenta === 'salir') { closeModal(); await salir(); }
  if (el.dataset.cuenta === 'eliminar') abrirEliminar();
  if (el.dataset.cuenta === 'clave' && cuentaHandlers.abrirClave) cuentaHandlers.abrirClave();
});

function abrirEliminar() {
  const u = actual;
  const mail = esPorMail(u);
  openModal('Eliminar mi cuenta', `<form class="form" id="f-eliminar">
      <div class="card amber"><strong>Esto no se puede deshacer</strong><p class="text" style="margin:0">Se borran tu cuenta y todos tus datos de Pesitos: movimientos, sueldo, metas, tarjetas y ahorros. Si querés, antes descargá una copia desde el menú.</p></div>
      ${mail ? '<div class="field"><label for="e-clave">Tu contraseña, para confirmar</label><input id="e-clave" name="clave" type="password" autocomplete="current-password" required></div>' : '<p class="small muted" style="margin:0">Te vamos a pedir que confirmes con Google.</p>'}
      <div class="field"><label for="e-conf">Escribí ELIMINAR para confirmar</label><input id="e-conf" name="conf" autocomplete="off" required></div>
      <p class="auth-error" role="alert" hidden></p>
      <button class="btn block danger-fill" type="submit">Eliminar definitivamente</button></form>`, { push: true });
}
