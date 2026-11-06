// Cotizaciones en vivo.
// - Dólares (blue, oficial, MEP, CCL, tarjeta, cripto, mayorista): DolarApi.com.
// - Euro, real, peso uruguayo y chileno: DolarApi.com.
// - Otras ~30 monedas del mundo (guaraní, sol, libra, yen…): Exchange Rate API (open.er-api.com,
//   gratis y sin clave; pide mostrar "Rates By Exchange Rate API"), cruzadas con tu dólar de referencia.
// - Bitcoin, Ethereum, USDT y oro (vía PAX Gold, 1 token = 1 onza troy = 31,1035 g; se guarda por GRAMO): CoinGecko.
// Si no hay conexión, se usan las últimas guardadas y se avisa que no están al día.

export const GRAMOS_POR_ONZA = 31.1035; // el oro se maneja por gramo
const TTL = 5 * 60 * 1000; // se refresca cada 5 minutos y al volver a la app
let loading = false;

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function refreshRates(ctx, force = false) {
  const cur = ctx.state.rates;
  if (loading || (!force && cur && Date.now() - cur.at < TTL)) return false;
  loading = true;
  const out = { ...(cur || {}) };
  let ok = false;
  // todos los dólares (oficial, blue, MEP, CCL, tarjeta, cripto, mayorista); el blue es el de referencia
  try {
    const todos = await getJSON('https://dolarapi.com/v1/dolares');
    const dolares = {};
    for (const d of todos || []) if (d && d.casa && d.venta) dolares[d.casa] = { nombre: d.nombre, compra: d.compra, venta: d.venta, updated: d.fechaActualizacion };
    if (Object.keys(dolares).length) out.dolares = dolares;
    if (dolares.blue) { out.USD = { compra: dolares.blue.compra, venta: dolares.blue.venta, updated: dolares.blue.updated }; ok = true; }
  } catch { /* sin conexión */ }
  if (!out.USD || !ok) {
    try {
      const b = await getJSON('https://dolarapi.com/v1/dolares/blue');
      if (b && b.venta) { out.USD = { compra: b.compra, venta: b.venta, updated: b.fechaActualizacion }; ok = true; }
    } catch { /* sin conexión */ }
  }
  try {
    const list = await getJSON('https://dolarapi.com/v1/cotizaciones');
    for (const c of list || []) {
      const code = String(c.moneda || '').toUpperCase();
      if (code && code !== 'USD' && c.venta) out[code] = { compra: c.compra, venta: c.venta, updated: c.fechaActualizacion };
    }
  } catch { /* sin conexión */ }
  // el resto de las monedas del mundo (se actualizan una vez por día: las pido cada 12 horas)
  if (!out.fx || Date.now() - (out.fx.at || 0) > 12 * 3600 * 1000) {
    try {
      const fx = await getJSON('https://open.er-api.com/v6/latest/USD');
      if (fx && fx.result === 'success' && fx.rates) out.fx = { at: Date.now(), updated: fx.time_last_update_utc || '', porUsd: fx.rates };
    } catch { /* sin conexión */ }
  }
  try {
    const cg = await getJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,pax-gold&vs_currencies=usd');
    out.crypto = { BTC: cg.bitcoin?.usd, ETH: cg.ethereum?.usd, USDT: cg.tether?.usd, XAU: cg['pax-gold']?.usd ? cg['pax-gold'].usd / GRAMOS_POR_ONZA : undefined, updated: new Date().toISOString() };
    ok = true;
  } catch { /* sin conexión */ }
  loading = false;
  out.at = Date.now();
  out.ok = ok;
  if (ok) out.okAt = out.at;
  ctx.update((s) => { s.rates = out; });
  return ok;
}

// Todos los dólares que trae DolarApi (id = "casa" de la API)
export const DOLARES = [['oficial', 'Dólar oficial'], ['blue', 'Dólar blue'], ['bolsa', 'Dólar MEP'], ['contadoconliqui', 'Dólar CCL'], ['tarjeta', 'Dólar tarjeta'], ['mayorista', 'Dólar mayorista'], ['cripto', 'Dólar cripto']];
export const dolarRef = (s) => ((s.settings || {}).dolarRef && DOLARES.some(([id]) => id === s.settings.dolarRef) ? s.settings.dolarRef : 'blue');
export const nombreDolar = (id) => (DOLARES.find(([x]) => x === id) || [, 'Dólar'])[1];

// Cuántos pesos vale 1 unidad del activo.
// 'USD' usa el dólar que elegiste como referencia (blue si no elegiste); 'USD:oficial', 'USD:bolsa'… un dólar puntual.
export function arsPer(s, asset) {
  if (!asset || asset === 'ARS') return 1;
  const manual = (s.settings.manualRates || {})[asset];
  if (manual) return manual;
  const r = s.rates || {};
  const dol = r.dolares || {};
  if (asset.startsWith('USD:')) { const d = dol[asset.slice(4)]; return (d && d.venta) || 0; }
  const ref = dol[dolarRef(s)];
  const usd = (ref && ref.venta) || (r.USD && r.USD.venta) || Number(s.settings.usdRate) || 0;
  if (asset === 'USD') return usd;
  if (r[asset] && r[asset].venta) return r[asset].venta;
  const c = r.crypto || {};
  if (c[asset]) return c[asset] * usd;
  // otras monedas: cruzadas con tu dólar de referencia
  const fx = r.fx && r.fx.porUsd;
  if (fx && fx[asset] > 0) return usd / fx[asset];
  return 0;
}

export function convert(s, amount, from, to) {
  const a = arsPer(s, from); const b = arsPer(s, to);
  if (!a || !b) return null;
  return (amount * a) / b;
}

// true si las cotizaciones guardadas tienen más de 1 hora
export function ratesStale(s) {
  const at = s.rates && s.rates.okAt;
  return !at || Date.now() - at > 60 * 60 * 1000;
}

export function ratesAge(s) {
  const at = s.rates && s.rates.okAt;
  if (!at) return 'sin datos todavía';
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'recién actualizado';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

// ---------- moneda principal de la persona (pesos o dólares) ----------
export const monedaBase = (s) => (s && s.settings && s.settings.moneda === 'USD' ? 'USD' : 'ARS');
/** Cuántas unidades de tu moneda principal vale 1 unidad de `cur` (null si no hay cotización). */
export function aBase(s, cur) {
  const b = monedaBase(s);
  if (!cur || cur === b) return 1;
  const v = convert(s, 1, cur, b);
  return v || null;
}
/** Un monto en pesos llevado a tu moneda (para topes de promos, que siempre están en pesos). */
export const pesosABase = (s, ars) => (monedaBase(s) === 'ARS' ? ars : Math.round((ars * (aBase(s, 'ARS') || 0)) * 100) / 100);
