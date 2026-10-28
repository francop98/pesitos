// El "economista": hallazgos automáticos, promos para vos, desafíos y respuestas.
// Hoy funciona con reglas. Más adelante se puede conectar a un modelo
// de IA (por ejemplo desde una función de Vercel en api/) sin cambiar las pantallas.

import { money, pct, normalize, monthKey, addMonthKey, toISO, todayISO, WEEKDAYS } from './format.js';
import { catLabel, CHALLENGES, walletName, provinceLabel } from './categories.js';
import { PROMO_CATALOG } from './promos-catalog.js';
import { livePromos, liveAge, expectedInflation } from './live.js';
import { budget, buyImpact, installmentsVsCash, monthExpenses, salaryStats, mainGoal, holdingsTotal } from './calc.js';

export const DISCLAIMER = 'Información educativa y general, no es asesoramiento financiero personalizado.';

// ---------- promos ----------
// Promos vigentes: las que publica el servicio de Pesitos (se actualizan solas
// todos los días). Si todavía no hay servicio, el catálogo local, solo
// durante su mes: nunca se muestra una promo vencida.
export function currentPromos(s) {
  if (s.live && Array.isArray(s.live.promos)) return { items: livePromos(s), source: 'live' };
  if (PROMO_CATALOG.month === monthKey()) return { items: PROMO_CATALOG.items, source: 'catalog' };
  return { items: [], source: 'none' };
}

export function promosForDay(s, day) {
  const mine = new Set(s.wallets || []);
  const fromCatalog = currentPromos(s).items
    .filter((p) => (mine.has(p.wallet) || (p.wallet === 'todos' && mine.size)) && (p.days || []).includes(day))
    .map((p) => ({ ...p, name: p.wallet === 'todos' ? 'Cualquier medio de pago' : walletName(p.wallet), source: 'catalog' }));
  const manual = (s.promos || []).filter((p) => p.day === day).map((p) => ({ ...p, merchant: '', source: 'manual' }));
  return [...fromCatalog, ...manual].sort((a, b) => (b.category === 'super') - (a.category === 'super') || b.pct - a.pct);
}
export function promosStatus(s) {
  const c = currentPromos(s);
  if (c.source === 'live') { const age = liveAge(s); const prov = s.profile && s.profile.province; return `Promos vigentes${prov ? ` en ${provinceLabel(prov)} y todo el país` : ' de todo el país'}, actualizadas automáticamente${age ? ' ' + age : ''}. Fuente: Con qué pago.`; }
  if (c.source === 'catalog') return `Promos de ${PROMO_CATALOG.label}. Se ocultan solas cuando vencen.`;
  return 'Las promos se cargan solas cuando la app está publicada con su servicio de actualización.';
}

export function insights(s) {
  const out = [];
  const mk = monthKey();
  const today = new Date().getDay();
  const tomorrow = (today + 1) % 7;

  // promos de tus medios de pago
  for (const [day, when] of [[today, 'Hoy'], [tomorrow, `Mañana (${WEEKDAYS[tomorrow]})`]]) {
    const p = promosForDay(s, day)[0];
    if (!p) continue;
    const where = p.merchant ? `en ${p.merchant}` : `en ${catLabel(p.category).toLowerCase()}`;
    out.push({ id: `promo-${day}`, tone: 'tip', title: 'Pesitos te sugiere', text: `${when} tenés ${p.pct}% ${where} con ${p.name}${p.cap ? ` (tope ${money(p.cap)})` : ''}.${p.cond ? ' ' + p.cond.replace(/\.$/, '') + '.' : ''} Si la compra grande cae ese día, ahorrás.`, cta: { label: 'Lo aproveché', action: 'promoUsed', id: String(p.cap || '') } });
    break;
  }

  // plata parada
  const idle = s.holdings.filter((h) => h.type === 'caja' && h.amount > 0).reduce((a, h) => a + h.amount, 0);
  if (idle > 0) out.push({ id: 'idle', tone: 'tip', title: 'Plata parada', text: `Tenés ${money(idle)} en caja de ahorro sin rendimiento. Quieta, pierde contra la inflación todos los meses.`, cta: { label: 'Ver opciones', action: 'showOptions' } });

  // gastos fijos que subieron
  for (const f of s.fixed) {
    if (f.lastAmount && f.amount > f.lastAmount * 1.03) {
      out.push({ id: 'fixed-' + f.id, tone: 'warn', title: `${f.name} subió ${pct(f.amount / f.lastAmount - 1, 0, false)}`, text: `Pasó de ${money(f.lastAmount)} a ${money(f.amount)}. Vale la pena comparar opciones o pedir una bonificación.` });
    }
  }

  // categorías que se dispararon contra tu promedio
  const cur = monthExpenses(s, mk).byCat;
  const prev = [1, 2, 3].map((n) => monthExpenses(s, addMonthKey(mk, -n)).byCat);
  const g = mainGoal(s);
  for (const [cat, v] of Object.entries(cur)) {
    if (cat === 'varios' || cat === 'otros') continue;
    const avg = prev.reduce((a, p) => a + (p[cat] || 0), 0) / 3;
    if (avg > 0 && v > avg * 1.3 && v - avg > 5000) {
      const extra = v - avg;
      let text = `Llevás ${money(v)} en ${catLabel(cat).toLowerCase()} este mes, un ${pct(v / avg - 1, 0, false)} más que tu promedio.`;
      if (g && g.monthly > 0) text += ` Volver a tu promedio adelanta "${g.name}" unos ${Math.round(extra / (g.monthly / 30))} días.`;
      out.push({ id: 'spike-' + cat, tone: 'warn', title: 'Ojo con esto', text });
    }
  }
  return out;
}

