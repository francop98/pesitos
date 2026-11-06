// =========================================================
// Pesitos — sincronización con Firestore
// Estructura en la nube:
//   usuarios/{uid}                    fechas y el PIN de seguridad (solo su hash): ni nombre ni mail
//   usuarios/{uid}/estado/general     tus datos (sueldo, metas, tarjetas, reglas…)
//   usuarios/{uid}/estado/expenses-AAAA, incomes-AAAA, transfers-AAAA
//                                     movimientos separados por año
//   Cada documento guarda { json }. Solo los puede leer y escribir su dueño (reglas de Firestore).
//   Los documentos grandes se parten en pedazos (general~2, general~3…).
// Versiones anteriores guardaban { c, iv } cifrado de extremo a extremo: si aparecen,
// se descifran con la llave (del dispositivo o abierta con la clave de Pesitos) y se
// vuelven a subir en el formato nuevo; después la llave se borra.
// Estrategia (igual que DBTYCS):
// - El dispositivo guarda siempre su copia rápida (js/almacenamiento.js).
// - Con sesión iniciada, cada cambio también se envía a la nube, agrupado
//   (cada ~1 s) y solo lo que cambió.
// - Cola de pendientes: cada cambio se anota en el dispositivo ANTES de
//   enviarlo y se borra recién cuando la nube lo confirma. Si se corta
//   internet o se cierra la app, se reenvía solo en la próxima ocasión.
// - Al ingresar: si la nube tiene datos, manda la nube. Si está vacía y el
//   dispositivo tiene datos (primer ingreso), se suben.
// - Los datos de ejemplo nunca se suben.
// =========================================================

import { firebase } from './firebaseconfig.js';
import { migrate, emptyState } from './almacenamiento.js';
import { descifrar } from './cifrado.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, deleteField, updateDoc, arrayUnion, arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const POR_ANIO = ['expenses', 'incomes', 'transfers'];               // listas que crecen: un documento por año
const SOLO_LOCAL = ['rates', 'live', 'ipcAuto', 'liveFailedAt', 'rendimientos', 'feriados']; // datos públicos que se bajan solos
const PEDAZO = 300000; // caracteres por documento (con tildes y todo queda por debajo de 1 MB)
const DEMORA = 1000;

let uid = null;
let esp = null;       // espacio compartido abierto (modo familiar) o null (tu plata personal)
let alRemoto = null;  // avisa cuando, al guardar, entraron cambios de otra persona del espacio
let timer = null;
let enviando = false;
let firmas = {};      // { docId: firma de lo último confirmado por la nube }
let ultimo = null;    // último estado recibido para guardar
let alCambiarEstado = () => {};
let llave = null;     // llave de la versión cifrada anterior (solo para migrar)
let migrando = false; // hay datos cifrados viejos que se están pasando al formato nuevo
let alMigrar = null;

const clave = () => (esp ? `esp_${esp}` : uid);
const kPend = () => `pesitos:pendientes:${clave()}`;
const kFirmas = () => `pesitos:firmas:${clave()}`;
const kBase = () => `pesitos:base:${clave()}`; // lo último que se sincronizó (para mezclar cambios de dos personas)
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const pendientes = () => leer(kPend(), []);
const refEstado = (id) => (esp ? doc(firebase().db, 'espacios', esp, 'estado', id) : doc(firebase().db, 'usuarios', uid, 'estado', id));
const colEstado = () => (esp ? collection(firebase().db, 'espacios', esp, 'estado') : collection(firebase().db, 'usuarios', uid, 'estado'));

/** Divide el estado en documentos (cada uno muy por debajo del límite de 1 MB de Firestore). */
export function partir(state) {
  const general = {};
  const docs = {};
  for (const [k, v] of Object.entries(state)) {
    if (SOLO_LOCAL.includes(k)) continue;
    if (POR_ANIO.includes(k) && Array.isArray(v)) {
      for (const item of v) {
        const anio = /^\d{4}/.test(item && item.date) ? item.date.slice(0, 4) : 'sin-fecha';
        (docs[`${k}-${anio}`] = docs[`${k}-${anio}`] || []).push(item);
      }
    } else general[k] = v;
  }
  const out = {};
  const poner = (id, json) => {
    if (json.length <= PEDAZO) { out[id] = json; return; }
    for (let i = 0, n = 1; i < json.length; i += PEDAZO, n++) out[n === 1 ? id : `${id}~${n}`] = json.slice(i, i + PEDAZO);
  };
  poner('general', JSON.stringify(general));
  for (const [id, items] of Object.entries(docs)) poner(id, JSON.stringify(items));
  return out; // { docId: json (o un pedazo) }
}

