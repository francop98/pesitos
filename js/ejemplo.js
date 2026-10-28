// Datos de ejemplo para recorrer la app. Todos los montos son inventados.
// Las cotizaciones se toman en vivo cuando hay conexión.
// La inflación de ejemplo NO es la real: cargá el IPC del INDEC en la pestaña Sueldo.

import { emptyState, uid } from './almacenamiento.js';
import { monthKey, addMonthKey, toISO, addDays, startOfToday } from './formato.js';

export function demoState() {
  const s = emptyState();
  s.ready = true; s.demo = true;
  s.savingMode = 'payFirst';
  s.rules.payFirst.on = true;
  s.customCategories = [{ id: 'c_mascotas', label: 'Mascotas' }];
  s.profile = { name: 'Franco', payday: 1 };
  const today = startOfToday();
  const cur = monthKey(today);
  const todayStr = toISO(today);

  // 12 meses de sueldo + inflación de ejemplo
  const ipc = [2.4, 2.2, 3.7, 2.8, 2.4, 1.5, 1.6, 1.9, 2.1, 1.9, 2.0, 2.3];
  const raises = { 2: 1.04, 5: 1.06, 8: 1.08, 9: 1.05, 10: 1.04, 11: 1.05 };
  let sal = 900000;
  for (let i = 0; i < 12; i++) {
    const mk = addMonthKey(cur, i - 11);
    s.ipc[mk] = ipc[i];
    if (raises[i]) sal = Math.round((sal * raises[i]) / 1000) * 1000;
    s.incomes.push({ id: uid(), date: `${mk}-01`, amount: sal, type: 'sueldo', note: 'Sueldo' });
  }
  s.incomes.push({ id: uid(), date: toISO(addDays(today, -3)), amount: 85000, type: 'extra', note: 'Venta de usado' });

  // desafío activo: 15 días sin salidas pagas, empezó hace 6 días
  const challengeStart = toISO(addDays(today, -6));
  s.challenge = { id: 'salidas15', start: challengeStart };

  // gastos variables de los últimos 4 meses
  const pattern = [
    { day: 2, note: 'Coto', category: 'super', amount: 46000 },
    { day: 9, note: 'Carrefour', category: 'super', amount: 52000 },
    { day: 16, note: 'Coto', category: 'super', amount: 44000 },
    { day: 23, note: 'Verdulería', category: 'super', amount: 18000 },
    { day: 4, note: 'YPF', category: 'transporte', amount: 30000 },
    { day: 18, note: 'YPF', category: 'transporte', amount: 32000 },
    { day: 6, note: 'PedidosYa', category: 'delivery', amount: 9000 },
    { day: 20, note: 'Rappi', category: 'delivery', amount: 8500 },
    { day: 3, note: 'Cine', category: 'ocio', amount: 14000 },
    { day: 12, note: 'Pizza con amigos', category: 'comida', amount: 16000 },
    { day: 25, note: 'Café', category: 'comida', amount: 4500 },
    { day: 14, note: 'Farmacia', category: 'salud', amount: 11000 },
  ];
  const extraDeliveryThisMonth = [{ day: 8, amount: 9500 }, { day: 11, amount: 11000 }, { day: 15, amount: 8800 }, { day: 22, amount: 10200 }];
  for (let back = 3; back >= 0; back--) {
    const mk = addMonthKey(cur, -back);
    const items = [...pattern];
    if (back === 0) extraDeliveryThisMonth.forEach((d) => items.push({ day: d.day, note: 'PedidosYa', category: 'delivery', amount: d.amount }));
    for (const it of items) {
      const date = `${mk}-${String(it.day).padStart(2, '0')}`;
      if (date > todayStr) continue;
      if (it.category === 'ocio' && date >= challengeStart) continue;
      s.expenses.push({ id: uid(), date, amount: it.amount, category: it.category, note: it.note, installments: 1 });
    }
  }
  s.expenses.push({ id: uid(), date: `${addMonthKey(cur, -2)}-07`, amount: 540000, category: 'hogar', note: 'Heladera', installments: 12 });
  s.expenses.push({ id: uid(), date: todayStr, amount: 12500, category: 'salud', note: 'Farmacity', installments: 1, pending: true });

  s.fixed = [
    { id: uid(), name: 'Alquiler', amount: 230000, dueDay: 10 },
    { id: uid(), name: 'Prepaga', amount: 85000, lastAmount: 76000, dueDay: 5 },
    { id: uid(), name: 'Internet y celular', amount: 32000, dueDay: 15, autoDebit: true, payWith: 'provincia' },
    { id: uid(), name: 'Luz y gas', amount: 28000, dueDay: 20 },
    { id: uid(), name: 'Spotify', amount: 4500, dueDay: 12 },
    { id: uid(), name: 'Nafta', amount: 60000, dueDay: 1 },
  ];

  s.goals = [
    { id: uid(), name: 'Viaje a Bariloche', target: 1800000, saved: 630000, monthly: 120000, main: true },
    { id: uid(), name: 'Fondo de emergencia', target: 1500000, saved: 930000, monthly: 80000 },
    { id: uid(), name: 'Cambiar el auto', target: 12000000, saved: 1400000, monthly: 0 },
  ];

  s.holdings = [
    { id: uid(), type: 'remunerada', name: 'Billetera virtual', amount: 930000, currency: 'ARS' },
    { id: uid(), type: 'plazo_fijo', name: 'Plazo fijo', amount: 630000, currency: 'ARS', maturity: toISO(addDays(today, 18)) },
    { id: uid(), type: 'divisas', name: 'Dólares', amount: 1000, currency: 'USD' },
    { id: uid(), type: 'cripto', name: 'Bitcoin', amount: 0.005, currency: 'BTC' },
    { id: uid(), type: 'caja', name: 'Caja de ahorro', amount: 180000, currency: 'ARS' },
  ];

  // medios de pago y tarjeta con compras en cuotas
  s.wallets = ['cuentadni', 'provincia', 'mercadopago', 'visa'];
  const card = { id: uid(), name: 'Visa Provincia', closeDay: 24, dueDay: 5, limit: 2500000, payFrom: 'provincia' };
  s.cards = [card];
  for (const e of s.expenses) if (e.note === 'Heladera') e.cardId = card.id;
  s.expenses.push({ id: uid(), date: `${addMonthKey(cur, -1)}-15`, amount: 180000, category: 'ropa', note: 'Zapatillas', installments: 6, cardId: card.id });
  s.expenses.push({ id: uid(), date: `${cur}-${String(Math.min(today.getDate(), 20)).padStart(2, '0')}`, amount: 96000, category: 'hogar', note: 'Silla de escritorio', installments: 3, cardId: card.id });
  s.promos = [];
  // los fijos que ya vencieron este mes, pagados
  s.paid = {};
  for (const f of s.fixed) if (f.dueDay < today.getDate()) s.paid[`fixed:${f.id}:${cur}`] = { date: `${cur}-${String(f.dueDay).padStart(2, '0')}`, amount: f.amount };
  // pagos programados
  const inDays = (n) => toISO(addDays(today, n));
  s.expectedIncomes = [{ id: uid(), name: 'Trabajo freelance', amount: 150000, date: toISO(addDays(today, 9)), repeat: 'once' }];
  s.bills = [
    { id: uid(), name: 'Patente del auto', amount: 38000, date: inDays(2), repeat: 'bimonthly', category: 'transporte', saveAhead: false, payWith: 'mercadopago' },
    { id: uid(), name: 'Seguro del auto (anual)', amount: 420000, date: inDays(95), repeat: 'yearly', category: 'transporte', saveAhead: true },
    { id: uid(), name: 'Matrícula del gimnasio', amount: 25000, date: inDays(12), repeat: 'once', category: 'suscripciones', saveAhead: false },
  ];
  s.savedByApp = { [cur]: 12300 };
  s.setAside = {};
  return s;
}
