// Agenda de pagos: todo lo que tenés que pagar, en orden.
// Junta tres fuentes:
//  - Gastos fijos (vencen todos los meses el día indicado)
//  - Resúmenes de tarjeta (monto calculado con las compras y cuotas)
//  - Pagos programados que cargás vos (únicos o que se repiten: patente,
//    seguro anual, matrícula, impuestos…)
// También calcula cuánto conviene ir apartando para los pagos grandes,
// arma el archivo de calendario con recordatorios y muestra avisos.

import { toISO, parseISO, addMonthKey, monthKey, startOfToday, daysBetween, money } from './formato.js';

export const REPEATS = [
  { id: 'once', label: 'Una sola vez', months: 0 },
  { id: 'monthly', label: 'Todos los meses', months: 1 },
  { id: 'bimonthly', label: 'Cada 2 meses', months: 2 },
  { id: 'quarterly', label: 'Cada 3 meses', months: 3 },
  { id: 'semiannual', label: 'Cada 6 meses', months: 6 },
  { id: 'yearly', label: 'Una vez por año', months: 12 },
];
export const repeatLabel = (id) => (REPEATS.find((r) => r.id === id) || REPEATS[0]).label;

function dateWithDay(y, m, day) {
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, dim));
}
const mkDate = (mk, day) => { const [y, m] = mk.split('-').map(Number); return dateWithDay(y, m - 1, day); };

// ---------- tarjetas ----------
export function statementOf(card, iso) {
  const d = parseISO(iso);
  const mk = iso.slice(0, 7);
  return d.getDate() <= (Number(card.closeDay) || 31) ? mk : addMonthKey(mk, 1);
}
export function statementAmount(s, card, mk) {
  let total = 0;
  for (const e of s.expenses) {
    if (e.pending || e.cardId !== card.id) continue;
    const n = e.installments > 1 ? e.installments : 1;
    const first = statementOf(card, e.date);
    for (let k = 0; k < n; k++) if (addMonthKey(first, k) === mk) total += e.amount / n;
  }
  return total;
}
export function statementDates(card, mk) {
  const close = mkDate(mk, Number(card.closeDay) || 25);
  const due = Number(card.dueDay) > Number(card.closeDay) ? mkDate(mk, Number(card.dueDay)) : mkDate(addMonthKey(mk, 1), Number(card.dueDay) || 5);
  return { close, due };
}

// ---------- ocurrencias de pagos programados ----------
function billOccurrences(bill, from, to) {
  const out = [];
  const first = parseISO(bill.date);
  const step = (REPEATS.find((r) => r.id === bill.repeat) || REPEATS[0]).months;
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
      const d = mkDate(mk, Number(f.dueDay) || 10);
      if (d < from || d > to) continue;
      push({ key: `fixed:${f.id}:${mk}`, kind: 'fixed', refId: f.id, name: f.name, amount: f.amount, dueDate: d, icon: 'repeat', sub: f.autoDebit ? 'Gasto fijo · débito automático' : 'Gasto fijo', payWith: f.payWith || '', autoDebit: !!f.autoDebit });
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
      push({ key: `bill:${b.id}:${toISO(d)}`, kind: 'bill', refId: b.id, name: b.name, amount: b.amount, dueDate: d, icon: 'calendar', sub: repeatLabel(b.repeat) + (b.autoDebit ? ' · débito automático' : ''), payWith: b.payWith || '', autoDebit: !!b.autoDebit, fromSavings: !!b.saveAhead });
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
  for (const it of items) {
    if (it.paid) { if (it.days >= -31) g.paid.push(it); continue; }
    if (it.days < 0) g.overdue.push(it);
    else if (it.days === 0) g.today.push(it);
    else if (it.days <= 7) g.week.push(it);
    else if (it.days <= 31) g.month.push(it);
    else g.later.push(it);
  }
  return g;
}

export const pendingUntil = (items, iso) => items.filter((i) => !i.paid && i.due <= iso).reduce((a, i) => a + i.amount, 0);

// Alertas para Inicio: vencidos (no fijos de meses viejos) y lo que vence en 3 días
export function alerts(s) {
  return agenda(s, 3).filter((i) => !i.paid && i.days <= 3 && i.days >= -15);
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
    event(`fixed-${f.id}`, `Vence ${f.name} (${money(f.amount)})`, first, `FREQ=MONTHLY;BYMONTHDAY=${day > 28 ? -1 : day}`, 'Gasto fijo cargado en Pesitos.');
  }
  for (const c of s.cards || []) {
    const day = Number(c.dueDay) || 5;
    const first = dateWithDay(today.getFullYear(), today.getMonth(), day);
    event(`card-${c.id}`, `Vence la tarjeta ${c.name}`, first, `FREQ=MONTHLY;BYMONTHDAY=${day > 28 ? -1 : day}`, 'Abrí Pesitos para ver el monto del resumen.');
  }
  for (const b of s.bills || []) {
    const step = (REPEATS.find((r) => r.id === b.repeat) || REPEATS[0]).months;
    const rr = !step ? '' : step === 12 ? 'FREQ=YEARLY' : `FREQ=MONTHLY;INTERVAL=${step}`;
    event(`bill-${b.id}`, `Vence ${b.name} (${money(b.amount)})`, parseISO(b.date), rr, `${repeatLabel(b.repeat)}. Cargado en Pesitos.`);
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
  const body = due.map((i) => `${i.name}: ${money(i.amount)}`).join(' · ');
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
  for (const f of s.fixed) if (f.lastAmount && f.amount > f.lastAmount * 1.02) increases.push({ name: f.name, from: f.lastAmount, to: f.amount });
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
