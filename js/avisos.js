// =========================================================
// Pesitos — avisos aunque la app esté cerrada (notificaciones push)
// Para avisarte, el servidor necesita saber QUÉ DÍAS hay algo. Por eso, si
// activás los avisos, se guarda sin cifrar solo esto, por día:
//   { hoy: cantidad de vencimientos, manana: cantidad, cierre, cobro, deuda }
// Nunca montos, nombres ni comercios. Lo demás sigue cifrado.
//   usuarios/{uid}/push/{id}      la suscripción de este dispositivo
//   usuarios/{uid}/avisos/agenda  { dias: { 'AAAA-MM-DD': {...} } } (próximos 40 días)
// =========================================================

import { firebase } from './firebaseconfig.js';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { agendaBetween, statementDates, statementOf } from './agenda.js';
import { fechaDeCobro, reglaDeCobro } from './feriados.js';
import { toISO, startOfToday, addMonthKey, monthKey } from './formato.js';
import { deudasAbiertas } from './cuentas.js';
import { toast } from './interfaz.js';

// Clave pública VAPID (la privada está solo en Vercel)
export const VAPID_PUBLICA = 'BOZlQ_Umdlrnx3ClrCKVe4P_c8gTsKP9e0i-8sRZD7J2Df_RmPxaiu3o7RWGm0ycGY8b6o5pGQ4Vpo_HqRevIV0';
const DIAS = 40;

const kActivo = (uid) => `pesitos_avisos:${uid}`;
const kFirma = (uid) => `pesitos_avisos_firma:${uid}`;
export const avisosSoportados = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const avisosActivos = (uid) => { try { return localStorage.getItem(kActivo(uid)) === '1'; } catch { return false; } };

function claveB64(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function idSuscripcion(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(h).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Días con algo para avisar: solo cantidades, sin datos. */
export function agendaDeAvisos(s) {
  const hoy = startOfToday();
  const hasta = new Date(hoy); hasta.setDate(hasta.getDate() + DIAS);
  const dias = {};
  const sumar = (iso, k) => { if (iso < toISO(hoy) || iso > toISO(hasta)) return; (dias[iso] = dias[iso] || {})[k] = (dias[iso][k] || 0) + 1; };
  for (const it of agendaBetween(s, hoy, hasta)) {
    if (it.paid || it.autoDebit) continue;
    sumar(it.due, 'hoy');
    const antes = new Date(it.dueDate); antes.setDate(antes.getDate() - 1);
    sumar(toISO(antes), 'manana');
  }
  for (const c of s.cards || []) for (const k of [0, 1]) { const { close } = statementDates(c, addMonthKey(statementOf(c, toISO(hoy)), k)); sumar(toISO(close), 'cierre'); }
  if (reglaDeCobro(s.profile).tipo !== 'varia') for (const k of [0, 1]) { const m = addMonthKey(monthKey(), k); sumar(toISO(fechaDeCobro(s.profile, Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1)), 'cobro'); }
  for (const d of deudasAbiertas(s)) if (d.vence) sumar(d.vence, 'deuda');
  return dias;
}

/** Sube la agenda de avisos si cambió (lo llama la app al abrir y al cambiar datos). */
export async function publicarAgenda(s, uid) {
  if (!uid || !avisosActivos(uid) || s.demo) return;
  const dias = agendaDeAvisos(s);
  const firma = toISO(startOfToday()) + JSON.stringify(dias); // se vuelve a subir al menos una vez por día
  try { if (localStorage.getItem(kFirma(uid)) === firma) return; } catch { /* nada */ }
  try {
    await setDoc(doc(firebase().db, 'usuarios', uid, 'avisos', 'agenda'), { dias, actualizado: serverTimestamp() });
    localStorage.setItem(kFirma(uid), firma);
  } catch (e) { console.warn('Avisos sin actualizar:', e); }
}

export async function activarAvisos(s, uid) {
  if (!avisosSoportados()) { toast('Este navegador no permite avisos. En iPhone, primero instalá Pesitos en la pantalla de inicio.'); return false; }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { toast('Sin permiso no te puedo avisar. Podés habilitarlo en los ajustes del navegador.'); return false; }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveB64(VAPID_PUBLICA) });
  const j = sub.toJSON();
  await setDoc(doc(firebase().db, 'usuarios', uid, 'push', await idSuscripcion(j.endpoint)), { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth }, creado: serverTimestamp() });
  localStorage.setItem(kActivo(uid), '1');
  localStorage.removeItem(kFirma(uid));
  await publicarAgenda(s, uid);
  return true;
}

export async function desactivarAvisos(uid) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await deleteDoc(doc(firebase().db, 'usuarios', uid, 'push', await idSuscripcion(sub.endpoint))).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* nada */ }
  // la agenda también se borra (si tenés avisos en otro dispositivo, ese la vuelve a subir al abrir la app)
  await deleteDoc(doc(firebase().db, 'usuarios', uid, 'avisos', 'agenda')).catch(() => {});
  localStorage.removeItem(kActivo(uid));
  localStorage.removeItem(kFirma(uid));
}
