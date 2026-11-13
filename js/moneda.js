// Moneda principal: pesos o dólares.
// Todos los montos que cargás se guardan en tu moneda principal. Si la cambiás,
// paso todo a la nueva con el dólar de referencia de hoy (Mi plata → Ahorros → Cotizaciones).

import { esc } from './formato.js';
import { openModal, closeModal, toast } from './interfaz.js';
import { monedaBase, arsPer, dolarRef, nombreDolar } from './cotizaciones.js';

export const MONEDAS_BASE = [['ARS', 'Pesos', 'Cobrás, gastás y ahorrás en pesos.'], ['USD', 'Dólares', 'Cobrás y manejás tu plata en dólares.']];
export const nombreMoneda = (m) => (m === 'USD' ? 'dólares' : 'pesos');

// multiplica por f todos los montos guardados (no toca cotizaciones ni tasas)
export function convertirMontos(s, f) {
  const r = (v) => (typeof v === 'number' && v ? Math.round(v * f * 100) / 100 : v);
  const campos = (o, ks) => { if (o) for (const k of ks) if (typeof o[k] === 'number') o[k] = r(o[k]); };
  for (const e of s.expenses || []) {
    campos(e, ['amount']); if (e.rate) e.rate = e.rate * f;
    for (const x of e.splits || []) campos(x, ['amount']);
    campos(e.shared, ['total', 'mine', 'other']);
    campos(e.reintegro, ['monto', 'esperado']);
  }
  for (const i of s.incomes || []) { campos(i, ['amount']); if (i.rate) i.rate = i.rate * f; }
  for (const x of s.fixed || []) campos(x, ['amount', 'lastAmount']);
  for (const x of s.goals || []) campos(x, ['target', 'saved', 'monthly']);
  for (const x of s.transfers || []) campos(x, ['amount']);
  for (const x of s.transferencias || []) campos(x, ['amount']);
  for (const x of s.cards || []) campos(x, ['limit']);
  for (const x of s.bills || []) campos(x, ['amount']);
  for (const x of s.expectedIncomes || []) campos(x, ['amount']);
  for (const x of s.promos || []) campos(x, ['cap']);
  for (const x of s.misBeneficios || []) campos(x, ['cap']);
  for (const x of s.proyectos || []) campos(x, ['presupuesto']);
  for (const x of Object.values(s.paid || {})) campos(x, ['amount']);
  for (const x of Object.values(s.received || {})) campos(x, ['amount']);
  for (const x of Object.values(s.cuentas || {})) campos(x, ['saldo']);
  for (const k of Object.keys(s.savedByApp || {})) s.savedByApp[k] = r(s.savedByApp[k]);
  for (const k of Object.keys(s.presupuestos || {})) s.presupuestos[k] = r(s.presupuestos[k]);
  for (const c of (s.rules && s.rules.custom) || []) if (c.type === 'fixedMonthly') campos(c, ['value']);
  if (s.rules && s.rules.roundup) s.rules.roundup.to = s.rules.roundup.to && f < 1 ? 1 : r(s.rules.roundup.to);
  // las deudas quedan en la moneda en que se hicieron
  const antes = f < 1 ? 'ARS' : 'USD';
  for (const d of s.deudas || []) if (!d.moneda) { d.moneda = antes; d.tc = f; }
  for (const x of s.holdings || []) if (!x.currency) x.currency = antes;
}

function body(s) {
  const actual = monedaBase(s);
  const usd = arsPer(s, 'USD');
  return `<form class="form" data-submit="guardarMoneda">
    <p class="small muted u-m-0">Es la moneda de tu día a día: en la que ves "Hoy podés gastar", tus gastos, tus metas y tus cuentas. Podés anotar gastos en otra moneda igual (por ejemplo, "Netflix US$ 10" o "Coto 20.000 pesos") y los paso solos.</p>
    <div class="ahorro-ops">${MONEDAS_BASE.map(([id, n, t]) => `<label class="ahorro-op ${id === actual ? 'on' : ''}"><input type="radio" name="moneda" value="${id}" ${id === actual ? 'checked' : ''} class="u-pos-absolute-op-0"><b>${n}</b><span>${t}</span></label>`).join('')}</div>
    <span class="hint">Si la cambiás, paso todo lo que cargaste a la nueva moneda con el ${esc(nombreDolar(dolarRef(s)).toLowerCase())} de hoy${usd ? ` ($${Math.round(usd)})` : ''}. Las promos y los topes de los bancos siguen en pesos y los convierto solos.</span>
    <button class="btn primary block" type="submit">Guardar</button>
  </form>`;
}

export const monedaActions = {
  openMoneda(ctx) { openModal('Tu moneda', body(ctx.state), { push: !document.getElementById('modal').hidden }); },
  guardarMoneda(ctx, d) {
    const nueva = d.moneda === 'USD' ? 'USD' : 'ARS';
    const vieja = monedaBase(ctx.state);
    if (nueva === vieja) { closeModal(); return; }
    const usd = arsPer(ctx.state, 'USD');
    if (!usd) { toast('No tengo la cotización del dólar ahora. Probá en un rato.'); return; }
    ctx.commit((s) => {
      convertirMontos(s, nueva === 'USD' ? 1 / usd : usd);
      s.settings.moneda = nueva;
    });
    closeModal(); toast(`Listo: ahora ves todo en ${nombreMoneda(nueva)}`);
  },
};
