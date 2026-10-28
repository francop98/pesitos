// =========================================================
// Pesitos — estadísticas: en qué se va la plata, ingresos contra gastos
// mes a mes, comparación con el período anterior, comercios, etiquetas,
// cuentas y exportar (Excel y PDF).
// =========================================================

import { money, esc, monthKey, addMonthKey, monthName, todayISO, pct } from './formato.js';
import { monthExpenses, monthIncome, fixedTotal } from './calculos.js';
import { catById } from './categorias.js';
import { merchantKey } from './interprete.js';
import { screenHead, icon, catIcon } from './interfaz.js';
import { nombreCuenta, patrimonio } from './cuentas.js';
import { descargarCSV, imprimirResumen, tablaMovimientos } from './exportar.js';

const PALETA = ['#1F6F4A', '#9BD34A', '#F2B33D', '#3E8ED0', '#E0703C', '#8E6CC9', '#2BB3A3', '#D85A8C', '#7A8B99', '#B5892F'];
let periodo = 'mes';
const PERIODOS = [['mes', 'Este mes'], ['anterior', 'Mes pasado'], ['3m', '3 meses'], ['6m', '6 meses'], ['anio', 'Este año']];

function meses(p = periodo) {
  const mk = monthKey();
  if (p === 'anterior') return [addMonthKey(mk, -1)];
  if (p === '3m') return [-2, -1, 0].map((k) => addMonthKey(mk, k));
  if (p === '6m') return [-5, -4, -3, -2, -1, 0].map((k) => addMonthKey(mk, k));
  if (p === 'anio') { const n = Number(mk.slice(5, 7)); return Array.from({ length: n }, (_, i) => `${mk.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`); }
  return [mk];
}
const anteriores = (ms) => ms.map((m) => addMonthKey(m, -ms.length));

export function resumen(s, ms) {
  const byCat = {}; let variables = 0; let fijos = 0; let ingresos = 0;
  for (const m of ms) {
    const e = monthExpenses(s, m); variables += e.total;
    for (const [c, v] of Object.entries(e.byCat)) byCat[c] = (byCat[c] || 0) + v;
    fijos += fixedTotal(s, m);
    ingresos += monthIncome(s, m);
  }
  const desde = `${ms[0]}-01`; const hasta = `${ms[ms.length - 1]}-31`;
  const enRango = (x) => x.date >= desde && x.date <= hasta;
  const gastosLista = s.expenses.filter((e) => !e.pending && enRango(e));
  const ingresosLista = s.incomes.filter(enRango);
  // comercios: por la primera palabra significativa de la descripción
  const comercios = {};
  for (const e of gastosLista) { const k = merchantKey(e.note) || e.note.toLowerCase(); const c = comercios[k] || (comercios[k] = { nombre: e.note, total: 0, veces: 0 }); c.total += e.amount; c.veces++; }
  const tags = {};
  for (const e of gastosLista) for (const t of e.tags || []) tags[t] = (tags[t] || 0) + e.amount;
  const medios = {};
  for (const e of gastosLista) { const k = e.cardId ? `Tarjeta ${(s.cards.find((c) => c.id === e.cardId) || {}).name || ''}` : e.accountId ? nombreCuenta(s, e.accountId) : 'Sin indicar'; medios[k] = (medios[k] || 0) + e.amount; }
  const gastos = variables + fijos;
  const hoy = todayISO();
  const diasTranscurridos = Math.max(1, Math.round((new Date(Math.min(Date.parse(hoy), Date.parse(hasta.replace(/-31$/, '-28')) + 4 * 86400000)) - new Date(desde)) / 86400000) + 1);
  return { byCat, variables, fijos, gastos, ingresos, ahorro: ingresos - gastos, tasa: ingresos ? (ingresos - gastos) / ingresos : 0, comercios: Object.values(comercios).sort((a, b) => b.total - a.total), tags, medios, gastosLista, ingresosLista, porDia: variables / Math.min(diasTranscurridos, ms.length * 31) };
}

