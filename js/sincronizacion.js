// =========================================================
// Pesitos — sincronización con Firestore
// Estructura en la nube:
//   usuarios/{uid}                    perfil de la cuenta (nombre, mail, fechas)
//   usuarios/{uid}/estado/general     tus datos (sueldo, metas, tarjetas, reglas…)
//   usuarios/{uid}/estado/expenses-AAAA, incomes-AAAA, transfers-AAAA
//                                     movimientos separados por año
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
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const POR_ANIO = ['expenses', 'incomes', 'transfers'];               // listas que crecen: un documento por año
const SOLO_LOCAL = ['rates', 'live', 'ipcAuto', 'liveFailedAt'];      // datos públicos que se bajan solos
const DEMORA = 1000;

let uid = null;
let timer = null;
let enviando = false;
let firmas = {};      // { docId: firma de lo último confirmado por la nube }
let ultimo = null;    // último estado recibido para guardar
let alCambiarEstado = () => {};

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
  const out = { general: JSON.stringify(general) };
  for (const [id, items] of Object.entries(docs)) out[id] = JSON.stringify(items);
  return out; // { docId: json }
}

/** Arma el estado a partir de los documentos de la nube. */
export function unir(docs) {
  const base = docs.general ? JSON.parse(docs.general) : {};
  for (const k of POR_ANIO) base[k] = [];
  for (const [id, json] of Object.entries(docs)) {
    const k = POR_ANIO.find((x) => id.startsWith(x + '-'));
    if (k) base[k].push(...JSON.parse(json));
  }
  return base;
}

const firma = (json) => { let h = 5381; for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0; return `${json.length}:${h >>> 0}`; };

async function leerNube() {
  const snap = await getDocs(collection(firebase().db, 'usuarios', uid, 'estado'));
  const docs = {};
  snap.forEach((d) => { const x = d.data(); if (typeof x.json === 'string') docs[d.id] = x.json; });
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
      if (id in partes) batch.set(refEstado(id), { json: partes[id], actualizado: serverTimestamp() });
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
export async function iniciar(user, { local, legacy, onStatus } = {}) {
  uid = user.uid;
  alCambiarEstado = onStatus || (() => {});
  firmas = leer(kFirmas(), {});
  const { db } = firebase();

  // perfil de la cuenta
  try {
    const ref = doc(db, 'usuarios', uid);
    const s = await getDoc(ref);
    const perfil = { nombre: user.displayName || '', email: user.email || '', proveedor: (user.providerData[0] || {}).providerId || 'password', ultimoIngreso: serverTimestamp() };
    await setDoc(ref, s.exists() ? perfil : { ...perfil, creado: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn('Perfil sin sincronizar:', e); }

  // 1) cambios sin enviar en este dispositivo: mandan ellos
  if (local && pendientes().length) { ultimo = local; programar(0); return { state: local, origen: 'local' }; }

  let nube = {};
  try { nube = await leerNube(); } catch (e) { console.warn('Sin conexión con la nube:', e); if (local) return { state: local, origen: 'local' }; }

  // 2) la nube tiene datos: manda la nube
  if (Object.keys(nube).length) {
    firmas = Object.fromEntries(Object.entries(nube).map(([id, json]) => [id, firma(json)]));
    escribir(kFirmas(), firmas);
    escribir(kPend(), []);
    const state = migrate(unir(nube));
    if (local) for (const k of SOLO_LOCAL) if (local[k] !== undefined) state[k] = local[k];
    ultimo = state;
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
  uid = null; ultimo = null; firmas = {};
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

/** Actualiza el perfil de la cuenta (por ejemplo, el nombre). */
export async function guardarPerfil(datos) {
  if (!uid) return;
  await setDoc(doc(firebase().db, 'usuarios', uid), datos, { merge: true });
}

window.addEventListener('online', reintentar);
