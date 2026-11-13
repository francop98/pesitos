// =========================================================
// Pesitos — PIN de seguridad (charla) y migración de la versión cifrada
// - crearPin: la primera vez (o después de "Olvidé mi PIN") se crea un PIN de 4 a 6
//   números. Se guarda solo su hash en tu cuenta y se pide cada vez que abrís Pesitos.
// - pedirClaveMigracion: Pesitos ya no cifra los datos con una clave aparte. Quien
//   tenía datos cifrados y entra desde un dispositivo sin la llave, escribe su clave
//   (o su código) UNA última vez para pasarlos al formato nuevo.
// =========================================================

import { esc } from './formato.js';
import { wordmark, icon, sprout, toast, openModal, closeModal } from './interfaz.js';
import { abrirLlave, limpiarCodigo } from './cifrado.js';

const send = (label = 'Seguir') => `<button type="submit" class="icon-btn green" aria-label="${label}">${icon('send', 20, 2.2)}</button>`;
const campo = (id, ph, extra = '') => `<form class="quick" data-clave-form="${id}" autocomplete="off" novalidate>
    <label for="k-${id}" class="sr-only">${esc(ph)}</label>
    <input id="k-${id}" name="value" type="password" placeholder="${esc(ph)}" data-autofocus ${extra}>
    <button type="button" class="pass-eye inline" data-clave="ver" aria-label="Mostrar">${icon('eye', 20)}</button>${send()}</form>`;

