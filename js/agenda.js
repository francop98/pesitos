// Agenda de pagos: todo lo que tenés que pagar, en orden.
// Junta tres fuentes:
//  - Gastos fijos (vencen todos los meses el día indicado)
//  - Resúmenes de tarjeta (monto calculado con las compras y cuotas)
//  - Pagos programados que cargás vos (únicos o que se repiten: patente,
//    seguro anual, matrícula, impuestos…)
// También calcula cuánto conviene ir apartando para los pagos grandes,
// arma el archivo de calendario con recordatorios y muestra avisos.

import { reintegrosDeResumen } from './reintegros.js';
import { toISO, parseISO, addMonthKey, monthKey, startOfToday, daysBetween, money } from './formato.js';

// meses entre dos 'AAAA-MM'
const monthDiffKeys = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };

export const REPEATS = [
  { id: 'once', label: 'Una sola vez', months: 0 },
  { id: 'weekly', label: 'Todas las semanas', days: 7 },
  { id: 'biweekly', label: 'Cada 2 semanas', days: 14 },
  { id: 'monthly', label: 'Todos los meses', months: 1 },
  { id: 'bimonthly', label: 'Cada 2 meses', months: 2 },
  { id: 'quarterly', label: 'Cada 3 meses', months: 3 },
  { id: 'fourmonthly', label: 'Cada 4 meses', months: 4 },
  { id: 'semiannual', label: 'Cada 6 meses', months: 6 },
  { id: 'yearly', label: 'Una vez por año', months: 12 },
  { id: 'custom', label: 'Personalizado…' },
];
const UNIDADES = { dias: ['día', 'días'], semanas: ['semana', 'semanas'], meses: ['mes', 'meses'] };
/** Cada cuánto se repite: { months } o { days } (0 = una sola vez). */
export function pasoDe(x) {
  if (x && x.repeat === 'custom' && x.every) {
    const n = Math.max(1, parseInt(x.every.n, 10) || 1);
    return x.every.unit === 'meses' ? { months: n } : { days: x.every.unit === 'semanas' ? n * 7 : n };
  }
  const r = REPEATS.find((y) => y.id === (x && x.repeat)) || REPEATS[0];
  return r.days ? { days: r.days } : { months: r.months || 0 };
}
export const repeatLabel = (id, x = null) => {
  if (id === 'custom' && x && x.every) { const n = Math.max(1, parseInt(x.every.n, 10) || 1); const u = UNIDADES[x.every.unit] || UNIDADES.dias; return n === 1 ? `Cada ${u[0]}` : `Cada ${n} ${u[1]}`; }
  return (REPEATS.find((r) => r.id === id) || REPEATS[0]).label;
};

function dateWithDay(y, m, day) {
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, dim));
}
const mkDate = (mk, day) => { const [y, m] = mk.split('-').map(Number); return dateWithDay(y, m - 1, day); };

// ---------- tarjetas ----------
export function statementOf(card, iso) {
  const mk = iso.slice(0, 7);
  // el cierre de cada mes puede cambiar (card.fechas): comparo con el cierre real de ese mes
  return iso <= toISO(statementDates(card, mk).close) ? mk : addMonthKey(mk, 1);
}
export function statementAmount(s, card, mk) { return detalleResumen(s, card, mk).total; }

// percepción a cuenta de Ganancias (RG 5617/2024) sobre consumos en dólares pagados en pesos
export const PERCEPCION_USD = 30;
/**
 * Todo lo que trae un resumen: compras y cuotas que caen, reintegros, cargos del banco,
 * impuestos, y lo que quedó sin pagar del resumen anterior (con su interés).
 * total = lo que sale de tu bolsillo (en pesos; los dólares convertidos).
 */
