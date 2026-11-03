// =========================================================
// Pesitos — cuánto rinde tu plata (se actualiza solo, dos veces por día)
// Fuentes (ArgentinaDatos, api.argentinadatos.com, datos públicos y gratuitos; son
// las mismas que usa comparatasas.ar):
// - Cuentas y billeteras con TASA FIJA publicada por la entidad (Fiwind, Ualá, Naranja X,
//   Carrefour…): /fci/otros/ultimo, con su tope y su fecha de vigencia.
// - Billeteras que invierten en un FONDO money market (Mercado Pago, Personal Pay, Cocos,
//   Prex…): TNA de los últimos 7 días del fondo (criterio del BCRA, Com. A 8497) desde
//   /fci/comparatasas. Se controla contra la variación de la cuotaparte de los dos
//   últimos días (/fci/mercadoDinero): si no coinciden, se marca para revisar.
// - Plazo fijo: tasa para clientes que publica el BCRA para cada banco.
// Si una tasa no llega o no es razonable, se queda la última buena. Cada cambio se
// guarda con su fecha: los intereses de cada día se calculan con la tasa de ese día.
// Topes: si la cuenta paga hasta un monto (ej. Fiwind 23% hasta $750.000), lo que
// pasa del tope rinde lo que diga la entidad (Fiwind: su fondo Delta Pesos) o nada.
// =========================================================

const API = 'https://api.argentinadatos.com/v1/finanzas';
const TTL = 12 * 60 * 60 * 1000;
let cargando = false;

// fija: nombre en /fci/otros (tasa publicada) · fondo: fondo money market que usa · excedente: fondo para lo que pasa del tope
export const BILLETERAS_QUE_RINDEN = [
  { id: 'mercadopago', nombre: 'Mercado Pago', fondo: 'Mercado Fondo - Clase A' },
  { id: 'uala', nombre: 'Ualá', fija: 'UALA', fondo: 'Ualintec Ahorro Pesos - Clase A' },
  { id: 'naranjax', nombre: 'Naranja X', fija: 'NARANJA X' },
  { id: 'fiwind', nombre: 'Fiwind', fija: 'FIWIND', excedente: 'Delta Pesos - Clase A', entidad: 'fiwind' },
  { id: 'personalpay', nombre: 'Personal Pay', fondo: 'Delta Pesos - Clase X' },
  { id: 'cocos', nombre: 'Cocos', fondo: 'Cocos Ahorro - Clase A' },
  { id: 'prex', nombre: 'Prex', fondo: 'Allaria Ahorro - Clase E' },
  { id: 'lemon', nombre: 'Lemon', fondo: 'Vinci Compass Liquidez - Clase F' },
  { id: 'claropay', nombre: 'Claro Pay', fondo: 'SBS Ahorro Pesos - Clase A' },
  { id: 'letsbit', nombre: 'Letsbit', fondo: 'MEGAQM Pesos - Clase E', entidad: 'letsbit' },
  { id: 'carrefour', nombre: 'Banco Carrefour', fija: 'CARREFOUR BANCO' },
];
export const nombreBilletera = (id) => (BILLETERAS_QUE_RINDEN.find((b) => b.id === id) || { nombre: id }).nombre;

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

const dias = (a, b) => Math.max(1, Math.round((Date.parse(a) - Date.parse(b)) / 86400000));
const redondear = (n) => Math.round(n * 100) / 100;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const razonable = (x) => Number.isFinite(x) && x > 0 && x < 150;
// la API a veces manda 0,23 y a veces 23: siempre a porcentaje
const aPct = (x) => { const v = Number(x); return Number.isFinite(v) ? (Math.abs(v) <= 1.5 ? v * 100 : v) : NaN; };
const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** TNA (%) de un fondo money market con el criterio del BCRA: retorno de 7 días × 365 / días. */
export function tnaFondo(r) {
  if (!r) return NaN;
  const ok = (v) => v != null && Number.isFinite(Number(v));
  if (ok(r.ultimos7Dias)) { const d = ok(r.diasUltimos7Dias) && r.diasUltimos7Dias > 0 ? Number(r.diasUltimos7Dias) : 7; const v = Number(r.ultimos7Dias); return Math.abs(v) <= 10 ? v * 365 / d : v; }
  if (ok(r.variacionDiariaPct)) { const v = Number(r.variacionDiariaPct); return Math.abs(v) <= 5 ? v * 365 : v; }
  if (ok(r.tnaEstimada)) return aPct(r.tnaEstimada);
  return NaN;
}

