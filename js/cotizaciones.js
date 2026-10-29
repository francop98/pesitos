// Cotizaciones en vivo.
// - Dólar blue: DolarApi.com, que toma los valores de DolarHoy.
// - Euro, real, peso uruguayo y chileno: DolarApi.com.
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
  try {
    const b = await getJSON('https://dolarapi.com/v1/dolares/blue');
    if (b && b.venta) { out.USD = { compra: b.compra, venta: b.venta, updated: b.fechaActualizacion }; ok = true; }
  } catch { /* sin conexión */ }
  try {
    const list = await getJSON('https://dolarapi.com/v1/cotizaciones');
    for (const c of list || []) {
      const code = String(c.moneda || '').toUpperCase();
      if (code && code !== 'USD' && c.venta) out[code] = { compra: c.compra, venta: c.venta, updated: c.fechaActualizacion };
    }
  } catch { /* sin conexión */ }
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

// Cuántos pesos vale 1 unidad del activo
export function arsPer(s, asset) {
  if (!asset || asset === 'ARS') return 1;
  const manual = (s.settings.manualRates || {})[asset];
  if (manual) return manual;
  const r = s.rates || {};
  const usd = (r.USD && r.USD.venta) || Number(s.settings.usdRate) || 0;
  if (asset === 'USD') return usd;
  if (r[asset] && r[asset].venta) return r[asset].venta;
  const c = r.crypto || {};
  if (c[asset]) return c[asset] * usd;
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