export function detalleResumen(s, card, mk, prof = 1) {
  const lineas = [];
  for (const e of s.expenses) {
    if (e.pending || e.cardId !== card.id) continue;
    const n = e.installments > 1 ? e.installments : 1;
    const k = monthDiffKeys(statementOf(card, e.date), mk);
    if (k < 0 || k >= n) continue;
    lineas.push({ e, cuota: k + 1, n, monto: e.amount / n, usd: e.currency === 'USD' ? (Number(e.original) || 0) / n : 0 });
  }
  lineas.sort((a, b) => (a.e.date < b.e.date ? 1 : -1));
  const consumos = lineas.reduce((a, l) => a + l.monto, 0);
  const enUsd = lineas.filter((l) => l.usd).reduce((a, l) => a + l.monto, 0);
  const usd = lineas.reduce((a, l) => a + l.usd, 0);
  const reintegros = Math.min(consumos, reintegrosDeResumen(s, card, mk));
  const cargos = [];
  // saldo que quedó sin pagar del resumen anterior + interés por financiarlo
  if (prof > 0) {
    const pm = addMonthKey(mk, -1);
    const p = (s.paid || {})[`card:${card.id}:${pm}`];
    if (p && p.amount > 0 && statementDates(card, pm).due < startOfToday()) {
      const resto = detalleResumen(s, card, pm, prof - 1).total - p.amount;
      if (resto > 1) {
        cargos.push({ k: 'saldo', label: 'Lo que quedó sin pagar del resumen anterior', v: resto });
        if (card.tna) cargos.push({ k: 'interes', label: `Interés por financiarlo (TNA ${String(card.tna).replace('.', ',')}% + IVA)`, v: resto * card.tna / 100 / 12 * 1.21 });
      }
    }
  }
  if (consumos > 0 || cargos.length) {
    if (card.comision) cargos.push({ k: 'mant', label: 'Mantenimiento de la tarjeta + IVA', v: card.comision * 1.21 });
    if (card.seguro) cargos.push({ k: 'seguro', label: 'Seguro y otros cargos', v: Number(card.seguro) });
    if (card.sellos) cargos.push({ k: 'sellos', label: `Impuesto de sellos (${String(card.sellos).replace('.', ',')}%)`, v: (consumos - reintegros) * card.sellos / 100 });
  }
  const pagaUsd = card.dolares === 'usd';
  if (enUsd && !pagaUsd) cargos.push({ k: 'perc', label: `Percepción Ganancias ${PERCEPCION_USD}% (por los dólares)`, v: enUsd * PERCEPCION_USD / 100, recuperable: true });
  const extras = cargos.reduce((a, c) => a + c.v, 0);
  const total = Math.max(0, consumos - reintegros + extras);
  return { mk, lineas, consumos, reintegros, cargos, usd, enUsd, pagaUsd, total, pesos: Math.max(0, total - (pagaUsd ? enUsd : 0)) };
}
export function statementDates(card, mk) {
  const f = (card.fechas || {})[mk] || {};
  const close = f.cierre ? parseISO(f.cierre) : mkDate(mk, Number(card.closeDay) || 25);
  const due = f.vence ? parseISO(f.vence) : Number(card.dueDay) > Number(card.closeDay) ? mkDate(mk, Number(card.dueDay)) : mkDate(addMonthKey(mk, 1), Number(card.dueDay) || 5);
  return { close, due, cambiadas: !!(f.cierre || f.vence) };
}