export async function refreshRendimientos(ctx, force = false) {
  const cur = ctx.state.rendimientos;
  if (cargando || (!force && cur && Date.now() - cur.at < TTL)) return;
  cargando = true;
  const tasas = { ...((cur && cur.tasas) || {}) };
  const plazoFijo = { ...((cur && cur.plazoFijo) || {}) };
  const hist = JSON.parse(JSON.stringify((cur && cur.hist) || {}));
  const [otros, cmp, ult, pen, rend, pf] = await Promise.all([
    getJSON(`${API}/fci/otros/ultimo`).catch(() => null),
    getJSON(`${API}/fci/comparatasas`).catch(() => null),
    getJSON(`${API}/fci/mercadoDinero/ultimo`).catch(() => null),
    getJSON(`${API}/fci/mercadoDinero/penultimo`).catch(() => null),
    getJSON(`${API}/rendimientos`).catch(() => null),
    getJSON(`${API}/tasas/plazoFijo`).catch(() => null),
  ]);
  const fondos = (cmp && Array.isArray(cmp.fondos)) ? cmp.fondos : [];
  const fondo7d = (nombre) => { const f = fondos.find((x) => norm(x.nombre) === norm(nombre)); return f ? { tna: tnaFondo(f.rendimientos), fecha: f.fecha || cmp.fechaActualizacion } : null; };
  // control: variación de la cuotaparte de los dos últimos días
  const fondo2d = (nombre) => {
    const u = (ult || []).find((x) => norm(x.fondo) === norm(nombre)); const p = (pen || []).find((x) => norm(x.fondo) === norm(nombre));
    return u && p && u.vcp && p.vcp && u.fecha !== p.fecha ? { tna: (u.vcp / p.vcp - 1) * 365 / dias(u.fecha, p.fecha) * 100, fecha: u.fecha } : null;
  };
  const fija = (nombre) => { const a = (otros || []).find((x) => norm(x.fondo) === norm(nombre)); return a ? { tna: aPct(a.tna), tope: Number(a.tope) > 0 ? Number(a.tope) : null, fecha: a.fecha, condiciones: a.condicionesCorto || a.condiciones || '' } : null; };
  for (const b of BILLETERAS_QUE_RINDEN) {
    let nuevo = null;
    if (b.fija) {
      const f = fija(b.fija);
      if (f && razonable(f.tna)) {
        nuevo = { tna: redondear(f.tna), tope: f.tope, fecha: f.fecha, condiciones: f.condiciones, tipo: 'fija', fuente: 'Tasa publicada por la entidad (CAFCI, vía ArgentinaDatos)' };
        // control con otra fuente (si la hay): avisar si no coinciden
        const e = b.entidad && (rend || []).find((x) => x.entidad === b.entidad);
        const ars = e && (e.rendimientos || []).find((x) => x.moneda === 'ARS' && x.apy > 0);
        if (ars) { const otra = (Math.pow(1 + ars.apy / 100, 1 / 365) - 1) * 365 * 100; if (Math.abs(otra - f.tna) > 3) nuevo.control = `Otra fuente da ${String(redondear(otra)).replace('.', ',')}% (un promedio, que incluye lo que pasa del tope): uso la tasa que publica ${b.nombre}.`; }
        if (b.excedente) { const x = fondo7d(b.excedente); if (x && razonable(x.tna)) nuevo.excedente = redondear(x.tna); }
      }
    }
    if (!nuevo && b.fondo) {
      const a = fondo7d(b.fondo); const c = fondo2d(b.fondo);
      if (a && razonable(a.tna)) {
        nuevo = { tna: redondear(a.tna), tope: null, fecha: a.fecha, tipo: 'fondo', fuente: 'Rendimiento de los últimos 7 días del fondo (CNV, vía ArgentinaDatos)' };
      } else if (c && razonable(c.tna)) nuevo = { tna: redondear(c.tna), tope: null, fecha: c.fecha, tipo: 'fondo', fuente: 'Variación diaria del fondo (vía ArgentinaDatos)' };
    }
    if (!nuevo && b.entidad) {
      const e = (rend || []).find((x) => x.entidad === b.entidad);
      const ars = e && (e.rendimientos || []).find((x) => x.moneda === 'ARS' && x.apy > 0);
      if (ars) { const v = (Math.pow(1 + ars.apy / 100, 1 / 365) - 1) * 365 * 100; if (razonable(v)) nuevo = { tna: redondear(v), tope: null, fecha: ars.fecha, tipo: 'fija', fuente: 'Rendimiento informado (vía ArgentinaDatos)' }; }
    }
    if (nuevo) {
      tasas[b.id] = nuevo;
      const h = hist[b.id] = hist[b.id] || [];
      const fecha = String(nuevo.fecha || hoyISO()).slice(0, 10);
      const ult2 = h[h.length - 1];
      if (!ult2 || ult2[1] !== nuevo.tna || ult2[2] !== nuevo.tope || ult2[3] !== (nuevo.excedente || 0)) {
        if (ult2 && ult2[0] === fecha) h.pop();
        h.push([fecha, nuevo.tna, nuevo.tope, nuevo.excedente || 0]);
        if (h.length > 400) h.splice(0, h.length - 400);
      }
    }
  }
  for (const b of pf || []) if (b.tnaClientes > 0) plazoFijo[b.entidad] = redondear(aPct(b.tnaClientes));
  cargando = false;
  const nuevo = { tasas, plazoFijo, hist };
  const cambio = JSON.stringify(nuevo) !== JSON.stringify({ tasas: (cur && cur.tasas) || {}, plazoFijo: (cur && cur.plazoFijo) || {}, hist: (cur && cur.hist) || {} });
  if (cambio || !cur) ctx.update((s) => { s.rendimientos = { at: Date.now(), ...nuevo }; });
  else ctx.state.rendimientos.at = Date.now();
}

