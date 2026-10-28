// Avisos de la mañana (notificaciones push).
// Lee de cada usuario solo su agenda de avisos (qué días hay algo, sin montos ni
// nombres: ver js/avisos.js) y le manda una notificación a sus dispositivos.
// Variables de entorno: VAPID_PRIVATE_KEY (y FIREBASE_SERVICE_ACCOUNT_JSON).

import webpush from 'web-push';
import { db } from './firebase.js';

export const VAPID_PUBLICA = 'BOZlQ_Umdlrnx3ClrCKVe4P_c8gTsKP9e0i-8sRZD7J2Df_RmPxaiu3o7RWGm0ycGY8b6o5pGQ4Vpo_HqRevIV0';
export const avisosConfigurados = () => Boolean(process.env.VAPID_PRIVATE_KEY);

const plural = (n, uno, varios) => (n === 1 ? uno : varios.replace('#', n));

/** Arma el texto del aviso de un día. */
export function mensajeDelDia(d = {}) {
  const partes = [];
  let titulo = '';
  let url = './#/pagos';
  if (d.hoy) { titulo = plural(d.hoy, 'Hoy vence un pago', 'Hoy vencen # pagos'); partes.push('Abrí Pesitos para ver cuáles y marcarlos como pagados.'); }
  if (d.manana) { if (!titulo) titulo = plural(d.manana, 'Mañana vence un pago', 'Mañana vencen # pagos'); else partes.push(plural(d.manana, 'Y mañana vence otro.', 'Y mañana vencen #.')); if (!d.hoy) partes.push('Fijate que tengas la plata en la cuenta.'); }
  if (d.cierre) { if (!titulo) { titulo = 'Hoy cierra tu tarjeta'; url = './#/tarjetas'; } partes.push('Lo que compres con tarjeta desde mañana va al resumen siguiente.'); }
  if (d.cobro) { if (!titulo) { titulo = 'Hoy es día de cobro 💸'; url = './#/inicio'; } partes.push('Confirmá tu sueldo y apartá tu ahorro antes de gastar.'); }
  if (d.deuda) { if (!titulo) { titulo = plural(d.deuda, 'Hoy vence una deuda o préstamo', 'Hoy vencen # deudas o préstamos'); url = './#/deudas'; } else partes.push('También vence una deuda o préstamo.'); }
  return titulo ? { title: titulo, body: partes.join(' '), url, tag: 'pesitos-dia' } : null;
}

/** Envía los avisos de hoy. Devuelve un resumen para el registro. */
export async function enviarAvisos(hoy) {
  if (!avisosConfigurados()) return 'apagado (falta VAPID_PRIVATE_KEY)';
  webpush.setVapidDetails('mailto:pesitosapp@gmail.com', VAPID_PUBLICA, process.env.VAPID_PRIVATE_KEY);
  const base = db();
  const usuarios = await base.collection('usuarios').listDocuments();
  let enviados = 0; let borrados = 0; let conAviso = 0;
  for (const u of usuarios) {
    const ag = await u.collection('avisos').doc('agenda').get();
    const msg = ag.exists ? mensajeDelDia(((ag.data() || {}).dias || {})[hoy]) : null;
    if (!msg) continue;
    conAviso++;
    const subs = await u.collection('push').get();
    for (const sd of subs.docs) {
      const sub = sd.data();
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'normal' }); enviados++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await sd.ref.delete(); borrados++; } else console.warn('Aviso no enviado:', e.statusCode || e.message); }
    }
  }
  return `ok: ${enviados} avisos a ${conAviso} usuarios${borrados ? `, ${borrados} suscripciones vencidas borradas` : ''}`;
}
