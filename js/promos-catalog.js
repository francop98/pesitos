// Catálogo de promos de referencia. Pesitos cruza estas promos con los
// bancos, billeteras y tarjetas que cargaste y te avisa el día antes.
//
// IMPORTANTE: las promos cambian todos los meses. Para que se actualicen
// solas hace falta una fuente que las publique (por ejemplo, un servidor
// propio o una función programada que guarde el catálogo; ver api/ y DEPLOY.md).
// Con la app publicada en Vercel, las promos llegan solas desde api/datos.js:
// este archivo queda solo como respaldo y sus promos se ocultan al vencer.
//
// days: 0 = domingo … 6 = sábado
// Fuente: El Economista, "Cuenta DNI renovó sus descuentos de octubre" (octubre 2026)
// https://eleconomista.com.ar/economia/cuenta-dni-renovo-sus-descuentos-octubre-hay-beneficios-40-reintegros-18000-n98555

export const PROMO_CATALOG = {
  month: '2026-10',
  label: 'octubre 2026',
  items: [
    { wallet: 'cuentadni', days: [1], merchant: 'Día', category: 'super', pct: 20, cap: 0, cond: 'Pagando con NFC y Visa crédito vinculada (Android)' },
    { wallet: 'cuentadni', days: [2], merchant: 'Toledo', category: 'super', pct: 20, cap: 0, cond: 'Pagando con NFC' },
    { wallet: 'cuentadni', days: [3], merchant: 'Carrefour', category: 'super', pct: 10, cap: 0, cond: 'Compra mínima $15.000' },
    { wallet: 'cuentadni', days: [3], merchant: 'La Anónima', category: 'super', pct: 10, cap: 5000, cond: 'Compras desde $25.000' },
    { wallet: 'cuentadni', days: [4], merchant: 'ChangoMás', category: 'super', pct: 20, cap: 0, cond: 'Sin compra mínima' },
    { wallet: 'cuentadni', days: [5, 6], merchant: 'Supercoop', category: 'super', pct: 15, cap: 0, cond: '' },
    { wallet: 'cuentadni', days: [4, 5], merchant: 'Mostaza', category: 'comida', pct: 30, cap: 15000, cond: 'Tope semanal, pagando con NFC' },
    { wallet: 'cuentadni', days: [0, 6], merchant: 'YPF Full', category: 'comida', pct: 25, cap: 8000, cond: 'Tope semanal' },
    { wallet: 'cuentadni', days: [3, 4], merchant: 'Farmacias y perfumerías', category: 'salud', pct: 10, cap: 0, cond: '' },
    { wallet: 'cuentadni', days: [3], merchant: 'Sodimac', category: 'hogar', pct: 10, cap: 0, cond: 'Acumulable con otras ofertas' },
    { wallet: 'cuentadni', days: [1, 2, 3, 4, 5], merchant: 'Comercios de cercanía', category: 'super', pct: 20, cap: 6000, cond: 'Tope semanal' },
    { wallet: 'cuentadni', days: [1, 2], merchant: 'Librerías', category: 'educacion', pct: 10, cap: 0, cond: '' },
  ],
};