// ---------- cuentas para los intereses ----------
/** Datos de la tasa de una billetera: { tna, tope, excedente, fecha, fuente } (o null). */
export const tasaDe = (s, id) => (s.rendimientos && s.rendimientos.tasas && s.rendimientos.tasas[id]) || null;

/** La tasa que regía un día (si cambió, cada día usa la suya). */
function tasaEnFecha(s, id, iso) {
  const h = s.rendimientos && s.rendimientos.hist && s.rendimientos.hist[id];
  const t = tasaDe(s, id);
  if (!h || !h.length) return t;
  let r = h[0];
  for (const x of h) { if (x[0] <= iso) r = x; else break; }
  return { tna: r[1], tope: r[2], excedente: r[3] || 0 };
}

/** Interés de un día sobre un saldo, respetando el tope. */
export function interesDelDia(t, saldo) {
  if (!t || !(saldo > 0)) return 0;
  const tope = Number(t.tope) > 0 ? Number(t.tope) : Infinity;
  return Math.min(saldo, tope) * (t.tna / 100 / 365) + Math.max(0, saldo - tope) * ((t.excedente || 0) / 100 / 365);
}

/** Cuánto ganás en N días con un monto en una billetera (interés compuesto diario y tope). */
export function gananciaEn(t, monto, n = 30) {
  let b = monto; for (let i = 0; i < n; i++) b += interesDelDia(t, b); return b - monto;
}

/**
 * Hace crecer un saldo día a día desde una fecha hasta hoy.
 * movs: { 'AAAA-MM-DD': monto } (entradas y salidas de cada día, opcional).
 * tasaFija: { tna } para tasas que cargaste a mano (sin billetera).
 */
export function crecer(s, { id, tasaFija, saldo, desde, movs = {}, hasta = new Date() }) {
  let bal = Number(saldo) || 0;
  if (!desde) return bal + Object.values(movs).reduce((a, v) => a + v, 0);
  const d = new Date(desde + 'T00:00:00');
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  for (let i = 0; i < 4000; i++) {
    d.setDate(d.getDate() + 1);
    if (d > fin) break;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = id ? tasaEnFecha(s, id, iso) : tasaFija;
    bal += interesDelDia(t, bal); // lo que quedó a la noche rinde
    bal += movs[iso] || 0;
  }
  return bal;
}

/** TNA (%) que corresponde a un ahorro hoy: la automática de su billetera o la que cargaste. */
export function tnaDe(s, h) {
  if (h.rinde && h.rinde !== 'manual' && h.rinde !== 'no') { const t = tasaDe(s, h.rinde); if (t) return t.tna; }
  return Number(h.tna) || 0;
}

/** Cuánto vale hoy un ahorro en su moneda, sumando los intereses de cada día desde que lo cargaste. */
export function valorHoy(s, h, hoy = new Date()) {
  if (!h.since || !h.amount) return h.amount;
  const auto = h.rinde && h.rinde !== 'manual' && h.rinde !== 'no' && tasaDe(s, h.rinde);
  const tna = auto ? null : Number(h.tna) || 0;
  if (!auto && !tna) return h.amount;
  let d = Math.floor((hoy - new Date(h.since + 'T00:00:00')) / 86400000);
  if (d <= 0) return h.amount;
  if (h.type === 'plazo_fijo') {
    // interés simple hasta el vencimiento (se cobra al final)
    const t = auto ? tasaDe(s, h.rinde).tna : tna;
    if (h.maturity) d = Math.min(d, Math.max(0, Math.round((new Date(h.maturity + 'T00:00:00') - new Date(h.since + 'T00:00:00')) / 86400000)));
    return h.amount * (1 + (t / 100) * d / 365);
  }
  return auto ? crecer(s, { id: h.rinde, saldo: h.amount, desde: h.since, hasta: hoy }) : crecer(s, { tasaFija: { tna }, saldo: h.amount, desde: h.since, hasta: hoy });
}

/** "23% anual hasta $750.000 (lo que pasa, 19%)" */
export function textoTasa(t, money) {
  if (!t) return '';
  const pct = (v) => `${String(v).replace('.', ',')}%`;
  return `${pct(t.tna)} anual${t.tope ? ` hasta ${money(t.tope)}${t.excedente ? ` (lo que pasa, ${pct(t.excedente)})` : ' (lo que pasa no rinde)'}` : ''}`;
}

export const interesesGanados = (s, h) => valorHoy(s, h) - (h.amount || 0);

export const rinde = (type) => ['remunerada', 'plazo_fijo', 'fci', 'caja'].includes(type);