// junta los pedazos: { general: '…', 'general~2': '…' } → { general: '……' }
function juntar(docs) {
  const out = {};
  const ids = Object.keys(docs).sort((a, b) => { const [x, nx] = a.split('~'); const [y, ny] = b.split('~'); return x.localeCompare(y) || (Number(nx || 1) - Number(ny || 1)); });
  for (const id of ids) { const base = id.split('~')[0]; out[base] = (out[base] || '') + docs[id]; }
  return out;
}

/** Arma el estado a partir de los documentos de la nube. */
export function unir(partes) {
  const docs = juntar(partes);
  const base = docs.general ? JSON.parse(docs.general) : {};
  for (const k of POR_ANIO) base[k] = [];
  for (const [id, json] of Object.entries(docs)) {
    const k = POR_ANIO.find((x) => id.startsWith(x + '-'));
    if (k) base[k].push(...JSON.parse(json));
  }
  return base;
}

const firma = (json) => { let h = 5381; for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0; return `${json.length}:${h >>> 0}`; };

let habiaCifrado = false;
/** ¿La nube tiene datos de la versión cifrada? (para pedir la clave una última vez) */
export async function hayCifrado(u) {
  const snap = await getDocs(collection(firebase().db, 'usuarios', u.uid, 'estado'));
  let si = false; snap.forEach((d) => { const x = d.data(); if (typeof x.c === 'string') si = true; });
  return si;
}
async function leerNube() {
  const snap = await getDocs(colEstado());
  const docs = {};
  const tareas = [];
  habiaCifrado = false;
  snap.forEach((d) => {
    const x = d.data();
    if (typeof x.json === 'string') docs[d.id] = x.json;
    else if (typeof x.c === 'string' && typeof x.iv === 'string') {
      habiaCifrado = true;
      if (!llave) throw new Error('cifrado-sin-llave');
      tareas.push(descifrar(llave, x).then((json) => { docs[d.id] = json; }));
    }
  });
  await Promise.all(tareas); // si la llave no corresponde, esto falla y no se pisa nada
  return docs;
}

function marcar(state) {
  const partes = partir(state);
  const pend = new Set(pendientes());
  for (const [id, json] of Object.entries(partes)) if (firmas[id] !== firma(json)) pend.add(id);
  for (const id of Object.keys(firmas)) if (!(id in partes)) pend.add(id); // documentos que quedaron vacíos
  escribir(kPend(), [...pend]);
  return partes;
}

// ---------- espacio compartido: mezclar lo tuyo con lo de la otra persona ----------
// Se recuerda lo último sincronizado: { ids: { expenses: [...] }, gen: { clave: firma } }.
// Listas: queda lo tuyo + lo nuevo de la otra persona; lo que borraste no vuelve.
// Datos generales (metas, fijos, tarjetas…): si vos no tocaste esa parte, entra la de la otra persona.
function recordarBase(state) {
  const ids = {}; for (const k of POR_ANIO) ids[k] = (state[k] || []).map((x) => x && x.id).filter(Boolean);
  const gen = {}; for (const [k, v] of Object.entries(state)) if (!POR_ANIO.includes(k) && !SOLO_LOCAL.includes(k)) gen[k] = firma(JSON.stringify(v ?? null));
  escribir(kBase(), { ids, gen });
}
export function mezclar(local, remoto, base) {
  const out = { ...local };
  const b = base || { ids: {}, gen: {} };
  for (const k of POR_ANIO) {
    const antes = new Set(b.ids[k] || []);
    const mios = local[k] || []; const ids = new Set(mios.map((x) => x.id));
    const nuevos = (remoto[k] || []).filter((x) => x && x.id && !ids.has(x.id) && !antes.has(x.id));
    out[k] = [...mios, ...nuevos];
  }
  for (const [k, v] of Object.entries(remoto)) {
    if (POR_ANIO.includes(k) || SOLO_LOCAL.includes(k)) continue;
    const mio = firma(JSON.stringify(local[k] ?? null));
    if (b.gen[k] && mio === b.gen[k] && firma(JSON.stringify(v ?? null)) !== mio) out[k] = v;
  }
  return out;
}

