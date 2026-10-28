// =========================================================
// Pesitos — sincronización con Firestore (cifrada de extremo a extremo)
// Estructura en la nube:
//   usuarios/{uid}                    solo fechas y la llave envuelta (ver js/cifrado.js):
//                                     ni tu nombre ni tu mail se guardan acá
//   usuarios/{uid}/estado/general     tus datos (sueldo, metas, tarjetas, reglas…)
//   usuarios/{uid}/estado/expenses-AAAA, incomes-AAAA, transfers-AAAA
//                                     movimientos separados por año
//   Cada documento guarda solo { c, iv }: el contenido cifrado con AES-GCM.
//   Los documentos grandes se parten en pedazos (general~2, general~3…).
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
import { cifrar, descifrar } from './cifrado.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const POR_ANIO = ['expenses', 'incomes', 'transfers'];               // listas que crecen: un documento por año
const SOLO_LOCAL = ['rates', 'live', 'ipcAuto', 'liveFailedAt', 'rendimientos', 'feriados']; // datos públicos que se bajan solos
const PEDAZO = 450000; // caracteres por documento (cifrado y en base64 queda por debajo de 1 MB)
const DEMORA = 1000;

let uid = null;
let timer = null;
let enviando = false;
let firmas = {};      // { docId: firma de lo último confirmado por la nube }
let ultimo = null;    // último estado recibido para guardar
let alCambiarEstado = () => {};
let llave = null;     // llave de datos (CryptoKey) de esta cuenta

const kPend = () => `pesitos:pendientes:${uid}`;
const kFirmas = () => `pesitos:firmas:${uid}`;
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const pendientes = () => leer(kPend(), []);
const refEstado = (id) => doc(firebase().db, 'usuarios', uid, 'estado', id);

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

let habiaSinCifrar = false;
async function leerNube() {
  const snap = await getDocs(collection(firebase().db, 'usuarios', uid, 'estado'));
  const docs = {};
  const tareas = [];
  habiaSinCifrar = false;
  snap.forEach((d) => {
    const x = d.data();
    if (typeof x.c === 'string' && typeof x.iv === 'string') tareas.push(descifrar(llave, x).then((json) => { docs[d.id] = json; }));
    else if (typeof x.json === 'string') { docs[d.id] = x.json; habiaSinCifrar = true; } // versión anterior, sin cifrar
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

async function enviar() {
  if (!uid || enviando || !ultimo) return;
  const pend = pendientes();
  if (!pend.length) { alCambiarEstado('ok'); return; }
  if (!navigator.onLine) { alCambiarEstado('sin-conexion'); return; }
  enviando = true;
  alCambiarEstado('enviando');
  try {
    const partes = partir(ultimo);
    const batch = writeBatch(firebase().db);
    for (const id of pend) {
      if (id in partes) batch.set(refEstado(id), { ...(await cifrar(llave, partes[id])), actualizado: serverTimestamp() });
      else batch.delete(refEstado(id));
    }
    await batch.commit();
    for (const id of pend) { if (id in partes) firmas[id] = firma(partes[id]); else delete firmas[id]; }
    escribir(kFirmas(), firmas);
    // si algo cambió mientras se enviaba, queda en la cola para la próxima
    const ahora = partir(ultimo);
    const quedan = pendientes().filter((id) => !pend.includes(id) || (id in ahora ? firma(ahora[id]) !== firmas[id] : id in firmas));
    escribir(kPend(), quedan);
    alCambiarEstado(quedan.length ? 'pendiente' : 'ok');
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
export async function iniciar(user, { local, legacy, onStatus, key, perfil } = {}) {
  uid = user.uid;
  llave = key;
  alCambiarEstado = onStatus || (() => {});
  firmas = leer(kFirmas(), {});

  // perfil: solo fechas y la llave envuelta (se reescribe entero: así se borran datos viejos como nombre o mail)
  // (si no tengo la llave envuelta a mano, no lo toco: nunca se pisa la llave guardada)
  if (perfil && perfil.llave) { try { await escribirPerfil(perfil.llave, perfil.creado); } catch (e) { console.warn('Perfil sin sincronizar:', e); } }

  // 1) cambios sin enviar en este dispositivo: mandan ellos
  if (local && pendientes().length) { ultimo = local; programar(0); return { state: local, origen: 'local' }; }

  let nube = {};
  try { nube = await leerNube(); } catch (e) { console.warn('Sin conexión con la nube:', e); if (local) return { state: local, origen: 'local' }; }

  // 2) la nube tiene datos: manda la nube
  if (Object.keys(nube).length) {
    const state = migrate(unir(nube));
    if (local) for (const k of SOLO_LOCAL) if (local[k] !== undefined) state[k] = local[k];
    ultimo = state;
    if (habiaSinCifrar) {
      // datos de la versión anterior (sin cifrar): se vuelven a subir cifrados y se borran los viejos
      firmas = Object.fromEntries(Object.keys(nube).map((id) => [id, 'sin-cifrar']));
      escribir(kFirmas(), firmas);
      escribir(kPend(), []);
      guardar(state);
      programar(0);
      return { state, origen: 'cifrado' };
    }
    firmas = Object.fromEntries(Object.entries(nube).map(([id, json]) => [id, firma(json)]));
    escribir(kFirmas(), firmas);
    escribir(kPend(), []);
    alCambiarEstado('ok');
    return { state, origen: 'nube' };
  }

  // 3) nube vacía: primer ingreso. Se suben los datos que ya había en el dispositivo.
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
  if (!uid || pendientes().length || enviando || !navigator.onLine) return null;
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
  if (borrarLocal && uid && !quedan) { try { localStorage.removeItem(kPend()); localStorage.removeItem(kFirmas()); } catch { /* nada */ } }
  uid = null; ultimo = null; firmas = {}; llave = null;
  return quedan;
}

/** Borra todos los datos de la cuenta en la nube (para eliminar la cuenta). */
export async function borrarNube() {
  if (!uid) return;
  const { db } = firebase();
  const snap = await getDocs(collection(db, 'usuarios', uid, 'estado'));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'usuarios', uid));
  await batch.commit();
  try { localStorage.removeItem(kPend()); localStorage.removeItem(kFirmas()); } catch { /* nada */ }
}

/** Lee el perfil de una cuenta: { llave, creado } (o vacío si es nueva). */
export async function leerPerfil(u) {
  const s = await getDoc(doc(firebase().db, 'usuarios', u.uid));
  const d = s.exists() ? s.data() : {};
  return { llave: d.llave || null, creado: d.creado || null };
}

let creadoGuardado = null;
async function escribirPerfil(llaveEnvuelta, creado) {
  if (creado) creadoGuardado = creado;
  const datos = { creado: creadoGuardado || serverTimestamp(), ultimoIngreso: serverTimestamp() };
  if (llaveEnvuelta) datos.llave = llaveEnvuelta;
  await setDoc(doc(firebase().db, 'usuarios', uid), datos);
}

/** Guarda la llave envuelta (al crearla, cambiar la clave o el código). */
export async function guardarLlave(u, llaveEnvuelta, creado) {
  uid = uid || u.uid;
  const ref = doc(firebase().db, 'usuarios', u.uid);
  const prev = await getDoc(ref).catch(() => null);
  const c = creado || (prev && prev.exists() && prev.data().creado) || serverTimestamp();
  creadoGuardado = c;
  await setDoc(ref, { creado: c, ultimoIngreso: serverTimestamp(), llave: llaveEnvuelta });
}

window.addEventListener('online', reintentar);