function dona(items, total) {
  if (!total) return '';
  const R = 52; const C = 2 * Math.PI * R; let acc = 0;
  const arcos = items.map((it, i) => { const frac = it.v / total; const seg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${PALETA[i % PALETA.length]}" stroke-width="22" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(it.label)}: ${Math.round(frac * 100)}%</title></circle>`; acc += frac; return seg; }).join('');
  return `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Gastos por categoría">${arcos}<text x="70" y="66" text-anchor="middle" style="fill:var(--muted)" font-size="10" font-weight="600">Variables</text><text x="70" y="82" text-anchor="middle" style="fill:var(--ink)" font-size="13" font-weight="800">${esc(money(total))}</text></svg>`;
}

function barrasMensuales(s) {
  const ms = Array.from({ length: 6 }, (_, i) => addMonthKey(monthKey(), i - 5));
  const datos = ms.map((m) => ({ m, ing: monthIncome(s, m), gas: monthExpenses(s, m).total + fixedTotal(s, m) }));
  const max = Math.max(1, ...datos.flatMap((d) => [d.ing, d.gas]));
  return `<div class="barras" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">${datos.map((d) => `<div class="barra-mes">
      <div class="barra-par"><span class="b-ing" style="height:${Math.round((d.ing / max) * 100)}%" title="Ingresos ${money(d.ing)}"></span><span class="b-gas" style="height:${Math.round((d.gas / max) * 100)}%" title="Gastos ${money(d.gas)}"></span></div>
      <span class="b-lbl">${monthName(d.m)}</span></div>`).join('')}</div>
    <div class="legend"><span><i class="swatch" style="background:var(--green-mid)"></i>Ingresos</span><span><i class="swatch" style="background:#F2B33D"></i>Gastos</span></div>`;
}

export function render(s) {
  const ms = meses();
  const r = resumen(s, ms);
  const prev = resumen(s, anteriores(ms));
  const cats = Object.entries(r.byCat).map(([c, v]) => ({ c, v, label: catById(c).label })).sort((a, b) => b.v - a.v);
  const top = cats.slice(0, 7);
  const resto = cats.slice(7).reduce((a, x) => a + x.v, 0);
  const items = resto ? [...top, { c: 'resto', v: resto, label: 'Resto' }] : top;
  const comp = (v, a) => (a ? (v - a) / a : null);
  // subir es malo en gastos y bueno en ingresos
  const cambio = (x, bueno = false) => (x == null ? '' : `<span class="${Math.abs(x) <= 0.02 ? 'igual' : (x > 0) !== bueno ? 'sube' : 'baja'}" title="Contra el período anterior">${x > 0 ? '▲' : x < 0 ? '▼' : '='} ${Math.abs(Math.round(x * 100))}%</span>`);
  const pat = patrimonio(s);
  return `<section class="screen">
    ${screenHead('Estadísticas', `<span class="head-actions"><button class="icon-btn" data-action="statsCSV" aria-label="Exportar a Excel">${icon('download', 20)}</button><button class="btn small" data-action="statsPDF">PDF</button></span>`)}
    <div class="chips periodo">${PERIODOS.map(([v, l]) => `<button class="chip toggle" data-action="statsPeriodo" data-v="${v}" aria-pressed="${periodo === v}">${l}</button>`).join('')}</div>
    <div class="stat-grid three">
      <div class="stat three"><span class="k">Ingresos</span><span class="v pos">${money(r.ingresos)}</span>${cambio(comp(r.ingresos, prev.ingresos), true)}</div>
      <div class="stat three"><span class="k">Gastos</span><span class="v">${money(r.gastos)}</span>${cambio(comp(r.gastos, prev.gastos))}</div>
      <div class="stat three"><span class="k">${r.ahorro >= 0 ? 'Te quedó' : 'Faltó'}</span><span class="v ${r.ahorro >= 0 ? 'pos' : 'neg'}">${money(Math.abs(r.ahorro))}</span>${r.ingresos ? `<span class="small muted">${pct(r.tasa, 0, false)} de lo que entró</span>` : ''}</div>
    </div>
    <div class="card">
      <strong>En qué se fue</strong>
      ${cats.length ? `<div class="dona-wrap">${dona(items, r.variables)}<div class="dona-ley">${items.map((it, i) => `<button class="ley-item" ${it.c !== 'resto' ? `data-action="buscarCon" data-filtro='${esc(JSON.stringify({ cat: it.c, desde: `${ms[0]}-01`, hasta: `${ms[ms.length - 1]}-31`, tipo: 'gastos' }))}'` : ''}><i style="background:${PALETA[i % PALETA.length]}"></i><span class="grow">${esc(it.label)}</span><b>${Math.round((it.v / r.variables) * 100)}%</b></button>`).join('')}</div></div>` : '<p class="text muted">Todavía no hay gastos en este período.</p>'}
      <div class="split small"><span>Gastos fijos</span><b>${money(r.fijos)}</b></div>
      <div class="split small"><span>Gasto variable por día (promedio)</span><b>${money(r.porDia)}</b></div>
    </div>
    ${cats.length ? `<div class="card tight">${cats.map((x) => { const a = prev.byCat[x.c] || 0; const c = catById(x.c); return `<div class="row"><span class="cat-icon">${catIcon(c, 18)}</span><span class="grow"><span class="name">${esc(c.label)}</span><span class="meta">Antes: ${money(a)}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount">${money(x.v)}</span>${cambio(comp(x.v, a))}</span></div>`; }).join('')}</div>` : ''}
    <div class="card"><strong>Ingresos y gastos, mes a mes</strong>${barrasMensuales(s)}</div>
    ${r.comercios.length ? `<div class="card"><strong>Dónde más gastaste</strong>${r.comercios.slice(0, 6).map((c) => `<div class="split small"><span>${esc(c.nombre)} <span class="muted">· ${c.veces} vez${c.veces === 1 ? '' : 'es'}</span></span><b>${money(c.total)}</b></div>`).join('')}</div>` : ''}
    ${Object.keys(r.medios).length > 1 ? `<div class="card"><strong>Con qué pagaste</strong>${Object.entries(r.medios).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="split small"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div>` : ''}
    ${Object.keys(r.tags).length ? `<div class="card"><strong>Por etiqueta</strong>${Object.entries(r.tags).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="split small"><span class="tag">#${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div>` : ''}
    <a class="card" href="#/cuentas" style="text-decoration:none;color:inherit;flex-direction:row;align-items:center"><span class="cat-icon green">${icon('bank', 18)}</span><span class="grow" style="display:flex;flex-direction:column"><b>Patrimonio neto</b><span class="small muted">Lo que tenés menos lo que debés</span></span><b class="${pat.neto >= 0 ? 'pos' : 'neg'}">${money(pat.neto)}</b>${icon('chevron', 16)}</a>
  </section>`;
}

export const actions = {
  statsPeriodo(ctx, el) { periodo = el.dataset.v; ctx.render(); },
  statsCSV(ctx) {
    const r = resumen(ctx.state, meses());
    descargarCSV(ctx.state, [...r.gastosLista.map((e) => ({ ...e, _k: 'e' })), ...r.ingresosLista.map((i) => ({ ...i, _k: 'i' }))].sort((a, b) => a.date.localeCompare(b.date)), `pesitos-${periodo}`);
  },
  statsPDF(ctx) {
    const s = ctx.state; const ms = meses(); const r = resumen(s, ms);
    const titulo = `${(PERIODOS.find((p) => p[0] === periodo) || [])[1]} · ${monthName(ms[0], true)} ${ms[0].slice(0, 4)}${ms.length > 1 ? ` a ${monthName(ms[ms.length - 1], true)} ${ms[ms.length - 1].slice(0, 4)}` : ''}`;
    const cats = Object.entries(r.byCat).sort((a, b) => b[1] - a[1]);
    imprimirResumen(titulo, `<div class="print-grid"><div>Ingresos<b>${money(r.ingresos)}</b></div><div>Gastos<b>${money(r.gastos)}</b></div><div>${r.ahorro >= 0 ? 'Te quedó' : 'Faltó'}<b>${money(Math.abs(r.ahorro))}</b></div></div>
      <h2>Gastos por categoría</h2><table class="print-tabla"><tbody>${cats.map(([c, v]) => `<tr><td>${esc(catById(c).label)}</td><td class="num">${money(v)}</td><td class="num">${r.variables ? Math.round((v / r.variables) * 100) : 0}%</td></tr>`).join('')}<tr><td>Gastos fijos</td><td class="num">${money(r.fijos)}</td><td></td></tr></tbody></table>
      <h2>Movimientos</h2>${tablaMovimientos(s, [...r.gastosLista.map((e) => ({ ...e, _k: 'e' })), ...r.ingresosLista.map((i) => ({ ...i, _k: 'i' }))].sort((a, b) => a.date.localeCompare(b.date)))}`);
  },
};
