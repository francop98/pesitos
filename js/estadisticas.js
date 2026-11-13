// =========================================================
// Pesitos — estadísticas: en qué se va la plata, ingresos contra gastos
// mes a mes, comparación con el período anterior, comercios, etiquetas,
// cuentas y exportar (Excel y PDF).
// =========================================================

import { money, esc, monthKey, addMonthKey, monthName, todayISO, pct , MONTHS_LONG} from './formato.js';
import { monthExpenses, monthIncome, fixedActive, cardSummary } from './calculos.js';
import { catById, catLabel } from './categorias.js';
import { merchantKey } from './interprete.js';
import { avancePresupuesto, barra as barraTope } from './presupuestos.js';
import { screenHead, icon, catIcon , abrirSelectorMes, closeModal, ojoMontos } from './interfaz.js';
import { nombreCuenta, patrimonio } from './cuentas.js';
import { descargarCSV, imprimirResumen, tablaMovimientos } from './exportar.js';

const PALETA = ['#1F6F4A', '#9BD34A', '#F2B33D', '#3E8ED0', '#E0703C', '#8E6CC9', '#2BB3A3', '#D85A8C', '#7A8B99', '#B5892F'];
let periodo = 'mes';
let statsTab = 'gastos'; // 'gastos' | 'sueldo'
/** Abrir Estadísticas en una pestaña (la ruta vieja #/sueldo llega acá). */
export function renderVista(s, v) { statsTab = v; return render(s); }
export const usarPestana = (v) => { statsTab = v; };
const PERIODOS = [['mes', 'Este mes'], ['anterior', 'Mes pasado'], ['3m', '3 meses'], ['6m', '6 meses'], ['anio', 'Este año'], ['anioPasado', 'Año pasado']];