// ---------- descuentos por un tiempo ----------
// x.desc = { monto, hasta: 'AAAA-MM' (último mes con descuento), avisar: 'AAAA-MM-DD' }
export const conDescuento = (x, mk) => !!(x && x.desc && x.desc.monto >= 0 && x.desc.hasta && mk <= x.desc.hasta);
export const montoEn = (x, mk) => (conDescuento(x, mk) ? Number(x.desc.monto) || 0 : Number(x.amount) || 0);
function textoDescuento(x, mk) {
  if (!x.desc || !x.desc.hasta) return '';
  if (mk <= x.desc.hasta) return `con descuento hasta ${MESES[Number(x.desc.hasta.slice(5)) - 1]}${x.desc.hasta.slice(0, 4) !== mk.slice(0, 4) ? ` ${x.desc.hasta.slice(0, 4)}` : ''} (después ${money(x.amount)})`;
  if (mk === addMonthKey(x.desc.hasta, 1)) return 'terminó el descuento: vuelve al precio normal';
  return '';
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ---------- ocurrencias de pagos programados ----------
function billOccurrences(bill, from, to) {
  const out = [];
  const first = parseISO(bill.date);
  const paso = pasoDe(bill);
  if (paso.days) {
    // cada N días o semanas
    const d = new Date(first);
    if (d < from) { const saltos = Math.floor((from - d) / 86400000 / paso.days); d.setDate(d.getDate() + saltos * paso.days); }
    for (let i = 0; i < 800 && d <= to; i++) { if (d >= from) out.push(new Date(d)); d.setDate(d.getDate() + paso.days); }
    return out;
  }
  const step = paso.months;
  if (!step) { if (first >= from && first <= to) out.push(first); return out; }
  const day = first.getDate();
  let mk = bill.date.slice(0, 7);
  for (let i = 0; i < 400; i++) {
    const d = mkDate(mk, day);
    if (d > to) break;
    if (d >= from) out.push(d);
    mk = addMonthKey(mk, step);
  }
  return out;
}

// ---------- la agenda ----------
// Pagos entre dos fechas. Cada pago sabe con qué se paga (payWith) y si es
// débito automático: esos se dan por pagados solos el día del vencimiento.
export function agendaBetween(s, from, to) {
  const today = startOfToday();
  const curMk = monthKey(today);
  const paid = s.paid || {};
  const items = [];
  const push = (it) => {
    const p = paid[it.key];
    const days = daysBetween(today, it.dueDate);
    const base = { ...it, due: toISO(it.dueDate), days };
    // pago parcial (por ejemplo, el mínimo de la tarjeta): queda pendiente el resto
    if (p && Number(p.amount) < it.amount - 1) {
      // tarjeta: vencido el resumen, lo que faltó pasa al siguiente (con interés)
      if (it.kind === 'card' && days < 0) { items.push({ ...base, paid: true, paidInfo: p, overdue: false }); return; }
      const rest = it.amount - Number(p.amount);
      items.push({ ...base, amount: rest, sub: `Pagaste ${money(p.amount)} de ${money(it.amount)}. El resto genera intereses si no lo cancelás.`, paid: false, partial: true, paidInfo: p, overdue: days < 0 });
      return;
    }
    // débito automático: llegado el día se considera pagado
    if (!p && it.autoDebit && days <= 0) {
      items.push({ ...base, paid: true, paidInfo: { date: base.due, amount: it.amount, auto: true }, overdue: false });
      return;
    }
    items.push({ ...base, paid: !!p, paidInfo: p || null, overdue: !p && days < 0 });
  };

  // gastos fijos: del mes actual en adelante (los meses anteriores se dan por pagados)
  for (const f of s.fixed) {
    let mk = monthKey(from) < curMk ? curMk : monthKey(from);
    for (let i = 0; i < 24 && mk <= monthKey(to); i++, mk = addMonthKey(mk, 1)) {
      if (f.endMonth && mk > f.endMonth) break; // terminó (crédito o cuotas)
      // el vencimiento de un mes puede ser otro día (f.vencMes = { 'AAAA-MM': día })
      const d = mkDate(mk, Number((f.vencMes || {})[mk]) || Number(f.dueDay) || 10);
      if (d < from || d > to) continue;
      const cuota = f.totalCuotas && f.endMonth ? f.totalCuotas - (monthDiffKeys(mk, f.endMonth)) : 0;
      const sub = [f.autoDebit ? 'Gasto fijo · débito automático' : 'Gasto fijo', cuota > 0 ? `cuota ${cuota} de ${f.totalCuotas}` : '', f.variable ? 'monto aproximado' : '', textoDescuento(f, mk)].filter(Boolean).join(' · ');
      push({ key: `fixed:${f.id}:${mk}`, kind: 'fixed', refId: f.id, name: f.name, amount: montoEn(f, mk), dueDate: d, icon: 'repeat', sub, payWith: f.payWith || '', autoDebit: !!f.autoDebit, estimated: !!f.variable, variable: !!f.variable });
    }
  }

  // resúmenes de tarjeta
  for (const c of s.cards || []) {
    const cur = statementOf(c, toISO(today));
    for (let k = -2; k <= 3; k++) {
      const mk = addMonthKey(cur, k);
      const amount = statementAmount(s, c, mk);
      const { close, due } = statementDates(c, mk);
      if (amount <= 0 || due < from || due > to) continue;
      // resúmenes que vencieron hace más de 10 días y nadie marcó: se asumen pagados
      if (daysBetween(due, today) > 10 && !paid[`card:${c.id}:${mk}`]) continue;
      const open = close > today;
      push({ key: `card:${c.id}:${mk}`, kind: 'card', refId: c.id, name: `Tarjeta ${c.name}`, amount, dueDate: due, icon: 'card',
        sub: open ? `Resumen en curso: cierra el ${close.getDate()}/${close.getMonth() + 1}, el monto puede cambiar` : `Resumen cerrado el ${close.getDate()}/${close.getMonth() + 1}`,
        estimated: open, payWith: c.payFrom || '', autoDebit: !!c.autoDebit });
    }
  }

  // pagos programados
  for (const b of s.bills || []) {
    for (const d of billOccurrences(b, from, to)) {
      push({ key: `bill:${b.id}:${toISO(d)}`, kind: 'bill', refId: b.id, name: b.name, amount: montoEn(b, toISO(d).slice(0, 7)), dueDate: d, icon: 'calendar', sub: repeatLabel(b.repeat, b) + (textoDescuento(b, toISO(d).slice(0, 7)) ? ` · ${textoDescuento(b, toISO(d).slice(0, 7))}` : '') + (b.variable ? ' · el monto varía' : '') + (b.autoDebit ? ' · débito automático' : ''), payWith: b.payWith || '', autoDebit: !!b.autoDebit, fromSavings: !!b.saveAhead, estimated: !!b.variable && !!b.amount, variable: !!b.variable || !b.amount });
    }
  }

  // recordatorios: los que cargaste y "pedir otro descuento" antes de que termine
  for (const x of [...(s.fixed || []), ...(s.bills || [])]) {
    if (!x.desc || !x.desc.avisar) continue;
    const d = parseISO(x.desc.avisar);
    if (d < from || d > to) continue;
    push({ key: `rec:desc:${x.id}:${x.desc.avisar}`, kind: 'recordatorio', refId: x.id, refKind: s.fixed.includes(x) ? 'fixed' : 'bill', name: `Pedir descuento: ${x.name}`, amount: 0, dueDate: d, icon: 'bell',
      sub: `El descuento termina en ${MESES[Number(x.desc.hasta.slice(5)) - 1]}: después pagás ${money(x.amount)} en vez de ${money(x.desc.monto)}` });
  }
  for (const r of s.recordatorios || []) {
    for (const d of billOccurrences(r, from, to)) {
      push({ key: `rec:${r.id}:${toISO(d)}`, kind: 'recordatorio', refId: r.id, name: r.name, amount: 0, dueDate: d, icon: 'bell', sub: [r.nota, r.repeat && r.repeat !== 'once' ? repeatLabel(r.repeat, r) : 'Recordatorio'].filter(Boolean).join(' · ') });
    }
  }

  return items.sort((a, b) => a.due.localeCompare(b.due));
}

// Pagos entre hace 45 días y dentro de `ahead` días.
export function agenda(s, ahead = 60) {
  const today = startOfToday();
  const from = new Date(today); from.setDate(from.getDate() - 45);
  const to = new Date(today); to.setDate(to.getDate() + ahead);
  return agendaBetween(s, from, to);
}

export { billOccurrences, mkDate, dateWithDay };

export function groups(items) {
  const g = { overdue: [], today: [], week: [], month: [], later: [], paid: [] };
  // de lo que se repite (fijos, pagos semanales o mensuales) se muestra solo el vencimiento más próximo
  const vistos = new Set();
  for (const it of [...items].sort((a, b) => a.days - b.days)) {
    if (it.paid) { if (it.days >= -31) g.paid.push(it); continue; }
    if (it.days < 0) { g.overdue.push(it); continue; }
    const origen = it.refId ? `${it.kind}:${it.refId}` : it.key;
    if (vistos.has(origen)) continue;
    vistos.add(origen);
    if (it.days === 0) g.today.push(it);
    else if (it.days <= 7) g.week.push(it);
    else g.later.push(it); // todo lo que viene después de esta semana
  }
  return g;
}

export const pendingUntil = (items, iso) => items.filter((i) => !i.paid && i.due <= iso).reduce((a, i) => a + i.amount, 0);

// Alertas para Inicio: vencidos (no fijos de meses viejos) y lo que vence en 3 días
export function alerts(s) {
  return agenda(s, 3).filter((i) => !i.paid && i.kind !== 'recordatorio' && i.days <= 3 && i.days >= -15);
}

// ---------- ahorrar de a poco para pagos grandes ----------
// Para cada pago marcado "ahorrar de a poco" que vence en más de un mes,
// cuánto apartar por mes para llegar con la plata.
export function provisions(s) {
  const today = startOfToday();
  const out = [];
  for (const b of s.bills || []) {
    if (!b.saveAhead) continue;
    const next = billOccurrences(b, today, new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()))
      .find((d) => !(s.paid || {})[`bill:${b.id}:${toISO(d)}`]);
    if (!next) continue;
    const months = Math.max(1, Math.round(daysBetween(today, next) / 30.4));
    if (months <= 1) continue;
    const saved = Number(b.saved) || 0;
    out.push({ bill: b, due: toISO(next), months, monthly: Math.max(0, (b.amount - saved) / months), saved });
  }
  return out;
}

