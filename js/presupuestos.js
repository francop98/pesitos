// =========================================================
// Pesitos — presupuestos por categoría
// s.presupuestos = { [categoría]: tope mensual en pesos }
// Avisa al llegar al 80 % y al pasarse (al cargar un gasto y en Inicio).
// =========================================================

import { money, esc, monthKey, addMonthKey, monthName, num } from './formato.js';
import { monthExpenses } from './calculos.js';
import { categoriasOrdenadas, catById } from './categorias.js';
import { screenHead, openModal, closeModal, toast, catIcon, icon } from './interfaz.js';

export function avancePresupuesto(s, cat, mk = monthKey()) {
  const limite = Number((s.presupuestos || {})[cat]) || 0;
  if (!limite) return null;
  const gastado = monthExpenses(s, mk).byCat[cat] || 0;
  return { cat, limite, gastado, pct: gastado / limite, queda: limite - gastado };
}

export function todosLosPresupuestos(s, mk = monthKey()) {
  return Object.keys(s.presupuestos || {}).map((c) => avancePresupuesto(s, c, mk)).filter(Boolean).sort((a, b) => b.pct - a.pct);
}

/** Promedio de los últimos 3 meses completos (sugerencia de tope). */
export function promedioCategoria(s, cat) {
  const mk = monthKey();
  const vals = [1, 2, 3].map((k) => monthExpenses(s, addMonthKey(mk, -k)).byCat[cat] || 0);
  const con = vals.filter((v) => v > 0);
  return con.length ? Math.round(con.reduce((a, v) => a + v, 0) / con.length / 1000) * 1000 : 0;
}

const color = (pct) => (pct >= 1 ? 'mal' : pct >= 0.8 ? 'ojo' : 'bien');
const diasRestantes = () => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() - h.getDate() + 1; };

export function barra(p) {
  return `<div class="pres-barra ${color(p.pct)}" role="img" aria-label="Usaste el ${Math.round(p.pct * 100)}%"><span style="width:${Math.min(100, Math.round(p.pct * 100))}%"></span></div>`;
}

/** Tarjeta de Inicio: solo si alguna categoría pasó el 80 %. */
export function alertaPresupuestos(s) {
  const ojo = todosLosPresupuestos(s).filter((p) => p.pct >= 0.8);
  if (!ojo.length) return '';
  return `<a class="card amber" href="#/presupuestos" style="text-decoration:none;color:inherit">
    <div class="tip-head"><span style="color:var(--amber)">${icon('bulb', 18)}</span><strong>Presupuestos</strong></div>
    ${ojo.slice(0, 3).map((p) => `<div style="display:flex;flex-direction:column;gap:4px"><div class="split" style="font-size:13px"><span>${esc(catById(p.cat).label)}</span><b>${p.pct >= 1 ? `Te pasaste ${money(-p.queda)}` : `Quedan ${money(p.queda)}`}</b></div>${barra(p)}</div>`).join('')}
  </a>`;
}

export function render(s) {
  const mk = monthKey();
  const lista = todosLosPresupuestos(s, mk);
  const total = lista.reduce((a, p) => a + p.limite, 0);
  const gastado = lista.reduce((a, p) => a + p.gastado, 0);
  const sinTope = categoriasOrdenadas(s).filter((c) => !(s.presupuestos || {})[c.id]);
  const dias = diasRestantes();
  return `<section class="screen">
    ${screenHead('Presupuestos', '', `Topes por categoría · ${monthName(mk, true)}`)}
    ${lista.length ? `<div class="card green" style="gap:8px">
      <span class="hero-label">Usaste de tus presupuestos</span>
      <span style="font-size:30px;font-weight:800">${money(gastado)} <span style="font-size:15px;font-weight:600" class="on-green-muted">de ${money(total)}</span></span>
      ${barra({ pct: total ? gastado / total : 0 })}
      <span class="small on-green-muted">${total - gastado >= 0 ? `Te quedan ${money(total - gastado)} para ${dias} día${dias === 1 ? '' : 's'}: unos ${money((total - gastado) / dias)} por día.` : `Te pasaste ${money(gastado - total)} en total.`}</span>
    </div>` : `<div class="card"><p class="text"><b>Poné un tope por mes a las categorías que querés cuidar</b> (súper, salidas, delivery…). Te aviso cuando llegues al 80 % y si te pasás.</p></div>`}
    ${lista.length ? `<div class="card tight">${lista.map((p) => { const c = catById(p.cat); return `<button class="row pres-row" data-action="editPresupuesto" data-cat="${esc(p.cat)}">
      <span class="cat-icon">${catIcon(c, 18)}</span>
      <span class="grow"><span class="name">${esc(c.label)}</span>${barra(p)}<span class="meta">${money(p.gastado)} de ${money(p.limite)} · ${p.pct >= 1 ? `te pasaste ${money(-p.queda)}` : `quedan ${money(p.queda)}`}</span></span>
      <span class="pill ${p.pct >= 1 ? 'warn' : p.pct >= 0.8 ? 'warn' : 'ok'}">${Math.round(p.pct * 100)}%</span></button>`; }).join('')}</div>` : ''}
    ${sinTope.length ? `<div class="section-title"><span>Agregar un tope</span></div>
    <div class="chips">${sinTope.map((c) => `<button class="chip" data-action="editPresupuesto" data-cat="${esc(c.id)}">${c.emoji ? esc(c.emoji) + ' ' : ''}${esc(c.label)}</button>`).join('')}</div>` : ''}
    <p class="small muted">Los gastos en cuotas cuentan la cuota de cada mes. Los gastos fijos no entran en los presupuestos: ya los descuento aparte.</p>
  </section>`;
}

export const actions = {
  editPresupuesto(ctx, el) {
    const s = ctx.state; const cat = el.dataset.cat; const c = catById(cat);
    const actual = (s.presupuestos || {})[cat] || 0;
    const sug = promedioCategoria(s, cat);
    openModal(`Presupuesto: ${c.label}`, `<form class="form" data-submit="savePresupuesto">
      <input type="hidden" name="cat" value="${esc(cat)}">
      <div class="field"><label for="pr-m">Tope por mes</label><input id="pr-m" name="monto" inputmode="decimal" value="${actual ? String(actual) : ''}" placeholder="Ej: 150.000" required></div>
      ${sug ? `<button type="button" class="chip" data-action="usarSugerido" data-v="${sug}">Usar ${money(sug)} (tu promedio de los últimos 3 meses)</button>` : ''}
      <button class="btn primary block" type="submit">Guardar</button>
      ${actual ? `<button class="btn ghost block" type="button" data-action="quitarPresupuesto" data-cat="${esc(cat)}">Quitar el tope</button>` : ''}
    </form>`);
  },
  usarSugerido(ctx, el) { const i = document.getElementById('pr-m'); if (i) i.value = el.dataset.v; },
  savePresupuesto(ctx, d) {
    const monto = num(d.monto);
    if (!monto) { toast('Poné un monto'); return; }
    ctx.commit((s) => { s.presupuestos = { ...(s.presupuestos || {}), [d.cat]: monto }; });
    closeModal(); toast(`Tope de ${catById(d.cat).label}: ${money(monto)} por mes`);
  },
  quitarPresupuesto(ctx, el) {
    ctx.commit((s) => { const p = { ...(s.presupuestos || {}) }; delete p[el.dataset.cat]; s.presupuestos = p; });
    closeModal(); toast('Tope quitado');
  },
};