// ---------- desafíos ----------
export const allChallenges = (s) => [...CHALLENGES, ...(s.customChallenges || [])];

export function challengeStatus(s) {
  if (!s.challenge) return null;
  const def = allChallenges(s).find((c) => c.id === s.challenge.id);
  if (!def) return null;
  const start = s.challenge.start;
  const day = Math.floor((new Date() - new Date(start + 'T00:00:00')) / 86400000) + 1;
  const since = s.expenses.filter((e) => !e.pending && e.date >= start);
  const from = new Date(start + 'T00:00:00'); from.setDate(from.getDate() - 60);
  const before = s.expenses.filter((e) => !e.pending && e.date >= toISO(from) && e.date < start);
  const elapsed = Math.min(day, def.days);
  let broken = false; let estimate = 0; let detail = '';
  if (def.type === 'noSmall') {
    const small = (e) => e.amount < def.amount && e.installments <= 1;
    broken = since.some(small);
    estimate = Math.round((before.filter(small).reduce((a, e) => a + e.amount, 0) / 60) * elapsed);
    detail = `Ningún gasto menor a ${money(def.amount)}.`;
  } else if (def.type === 'capCat') {
    const spent = since.filter((e) => e.category === def.category).reduce((a, e) => a + e.amount, 0);
    broken = spent > def.amount;
    const usual = (before.filter((e) => e.category === def.category).reduce((a, e) => a + e.amount, 0) / 60) * elapsed;
    estimate = Math.max(0, Math.round(usual - spent));
    detail = `Llevás ${money(spent)} de ${money(def.amount)} en ${catLabel(def.category).toLowerCase()}.`;
  } else {
    broken = since.some((e) => e.category === def.category);
    estimate = Math.round((before.filter((e) => e.category === def.category).reduce((a, e) => a + e.amount, 0) / 60) * elapsed);
    detail = `Nada en ${catLabel(def.category).toLowerCase()}.`;
  }
  return { def, day: elapsed, done: day > def.days && !broken, broken, estimate, detail, pct: Math.min(1, day / def.days) };
}

