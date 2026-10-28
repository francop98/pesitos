// Formatos y utilidades de fechas (todo en hora local).

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function money(n) {
  const v = Math.round(n || 0);
  return (v < 0 ? '−$' : '$') + nf.format(Math.abs(v));
}
export const usd = (n) => 'US$ ' + nf.format(Math.round(n || 0));
export function pct(n, digits = 1, sign = true) {
  const v = (n * 100).toFixed(digits).replace('.', ',');
  return (sign && n > 0 ? '+' : '') + v + '%';
}

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}
export const todayISO = () => toISO(new Date());
export const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
export const monthKey = (d = new Date()) => toISO(d).slice(0, 7);
export function addMonthKey(mk, n) {
  const [y, m] = mk.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}
export function monthDiff(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}
export function monthName(mk, long = false) {
  const m = Number(mk.split('-')[1]) - 1;
  return long ? MONTHS_LONG[m] : MONTHS[m];
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

export function relDay(iso) {
  const d = parseISO(iso);
  const diff = daysBetween(d, startOfToday());
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()][0].toUpperCase() + WEEKDAYS[d.getDay()].slice(1);
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function num(v) {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