async function enviar() {
  if (!uid || enviando || !ultimo) return;
  if (!pendientes().length) { alCambiarEstado('ok'); return; }
  if (!navigator.onLine) { alCambiarEstado('sin-conexion'); return; }
  enviando = true;
  alCambiarEstado('enviando');
  try {
    // en un espacio compartido, primero traigo lo que cargó la otra persona y lo mezclo
    if (esp) {
      const nube = await leerNube();
      if (Object.keys(nube).length) {
        const cambio = Object.entries(nube).some(([id, json]) => firmas[id] !== firma(json));
        if (cambio) {
          const mezcla = migrate(mezclar(ultimo, unir(nube), leer(kBase(), null)));
          for (const k of SOLO_LOCAL) if (ultimo[k] !== undefined) mezcla[k] = ultimo[k];
          firmas = Object.fromEntries(Object.entries(nube).map(([id, json]) => [id, firma(json)]));
          ultimo = mezcla;
          marcar(mezcla);
          if (alRemoto) alRemoto(mezcla);
        }
      }
    }
    const partes = partir(ultimo);
    const pend = pendientes();
    const batch = writeBatch(firebase().db);
    for (const id of pend) {
      if (id in partes) batch.set(refEstado(id), { json: partes[id], actualizado: serverTimestamp() });
      else batch.delete(refEstado(id));
    }
    await batch.commit();
    for (const id of pend) { if (id in partes) firmas[id] = firma(partes[id]); else delete firmas[id]; }
    escribir(kFirmas(), firmas);
    if (esp) recordarBase(ultimo);
    // si algo cambió mientras se enviaba, queda en la cola para la próxima
    const ahora = partir(ultimo);
    const quedan = pendientes().filter((id) => !pend.includes(id) || (id in ahora ? firma(ahora[id]) !== firmas[id] : id in firmas));
    escribir(kPend(), quedan);
    alCambiarEstado(quedan.length ? 'pendiente' : 'ok');
    // migración terminada: todo quedó en el formato nuevo, la llave vieja ya no hace falta
    if (!quedan.length && migrando) { migrando = false; try { await setDoc(doc(firebase().db, 'usuarios', uid), { llave: deleteField() }, { merge: true }); } catch (e) { console.warn(e); } if (alMigrar) alMigrar(); }
  } catch (e) {
    console.warn('No se pudo guardar en la nube:', e);
    alCambiarEstado('pendiente');
  } finally {
    enviando = false;
    if (pendientes().length && navigator.onLine) programar(5000);
  }
}

function programar(ms = DEMORA) { clearTimeout(timer); timer = setTimeout(enviar, ms); }

/**
 * Arranca la sincronización de una cuenta y devuelve el estado con el que abrir la app.
 * local: copia del dispositivo para esta cuenta (o null); legacy: datos de antes de las cuentas.
 */
export async function iniciar(user, { local, legacy, onStatus, key, onMigrado, espacio = null, onRemoto = null } = {}) {
  uid = user.uid;
  esp = espacio || null;
  alRemoto = onRemoto;
  llave = key || null;
  alMigrar = onMigrado || null;
  alCambiarEstado = onStatus || (() => {});
  firmas = leer(kFirmas(), {});
  if (!esp) { try { await setDoc(doc(firebase().db, 'usuarios', uid), { ultimoIngreso: serverTimestamp() }, { merge: true }); } catch (e) { console.warn('Perfil sin sincronizar:', e); } }

  // 1) cambios sin enviar en este dispositivo: mandan ellos
  if (local && pendientes().length) { ultimo = local; programar(0); return { state: local, origen: 'local' }; }

  let nube = {};
  try { nube = await leerNube(); } catch (e) { console.warn('Sin conexión con la nube:', e); if (local) return { state: local, origen: 'local' }; }

  // 2) la nube tiene datos: manda la nube
  if (Object.keys(nube).length) {
    const state = migrate(unir(nube));
    if (local) for (const k of SOLO_LOCAL) if (local[k] !== undefined) state[k] = local[k];
    ultimo = state;
    if (habiaCifrado) {
      // datos de la versión cifrada: se vuelven a subir en el formato nuevo (todos los documentos)
      migrando = true;
      firmas = Object.fromEntries(Object.keys(nube).map((id) => [id, 'cifrado']));
      escribir(kFirmas(), firmas);
      escribir(kPend(), []);
      guardar(state);
      programar(0);
      return { state, origen: 'descifrado' };
    }
    firmas = Object.fromEntries(Object.entries(nube).map(([id, json]) => [id, firma(json)]));
    escribir(kFirmas(), firmas);
    escribir(kPend(), []);
    if (esp) recordarBase(state);
    alCambiarEstado('ok');
    return { state, origen: 'nube' };
  }

  // 3) nube vacía: primer ingreso. Se suben los datos que ya había en el dispositivo.
  if (esp) { const st = local || emptyState(); guardar(st); return { state: st, origen: 'nuevo' }; }
  const previo = [local, legacy].find((x) => x && x.ready && !x.demo) || null;
  const state = previo || local || emptyState();
  if (previo) guardar(previo);
  else ultimo = state;
  return { state, origen: previo ? 'migrado' : 'nuevo' };
}