// ---------- calendario (.ics) con recordatorios ----------
function icsDate(d) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
function icsEscape(t) { return String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n'); }

export function buildICS(s) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pesitos//Pagos//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Pesitos · Pagos'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const today = startOfToday();
  const event = (uid, title, date, rrule, desc) => {
    const end = new Date(date); end.setDate(end.getDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:${uid}@pesitos`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`);
    if (rrule) lines.push(`RRULE:${rrule}`);
    // aviso el día anterior a las 9 y el mismo día a las 9
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'TRIGGER:-PT15H', 'END:VALARM');
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'TRIGGER:PT9H', 'END:VALARM');
    lines.push('END:VEVENT');
  };
  for (const f of s.fixed) {
    const day = Number(f.dueDay) || 10;
    const first = dateWithDay(today.getFullYear(), today.getMonth(), day);
    if (f.endMonth && monthKey(first) > f.endMonth) continue;
    const until = f.endMonth ? `;UNTIL=${f.endMonth.replace('-', '')}${day > 28 ? '28' : String(day).padStart(2, '0')}T235959Z` : '';
    event(`fixed-${f.id}`, `Vence ${f.name} (${f.variable ? '≈ ' : ''}${money(f.amount)})`, first, `FREQ=MONTHLY;BYMONTHDAY=${day > 28 ? -1 : day}${until}`, 'Gasto fijo cargado en Pesitos.');
  }
  for (const c of s.cards || []) {
    const day = Number(c.dueDay) || 5;
    const first = dateWithDay(today.getFullYear(), today.getMonth(), day);
    event(`card-${c.id}`, `Vence la tarjeta ${c.name}`, first, `FREQ=MONTHLY;BYMONTHDAY=${day > 28 ? -1 : day}`, 'Abrí Pesitos para ver el monto del resumen.');
  }
  for (const b of s.bills || []) {
    const paso = pasoDe(b); const step = paso.months;
    const rr = paso.days ? (paso.days % 7 === 0 ? `FREQ=WEEKLY;INTERVAL=${paso.days / 7}` : `FREQ=DAILY;INTERVAL=${paso.days}`) : !step ? '' : step === 12 ? 'FREQ=YEARLY' : `FREQ=MONTHLY;INTERVAL=${step}`;
    event(`bill-${b.id}`, `Vence ${b.name}${b.amount ? ` (${b.variable ? '≈ ' : ''}${money(b.amount)})` : ''}`, parseISO(b.date), rr, `${repeatLabel(b.repeat, b)}. Cargado en Pesitos.`);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ---------- avisos del dispositivo (cuando abrís la app) ----------
export async function notifyDue(ctx) {
  const s = ctx.state;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = toISO(startOfToday());
  if (s.notifiedOn === today) return;
  const due = agenda(s, 1).filter((i) => !i.paid && i.days >= -3 && i.days <= 1);
  if (!due.length) return;
  const title = due.length === 1 ? `${due[0].days < 0 ? 'Venció' : due[0].days === 0 ? 'Vence hoy' : 'Vence mañana'}: ${due[0].name}` : `Tenés ${due.length} pagos por vencer`;
  const body = due.map((i) => (i.amount ? `${i.name}: ${i.estimated ? "≈ " : ""}${money(i.amount)}` : `${i.name}: monto a confirmar`)).join(' · ');
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) reg.showNotification(title, { body, icon: 'assets/icon-192.png', tag: 'pesitos-pagos' });
    else new Notification(title, { body, icon: 'assets/icon-192.png' });
  } catch { /* sin avisos */ }
  ctx.update((st) => { st.notifiedOn = today; });
}

