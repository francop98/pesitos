// =========================================================
// Pesitos — proyectos
// Para seguir aparte lo que gastás (y lo que entra) en algo puntual: una obra, un viaje,
// un evento o un emprendimiento. Cada gasto o ingreso puede ir a un proyecto.
// s.proyectos = [{ id, nombre, tipo, presupuesto, conAhorros, creado, fin, cerrado }]
// Los movimientos guardan proyectoId. Si el proyecto se paga con ahorros, sus gastos
// no cuentan en "Hoy podés gastar".
// =========================================================

import { money, esc, num, todayISO, relDay } from './formato.js';
import { catById, catLabel } from './categorias.js';
import { icon, catIcon, openModal, closeModal, toast, borrarConDeshacer, screenHead } from './interfaz.js';
import { uid } from './almacenamiento.js';

let abierto = null; // proyecto que se está viendo

export const TIPOS = [
  ['obra', 'Obra o remodelación', 'home'],
  ['viaje', 'Viaje', 'plane'],
  ['evento', 'Evento', 'gift'],
  ['mudanza', 'Mudanza', 'key'],
  ['negocio', 'Emprendimiento', 'chart'],
  ['compra', 'Compra grande', 'cart'],
  ['otro', 'Otro', 'folder'],
];
const tipoDe = (p) => TIPOS.find((t) => t[0] === p.tipo) || TIPOS[TIPOS.length - 1];
const fechaTxt = (iso) => iso.split('-').reverse().join('/');

export const proyectosActivos = (s) => (s.proyectos || []).filter((p) => !p.cerrado);
export const proyectoDe = (s, id) => (s.proyectos || []).find((p) => p.id === id) || null;
const enProyecto = (s, id) => ({
  gastos: s.expenses.filter((e) => !e.pending && e.proyectoId === id),
  ingresos: s.incomes.filter((i) => i.proyectoId === id),
});
export function resumenProyecto(s, p) {
  const { gastos, ingresos } = enProyecto(s, p.id);
  const gastado = gastos.reduce((a, e) => a + e.amount, 0);
  const entro = ingresos.reduce((a, i) => a + i.amount, 0);
  const porCat = {};
  for (const e of gastos) porCat[e.category] = (porCat[e.category] || 0) + e.amount;
  const fechas = [...gastos, ...ingresos].map((x) => x.date).sort();
  return { gastos, ingresos, gastado, entro, neto: entro - gastado, porCat, desde: fechas[0], hasta: fechas[fechas.length - 1], movs: gastos.length + ingresos.length };
}

const barra = (pct) => `<div class="pres-barra ${pct >= 1 ? 'mal' : pct >= 0.8 ? 'ojo' : 'bien'}"><span style="width:${Math.min(100, Math.round(pct * 100))}%"></span></div>`;

/** Pantalla propia: #/proyectos */
export function render(s) {
  const p = abierto && proyectoDe(s, abierto);
  return `<section class="screen">
    ${p ? screenHead(p.nombre, '', p.tipo && p.tipo !== 'otro' ? tipoDe(p)[1] : 'Proyecto').replace('data-action="goBack" aria-label="Volver"', 'data-action="verProyecto" data-id="" aria-label="Volver a todos los proyectos"') : screenHead('Proyectos', '<button class="btn small" data-action="nuevoProyecto">+ Nuevo</button>', 'Gastos agrupados por objetivo')}
    ${cuerpo(s)}
  </section>`;
}