/** Anota y programa el envío de lo que cambió. */
export function guardar(state) {
  if (!uid || !state || state.demo) return;
  ultimo = state;
  marcar(state);
  alCambiarEstado('pendiente');
  programar();
}

/** Trae cambios hechos desde otro dispositivo (si acá no hay nada sin enviar). */
export async function traerCambios() {
  if (!uid || enviando || !navigator.onLine) return null;
  if (pendientes().length) { if (esp) programar(0); return null; } // en un espacio, al enviar se mezcla
  try {
    const nube = await leerNube();
    if (!Object.keys(nube).length) return null;
    const cambio = Object.entries(nube).some(([id, json]) => firmas[id] !== firma(json)) || Object.keys(firmas).some((id) => !(id in nube));
    if (!cambio) return null;
    firmas = Object.fromEntries(Object.entries(nube).map(([id, json]) => [id, firma(json)]));
    escribir(kFirmas(), firmas);
    const state = migrate(unir(nube));
    if (ultimo) for (const k of SOLO_LOCAL) if (ultimo[k] !== undefined) state[k] = ultimo[k];
    ultimo = state;
    if (esp) recordarBase(state);
    return state;
  } catch { return null; }
}

export const hayPendientes = () => Boolean(uid && pendientes().length);
export const reintentar = () => { if (uid && pendientes().length) programar(0); };

/** Termina la sesión de sincronización (intenta enviar lo pendiente antes). */
export async function detener({ borrarLocal = false } = {}) {
  clearTimeout(timer);
  if (uid && pendientes().length) { try { await enviar(); } catch { /* queda en la cola */ } }
  const quedan = Boolean(uid && pendientes().length);
  // si quedó algo sin enviar (por ejemplo, sin internet), se conserva para el próximo ingreso
  if (borrarLocal && uid && !quedan) { try { localStorage.removeItem(kPend()); localStorage.removeItem(kFirmas()); localStorage.removeItem(kBase()); } catch { /* nada */ } }
  uid = null; esp = null; alRemoto = null; ultimo = null; firmas = {}; llave = null; migrando = false;
  return quedan;
}

/** Borra todos los datos de la cuenta en la nube (para eliminar la cuenta). */
export async function borrarNube() {
  if (!uid || esp) return;
  const { db } = firebase();
  const batch = writeBatch(db);
  for (const sub of ['estado', 'push', 'avisos']) {
    const snap = await getDocs(collection(db, 'usuarios', uid, sub)).catch(() => null);
    if (snap) snap.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'usuarios', uid));
  await batch.commit();
  try { localStorage.removeItem(kPend()); localStorage.removeItem(kFirmas()); } catch { /* nada */ }
}

/** Lee el perfil de una cuenta: { llave (solo versión anterior), pin, creado }. */
export async function leerPerfil(u) {
  const s = await getDoc(doc(firebase().db, 'usuarios', u.uid));
  const d = s.exists() ? s.data() : {};
  if (!s.exists()) { try { await setDoc(doc(firebase().db, 'usuarios', u.uid), { creado: serverTimestamp(), ultimoIngreso: serverTimestamp() }, { merge: true }); } catch { /* después */ } }
  return { llave: d.llave || null, pin: d.pin || null, creado: d.creado || null };
}

/** Sin clave ni código: borra los datos cifrados que ya no se pueden abrir (empezar de cero). */
export async function borrarDatosViejos(u) {
  const { db } = firebase();
  const snap = await getDocs(collection(db, 'usuarios', u.uid, 'estado'));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.set(doc(db, 'usuarios', u.uid), { llave: deleteField() }, { merge: true });
  await batch.commit();
  try { localStorage.removeItem(`pesitos:pendientes:${u.uid}`); localStorage.removeItem(`pesitos:firmas:${u.uid}`); localStorage.removeItem(`pesitos:v1:${u.uid}`); } catch { /* nada */ }
}

