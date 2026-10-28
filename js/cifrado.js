// =========================================================
// Pesitos — cifrado de extremo a extremo
// Tus datos se cifran en tu dispositivo ANTES de subirse a la nube, con una
// llave que solo se puede abrir con tu "clave de Pesitos" (o tu código de
// recuperación). Ni Pesitos ni quien administra el servidor pueden leerlos.
//
// - Llave de datos: AES-GCM de 256 bits, generada al azar en tu dispositivo.
// - Esa llave se guarda en la nube "envuelta" (cifrada) dos veces:
//     con tu clave de Pesitos (PBKDF2-SHA256, 600.000 vueltas) y
//     con tu código de recuperación.
// - En tu dispositivo queda guardada como llave NO exportable (IndexedDB),
//   así no te la pide cada vez que abrís la app. Al cerrar sesión se borra.
// =========================================================

const ITER = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64(buf) {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

export const cifradoDisponible = () => Boolean(window.crypto && crypto.subtle && window.indexedDB);

async function derivar(secreto, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secreto.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function envolver(raw, secreto) {
  const salt = azar(16); const iv = azar(12);
  const kek = await derivar(secreto, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct), iter: ITER };
}

async function desenvolver(env, secreto) {
  const kek = await derivar(secreto, deB64(env.salt), env.iter || ITER);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(env.iv) }, kek, deB64(env.ct)));
}

const importar = (raw, extraible = false) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extraible, ['encrypt', 'decrypt']);

// Código de recuperación: 24 caracteres sin letras que se confunden (I, L, O, U), 120 bits
const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function nuevoCodigo() {
  const r = azar(24);
  const t = Array.from(r, (x) => ALFA[x % 32]).join('');
  return t.match(/.{4}/g).join('-');
}
export const limpiarCodigo = (c) => String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V').match(/.{1,4}/g)?.join('-') || '';

/** Clave de Pesitos válida: 8 o más caracteres, con letras y números. */
export function claveValida(c) {
  const t = String(c || '');
  if (t.length < 8) return 'Tiene que tener al menos 8 caracteres.';
  if (!/[a-záéíóúñ]/i.test(t) || !/\d/.test(t)) return 'Usá letras y números (por ejemplo, una frase con un número).';
  return '';
}

/** Crea la llave de datos. Devuelve lo que se guarda en la nube, el código de recuperación y la llave. */
export async function crearLlave(clave) {
  const raw = azar(32);
  const codigo = nuevoCodigo();
  const llave = { v: 1, pass: await envolver(raw, clave), rec: await envolver(raw, limpiarCodigo(codigo)) };
  return { llave, codigo, key: await importar(raw) };
}

/** Abre la llave con la clave de Pesitos (o con el código de recuperación). Falla si no coincide. */
export async function abrirLlave(llave, clave, { conCodigo = false } = {}) {
  const raw = await desenvolver(conCodigo ? llave.rec : llave.pass, conCodigo ? limpiarCodigo(clave) : clave);
  return { key: await importar(raw), raw };
}

/** Cambia la clave de Pesitos (el código de recuperación sigue sirviendo). */
export async function cambiarClave(llave, raw, nueva) {
  return { ...llave, pass: await envolver(raw, nueva) };
}

/** Nuevo código de recuperación (el anterior deja de servir). */
export async function nuevoCodigoRecuperacion(llave, raw) {
  const codigo = nuevoCodigo();
  return { llave: { ...llave, rec: await envolver(raw, limpiarCodigo(codigo)) }, codigo };
}

export async function cifrar(key, texto) {
  const iv = azar(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(texto));
  return { iv: b64(iv), c: b64(ct) };
}

export async function descifrar(key, { iv, c }) {
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, key, deB64(c)));
}

// ---------- llave guardada en este dispositivo (IndexedDB, no exportable) ----------
function db() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('pesitos-llaves', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('llaves');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function tx(modo, fn) {
  const d = await db();
  return new Promise((ok, mal) => {
    const t = d.transaction('llaves', modo);
    const r = fn(t.objectStore('llaves'));
    t.oncomplete = () => { d.close(); ok(r && r.result); };
    t.onerror = () => { d.close(); mal(t.error); };
  });
}
export const guardarEnDispositivo = (uid, key) => tx('readwrite', (st) => st.put(key, uid));
export const llaveDelDispositivo = async (uid) => { try { return (await tx('readonly', (st) => st.get(uid))) || null; } catch { return null; } };
export const borrarDelDispositivo = async (uid) => { try { await tx('readwrite', (st) => st.delete(uid)); } catch { /* nada */ } };
