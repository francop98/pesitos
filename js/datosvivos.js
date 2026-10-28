// Datos que cambian con el tiempo y se actualizan solos:
// - Inflación mensual (IPC del INDEC) desde la API oficial de series de
//   tiempo del Gobierno (apis.datos.gob.ar). Respaldo: el servicio de Pesitos.
// - Promos vigentes, publicadas por el servicio de Pesitos (api/ en Vercel),
//   que las junta todos los días de fuentes gratuitas. Ver DEPLOY.md.
// Nada de esto se carga a mano.

import { monthKey, addMonthKey, todayISO, normalize } from './formato.js';

const norm = (t) => normalize(t).replace(/[^a-z0-9]+/g, ' ').trim();
// para comparar nombres de bancos: "Banco Patagonia" = "Patagonia"
const nameKey = (t) => norm(t).replace(/\b(banco|tarjeta|de|del|la|el)\b/g, ' ').replace(/\s+/g, ' ').trim();

// ¿La promo vale en la provincia del usuario? (misma lógica que api/_lib/zona.js)
const ZONE_KEYS = { 'Buenos Aires': ['provincia de buenos aires', 'pba', 'amba', 'bonaerense'], CABA: ['caba', 'ciudad de buenos aires', 'ciudad autonoma', 'amba'] };
export function inZone(zone, prov, city = '') {
  const z = norm(zone || '');
  if (!z || z.includes('nacional') || z.includes('todo el pais')) return true;
  const c = norm(city);
  if (c && c.length >= 3 && z.includes(c)) return true; // promos de tu ciudad
  if (!prov) return false; // sin provincia elegida, solo las nacionales
  return (ZONE_KEYS[prov] || [norm(prov)]).some((k) => z.includes(k));
}

const LIVE_URL = './api/datos';            // función de Vercel (api/datos.js)
const IPC_SERIES = '148.3_INIVELNAL_DICI_M_26'; // IPC Nacional, nivel general (INDEC)
const LIVE_TTL = 60 * 60 * 1000;           // 1 hora
const IPC_TTL = 6 * 60 * 60 * 1000;        // 6 horas
let busy = false;

async function getJSON(url, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchIpcOfficial() {
  const start = addMonthKey(monthKey(), -36);
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${IPC_SERIES}:percent_change&start_date=${start}&limit=1000&format=json`;
  const j = await getJSON(url);
  const out = {};
  for (const row of j.data || []) {
    const [date, v] = row;
    if (v == null) continue;
    const pct = Math.abs(v) < 1 ? v * 100 : v; // la API devuelve proporción (0,023 = 2,3%)
    out[String(date).slice(0, 7)] = Math.round(pct * 100) / 100;
  }
  if (!Object.keys(out).length) throw new Error('sin datos');
  return out;
}

let lastTry = 0;

export async function refreshLive(ctx, force = false) {
  if (busy || (!force && Date.now() - lastTry < 2 * 60 * 1000)) return;
  lastTry = Date.now();
  const s = ctx.state;
  const now = Date.now();
  const tasks = [];
  const patch = {};

  const zonaActual = `${(s.profile && s.profile.province) || ''}|${(s.profile && s.profile.city) || ''}`;
  const provChanged = s.live && (s.live.prov || '') !== zonaActual;
  if (force || provChanged || !s.live || now - (s.live.at || 0) > LIVE_TTL) {
    // medios de pago que el usuario agregó: el servicio también busca sus promos
    const extra = (s.customWallets || []).map((w) => w.name).slice(0, 5).join(',');
    const q = new URLSearchParams();
    if (s.profile && s.profile.province) q.set('prov', s.profile.province);
    if (s.profile && s.profile.city) q.set('ciudad', s.profile.city);
    if (extra) q.set('extra', extra);
    const url = q.toString() ? `${LIVE_URL}?${q}` : LIVE_URL;
    tasks.push(getJSON(url).then((j) => {
      if (j && (Array.isArray(j.promos) || j.ipc)) patch.live = { promos: j.promos || [], ipc: j.ipc || {}, updatedAt: j.updatedAt || null, sources: j.sources || [], prov: zonaActual, at: now };
    }).catch(() => { patch.liveFailedAt = now; }));
  }
  if (force || !s.ipcAuto || now - (s.ipcAuto.at || 0) > IPC_TTL) {
    tasks.push(fetchIpcOfficial().then((m) => { patch.ipcAuto = { data: m, source: 'INDEC (datos.gob.ar)', at: now }; }).catch(() => {}));
  }
  if (!tasks.length) return;
  busy = true;
  await Promise.all(tasks);
  busy = false;
  if (patch.live || patch.ipcAuto) ctx.update((st) => { Object.assign(st, patch); });
}

// Inflación mensual: oficial → servicio de Pesitos → datos de ejemplo
export function ipcMap(s) {
  const real = { ...((s.live && s.live.ipc) || {}), ...((s.ipcAuto && s.ipcAuto.data) || {}) };
  return Object.keys(real).length ? real : { ...(s.ipc || {}) }; // los datos de ejemplo solo si no hay reales
}

export function lastIpc(s) {
  const m = ipcMap(s);
  const keys = Object.keys(m).sort();
  const k = keys[keys.length - 1];
  return k ? { mk: k, value: m[k] } : null;
}

// Inflación mensual esperada: promedio de los últimos 3 datos publicados
export function expectedInflation(s) {
  const m = ipcMap(s);
  const vals = Object.keys(m).sort().slice(-3).map((k) => Number(m[k])).filter((v) => Number.isFinite(v));
  if (!vals.length) return 2;
  return Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 100) / 100;
}

// Promos vigentes del servicio (solo las que están dentro de sus fechas)
export function livePromos(s) {
  const today = todayISO();
  // promos de medios agregados por el usuario: llegan con su nombre y se asocian a su id
  const custom = Object.fromEntries((s.customWallets || []).map((w) => [nameKey(w.name), w.id]));
  const prov = (s.profile && s.profile.province) || '';
  const city = (s.profile && s.profile.city) || '';
  const list = ((s.live && s.live.promos) || []).map((p) => (p.walletName && custom[nameKey(p.walletName)] ? { ...p, wallet: custom[nameKey(p.walletName)] } : p));
  return list.filter((p) => (!p.validFrom || p.validFrom <= today) && (!p.validTo || p.validTo >= today) && inZone(p.zone, prov, city));
}

export function liveAge(s) {
  const t = s.live && s.live.updatedAt ? Date.parse(s.live.updatedAt) : 0;
  if (!t) return null;
  const h = Math.round((Date.now() - t) / 3600000);
  if (h < 1) return 'hace menos de una hora';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