/** Guarda el PIN de seguridad (solo su hash) en la cuenta: sirve en todos tus dispositivos. */
export async function guardarPin(u, pin) {
  await setDoc(doc(firebase().db, 'usuarios', u.uid), { pin }, { merge: true });
}

window.addEventListener('online', reintentar);

// =========================================================
// Espacios compartidos (modo familiar)
//   espacios/{id}            { nombre, dueno, miembros: [uid], nombres: { uid: nombre }, creado }
//   espacios/{id}/estado/*   los datos del espacio (igual que los tuyos)
//   invitaciones/{código}    { esp, creado, vence } para sumarse con un código
// =========================================================
const azar = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codigoNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => LETRAS[b % LETRAS.length]).join('');

export const espacioActual = () => esp;

/** Crea un espacio y devuelve su id. */
export async function crearEspacio(user, nombre, miNombre) {
  const id = azar(10);
  await setDoc(doc(firebase().db, 'espacios', id), { nombre: String(nombre).slice(0, 40), dueno: user.uid, miembros: [user.uid], nombres: { [user.uid]: String(miNombre || '').slice(0, 30) }, creado: serverTimestamp() });
  return id;
}
/** Invitación: un código de 8 letras que vale 7 días. */
export async function invitar(espId) {
  const codigo = codigoNuevo();
  await setDoc(doc(firebase().db, 'invitaciones', codigo), { esp: espId, creado: serverTimestamp(), vence: new Date(Date.now() + 7 * 864e5) });
  return codigo;
}
/** Sumarse con un código. Devuelve { id, nombre } del espacio. */
export async function unirse(user, codigo, miNombre) {
  const c = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inv = await getDoc(doc(firebase().db, 'invitaciones', c));
  if (!inv.exists()) throw new Error('codigo');
  const { esp: id, vence } = inv.data();
  const v = vence && vence.toDate ? vence.toDate() : new Date(vence);
  if (v && v < new Date()) throw new Error('vencido');
  await updateDoc(doc(firebase().db, 'espacios', id), { miembros: arrayUnion(user.uid), [`nombres.${user.uid}`]: String(miNombre || '').slice(0, 30) });
  const e = await getDoc(doc(firebase().db, 'espacios', id));
  return { id, nombre: (e.data() || {}).nombre || 'Familia' };
}
/** Lo que hay cargado en un espacio (para sumar tu parte a tu plata personal). */
export async function leerEstadoEspacio(id) {
  const snap = await getDocs(collection(firebase().db, 'espacios', id, 'estado'));
  const docs = {};
  snap.forEach((d) => { const x = d.data(); if (typeof x.json === 'string') docs[d.id] = x.json; });
  return Object.keys(docs).length ? unir(docs) : null;
}
/** Datos del espacio (para ver quiénes son). */
export async function leerEspacio(id) {
  const e = await getDoc(doc(firebase().db, 'espacios', id));
  return e.exists() ? e.data() : null;
}
/** Salir de un espacio (si sos la última persona, se borra todo). */
export async function salirDeEspacio(user, id) {
  const { db } = firebase();
  const e = await getDoc(doc(db, 'espacios', id));
  if (!e.exists()) return;
  const d = e.data();
  if ((d.miembros || []).length <= 1) {
    const snap = await getDocs(collection(db, 'espacios', id, 'estado'));
    const batch = writeBatch(db);
    snap.forEach((x) => batch.delete(x.ref));
    batch.delete(doc(db, 'espacios', id));
    await batch.commit();
  } else await updateDoc(doc(db, 'espacios', id), { miembros: arrayRemove(user.uid), [`nombres.${user.uid}`]: deleteField() });
  try { for (const k of ['pendientes', 'firmas', 'base', 'v1']) localStorage.removeItem(`pesitos:${k}:esp_${id}`); } catch { /* nada */ }
}

/** Avisar un error en una promo: queda en reportes/ y el servidor se lo manda al dueño de la app. */
export async function enviarReporte(user, r) {
  await setDoc(doc(firebase().db, 'reportes', azar(10)), {
    uid: user.uid, medio: String(r.medio || '').slice(0, 40), comercio: String(r.comercio || '').slice(0, 80), pct: Number(r.pct) || 0,
    motivo: String(r.motivo || 'otro').slice(0, 20), texto: String(r.texto || '').slice(0, 300), creado: serverTimestamp(),
  });
}
