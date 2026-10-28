// =========================================================
// Pesitos — cuánto rinde tu plata (se actualiza solo)
// Fuente: ArgentinaDatos (api.argentinadatos.com), datos públicos y gratuitos:
// - Billeteras con cuenta remunerada que invierten en un fondo money market
//   (Mercado Pago, Ualá, Cocos…): la TNA se calcula con la variación de la
//   cuotaparte del fondo entre los dos últimos días publicados.
// - Billeteras que informan su tasa (Fiwind, Letsbit).
// - Plazo fijo: tasa para clientes que publica el BCRA para cada banco.
// El valor de tus ahorros suma los intereses día a día, con interés compuesto.
// =========================================================

const API = 'https://api.argentinadatos.com/v1/finanzas';
const TTL = 12 * 60 * 60 * 1000; // dos veces por día alcanza: las tasas cambian poco
let cargando = false;

// billeteras / cuentas remuneradas → fondo money market que usan
export const BILLETERAS_QUE_RINDEN = [
  { id: 'mercadopago', nombre: 'Mercado Pago', fondo: 'Mercado Fondo - Clase A' },
  { id: 'uala', nombre: 'Ualá', fondo: 'Ualintec Ahorro Pesos - Clase A' },
  { id: 'cocos', nombre: 'Cocos', fondo: 'Cocos Ahorro - Clase A' },
  { id: 'fiwind', nombre: 'Fiwind', entidad: 'fiwind' },
  { id: 'letsbit', nombre: 'Letsbit', entidad: 'letsbit' },
];

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

const dias = (a, b) => Math.max(1, Math.round((Date.parse(a) - Date.parse(b)) / 86400000));
const redondear = (n) => Math.round(n * 100) / 100;

export async function refreshRendimientos(ctx, force = false) {
  const cur = ctx.state.rendimientos;
  if (cargando || (!force && cur && Date.now() - cur.at < TTL)) return;
  cargando = true;
  const tasas = { ...((cur && cur.tasas) || {}) };
  const plazoFijo = { ...((cur && cur.plazoFijo) || {}) };
  try {
    const [ult, pen] = await Promise.all([getJSON(`${API}/fci/mercadoDinero/ultimo`), getJSON(`${API}/fci/mercadoDinero/penultimo`)]);
    for (const b of BILLETERAS_QUE_RINDEN.filter((x) => x.fondo)) {
      const u = (ult || []).find((x) => x.fondo === b.fondo);
      const p = (pen || []).find((x) => x.fondo === b.fondo);
      if (u && p && u.vcp && p.vcp && u.fecha !== p.fecha) {
        const tna = ((u.vcp / p.vcp - 1) * 365 / dias(u.fecha, p.fecha)) * 100;
        if (tna > 0 && tna < 200) tasas[b.id] = { tna: redondear(tna), fecha: u.fecha };
      }
    }
  } catch { /* sin conexión: quedan las últimas */ }
  try {
    const r = await getJSON(`${API}/rendimientos`);
    for (const b of BILLETERAS_QUE_RINDEN.filter((x) => x.entidad)) {
      const e = (r || []).find((x) => x.entidad === b.entidad);
      const ars = e && (e.rendimientos || []).find((x) => x.moneda === 'ARS');
      // informan TEA (apy): se pasa a TNA con capitalización diaria
      if (ars && ars.apy > 0) tasas[b.id] = { tna: redondear((Math.pow(1 + ars.apy / 100, 1 / 365) - 1) * 365 * 100), fecha: ars.fecha };
    }
  } catch { /* nada */ }
  try {
    const r = await getJSON(`${API}/tasas/plazoFijo`);
    for (const b of r || []) if (b.tnaClientes > 0) plazoFijo[b.entidad] = redondear(b.tnaClientes * 100);
  } catch { /* nada */ }
  cargando = false;
  const nuevo = { tasas, plazoFijo };
  const cambio = JSON.stringify(nuevo) !== JSON.stringify({ tasas: (cur && cur.tasas) || {}, plazoFijo: (cur && cur.plazoFijo) || {} });
  if (cambio || !cur) ctx.update((s) => { s.rendimientos = { at: Date.now(), ...nuevo }; });
  else ctx.state.rendimientos.at = Date.now();
}

/** TNA (%) que corresponde a un ahorro: la automática de su billetera o la que cargaste. */
export function tnaDe(s, h) {
  if (h.rinde && h.rinde !== 'manual' && h.rinde !== 'no') {
    const t = s.rendimientos && s.rendimientos.tasas && s.rendimientos.tasas[h.rinde];
    if (t) return t.tna;
  }
  return Number(h.tna) || 0;
}

/** Cuánto vale hoy un ahorro en su moneda, sumando los intereses desde que cargaste el monto. */
export function valorHoy(s, h, hoy = new Date()) {
  const tna = tnaDe(s, h);
  if (!tna || !h.since || !h.amount) return h.amount;
  let d = Math.floor((hoy - new Date(h.since + 'T00:00:00')) / 86400000);
  if (d <= 0) return h.amount;
  if (h.type === 'plazo_fijo') {
    // interés simple hasta el vencimiento (se cobra al final)
    if (h.maturity) d = Math.min(d, Math.max(0, Math.round((new Date(h.maturity + 'T00:00:00') - new Date(h.since + 'T00:00:00')) / 86400000)));
    return h.amount * (1 + (tna / 100) * d / 365);
  }
  return h.amount * Math.pow(1 + tna / 100 / 365, d); // interés compuesto diario
}

export const interesesGanados = (s, h) => valorHoy(s, h) - (h.amount || 0);

export const rinde = (type) => ['remunerada', 'plazo_fijo', 'fci', 'caja'].includes(type);