/** Lista de proyectos. */
export function cuerpo(s) {
  if (abierto && proyectoDe(s, abierto)) return detalle(s, proyectoDe(s, abierto));
  abierto = null;
  const lista = (s.proyectos || []).slice().sort((a, b) => (a.cerrado === b.cerrado ? (b.creado || '').localeCompare(a.creado || '') : a.cerrado ? 1 : -1));
  const activos = lista.filter((p) => !p.cerrado);
  const totalActivo = activos.reduce((a, p) => a + resumenProyecto(s, p).gastado, 0);
  return `${lista.length ? `
    ${activos.length ? `<div class="stat-grid"><div class="stat"><span class="k">En curso</span><span class="v">${activos.length}</span></div><div class="stat"><span class="k">Gastado en ellos</span><span class="v">${money(totalActivo)}</span></div></div>` : ''}
    <div class="card tight">${lista.map((p) => { const r = resumenProyecto(s, p); return `<button class="row" data-action="verProyecto" data-id="${esc(p.id)}">
      <span class="cat-icon ${p.cerrado ? '' : 'green'}">${icon(tipoDe(p)[2], 18)}</span>
      <span class="grow"><span class="name">${esc(p.nombre)}${p.cerrado ? ' <span class="pill">Terminado</span>' : ''}</span>
        <span class="meta">${r.movs} movimiento${r.movs === 1 ? '' : 's'}${p.presupuesto ? ` · ${Math.round((r.gastado / p.presupuesto) * 100)}% de ${money(p.presupuesto)}` : ''}${p.fin && !p.cerrado ? ` · hasta el ${fechaTxt(p.fin)}` : ''}${p.conAhorros ? ' · con ahorros' : ''}</span>
        ${p.presupuesto ? barra(r.gastado / p.presupuesto) : ''}</span>
      <span class="amount">${money(r.gastado)}</span></button>`; }).join('')}</div>`
    : `<div class="card proy-vacio">
        <span class="cat-icon green">${icon('folder', 20)}</span>
        <strong>Agrupá los gastos de un objetivo puntual</strong>
        <p class="small muted" style="margin:0">Un proyecto junta todos los movimientos de algo con principio y fin: una remodelación, un viaje, un evento o un emprendimiento. Así sabés cuánto llevás invertido, en qué se fue y cuánto te queda del presupuesto, sin mezclarlo con tus gastos de todos los días.</p>
        <ul class="proy-lista small">
          <li>Presupuesto y fecha objetivo opcionales, con aviso de ritmo.</li>
          <li>Desglose por categoría.</li>
          <li>Podés pagarlo con ahorros y que no afecte tu "Hoy podés gastar".</li>
        </ul>
      </div>`}
    <button class="btn primary block" data-action="nuevoProyecto">+ Nuevo proyecto</button>`;
}

// Si tiene presupuesto y fecha objetivo: compara lo gastado con el tiempo que pasó.
function ritmo(p, r) {
  if (p.cerrado || !p.presupuesto || !p.fin || !p.creado) return '';
  const ini = new Date(p.creado + 'T00:00'); const fin = new Date(p.fin + 'T00:00'); const hoy = new Date();
  const total = Math.max(1, (fin - ini) / 86400000); const paso = Math.min(total, Math.max(0, (hoy - ini) / 86400000));
  const pt = paso / total; const pg = r.gastado / p.presupuesto;
  const quedan = Math.max(0, Math.ceil((fin - hoy) / 86400000));
  const resto = Math.max(0, p.presupuesto - r.gastado);
  const txt = hoy > fin ? `La fecha objetivo ya pasó (${fechaTxt(p.fin)}).`
    : pg > pt + 0.1 ? `Vas más rápido de lo planeado: usaste el <b>${Math.round(pg * 100)}%</b> del presupuesto y pasó el ${Math.round(pt * 100)}% del tiempo.`
      : `Vas en ritmo: usaste el ${Math.round(pg * 100)}% del presupuesto y pasó el ${Math.round(pt * 100)}% del tiempo.`;
  return `<div class="card ${pg > pt + 0.1 ? 'amber' : ''}"><strong>Ritmo</strong><span class="small">${txt}</span>
    ${hoy <= fin ? `<span class="small muted">Te quedan ${money(resto)} para ${quedan} día${quedan === 1 ? '' : 's'}${quedan > 31 ? ` (≈ ${money(resto / (quedan / 30.4))} por mes)` : ''}.</span>` : ''}</div>`;
}

