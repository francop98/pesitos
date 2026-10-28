// Cálculos: presupuesto del ciclo, "hoy podés gastar", ahorro por reglas,
// metas, sueldo real, tarjetas y cuotas.

import { toISO, parseISO, monthKey, addMonthKey, monthDiff, startOfToday, daysBetween, MONTHS_LONG, money } from './formato.js';
import { arsPer } from './cotizaciones.js';
import { ipcMap, expectedInflation } from './datosvivos.js';
import { provisions } from './agenda.js';

const share = (e) => (e.installments > 1 ? e.amount / e.installments : e.amount);
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

function dateWithDay(y, m, day) {
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, dim));
}

// Ciclo de cobro: del último día de cobro al próximo.
export function payCycle(s, today = startOfToday()) {
  const pd = Number(s.profile.payday) || 1;
  let next = dateWithDay(today.getFullYear(), today.getMonth(), pd);
  if (next <= today) next = dateWithDay(today.getFullYear(), today.getMonth() + 1, pd);
  const start = dateWithDay(next.getFullYear(), next.getMonth() - 1, pd);
  return { start, next, startISO: toISO(start), nextISO: toISO(next), daysLeft: Math.max(1, daysBetween(today, next)) };
}

export function lastSalary(s) {
  return [...s.incomes].filter((i) => i.type === 'sueldo').sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

export const fixedTotal = (s) => sum(s.fixed, (f) => f.amount);

function cycleExpenses(s, cycle) {
  return s.expenses.filter((e) => !e.pending && e.date >= cycle.startISO && e.date < cycle.nextISO);
}

// Ahorro planificado según las reglas activas, con el detalle de cada una.
export function plannedSaving(s, salary, extras = 0, expenses = []) {
  const r = s.rules;
  const parts = [];
  let base = 0;
  if (r.payFirst.on) base = (salary * r.payFirst.pct) / 100;
  if (r.r503020.on) base = Math.max(base, salary * 0.2);
  if (base) parts.push({ name: r.r503020.on && base === salary * 0.2 ? '50/30/20' : 'Págate primero', amount: base });
  if (r.extraPct.on && extras) parts.push({ name: 'Ingresos extra', amount: (extras * r.extraPct.pct) / 100 });
  if (r.roundup.on) {
    const to = Number(r.roundup.to) || 1000;
    const round = sum(expenses, (e) => { const v = share(e); return Math.ceil(v / to) * to - v; });
    if (round) parts.push({ name: 'Redondeo', amount: round });
  }
  // ahorro de a poco para pagos grandes que vienen (agenda de pagos)
  const prov = provisions(s).reduce((a, p) => a + p.monthly, 0);
  if (prov > 0) parts.push({ name: 'Para pagos que vienen', amount: prov });
  for (const c of r.custom || []) {
    if (!c.on) continue;
    let v = 0;
    if (c.type === 'pctSalary') v = (salary * c.value) / 100;
    else if (c.type === 'fixedMonthly') v = c.value;
    else if (c.type === 'catPct') v = (sum(expenses.filter((e) => e.category === c.category), share) * c.value) / 100;
    if (v) parts.push({ name: c.name, amount: v });
  }
  return { total: sum(parts, (p) => p.amount), parts };
}

// Gasto variable que cae en el ciclo (las compras en cuotas cuentan de a una cuota por mes).
export function cycleVariable(s, cycle) {
  const startMk = cycle.startISO.slice(0, 7);
  let total = 0;
  for (const e of s.expenses) {
    if (e.pending || e.fromSavings) continue;
    if (e.date >= cycle.startISO && e.date < cycle.nextISO) total += share(e);
    else if (e.date < cycle.startISO && e.installments > 1) {
      const k = monthDiff(e.date.slice(0, 7), startMk);
      if (k >= 1 && k <= e.installments - 1) total += share(e);
    }
  }
  return total;
}

export function budget(s) {
  const today = startOfToday();
  const todayStr = toISO(today);
  const cycle = payCycle(s, today);
  const inCycle = s.incomes.filter((i) => i.date >= cycle.startISO && i.date < cycle.nextISO);
  const salaryInCycle = sum(inCycle.filter((i) => i.type === 'sueldo'), (i) => i.amount);
  const last = lastSalary(s);
  const salary = salaryInCycle || (last ? last.amount : 0);
  const extras = sum(inCycle.filter((i) => i.type !== 'sueldo'), (i) => i.amount);
  const income = salary + extras;
  const fixed = fixedTotal(s);
  const plan = plannedSaving(s, salary, extras, cycleExpenses(s, cycle));
  const saving = plan.total;
  const variable = cycleVariable(s, cycle);
  const spentToday = sum(s.expenses.filter((e) => !e.pending && !e.fromSavings && e.date === todayStr), share);
  const free = income - fixed - saving - variable;
  const dailyBase = (free + spentToday) / cycle.daysLeft;
  const todayLeft = dailyBase - spentToday;
  const usedPct = income > 0 ? Math.min(1, (fixed + saving + variable) / income) : 0;
  return { cycle, income, salary, extras, fixed, saving, savingParts: plan.parts, variable, spentToday, free, dailyBase, todayLeft, usedPct, estimated: !salaryInCycle && !!last, noIncome: income <= 0 };
}

// ---------- metas ----------
export const mainGoal = (s) => s.goals.find((g) => g.main) || s.goals[0] || null;
export const goalPct = (g) => (g.target > 0 ? Math.min(1, g.saved / g.target) : 0);

export function goalEta(g) {
  if (!g.target) return { done: false, text: 'Falta definir cuánto necesitás' };
  const left = Math.max(0, g.target - g.saved);
  if (left === 0) return { done: true, text: '¡Meta cumplida!' };
  if (!g.monthly || g.monthly <= 0) return { done: false, text: 'Sin aporte mensual definido' };
  const months = Math.ceil(left / g.monthly);
  const d = new Date(); d.setMonth(d.getMonth() + months);
  const when = months <= 11 ? MONTHS_LONG[d.getMonth()] : `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  return { done: false, months, text: `A este ritmo llegás en ${when}` };
}

// ---------- "¿Me lo compro?" ----------
export function buyImpact(s, amount) {
  const b = budget(s);
  if (b.noIncome) return { level: 'warn', title: 'Primero cargá tu sueldo', text: 'Sin ingreso no puedo calcular el impacto.' };
  if (amount <= b.todayLeft) {
    return { level: 'ok', title: 'Dale, entra en lo de hoy', text: `Te quedarían ${money(b.todayLeft - amount)} para hoy, sin tocar tus metas.` };
  }
  if (amount <= b.free) {
    const newDaily = (b.free - amount) / b.cycle.daysLeft;
    return { level: 'warn', title: 'Se puede, pero ajusta tu diario', text: `Hasta el próximo cobro pasarías de ${money(b.dailyBase)} a ${money(newDaily)} por día.` };
  }
  const over = amount - Math.max(0, b.free);
  const g = mainGoal(s);
  let text = `Te pasás ${money(over)} de lo que tenés libre hasta el cobro.`;
  if (g && g.monthly > 0) {
    const days = Math.max(1, Math.round(over / (g.monthly / 30)));
    text += ` Si sale de tus ahorros, atrasa "${g.name}" unos ${days} días.`;
  }
  return { level: 'no', title: 'Mejor esperá', text, extra: amount > 3 * Math.max(1, b.dailyBase) ? 'Si hay cuotas sin interés, preguntale al asesor si conviene.' : '' };
}

// ---------- cuotas vs contado ----------
export function installmentsVsCash(price, n, discountPct, monthlyInflPct) {
  const i = monthlyInflPct / 100;
  let pv = 0;
  for (let k = 1; k <= n; k++) pv += price / n / Math.pow(1 + i, k);
  const cash = price * (1 - discountPct / 100);
  return { pv, cash, better: pv < cash ? 'cuotas' : 'contado', diff: Math.abs(cash - pv) };
}

// ---------- totales por mes y categoría ----------
export function monthExpenses(s, mk) {
  let total = 0; const byCat = {};
  for (const e of s.expenses) {
    if (e.pending) continue;
    const n = e.installments > 1 ? e.installments : 1;
    const k = monthDiff(e.date.slice(0, 7), mk);
    if (k < 0 || k >= n) continue;
    const v = e.amount / n;
    total += v; byCat[e.category] = (byCat[e.category] || 0) + v;
  }
  return { total, byCat };
}
export const monthIncome = (s, mk) => sum(s.incomes.filter((i) => i.date.slice(0, 7) === mk), (i) => i.amount);

// ---------- sueldo nominal vs real ----------
export function salaryStats(s) {
  const byMonth = {};
  s.incomes.filter((i) => i.type === 'sueldo').forEach((i) => { const mk = i.date.slice(0, 7); byMonth[mk] = (byMonth[mk] || 0) + i.amount; });
  const months = Object.keys(byMonth).sort();
  if (!months.length) return null;
  const first = months[0]; const last = months[months.length - 1];
  // Inflación automática (INDEC). Los meses que el INDEC todavía no publicó
  // se estiman con el promedio de los últimos 3 meses y se marcan como estimados.
  const ipc = ipcMap(s);
  const guess = expectedInflation(s);
  const factor = { [first]: 1 }; const missing = [];
  let f = 1; let mk = first;
  while (mk < last) {
    const nx = addMonthKey(mk, 1);
    let ip = ipc[nx];
    if (ip == null || ip === '') { missing.push(nx); ip = guess; }
    f *= 1 + (Number(ip) || 0) / 100;
    factor[nx] = f; mk = nx;
  }
  const series = months.map((m) => ({ mk: m, nominal: byMonth[m], real: (byMonth[m] * factor[last]) / factor[m] }));
  const cur = series[series.length - 1];
  const best = series.reduce((a, b) => (b.real > a.real ? b : a));
  const target = addMonthKey(last, -12);
  const base = series.find((x) => x.mk >= target) || series[0];
  const nomGrowth = cur.nominal / base.nominal - 1;
  const inflation = factor[last] / factor[base.mk] - 1;
  const realGrowth = (1 + nomGrowth) / (1 + inflation) - 1;
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) { if (series[i].real > series[i - 1].real * 1.0005) streak++; else break; }
  const toRecover = best.real > cur.real ? best.real / cur.real - 1 : 0;
  return { series, cur, best, isBest: best.mk === cur.mk && series.length > 1, base, nomGrowth, inflation, realGrowth, streak, toRecover, missing, span: monthDiff(base.mk, last) };
}

// ---------- ahorro ----------
export const holdingArs = (s, h) => h.amount * arsPer(s, h.currency || 'ARS');
export const holdingsTotal = (s) => sum(s.holdings, (h) => holdingArs(s, h));
export const savedThisMonth = (s) => s.savedByApp[monthKey()] || 0;

// ---------- tarjetas de crédito ----------
// Mes del resumen en el que entra una compra (según el día de cierre).
export function statementMonth(card, iso) {
  const d = parseISO(iso);
  const mk = iso.slice(0, 7);
  return d.getDate() <= (Number(card.closeDay) || 31) ? mk : addMonthKey(mk, 1);
}

export function cardSummary(s, card) {
  const current = statementMonth(card, toISO(startOfToday()));
  const byMonth = {};
  const pending = [];
  let committed = 0;
  for (const e of s.expenses) {
    if (e.pending || e.cardId !== card.id) continue;
    const n = e.installments > 1 ? e.installments : 1;
    const first = statementMonth(card, e.date);
    const each = e.amount / n;
    for (let k = 0; k < n; k++) {
      const mk = addMonthKey(first, k);
      if (mk >= current) { byMonth[mk] = (byMonth[mk] || 0) + each; committed += each; }
    }
    const paid = Math.max(0, Math.min(n, monthDiff(first, current)));
    if (n > 1 && paid < n) pending.push({ e, n, each, next: paid + 1, left: n - paid, remaining: each * (n - paid), last: addMonthKey(first, n - 1) });
  }
  pending.sort((a, b) => b.remaining - a.remaining);
  const months = Array.from({ length: 6 }, (_, i) => { const mk = addMonthKey(current, i); return { mk, amount: byMonth[mk] || 0 }; });
  return { current, next: byMonth[current] || 0, months, pending, committed, used: card.limit ? committed / card.limit : 0 };
}

// ---------- resumen semanal automático (lunes a domingo, se cierra el lunes 00:00) ----------
export function lastWeekStart(today = startOfToday()) {
  const back = (today.getDay() + 6) % 7; // días desde el lunes
  const monday = new Date(today); monday.setDate(today.getDate() - back - 7);
  return toISO(monday);
}

function weekSpent(s, fromISO, toISOd) {
  return s.expenses.filter((e) => !e.pending && e.date >= fromISO && e.date <= toISOd);
}

export function weekSummary(s, mondayISO) {
  const from = parseISO(mondayISO);
  const to = new Date(from); to.setDate(from.getDate() + 6);
  const toStr = toISO(to);
  const list = weekSpent(s, mondayISO, toStr);
  const spent = sum(list, share);
  const byCat = {};
  list.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + share(e); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amount]) => ({ cat, amount }));
  // promedio de las 4 semanas anteriores
  const prev = [1, 2, 3, 4].map((k) => {
    const a = new Date(from); a.setDate(from.getDate() - 7 * k);
    const b = new Date(a); b.setDate(a.getDate() + 6);
    return sum(weekSpent(s, toISO(a), toISO(b)), share);
  }).filter((v) => v > 0);
  const avg = prev.length ? prev.reduce((a, v) => a + v, 0) / prev.length : 0;
  const income = sum(s.incomes.filter((i) => i.date >= mondayISO && i.date <= toStr), (i) => i.amount);
  let verdict = 'Primera semana con datos: desde la próxima te comparo contra tu promedio.';
  if (avg > 0) {
    const diff = spent / avg - 1;
    verdict = Math.abs(diff) < 0.05 ? 'Gastaste parecido a tu promedio de las últimas semanas.'
      : diff < 0 ? `Gastaste ${Math.round(-diff * 100)}% menos que tu promedio (${money(avg)}). ¡Bien ahí!`
      : `Gastaste ${Math.round(diff * 100)}% más que tu promedio (${money(avg)}).`;
  }
  return { from: mondayISO, to: toStr, spent, top, avg, income, verdict, count: list.length };
}

// Saldo esperado desde el último cierre semanal.
export function expectedBalance(s, todayStr = toISO(startOfToday())) {
  if (!s.lastClose) return null;
  const since = s.lastClose.date;
  const inc = sum(s.incomes.filter((i) => i.date > since && i.date <= todayStr), (i) => i.amount);
  const exp = sum(s.expenses.filter((e) => !e.pending && !e.cardId && e.date > since && e.date <= todayStr), share);
  const tr = sum((s.transfers || []).filter((t) => t.date > since && t.date <= todayStr), (t) => t.amount);
  let fixedDue = 0;
  const a = parseISO(since); const b = parseISO(todayStr);
  for (let d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1); d <= b; d.setDate(d.getDate() + 1)) {
    for (const f of s.fixed) if (Number(f.dueDay) === d.getDate()) fixedDue += f.amount;
  }
  return s.lastClose.balance + inc - exp - tr - fixedDue;
}

export function closeDue(s) {
  if (!s.lastClose) return true;
  return daysBetween(parseISO(s.lastClose.date), startOfToday()) >= 7;
}

export { monthKey };