export function dueLabel(it) {
  if (it.paid) return 'Pagado';
  if (it.days < -1) return `Venció hace ${-it.days} días`;
  if (it.days === -1) return 'Venció ayer';
  if (it.days === 0) return 'Vence hoy';
  if (it.days === 1) return 'Vence mañana';
  if (it.days <= 7) return `Vence en ${it.days} días`;
  const d = parseISO(it.due);
  return `Vence el ${d.getDate()}/${d.getMonth() + 1}`;
}


// ---------- historial de cumplimiento ----------
export function history(s) {
  const recs = Object.entries(s.paid || {}).filter(([, p]) => p && p.due).map(([key, p]) => ({ key, ...p }))
    .sort((a, b) => a.due.localeCompare(b.due));
  let streak = 0;
  for (let i = recs.length - 1; i >= 0; i--) { if (recs[i].onTime) streak++; else break; }
  const onTime = recs.filter((r) => r.onTime).length;
  const increases = [];
  for (const f of s.fixed) if (!f.variable && f.lastAmount && f.amount > f.lastAmount * 1.02) increases.push({ name: f.name, from: f.lastAmount, to: f.amount });
  for (const b of s.bills || []) if (b.lastAmount && b.amount > b.lastAmount * 1.02) increases.push({ name: b.name, from: b.lastAmount, to: b.amount });
  return { total: recs.length, onTime, late: recs.length - onTime, streak, increases };
}

