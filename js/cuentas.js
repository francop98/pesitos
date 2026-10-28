// =========================================================
// Pesitos — cuentas con saldo (efectivo, bancos, billeteras),
// transferencias entre cuentas, deudas y préstamos, y patrimonio.
//
// Datos:
//   s.cuentas        { [id]: { saldo, desde: 'AAAA-MM-DD' } }  saldo real a esa fecha
//   s.cuentaPrincipal id de la cuenta que se usa por defecto
//   s.transferencias [{ id, date, from, to, amount, note }]
//   s.deudas         [{ id, tipo: 'meDeben' | 'debo', persona, monto, date, nota, vence,
//                       cuenta, pagos: [{ id, date, monto, cuenta }], origen }]
// Ids de cuenta: 'efectivo' o el id de un banco/billetera de "Mis medios de pago".
// =========================================================

import { allWallets } from './categorias.js';
import { todayISO, monthKey, monthDiff } from './formato.js';
import { holdingsTotal, cardSummary, fixedActive } from './calculos.js';

const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

/** Cuentas posibles: efectivo + bancos y billeteras elegidos (las tarjetas de crédito no son cuentas). */
export function listaCuentas(s) {
  const mias = new Set(s.wallets || []);
  const out = [{ id: 'efectivo', name: 'Efectivo', kind: 'Efectivo' }];
  for (const w of allWallets()) if (mias.has(w.id) && w.kind !== 'Tarjetas') out.push({ id: w.id, name: w.name, kind: w.kind });
  return out;
}
export const nombreCuenta = (s, id) => (listaCuentas(s).find((c) => c.id === id) || { name: id === 'efectivo' ? 'Efectivo' : (allWallets().find((w) => w.id === id) || { name: 'Cuenta' }).name }).name;
export const cuentaPrincipal = (s) => s.cuentaPrincipal || (listaCuentas(s)[1] || listaCuentas(s)[0]).id;
export const cuentasConSaldo = (s) => listaCuentas(s).filter((c) => s.cuentas && s.cuentas[c.id]);

/** Lo que salió de la cuenta por un gasto (si fue compartido y pagaste vos, el total). */
export function salidaDeGasto(e) {
  if (e.cardId || e.pending) return 0;
  if (e.shared) return e.shared.paidByMe ? Number(e.shared.total) || e.amount : 0;
  return e.amount;
}

/** Movimientos de una cuenta desde una fecha: [{ date, monto (+/-), texto, tipo, ref }] */
export function movimientosDeCuenta(s, id, desde = '0000-00-00', hasta = todayISO()) {
  const out = [];
  const en = (d) => d && d > desde && d <= hasta;
  for (const i of s.incomes || []) if (i.accountId === id && en(i.date)) out.push({ date: i.date, monto: i.amount, texto: i.note, tipo: 'ingreso', ref: i.id });
  for (const e of s.expenses || []) if (e.accountId === id && en(e.date)) { const v = salidaDeGasto(e); if (v) out.push({ date: e.date, monto: -v, texto: e.note, tipo: 'gasto', ref: e.id }); }
  for (const t of s.transferencias || []) {
    if (!en(t.date)) continue;
    if (t.from === id) out.push({ date: t.date, monto: -t.amount, texto: t.note || 'Transferencia', tipo: 'transferencia', ref: t.id });
    if (t.to === id) out.push({ date: t.date, monto: t.amount, texto: t.note || 'Transferencia', tipo: 'transferencia', ref: t.id });
  }
  // pagos de gastos fijos y resúmenes de tarjeta marcados como pagados con esta cuenta
  for (const [key, p] of Object.entries(s.paid || {})) {
    if (p.account !== id || !en(p.date) || key.startsWith('bill:')) continue; // los pagos programados ya son gastos
    const [tipo, ref] = key.split(':');
    const nombre = tipo === 'card' ? `Tarjeta ${(s.cards.find((c) => c.id === ref) || {}).name || ''}` : ((s.fixed.find((f) => f.id === ref) || {}).name || 'Gasto fijo');
    out.push({ date: p.date, monto: -Number(p.amount || 0), texto: `Pago: ${nombre}`.trim(), tipo: 'pago', ref: key });
  }
  for (const t of s.transfers || []) if (t.accountId === id && en(t.date)) out.push({ date: t.date, monto: -t.amount, texto: t.note || 'A ahorros', tipo: 'ahorro', ref: t.id });
  for (const d of s.deudas || []) {
    if (d.cuenta === id && en(d.date) && !d.origen) out.push({ date: d.date, monto: d.tipo === 'meDeben' ? -d.monto : d.monto, texto: d.tipo === 'meDeben' ? `Le prestaste a ${d.persona}` : `Te prestó ${d.persona}`, tipo: 'deuda', ref: d.id });
    for (const p of d.pagos || []) if (p.cuenta === id && en(p.date)) out.push({ date: p.date, monto: d.tipo === 'meDeben' ? p.monto : -p.monto, texto: d.tipo === 'meDeben' ? `${d.persona} te devolvió` : `Le devolviste a ${d.persona}`, tipo: 'deuda', ref: d.id });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Saldo de hoy: el que cargaste en su fecha, más todo lo que pasó después. */
export function saldoCuenta(s, id) {
  const c = s.cuentas && s.cuentas[id];
  if (!c) return null;
  return Number(c.saldo || 0) + sum(movimientosDeCuenta(s, id, c.desde), (m) => m.monto);
}
export const totalCuentas = (s) => sum(cuentasConSaldo(s), (c) => saldoCuenta(s, c.id) || 0);

// ---------- deudas y préstamos ----------
export const pagadoDeuda = (d) => sum(d.pagos || [], (p) => p.monto);
export const saldoDeuda = (d) => Math.max(0, Number(d.monto || 0) - pagadoDeuda(d));
export const deudasAbiertas = (s, tipo) => (s.deudas || []).filter((d) => (!tipo || d.tipo === tipo) && saldoDeuda(d) > 0.5);
export const totalMeDeben = (s) => sum(deudasAbiertas(s, 'meDeben'), saldoDeuda);
export const totalDebo = (s) => sum(deudasAbiertas(s, 'debo'), saldoDeuda);

/** Lo que falta pagar de créditos (gastos fijos con cuotas) */
export function restaCreditos(s, mk = monthKey()) {
  return sum((s.fixed || []).filter((f) => f.endMonth && fixedActive(f, mk)), (f) => f.amount * (monthDiff(mk, f.endMonth) + (s.paid && s.paid[`fixed:${f.id}:${mk}`] ? 0 : 1)));
}

/** Patrimonio: lo que tenés menos lo que debés. */
export function patrimonio(s) {
  const cuentas = totalCuentas(s);
  const ahorros = holdingsTotal(s);
  const meDeben = totalMeDeben(s);
  const debo = totalDebo(s);
  const tarjetas = sum(s.cards || [], (c) => { const x = cardSummary(s, c); const p = (s.paid || {})[`card:${c.id}:${x.current}`]; return Math.max(0, x.committed - (p ? Number(p.amount) || 0 : 0)); });
  const creditos = restaCreditos(s);
  const activos = cuentas + ahorros + meDeben;
  const pasivos = debo + tarjetas + creditos;
  return { cuentas, ahorros, meDeben, debo, tarjetas, creditos, activos, pasivos, neto: activos - pasivos, conCuentas: cuentasConSaldo(s).length > 0 };
}