// ---------- preguntas ----------
function amountIn(text) {
  const m = normalize(text).match(/(\d[\d.,]*)\s*(lucas?|mil|k|palos?|millon(?:es)?)?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0;
  if (m[2]) n *= /palo|millon/.test(m[2]) ? 1e6 : 1e3;
  return Math.round(n);
}

export function answer(question, s) {
  const q = normalize(question);
  const b = budget(s);

  if (/cuota/.test(q)) {
    const n = Number((q.match(/(\d{1,2})\s*cuotas?/) || [])[1]) || 12;
    const disc = Number((q.match(/(\d{1,2})\s*%/) || [])[1]) || 0;
    const price = amountIn(q.replace(/(\d{1,2})\s*cuotas?/, '').replace(/(\d{1,2})\s*%/, '')) || 100000;
    const infl = expectedInflation(s);
    const r = installmentsVsCash(price, n, disc, infl);
    const base = `Con una inflación esperada de ${String(infl).replace('.', ',')}% mensual (promedio de los últimos 3 meses del INDEC), ${n} cuotas sin interés de ${money(price)} equivalen hoy a ${money(r.pv)}.`;
    const cash = disc ? ` De contado, con ${disc}% de descuento, pagás ${money(r.cash)}.` : ` De contado pagás ${money(r.cash)}.`;
    const verdict = r.better === 'cuotas' ? `\n\nConvienen las cuotas: ahorrás unos ${money(r.diff)} en valor real.` : `\n\nConviene el contado: ahorrás unos ${money(r.diff)}.`;
    const tip = disc ? '' : '\n\nSi el contado tiene descuento, indicalo (por ejemplo: "12 cuotas o contado con 10%, $300.000") y recalculo.';
    return base + cash + verdict + tip + '\n\nVale solo si las cuotas no tienen interés y entran cómodas en tu mes.';
  }

  if (/me lo compro|comprar|compro|me compro/.test(q)) {
    const amount = amountIn(q);
    if (!amount) return 'Indicame el monto, por ejemplo: "¿Me compro unas zapatillas de $90.000?"';
    const r = buyImpact(s, amount);
    return `${r.title}. ${r.text}${r.extra ? '\n\n' + r.extra : ''}`;
  }

  if (/promo|descuento|reintegro/.test(q)) {
    if (!(s.wallets || []).length) return 'Cargá tus bancos, billeteras y tarjetas en Asesor → Mis medios de pago y te digo qué descuentos tenés cada día.';
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const day = (new Date().getDay() + i) % 7;
      const ps = promosForDay(s, day).slice(0, 2);
      if (ps.length) lines.push(`• ${WEEKDAYS[day][0].toUpperCase() + WEEKDAYS[day].slice(1)}: ${ps.map((p) => `${p.pct}% ${p.merchant || catLabel(p.category).toLowerCase()} (${p.name})`).join(', ')}`);
    }
    return lines.length ? 'Tus promos de la semana:\n' + lines.join('\n') : 'No encontré promos cargadas para tus medios de pago. Podés sumar las tuyas en Asesor → Promos.';
  }

  if (/aguinaldo|bono|extra/.test(q)) {
    const emergency = s.goals.find((g) => /emergencia/i.test(g.name));
    const lines = ['Una forma ordenada de usar un ingreso extra:'];
    if (emergency && emergency.target && emergency.saved < emergency.target) lines.push(`• Primero completá tu fondo de emergencia (te faltan ${money(emergency.target - emergency.saved)}).`);
    else lines.push('• Si no tenés fondo de emergencia, arrancá por ahí: de 3 a 6 meses de gastos fijos.');
    lines.push('• Lo que sigue, a tus metas según el plazo de cada una.');
    lines.push('• Y reservá un 10% a 20% para darte un gusto sin culpa.');
    return lines.join('\n');
  }

  if (/donde (pongo|invierto|ahorro|meto|guardo)|invertir|inversion|plazo fijo|fci|dolar/.test(q)) return OPTIONS_TEXT;

  if (/cuanto (puedo|me queda)|puedo gastar|me queda/.test(q)) {
    if (b.noIncome) return 'Cargá tu sueldo y te digo cuánto podés gastar por día.';
    return `Hoy podés gastar ${money(Math.max(0, b.todayLeft))}. Hasta el cobro (${b.cycle.daysLeft} días) te quedan ${money(Math.max(0, b.free))} libres, ya descontando fijos y ahorro.`;
  }

  if (/sueldo|aumento|inflacion|salario/.test(q)) {
    const st = salaryStats(s);
    if (!st) return 'Todavía no cargaste sueldos. Andá a la pestaña Sueldo y cargá los últimos meses.';
    let t = `En los últimos ${st.span} meses tu sueldo subió ${pct(st.nomGrowth)} y la inflación fue ${pct(st.inflation)}: en términos reales ${st.realGrowth >= 0 ? 'ganaste' : 'perdiste'} ${pct(Math.abs(st.realGrowth), 1, false)}.`;
    if (st.toRecover > 0) t += `\n\nPara volver a tu mejor mes necesitarías un aumento de ${pct(st.toRecover, 0, false)}. Es un buen número para llevar a una negociación.`;
    if (st.missing.length) t += `\n\nEl INDEC todavía no publicó ${st.missing.length === 1 ? 'el último mes' : `${st.missing.length} meses`}: por ahora uso una estimación y se corrige sola cuando sale el dato.`;
    return t;
  }

  if (/ahorr/.test(q)) {
    return `Tenés ${money(holdingsTotal(s))} ahorrados. Este ciclo tus reglas apartan ${money(b.saving)}.`;
  }

  return 'Todavía estoy aprendiendo. Probá con:\n• "¿12 cuotas o contado con 10%? $300.000"\n• "¿Me compro algo de $80.000?"\n• "¿Qué promos tengo esta semana?"\n• "¿Dónde pongo mis ahorros?"\n• "¿Le gané a la inflación?"';
}

export const OPTIONS_TEXT = `Depende de cuándo vas a necesitar la plata:

• Menos de 3 meses o fondo de emergencia: cuenta remunerada o fondo money market. Rinden algo y la sacás cuando quieras.

• De 3 a 12 meses: plazo fijo tradicional o fondos de renta fija de corto plazo. Si podés dejarla 90 días o más, mirá también el plazo fijo UVA, que sigue a la inflación.

• Más de un año: dólares, CEDEARs, bonos, oro o cripto. Pueden rendir más, pero suben y bajan; no pongas ahí plata que vas a necesitar pronto.

Compará tasas y comisiones en tu banco o billetera antes de decidir.`;

export { todayISO };