// ---------- cierres de tarjeta próximos ----------
// Tarjetas que cierran hoy o en los próximos `days` días.
export function closings(s, days = 2) {
  const today = startOfToday();
  const out = [];
  for (const c of s.cards || []) {
    const mk = statementOf(c, toISO(today));
    const { close } = statementDates(c, mk);
    const d = daysBetween(today, close);
    if (d < 0 || d > days) continue;
    const nextMk = addMonthKey(mk, 1);
    const { due } = statementDates(c, nextMk);
    const after = new Date(close); after.setDate(after.getDate() + 1);
    out.push({ card: c, close, days: d, bestDay: after, nextDue: due });
  }
  return out;
}

// Mejor día del mes para compras grandes con la tarjeta: el día después del cierre
export function bestBuyDay(card) {
  const today = startOfToday();
  const mk = statementOf(card, toISO(today));
  const { close } = statementDates(card, mk);
  const best = new Date(close); best.setDate(best.getDate() + 1);
  const { due } = statementDates(card, addMonthKey(mk, 1));
  return { best, due, days: daysBetween(best, due) };
}

// ---------- por cuenta o medio de pago ----------
export function byAccount(items, nameOf) {
  const map = {};
  for (const it of items) {
    if (it.paid || it.fromSavings) continue;
    const k = it.payWith || '';
    (map[k] = map[k] || { label: k ? nameOf(k) : 'Sin cuenta asignada', total: 0, items: [], auto: 0 });
    map[k].total += it.amount; map[k].items.push(it); if (it.autoDebit) map[k].auto += it.amount;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}
