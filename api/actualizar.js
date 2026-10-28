// Actualización automática (Vercel Cron, ver vercel.json): todos los días a las
// 9:00 y a las 15:00 de Argentina (la fuente de promos se renueva cerca de las 7:45).
// Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente.
// También se puede correr a mano desde Vercel → Settings → Cron Jobs → Run.

import { actualizar } from './_lib/actualizar.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado' });
  try {
    const doc = await actualizar({ turno: String(req.query.turno || 'manana') });
    return res.status(200).json({ ok: true, promos: doc.promos.length, ipcMeses: Object.keys(doc.ipc).length, status: doc.status, updatedAt: doc.updatedAt });
  } catch (e) {
    console.error('Actualización falló:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