function meses(p = periodo) {
  const mk = monthKey();
  if (p.startsWith('mk:')) return [p.slice(3)];
  if (p === 'anterior') return [addMonthKey(mk, -1)];
  if (p === '3m') return [-2, -1, 0].map((k) => addMonthKey(mk, k));
  if (p === '6m') return [-5, -4, -3, -2, -1, 0].map((k) => addMonthKey(mk, k));
  if (p === 'anioPasado') { const y = Number(mk.slice(0, 4)) - 1; return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`); }
  if (p === 'anio') { const n = Number(mk.slice(5, 7)); return Array.from({ length: n }, (_, i) => `${mk.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`); }
  return [mk];
}
const anteriores = (ms) => ms.map((m) => addMonthKey(m, -ms.length));

// topes (presupuestos) de categorías que todavía no tienen gastos este mes
function topesSinGasto(s, cats, p) {
  if (p !== 'mes') return '';
  const con = new Set(cats.map((x) => x.c));
  const otros = Object.keys(s.presupuestos || {}).filter((c) => !con.has(c));
  return otros.length ? `<span class="small muted u-mt-n6">También tenés tope en ${otros.map((c) => esc(catById(c).label)).join(', ')}: todavía sin gastos este mes.</span>` : '';
}

// Gastos fijos de un mes: lo que pagaste de verdad si lo registraste; si no, lo cargado.
export function fijosDelMes(s, m) {
  // si un fijo tiene pagos registrados, cuenta desde el primero (antes no existía o no se sabe)
  const primero = (f) => Object.keys(s.paid || {}).filter((k) => k.startsWith(`fixed:${f.id}:`) && Number(s.paid[k].amount) > 0).map((k) => k.split(':')[2]).sort()[0];
  return (s.fixed || []).filter((f) => fixedActive(f, m) && !(primero(f) && m < primero(f))).map((f) => {
    const p = (s.paid || {})[`fixed:${f.id}:${m}`];
    const real = !!(p && Number(p.amount) > 0);
    const v = real ? Number(p.amount) : (f.desc && f.desc.hasta && m <= f.desc.hasta ? Number(f.desc.monto) || 0 : Number(f.amount) || 0);
    return { f, v, real };
  });
}
const fijosMes = (s, m) => fijosDelMes(s, m).reduce((a, x) => a + x.v, 0);

export function resumen(s, ms) {
  const byCat = {}; let variables = 0; let fijos = 0; let ingresos = 0;
  for (const m of ms) {
    const e = monthExpenses(s, m); variables += e.total;
    for (const [c, v] of Object.entries(e.byCat)) byCat[c] = (byCat[c] || 0) + v;
    fijos += fijosMes(s, m);
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
  return `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Gastos por categoría">${arcos}<text x="70" y="66" text-anchor="middle" class="u-fill-muted" font-size="10" font-weight="600">Variables</text><text x="70" y="82" text-anchor="middle" class="u-fill-ink" font-size="13" font-weight="800">${esc(money(total))}</text></svg>`;
}

// Cada gasto fijo en el período (crédito, teléfono, servicios...), con lo pagado de verdad
function fijosUnoPorUno(s, ms) {
  const acc = {};
  for (const m of ms) for (const x of fijosDelMes(s, m)) { const a = acc[x.f.id] || (acc[x.f.id] = { f: x.f, v: 0, reales: 0, meses: 0 }); a.v += x.v; a.meses++; if (x.real) a.reales++; }
  const l = Object.values(acc).filter((a) => a.v > 0).sort((a, b) => b.v - a.v);
  if (!l.length) return '';
  return `<div class="card tight"><div class="split u-p-4-0-6"><strong>Gastos fijos, uno por uno</strong><b>${money(l.reduce((a, x) => a + x.v, 0))}</b></div>
    ${l.map((a) => `<button class="row" data-action="verHistorialFijo" data-id="${esc(a.f.id)}"><span class="grow"><span class="name">${esc(a.f.name)}</span><span class="meta">${a.reales === a.meses ? `${a.meses} pago${a.meses === 1 ? '' : 's'} registrado${a.meses === 1 ? '' : 's'}` : a.reales ? `${a.reales} de ${a.meses} meses con lo pagado; el resto, lo cargado` : 'Según el monto cargado'}${ms.length > 1 ? ` · ${money(a.v / a.meses)} por mes` : ''}</span></span><span class="amount">${money(a.v)}</span></button>`).join('')}
  </div>`;
}

// Mes a mes del período: lo que entró, lo que salió y lo que quedó, con total y promedio
function tablaMeses(s, ms) {
  if (ms.length < 2) return '';
  const hoy = monthKey();
  const filas = ms.filter((m) => m <= hoy).map((m) => { const ing = monthIncome(s, m); const gas = monthExpenses(s, m).total + fijosMes(s, m); return { m, ing, gas, q: ing - gas }; });
  const t = filas.reduce((a, f) => ({ ing: a.ing + f.ing, gas: a.gas + f.gas, q: a.q + f.q }), { ing: 0, gas: 0, q: 0 });
  const n = Math.max(1, filas.length);
  const fila = (k, f, cls = '') => `<div class="ti-fila ${cls}" role="row"><span>${k}</span><span class="pos">${money(f.ing)}</span><span>${money(f.gas)}</span><span class="${f.q >= 0 ? 'pos' : 'neg'}">${money(f.q)}</span></div>`;
  return `<div class="card"><strong>Mes a mes</strong>
    <div class="tabla-inf cuatro" role="table" aria-label="Ingresos y gastos de cada mes">
      <div class="ti-fila ti-head" role="row"><span>Mes</span><span>Entró</span><span>Salió</span><span>Quedó</span></div>
      ${filas.map((f) => fila(MONTHS_LONG[Number(f.m.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase()), f)).join('')}
      ${fila('Total', t, 'ti-total')}
      ${fila('Promedio', { ing: t.ing / n, gas: t.gas / n, q: t.q / n })}
    </div>
    <span class="small muted">Salió = gastos del día a día (las compras en cuotas, de a una cuota por mes) más los gastos fijos.</span></div>`;
}

function barrasMensuales(s) {
  const ms = Array.from({ length: 6 }, (_, i) => addMonthKey(monthKey(), i - 5));
  const datos = ms.map((m) => ({ m, ing: monthIncome(s, m), gas: monthExpenses(s, m).total + fijosMes(s, m) }));
  const max = Math.max(1, ...datos.flatMap((d) => [d.ing, d.gas]));
  return `<div class="barras" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">${datos.map((d) => `<div class="barra-mes">
      <div class="barra-par"><span class="b-ing" style="height:${Math.round((d.ing / max) * 100)}%" title="Ingresos ${money(d.ing)}"></span><span class="b-gas" style="height:${Math.round((d.gas / max) * 100)}%" title="Gastos ${money(d.gas)}"></span></div>
      <span class="b-lbl">${monthName(d.m)}</span></div>`).join('')}</div>
    <div class="legend"><span><i class="swatch u-bg-green-mid"></i>Ingresos</span><span><i class="swatch u-bg-F2B33D"></i>Gastos</span></div>`;
}


// ---------- más datos: proyección, día de la semana, hormiga, ticket, necesidades vs gustos ----------
const NECESIDADES = new Set(['vivienda', 'servicios', 'super', 'salud', 'transporte', 'vehiculo', 'educacion', 'hogar', 'mascotas', 'otros']);
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['los domingos', 'los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados'];
const parte = (e) => (e.installments > 1 ? e.amount / e.installments : e.amount);
function masDatos(s, r, ms, p) {
  const out = [];
  const lista = r.gastosLista.filter((e) => !e.fromPayment && !e.fromSavings);
  // proyección a fin de mes
  if (p === 'mes') {
    const hoy = new Date(); const dia = hoy.getDate(); const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    if (dia >= 3 && dia < fin) {
      // ritmo de los últimos 30 días (más estable que solo los días de este mes)
      const desde30 = new Date(); desde30.setDate(desde30.getDate() - 30); const d30 = desde30.toISOString().slice(0, 10);
      const ritmo = s.expenses.filter((e) => !e.pending && !e.fromPayment && !e.fromSavings && e.date >= d30).reduce((a, e) => a + parte(e), 0) / 30;
      const proy = r.variables + ritmo * (fin - dia) + r.fijos;
      const queda = r.ingresos - proy;
      out.push(`<div class="card"><strong>Si seguís a este ritmo</strong>
        <span class="text">Terminás ${MONTHS_LONG[hoy.getMonth()]} gastando cerca de <b>${money(proy)}</b>${r.ingresos ? ` y te ${queda >= 0 ? `quedarían <b class="pos">${money(queda)}</b>` : `faltarían <b class="neg">${money(-queda)}</b>`}` : ''}.</span>
        <span class="small muted">Lo que llevás gastado, más ${money(ritmo)} por día (tu promedio de los últimos 30 días) hasta fin de mes, más tus gastos fijos.</span></div>`);
    }
  }
  if (lista.length) {
    // gastos hormiga: compras chicas que de a una no se notan
    const ingMes = r.ingresos / ms.length;
    const umbral = Math.max(3000, Math.round((ingMes ? ingMes * 0.01 : 10000) / 1000) * 1000);
    const chicos = lista.filter((e) => parte(e) <= umbral);
    const sumChicos = chicos.reduce((a, e) => a + parte(e), 0);
    const tick = lista.reduce((a, e) => a + parte(e), 0) / lista.length;
    const porLugar = {};
    for (const e of chicos) { const k = merchantKey(e.note || '') || e.category; const x = porLugar[k] = porLugar[k] || { n: 0, t: 0, nombre: e.note || catLabel(e.category) }; x.n++; x.t += parte(e); }
    const topH = Object.values(porLugar).sort((x, y) => y.t - x.t).slice(0, 3);
    if (chicos.length) out.push(`<div class="card hormiga"><div class="split"><strong>🐜 Gastos hormiga</strong><b>${money(sumChicos)}</b></div>
      <span class="small">${chicos.length} compra${chicos.length === 1 ? '' : 's'} de hasta ${money(umbral)}${r.variables ? `: el <b>${Math.round((sumChicos / r.variables) * 100)}%</b> de lo que gastaste en el día a día` : ''}. A este ritmo son <b>${money(sumChicos / ms.length * 12)} por año</b>.</span>
      ${topH.map((x) => `<div class="split small"><span>${esc(x.nombre)} · ${x.n} ${x.n === 1 ? 'vez' : 'veces'}</span><b>${money(x.t)}</b></div>`).join('')}
      <span class="small muted">Cafés, kiosco, delivery chico, apps: de a uno no se notan. Cortar la mitad te deja ${money(sumChicos / ms.length / 2)} más por mes.</span></div>`);
    // lo que más repetís (cualquier monto)
    const rep = {};
    for (const e of lista) { const k = merchantKey(e.note || ''); if (!k) continue; const x = rep[k] = rep[k] || { n: 0, t: 0, nombre: e.note }; x.n++; x.t += parte(e); }
    const topR = Object.values(rep).filter((x) => x.n >= 3).sort((x, y) => y.n - x.n || y.t - x.t).slice(0, 4);
    if (topR.length) out.push(`<div class="card"><strong>Lo que más repetís</strong>
      ${topR.map((x) => `<div class="split small"><span>${esc(x.nombre)} · ${x.n} veces · ${money(x.t / x.n)} cada vez</span><b>${money(x.t)}</b></div>`).join('')}
      <span class="small muted">Lo que repetís seguido es donde un cambio chico rinde más (y donde más conviene buscar promos).</span></div>`);
    out.push(`<div class="stat-grid">
      <div class="stat"><span class="k">Compras</span><span class="v">${lista.length}</span><span class="small muted">${(lista.length / ms.length).toFixed(0)} por mes</span></div>
      <div class="stat"><span class="k">Ticket promedio</span><span class="v">${money(tick)}</span><span class="small muted">por compra</span></div>
    </div>`);
  }
  if (lista.length >= 5) {
    // por día de la semana (promedio por cada día de ese tipo en el período)
    const tot = [0, 0, 0, 0, 0, 0, 0]; const cuenta = [0, 0, 0, 0, 0, 0, 0];
    const desde = new Date(`${ms[0]}-01T00:00`); const hasta = new Date(Math.min(Date.now(), new Date(`${addMonthKey(ms[ms.length - 1], 1)}-01T00:00`) - 1));
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) cuenta[d.getDay()]++;
    for (const e of lista) tot[new Date(e.date + 'T00:00').getDay()] += parte(e);
    const prom = tot.map((t, i) => (cuenta[i] ? t / cuenta[i] : 0));
    const max = Math.max(1, ...prom); const iMax = prom.indexOf(Math.max(...prom));
    const orden = [1, 2, 3, 4, 5, 6, 0];
    out.push(`<div class="card"><strong>Qué día gastás más</strong>
      <div class="barras dias7" role="img" aria-label="Gasto promedio por día de la semana">${orden.map((i) => `<div class="barra-mes"><div class="barra-par"><span class="b-gas${i === iMax ? ' top' : ''}" style="height:${Math.round((prom[i] / max) * 100)}%" title="${money(prom[i])}"></span></div><span class="b-lbl">${DIAS[i]}</span></div>`).join('')}</div>
      <span class="small">${DIAS_LARGOS[iMax][0].toUpperCase() + DIAS_LARGOS[iMax].slice(1)} gastás en promedio <b>${money(prom[iMax])}</b>${prom.filter((x) => x > 0).length > 1 ? `, ${Math.round(prom[iMax] / (prom.reduce((a, x) => a + x, 0) / 7) * 10) / 10}× tu promedio diario` : ''}.</span></div>`);
  }
  // necesidades vs gustos (regla 50/30/20)
  if (r.ingresos && r.gastos) {
    let nec = r.fijos; let gus = 0;
    for (const [c, v] of Object.entries(r.byCat)) { if (NECESIDADES.has(c)) nec += v; else gus += v; }
    const pn = nec / r.ingresos; const pg = gus / r.ingresos; const pa = Math.max(0, r.ahorro) / r.ingresos;
    const fila = (k, v, meta, ok) => `<div class="regla-fila"><span>${k}</span><div class="regla-barra"><span style="width:${Math.min(100, Math.round(v * 100))}%" class="${ok ? 'ok' : 'mal'}"></span><i style="left:${meta * 100}%"></i></div><b>${Math.round(v * 100)}%</b></div>`;
    out.push(`<div class="card"><strong>Necesidades, gustos y ahorro</strong>
      ${fila('Necesidades', pn, 0.5, pn <= 0.5)}${fila('Gustos', pg, 0.3, pg <= 0.3)}${fila('Ahorro', pa, 0.2, pa >= 0.2)}
      <span class="small muted">Sobre lo que entró. La rayita marca la regla 50/30/20 (50% necesidades, 30% gustos, 20% ahorro). Necesidades: fijos, súper, vivienda, servicios, salud, transporte, educación e impuestos.</span></div>`);
  }
  // suscripciones y cuotas comprometidas
  const subs = (r.byCat.suscripciones || 0) / ms.length;
  const comp = (s.cards || []).reduce((a, c) => a + cardSummary(s, c).committed, 0);
  if (subs || comp) out.push(`<div class="stat-grid">
    ${subs ? `<div class="stat"><span class="k">Suscripciones</span><span class="v">${money(subs)}</span><span class="small muted">por mes · ${money(subs * 12)} al año</span></div>` : ''}
    ${comp ? `<div class="stat"><span class="k">Cuotas a futuro</span><span class="v">${money(comp)}</span><span class="small muted">ya comprometido en tarjetas</span></div>` : ''}
  </div>`);
  return out.join('');
}

export function render(s) {
  return `<section class="screen">
    ${screenHead('Estadísticas')}
    ${cuerpo(s)}
  </section>`;
}

/** Estadísticas y tu sueldo (también en Movimientos → Estadísticas). */
// "Ver más análisis" desplegado (se mantiene al cambiar de período)
let masAbierto = false;
document.addEventListener('toggle', (e) => { if (e.target && e.target.id === 'mas-analisis') masAbierto = e.target.open; }, true);
export function cuerpo(s) {
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
  return `
    <div class="seg"><span class="seg-acc"><button class="icon-btn" data-action="statsCSV" aria-label="Exportar a Excel">${icon('download', 20)}</button><button class="btn small" data-action="statsPDF">PDF</button></span></div>
    ${`
    <div class="chips periodo">${PERIODOS.map(([v, l]) => `<button class="chip toggle" data-action="statsPeriodo" data-v="${v}" aria-pressed="${periodo === v}">${l}</button>`).join('')}<button class="chip toggle" data-action="statsElegirMes" aria-pressed="${periodo.startsWith('mk:')}">${periodo.startsWith('mk:') ? `${MONTHS_LONG[Number(periodo.slice(8, 10)) - 1].replace(/^./, (c) => c.toUpperCase())} ${periodo.slice(3, 7)}` : 'Otro mes…'}</button></div>
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
    ${cats.length ? `<div class="section-title"><span>Por categoría</span><span class="small muted">Tocá una para ponerle un tope</span></div>
    <div class="card tight">${cats.map((x) => { const a = prev.byCat[x.c] || 0; const c = catById(x.c); const tope = periodo === 'mes' ? avancePresupuesto(s, x.c) : null; return `<button class="row" data-action="editPresupuesto" data-cat="${esc(x.c)}"><span class="cat-icon">${catIcon(c, 18)}</span><span class="grow"><span class="name">${esc(c.label)}</span>${tope ? `${barraTope(tope)}<span class="meta">Tope ${money(tope.limite)} · ${tope.pct >= 1 ? `te pasaste ${money(-tope.queda)}` : `quedan ${money(tope.queda)}`}</span>` : `<span class="meta">Antes: ${money(a)}</span>`}</span><span class="u-d-flex-dir-column-items-end"><span class="amount">${money(x.v)}</span>${cambio(comp(x.v, a))}</span></button>`; }).join('')}</div>
    ${topesSinGasto(s, cats, periodo)}` : ''}
    <details class="mas-analisis" id="mas-analisis"${masAbierto ? ' open' : ''}><summary class="btn block">Ver más análisis <span class="small muted">mes a mes, fijos, ritmo, hábitos, dónde y con qué pagaste</span></summary>
    <div class="mas-cuerpo">
    ${tablaMeses(s, ms)}
    ${fijosUnoPorUno(s, ms)}
    ${masDatos(s, r, ms, periodo)}
    <div class="card"><strong>Ingresos y gastos, mes a mes</strong>${barrasMensuales(s)}</div>
    ${r.comercios.length ? `<div class="card"><strong>Dónde más gastaste</strong>${r.comercios.slice(0, 6).map((c) => `<div class="split small"><span>${esc(c.nombre)} <span class="muted">· ${c.veces} vez${c.veces === 1 ? '' : 'es'}</span></span><b>${money(c.total)}</b></div>`).join('')}</div>` : ''}
    ${Object.keys(r.medios).length > 1 ? `<div class="card"><strong>Con qué pagaste</strong>${Object.entries(r.medios).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="split small"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div>` : ''}
    ${Object.keys(r.tags).length ? `<div class="card"><strong>Por etiqueta</strong>${Object.entries(r.tags).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="split small"><span class="tag">#${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div>` : ''}
    </div></details>
    `}
  `;
}

export const actions = {
  statsPeriodo(ctx, el) { periodo = el.dataset.v; ctx.render(); },
  statsTab(ctx, el) { statsTab = el.dataset.v; ctx.render(); },
  statsElegirMes(ctx) {
    const s = ctx.state; const hoy = monthKey();
    let min = hoy; for (const x of [...s.expenses, ...s.incomes]) if (x.date && x.date.slice(0, 7) < min) min = x.date.slice(0, 7);
    abrirSelectorMes({ actual: periodo.startsWith('mk:') ? periodo.slice(3) : hoy, min: `${Math.min(Number(min.slice(0, 4)), Number(hoy.slice(0, 4)) - 20)}-01`, max: hoy, accion: 'statsIrMes', marcados: new Set([...s.expenses, ...s.incomes].map((x) => (x.date || '').slice(0, 7))) });
  },
  statsIrMes(ctx, el) { periodo = `mk:${el.dataset.mk}`; closeModal(); ctx.render(); },
  statsCSV(ctx) {
    const r = resumen(ctx.state, meses());
    descargarCSV(ctx.state, [...r.gastosLista.map((e) => ({ ...e, _k: 'e' })), ...r.ingresosLista.map((i) => ({ ...i, _k: 'i' }))].sort((a, b) => a.date.localeCompare(b.date)), `pesitos-${periodo}`);
  },
  statsPDF(ctx) {
    const s = ctx.state; const ms = meses(); const r = resumen(s, ms);
    const titulo = `${(PERIODOS.find((p) => p[0] === periodo) || [0, 'Mes elegido'])[1]} · ${monthName(ms[0], true)} ${ms[0].slice(0, 4)}${ms.length > 1 ? ` a ${monthName(ms[ms.length - 1], true)} ${ms[ms.length - 1].slice(0, 4)}` : ''}`;
    const cats = Object.entries(r.byCat).sort((a, b) => b[1] - a[1]);
    imprimirResumen(titulo, `<div class="print-grid"><div>Ingresos<b>${money(r.ingresos)}</b></div><div>Gastos<b>${money(r.gastos)}</b></div><div>${r.ahorro >= 0 ? 'Te quedó' : 'Faltó'}<b>${money(Math.abs(r.ahorro))}</b></div></div>
      <h2>Gastos por categoría</h2><table class="print-tabla"><tbody>${cats.map(([c, v]) => `<tr><td>${esc(catById(c).label)}</td><td class="num">${money(v)}</td><td class="num">${r.variables ? Math.round((v / r.variables) * 100) : 0}%</td></tr>`).join('')}<tr><td>Gastos fijos</td><td class="num">${money(r.fijos)}</td><td></td></tr></tbody></table>
      <h2>Movimientos</h2>${tablaMovimientos(s, [...r.gastosLista.map((e) => ({ ...e, _k: 'e' })), ...r.ingresosLista.map((i) => ({ ...i, _k: 'i' }))].sort((a, b) => a.date.localeCompare(b.date)))}`);
  },
};