function pantalla({ bubbles, controls, nota = '', atras = false }) {
  return `<section class="guide auth">
    <header class="guide-top">${atras ? `<button class="icon-btn back on-green" data-clave="atras" aria-label="Volver">${icon('back', 20, 2.2)}</button>` : '<span class="u-w-44"></span>'}
      <div class="guide-brand">${wordmark(26, '#FFFFFF', '#C6F36B')}<span>Tu economista de bolsillo</span></div><span class="u-w-44"></span></header>
    <div class="chat guide-chat">
      ${bubbles.map((b, i) => `<div class="bot-row">${i === 0 ? `<span class="bot-avatar">${sprout(18)}</span>` : '<span class="bot-avatar ghost"></span>'}<div class="bubble bot">${b}</div></div>`).join('')}
      ${nota ? `<div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot aviso" role="alert">${esc(nota)}</div></div>` : ''}
    </div>
    <div class="guide-controls">${controls}</div>
  </section>`;
}

function dibujar(cont, opts) {
  cont.innerHTML = pantalla(opts);
  const f = cont.querySelector('[data-autofocus]');
  if (f && window.matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
  window.scrollTo(0, document.body.scrollHeight);
}

function verClave(cont) {
  const i = cont.querySelector('input[name=value]');
  if (i) i.type = i.type === 'password' ? 'text' : 'password';
}

// ---------- PIN de seguridad ----------
const enc = new TextEncoder();
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
export async function hashPin(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, 256));
}
/** Arma lo que se guarda del PIN: { salt, hash, largo } (nunca el PIN). */
export async function datosPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: await hashPin(pin, salt), largo: pin.length };
}
const campoPin = (id, ph) => `<form class="quick" data-clave-form="${id}" autocomplete="off" novalidate>
    <label for="k-${id}" class="sr-only">${esc(ph)}</label>
    <input id="k-${id}" name="value" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="${esc(ph)}" data-autofocus autocomplete="new-password">
    <button type="button" class="pass-eye inline" data-clave="ver" aria-label="Mostrar">${icon('eye', 20)}</button>${send()}</form>`;

/** Crear el PIN de seguridad. Resuelve con { salt, hash, largo }. */
export function crearPin(cont, { nombre = '', nuevo = false } = {}) {
  return new Promise((resolver) => {
    let paso = 'elegir'; let primero = ''; let nota = '';
    const render = () => {
      if (paso === 'elegir') {
        dibujar(cont, { nota, bubbles: nuevo
          ? ['Listo, ya entraste. Ahora elegí un <b>PIN de seguridad</b> nuevo.']
          : [`${nombre ? `${esc(nombre)}, un` : 'Un'} último paso: elegí tu <b>PIN de seguridad</b>.`, 'Son de 4 a 6 números. Te lo voy a pedir cada vez que inicies sesión, en cualquier dispositivo.', 'Si algún día te lo olvidás, no pasa nada: volvés a entrar con tu mail o Google y creás otro.'],
          controls: campoPin('pin', 'Tu PIN (4 a 6 números)') });
      } else {
        dibujar(cont, { nota, atras: true, bubbles: ['Escribilo de nuevo, para confirmar.'], controls: campoPin('repetir', 'Repetí tu PIN') });
      }
    };
    render();
    cont.onclick = (e) => {
      const el = e.target.closest('[data-clave]');
      if (!el) return;
      if (el.dataset.clave === 'ver') verClave(cont);
      if (el.dataset.clave === 'atras') { paso = 'elegir'; nota = ''; render(); }
    };
    cont.onsubmit = async (e) => {
      const f = e.target.closest('[data-clave-form]');
      if (!f) return;
      e.preventDefault();
      const v = f.value.value.trim();
      if (paso === 'elegir') {
        if (!/^\d{4,6}$/.test(v)) { nota = 'Tienen que ser de 4 a 6 números.'; render(); return; }
        if (/^(\d)\1+$/.test(v) || '0123456789'.includes(v) || '9876543210'.includes(v)) { nota = 'Es muy fácil de adivinar. Probá con otro.'; render(); return; }
        primero = v; paso = 'repetir'; nota = ''; render(); return;
      }
      if (v !== primero) { nota = 'No coinciden. Probá de nuevo.'; paso = 'elegir'; primero = ''; render(); return; }
      dibujar(cont, { bubbles: ['Guardando tu PIN…'], controls: '' });
      const datos = await datosPin(primero);
      toast('PIN creado');
      resolver(datos);
    };
  });
}

// ---------- migración desde la versión cifrada ----------
/** Pide la clave de Pesitos (o el código) una última vez. Resuelve con { key } o { empezarDeCero: true }. */
export function pedirClaveMigracion(cont, llave, { email = '', onSalir } = {}) {
  return new Promise((resolver) => {
    let modo = 'clave'; let nota = '';
    const render = () => {
      if (modo === 'clave') dibujar(cont, { nota, bubbles: ['¡Hola de nuevo! Cambiamos algo para hacerte la vida más fácil: <b>Pesitos ya no usa clave de Pesitos ni código de recuperación.</b>', `Escribí tu clave${email ? ` de ${esc(email)}` : ''} <b>por última vez</b> para pasar tus datos al formato nuevo. Después no te la pido nunca más.`],
        controls: campo('clave', 'Tu clave de Pesitos', 'autocomplete="current-password"') + '<div class="chips"><button class="chip big" data-clave="olvide">Me la olvidé</button><button class="chip big" data-clave="salir">Usar otra cuenta</button></div>' });
      if (modo === 'codigo') dibujar(cont, { nota, atras: true, bubbles: ['Escribí tu <b>código de recuperación</b> (el de 24 letras y números que guardaste cuando creaste la clave).'],
        controls: `<form class="quick" data-clave-form="codigo" autocomplete="off" novalidate><label for="k-codigo" class="sr-only">Código</label><input id="k-codigo" name="value" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" data-autofocus>${send()}</form>
          <div class="chips"><button class="chip big" data-clave="cero">No tengo ni la clave ni el código</button></div>` });
      if (modo === 'cero') dibujar(cont, { nota, atras: true, bubbles: ['Sin la clave ni el código, los datos que guardaste con la versión anterior no se pueden abrir: estaban cifrados para que nadie más pudiera leerlos.', 'Si querés, empezás de cero con tu misma cuenta. <b>Los datos viejos se borran.</b>'],
        controls: '<button class="btn danger-fill block" data-clave="confirmar-cero">Empezar de cero</button><button class="btn block" data-clave="atras">Volver a intentar</button>' });
    };
    render();
    cont.onclick = (e) => {
      const el = e.target.closest('[data-clave]');
      if (!el) return;
      if (el.dataset.clave === 'ver') verClave(cont);
      if (el.dataset.clave === 'olvide') { modo = 'codigo'; nota = ''; render(); }
      if (el.dataset.clave === 'cero') { modo = 'cero'; nota = ''; render(); }
      if (el.dataset.clave === 'confirmar-cero') resolver({ empezarDeCero: true });
      if (el.dataset.clave === 'atras') { modo = 'clave'; nota = ''; render(); }
      if (el.dataset.clave === 'salir' && onSalir) onSalir();
    };
    cont.onsubmit = async (e) => {
      const f = e.target.closest('[data-clave-form]');
      if (!f) return;
      e.preventDefault();
      const v = f.value.value;
      try {
        if (modo === 'clave') {
          dibujar(cont, { bubbles: ['Abriendo tus datos…'], controls: '' });
          resolver({ key: (await abrirLlave(llave, v)).key }); return;
        }
        if (modo === 'codigo') {
          if (limpiarCodigo(v).replace(/-/g, '').length !== 24) { nota = 'El código tiene 24 letras y números. Revisalo.'; render(); return; }
          dibujar(cont, { bubbles: ['Revisando el código…'], controls: '' });
          resolver({ key: (await abrirLlave(llave, v, { conCodigo: true })).key }); return;
        }
      } catch {
        nota = modo === 'clave' ? 'Esa no es tu clave de Pesitos. Probá de nuevo.' : 'Ese código no coincide. Revisalo letra por letra.';
        render();
      }
    };
  });
}

export const claveActions = {
  async copiarTexto(ctx, el) { try { await navigator.clipboard.writeText(el.dataset.texto); toast('Copiado'); } catch { toast('No pude copiarlo: anotalo a mano'); } },
  cerrarModal() { closeModal(); },
};
