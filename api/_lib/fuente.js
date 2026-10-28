// Fuente principal de promos (gratis, sin clave): el repositorio público
// "descuentos-ar-datos", que publica todos los días las promos vigentes de
// bancos y billeteras de Argentina (lo mantiene la app "Con qué pago").
// https://github.com/lubelrivero-design/descuentos-ar-datos

export const FUENTE = {
  name: 'Con qué pago (descuentos-ar-datos)',
  url: 'https://github.com/lubelrivero-design/descuentos-ar-datos',
  json: 'https://raw.githubusercontent.com/lubelrivero-design/descuentos-ar-datos/main/promos.json',
};

// medio de la fuente → id de medio de pago de la app (js/categorias.js)
const MEDIOS = {
  cuenta_dni: 'cuentadni', mercado_pago: 'mercadopago', mercado_pago_tarjeta: 'mercadopago', modo: 'modo',
  naranja_x: 'naranjax', uala: 'uala', personal_pay: 'personalpay', bna_mas: 'bnamas', banco_provincia: 'provincia',
  galicia: 'galicia', santander: 'santander', bbva: 'bbva', macro: 'macro', icbc: 'icbc', supervielle: 'supervielle',
  credicoop: 'credicoop', ciudad: 'ciudad', brubank: 'brubank', cualquiera: 'todos',
};

// rubro de la fuente → categoría de la app
const RUBROS = {
  supermercados: 'super', mayoristas: 'super', carnicerias: 'super', alimentos: 'super', ferias: 'super', 'comercios de cercanía': 'super',
  gastronomia: 'comida', delivery: 'delivery',
  transporte: 'transporte', combustible: 'transporte', automotor: 'transporte', rodados: 'transporte',
  hogar: 'hogar', electro: 'hogar', garrafas: 'hogar',
  farmacia: 'salud', belleza: 'salud', opticas: 'salud',
  indumentaria: 'ropa', espectaculos: 'ocio', viajes: 'ocio', librerias: 'educacion', educacion: 'educacion',
};

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3, jueves: 4, viernes: 5, sabado: 6, 'sábado': 6 };
const PERIODOS = { semanal: 'semana', mensual: 'mes', 'por compra': 'compra', 'por fin de semana': 'fin de semana' };
// corta en una palabra completa y agrega «…»
const cut = (t, n) => { t = String(t || '').trim(); return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1) > n * 0.6 ? t.lastIndexOf(' ', n - 1) : n - 1).replace(/[\s,;:.]+$/, '') + '…'; };
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const endOfMonth = (today) => { const [y, m] = today.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export async function promosFuente(today) {
  const r = await fetch(FUENTE.json, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Fuente ${r.status}`);
  const j = await r.json();
  const out = [];
  for (const x of j.promos || []) {
    if (!x || x.baja_motivo || x.confianza === 'baja') continue;
    const pct = Math.round(Number(x.descuento_pct) || 0);
    if (pct <= 0 || pct > 100) continue; // las de cuotas solas no entran
    const days = [...new Set((x.dias || []).map((d) => DIAS[String(d).toLowerCase()]).filter((d) => d !== undefined))];
    if (!days.length) continue;
    const validTo = isDate(x.vigencia_hasta) ? x.vigencia_hasta : endOfMonth(today);
    if (validTo < today) continue;
    const wallet = MEDIOS[x.medio] || 'otro';
    const extraName = x.medio === 'mercado_pago_tarjeta' ? 'Con Tarjeta Mercado Pago. ' : (x.medio === 'brubank' && x.medio_nombre !== 'Brubank' ? `${x.medio_nombre}. ` : '');
    out.push({
      wallet,
      ...(wallet === 'otro' ? { walletName: String(x.medio_nombre || x.medio).slice(0, 40) } : {}),
      days,
      merchant: (x.comercios || []).join(', ').slice(0, 80),
      category: RUBROS[x.rubro] || 'otros',
      pct,
      cap: Math.max(0, Math.round(Number(x.tope_monto) || 0)),
      ...(PERIODOS[x.tope_periodo] ? { capPeriod: PERIODOS[x.tope_periodo] } : {}),
      ...(!(Number(x.tope_monto) > 0) && x.tope_publicado === false ? { capUnknown: true } : {}),
      ...(Number(x.compra_minima) > 0 ? { minPurchase: Math.round(Number(x.compra_minima)) } : {}),
      cond: cut(extraName + String(x.requisitos || ''), 220),
      zone: String(x.zona || 'Nacional').slice(0, 60),
      validFrom: isDate(x.vigencia_desde) ? x.vigencia_desde : today,
      validTo,
      source: typeof x.fuente === 'string' ? x.fuente.slice(0, 300) : '',
    });
  }
  return { promos: out, actualizado: j.actualizado || null };
}