function detalle(s, p) {
  const r = resumenProyecto(s, p);
  const cats = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]);
  const movs = [...r.gastos.map((e) => ({ ...e, _k: 'e' })), ...r.ingresos.map((i) => ({ ...i, _k: 'i' }))].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card green" style="gap:6px">
      <span class="hero-label">${esc(p.nombre)}${p.cerrado ? ' · terminado' : ''}</span>
      <span class="hero-number" style="font-size:32px">${money(r.gastado)}</span>
      <span class="small on-green-muted">${p.presupuesto ? `de ${money(p.presupuesto)} de presupuesto · ${r.gastado <= p.presupuesto ? `quedan ${money(p.presupuesto - r.gastado)}` : `te pasaste ${money(r.gastado - p.presupuesto)}`}` : 'gastado en total'}</span>
      ${p.presupuesto ? barra(r.gastado / p.presupuesto) : ''}
      ${r.entro ? `<span class="small on-green-muted">Entró ${money(r.entro)} · resultado ${r.neto >= 0 ? '+' : '−'}${money(Math.abs(r.neto))}</span>` : ''}
      ${r.desde ? `<span class="small on-green-muted">Desde el ${fechaTxt(r.desde)}${r.hasta !== r.desde ? ` al ${fechaTxt(r.hasta)}` : ''} · ${p.conAhorros ? 'se paga con ahorros: no cuenta en "Hoy podés gastar"' : 'cuenta en "Hoy podés gastar"'}</span>` : ''}
    </div>
    ${ritmo(p, r)}
    ${cats.length ? `<div class="card"><strong>En qué se fue</strong>${cats.map(([c, v]) => `<div class="split small"><span>${esc(catLabel(c))}</span><b>${money(v)} · ${Math.round((v / Math.max(1, r.gastado)) * 100)}%</b></div>`).join('')}</div>` : ''}
    <div class="btn-row"><button class="btn small" data-action="sumarAProyecto" data-id="${esc(p.id)}">${icon('plus', 16, 2.4)} Sumar movimientos</button><button class="btn small" data-action="editarProyecto" data-id="${esc(p.id)}">Editar</button></div>
    <div class="section-title"><span>Movimientos</span><span class="small muted">${r.movs}</span></div>
    ${movs.length ? `<div class="card tight">${movs.map((x) => `<button class="row" data-action="openEntry" data-id="${esc(x.id)}" data-kind="${x._k === 'e' ? 'expense' : 'income'}">
      <span class="cat-icon ${x._k === 'i' ? 'green' : ''}">${x._k === 'e' ? catIcon(catById(x.category), 18) : icon('up', 18)}</span>
      <span class="grow"><span class="name">${esc(x.note)}</span><span class="meta">${relDay(x.date)}${x._k === 'e' ? ` · ${esc(catLabel(x.category))}` : ''}</span></span>
      <span class="amount ${x._k === 'i' ? 'pos' : ''}">${x._k === 'i' ? '+' : '−'}${money(x.amount)}</span></button>`).join('')}</div>`
      : '<div class="card"><p class="empty">Todavía no hay movimientos en este proyecto. Al cargar un gasto elegí el proyecto, o tocá "Sumar movimientos" para agregar los que ya cargaste.</p></div>'}`;
}

function form(p = {}) {
  const tipo = p.tipo || 'otro';
  return `<form class="form" data-submit="guardarProyecto">
    <input type="hidden" name="id" value="${esc(p.id || '')}">
    <input type="hidden" name="tipo" value="${esc(tipo)}">
    <div class="field"><label for="pr-n">Nombre</label><input id="pr-n" name="nombre" value="${esc(p.nombre || '')}" placeholder="Ej: Vacaciones en Bariloche, Arreglo del baño" required maxlength="40"></div>
    <div class="field-row">
      <div class="field"><label for="pr-p">Presupuesto (opcional)</label><input id="pr-p" name="presupuesto" inputmode="decimal" value="${p.presupuesto || ''}" placeholder="$ 0"></div>
      <div class="field"><label for="pr-f">Fecha objetivo (opcional)</label><input id="pr-f" name="fin" type="date" value="${esc(p.fin || '')}"></div>
    </div>
    <span class="hint">Con presupuesto y fecha te digo si vas en ritmo y cuánto podés gastar por mes.</span>
    <label class="check"><input type="checkbox" name="conAhorros" ${p.conAhorros ? 'checked' : ''}> <span>Lo pago con ahorros<br><span class="small muted">Sus gastos no se descuentan de "Hoy podés gastar". Dejalo sin marcar si lo pagás con la plata del mes.</span></span></label>
    ${p.id ? `<label class="check"><input type="checkbox" name="cerrado" ${p.cerrado ? 'checked' : ''}> <span>Proyecto terminado<br><span class="small muted">Deja de aparecer al cargar gastos. Lo seguís viendo acá.</span></span></label>` : ''}
    <button class="btn primary block" type="submit">Guardar</button>
    ${p.id ? `<button class="btn ghost block" type="button" data-action="borrarProyecto" data-id="${esc(p.id)}">Borrar proyecto (los movimientos quedan)</button>` : ''}
  </form>`;
}

function listaParaSumar(s, id) {
  const desde = new Date(); desde.setMonth(desde.getMonth() - 6);
  const lim = desde.toISOString().slice(0, 10);
  const items = [...s.expenses.filter((e) => !e.pending).map((e) => ({ ...e, _k: 'e' })), ...s.incomes.map((i) => ({ ...i, _k: 'i' }))]
    .filter((x) => x.proyectoId !== id && x.date >= lim).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
  return `<form class="form" data-submit="guardarSumaProyecto"><input type="hidden" name="id" value="${esc(id)}">
    <p class="small muted" style="margin:0">Marcá los movimientos de los últimos 6 meses que son de este proyecto.</p>
    <div class="card tight sumar-lista">${items.length ? items.map((x) => `<label class="row check-row"><input type="checkbox" name="m_${x._k}_${esc(x.id)}"><span class="grow"><span class="name">${esc(x.note)}</span><span class="meta">${relDay(x.date)}${x.proyectoId ? ' · en otro proyecto' : ''}</span></span><span class="amount ${x._k === 'i' ? 'pos' : ''}">${x._k === 'i' ? '+' : '−'}${money(x.amount)}</span></label>`).join('') : '<p class="empty">No hay movimientos para sumar.</p>'}</div>
    <button class="btn primary block" type="submit">Sumar al proyecto</button></form>`;
}

export const actions = {
  verProyecto(ctx, el) { abierto = el.dataset.id || null; ctx.render(); window.scrollTo(0, 0); },
  nuevoProyecto() { openModal('Nuevo proyecto', form()); },
  editarProyecto(ctx, el) { const p = proyectoDe(ctx.state, el.dataset.id); if (p) openModal('Editar proyecto', form(p)); },
  guardarProyecto(ctx, d) {
    const nombre = String(d.nombre || '').trim();
    if (!nombre) { toast('Ponele un nombre'); return; }
    let id = d.id;
    ctx.commit((s) => {
      s.proyectos = s.proyectos || [];
      const datos = { nombre, tipo: d.tipo || 'otro', fin: d.fin || '', presupuesto: num(d.presupuesto) || 0, conAhorros: !!d.conAhorros, cerrado: !!d.cerrado };
      const p = s.proyectos.find((x) => x.id === d.id);
      if (p) Object.assign(p, datos); else { id = uid(); s.proyectos.push({ id, creado: todayISO(), ...datos }); }
    });
    abierto = id; closeModal(); toast(d.id ? 'Proyecto guardado' : 'Proyecto creado: asignale gastos al cargarlos'); ctx.render();
  },
  borrarProyecto(ctx, el) {
    const id = el.dataset.id; closeModal(); abierto = null;
    borrarConDeshacer(ctx, 'Proyecto borrado', (s) => {
      s.proyectos = (s.proyectos || []).filter((p) => p.id !== id);
      for (const x of [...s.expenses, ...s.incomes]) if (x.proyectoId === id) delete x.proyectoId;
    });
  },
  sumarAProyecto(ctx, el) { openModal('Sumar movimientos', listaParaSumar(ctx.state, el.dataset.id)); },
  guardarSumaProyecto(ctx, d) {
    const marcados = Object.keys(d).filter((k) => k.startsWith('m_'));
    if (!marcados.length) { closeModal(); return; }
    ctx.commit((s) => {
      for (const k of marcados) {
        const [, tipo, ...resto] = k.split('_'); const mid = resto.join('_');
        const x = (tipo === 'e' ? s.expenses : s.incomes).find((y) => y.id === mid);
        if (x) x.proyectoId = d.id;
      }
    });
    closeModal(); toast(`Sumé ${marcados.length} movimiento${marcados.length === 1 ? '' : 's'} al proyecto`);
  },
  tipoProyecto(ctx, el) {
    const f = el.closest('form');
    f.querySelector('[name=tipo]').value = el.dataset.v;
    f.querySelectorAll('[data-action=tipoProyecto]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
  },
  pickProyecto(ctx, el) {
    const f = el.closest('form');
    f.querySelector('[name=proyecto]').value = el.dataset.v;
    f.querySelectorAll('[data-action=pickProyecto]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
  },
};
