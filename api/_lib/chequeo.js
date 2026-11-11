// Chequeo diario de todo lo externo que usa la app (lo corre el cron de la mañana).
// Si una fuente deja de responder o cambia el formato, queda anotado en
// publico/datos.salud y te llega un aviso al celular (ver avisarDueno).
// La lista completa de dependencias y qué revisar a mano está en REVISION.md.

// Versiones que usa la app hoy: si sale una más nueva, se anota (no es urgente).
export const VERSIONES = {
  'firebase (app, js/*.js)': { npm: 'firebase', usada: '10.14.1' },
  'firebase-admin (api)': { npm: 'firebase-admin', usada: '12.7.0' },
  'web-push (api)': { npm: 'web-push', usada: '3.6.7' },
};

const esArr = (j, min = 1) => Array.isArray(j) && j.length >= min;
const año = (today) => Number(today.slice(0, 4));

// id, nombre, url, prueba (true si el formato es el que espera la app), para qué se usa
export const FUENTES = (today) => [
  { id: 'dolarapi', nombre: 'DolarApi (dólar oficial, blue, tarjeta)', url: 'https://dolarapi.com/v1/dolares', ok: (j) => esArr(j, 3) && j.some((x) => x.casa === 'oficial') && j.some((x) => x.casa === 'tarjeta') },
  { id: 'dolarapi-otras', nombre: 'DolarApi (euro, real y otras)', url: 'https://dolarapi.com/v1/cotizaciones', ok: (j) => esArr(j, 2) && j.some((x) => x.moneda === 'EUR') },
  { id: 'er-api', nombre: 'ExchangeRate-API (otras monedas)', url: 'https://open.er-api.com/v6/latest/USD', ok: (j) => j && j.result === 'success' && j.rates && j.rates.ARS > 0 },
  { id: 'coingecko', nombre: 'CoinGecko (cripto y oro)', url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,pax-gold&vs_currencies=usd', ok: (j) => j && j.bitcoin && j.bitcoin.usd > 0 && j['pax-gold'] && j['pax-gold'].usd > 0 },
  { id: 'feriados', nombre: `ArgentinaDatos (feriados ${año(today)})`, url: `https://api.argentinadatos.com/v1/feriados/${año(today)}`, ok: (j) => esArr(j, 10) },
  // desde noviembre, que ya estén los del año que viene (la app calcula cobros y vencimientos con eso)
  ...(Number(today.slice(5, 7)) >= 11 ? [{ id: 'feriados-prox', nombre: `ArgentinaDatos (feriados ${año(today) + 1})`, url: `https://api.argentinadatos.com/v1/feriados/${año(today) + 1}`, ok: (j) => esArr(j, 10), leve: true }] : []),
  { id: 'plazofijo', nombre: 'ArgentinaDatos (tasas de plazo fijo)', url: 'https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo', ok: (j) => esArr(j, 3) },
  { id: 'rendimientos', nombre: 'ArgentinaDatos (rendimientos de billeteras)', url: 'https://api.argentinadatos.com/v1/finanzas/rendimientos', ok: (j) => esArr(j, 1) },
  { id: 'fci-otros', nombre: 'ArgentinaDatos (tasas de cuentas remuneradas)', url: 'https://api.argentinadatos.com/v1/finanzas/fci/otros/ultimo', ok: (j) => esArr(j, 3) },
  { id: 'fci-compara', nombre: 'ArgentinaDatos (comparador de fondos)', url: 'https://api.argentinadatos.com/v1/finanzas/fci/comparatasas', ok: (j) => j && esArr(j.fondos, 3) },
  { id: 'fci', nombre: 'ArgentinaDatos (fondos money market)', url: 'https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo', ok: (j) => esArr(j, 5) },
  { id: 'letras', nombre: 'ArgentinaDatos (letras del Tesoro)', url: 'https://api.argentinadatos.com/v1/finanzas/letras', ok: (j) => esArr(j, 1) },
  { id: 'georef', nombre: 'Georef (ciudades por provincia)', url: 'https://apis.datos.gob.ar/georef/api/localidades-censales?provincia=06&campos=nombre&max=1', ok: (j) => j && esArr(j.localidades_censales, 1) },
];

async function probar(f) {
  const t0 = Date.now();
  try {
    const r = await fetch(f.url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { id: f.id, nombre: f.nombre, ok: false, detalle: `respondió ${r.status}`, ms: Date.now() - t0, leve: !!f.leve };
    const j = await r.json();
    const bien = !!f.ok(j);
    return { id: f.id, nombre: f.nombre, ok: bien, detalle: bien ? 'ok' : 'cambió el formato o vino vacío', ms: Date.now() - t0, leve: !!f.leve };
  } catch (e) {
    return { id: f.id, nombre: f.nombre, ok: false, detalle: String(e.name === 'TimeoutError' ? 'no respondió (12 s)' : e.message || e).slice(0, 80), ms: Date.now() - t0, leve: !!f.leve };
  }
}

async function versiones() {
  const out = [];
  for (const [nombre, v] of Object.entries(VERSIONES)) {
    try {
      const r = await fetch(`https://registry.npmjs.org/${v.npm}/latest`, { signal: AbortSignal.timeout(8000) });
      const ultima = r.ok ? (await r.json()).version : null;
      out.push({ nombre, usada: v.usada, ultima, nueva: !!ultima && ultima.split('.')[0] !== v.usada.split('.')[0] });
    } catch { out.push({ nombre, usada: v.usada, ultima: null, nueva: false }); }
  }
  return out;
}

/** Prueba todas las fuentes en paralelo. Devuelve { revisado, fuentes, versiones, problemas, pendientes }. */
export async function revisarFuentes(today) {
  const [fuentes, vers] = await Promise.all([Promise.all(FUENTES(today).map(probar)), versiones()]);
  const problemas = fuentes.filter((f) => !f.ok && !f.leve).map((f) => `${f.nombre}: ${f.detalle}`);
  const pendientes = [
    ...fuentes.filter((f) => !f.ok && f.leve).map((f) => `${f.nombre}: todavía no están`),
    ...vers.filter((v) => v.nueva).map((v) => `${v.nombre}: hay versión ${v.ultima} (la app usa ${v.usada})`),
  ];
  return { revisado: new Date().toISOString(), fuentes, versiones: vers, problemas, pendientes };
}
