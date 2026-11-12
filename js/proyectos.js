// =========================================================
// Pesitos — proyectos
// Para seguir aparte lo que gastás (y lo que entra) en algo puntual: una obra, un viaje,
// un evento o un emprendimiento. Cada gasto o ingreso puede ir a un proyecto.
// s.proyectos = [{ id, nombre, tipo, presupuesto, conAhorros, creado, fin, cerrado, con: ['Sofi'], aportes: [] }]
// Compartido: "con" son las otras personas (se divide en partes iguales entre vos y ellas).
// aportes = [{ id, quien, monto, fecha, nota, aMi }]: lo que puso cada una (aMi: te lo dio a vos;
// si no, lo pagó directo). Lo tuyo son los gastos del proyecto menos lo que te dieron.
// Los movimientos guardan proyectoId. Si el proyecto se paga con ahorros, sus gastos
// no cuentan en "Hoy podés gastar".
// Ahorro del proyecto: si elegís ahorrar para él, se crea una meta enlazada (goal tipo
// 'proyecto', p.metaId) a la que pasás plata desde Mi plata → Ahorros. Se ve en Mi plata → Metas.
// Puede no tener ahorro (solo agrupar gastos).
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
export const metaDeProyecto = (s, p) => (p.metaId && (s.goals || []).find((g) => g.id === p.metaId)) || null;
export function resumenProyecto(s, p) {
  const { gastos, ingresos } = enProyecto(s, p.id);
  const meta = metaDeProyecto(s, p);
  const gastado = gastos.reduce((a, e) => a + e.amount, 0);
  const entro = ingresos.reduce((a, i) => a + i.amount, 0);
  const porCat = {};
  for (const e of gastos) porCat[e.category] = (porCat[e.category] || 0) + e.amount;
  const fechas = [...gastos, ...ingresos].map((x) => x.date).sort();
  const ahorrado = meta ? Number(meta.saved) || 0 : 0;
  return { gastos, ingresos, gastado, entro, neto: entro - gastado, porCat, desde: fechas[0], hasta: fechas[fechas.length - 1], movs: gastos.length + ingresos.length, meta, ahorrado, queda: ahorrado - gastado };
}

/** Entre cuántos y cuánto puso cada uno. null si no es compartido. */
export function cuentasProyecto(s, p) {
  const con = p.con || []; if (!con.length) return null;
  const r = resumenProyecto(s, p);
  const ap = p.aportes || [];
  const directo = ap.filter((a) => !a.aMi).reduce((t, a) => t + a.monto, 0);
  const total = r.gastado + directo;
  const n = con.length + 1; const parte = total / n;
  const puso = (q) => ap.filter((a) => a.quien === q).reduce((t, a) => t + a.monto, 0);
  const yo = r.gastado - ap.filter((a) => a.aMi).reduce((t, a) => t + a.monto, 0);
  const personas = [{ quien: 'Vos', puso: yo, saldo: yo - parte, yo: true }, ...con.map((q) => ({ quien: q, puso: puso(q), saldo: puso(q) - parte }))];
  return { total, n, parte, personas, aportes: ap };
}
function compartidoHtml(s, p) {
  const c = cuentasProyecto(s, p); if (!c) return '';
  const r1 = (x) => Math.round(x);
  const fila = (x) => `<div class="row"><span class="grow"><span class="name">${esc(x.quien)}</span><span class="meta">Puso ${money(x.puso)} · le toca ${money(c.parte)}</span></span>
    <span class="amount ${r1(x.saldo) > 0 ? 'pos' : ''}">${r1(x.saldo) === 0 ? 'Está al día' : x.saldo > 0 ? `Le deben ${money(x.saldo)}` : `Debe ${money(-x.saldo)}`}</span></div>`;
  const yo = c.personas[0];
  return `<div class="section-title"><span>Entre ${c.n} personas</span><button data-action="nuevoAporte" data-id="${esc(p.id)}">+ Aporte</button></div>
    <div class="card tight">
      <div class="row"><span class="grow"><span class="name">Total del proyecto</span><span class="meta">${money(c.total)} · ${money(c.parte)} cada uno</span></span></div>
      ${c.personas.map(fila).join('')}
    </div>
    <p class="small muted" style="margin:0">Tus gastos del proyecto cuentan como lo que pusiste vos. Lo que pongan los demás cargalo como aporte (si te lo dieron a vos o si pagaron algo directo).${r1(yo.saldo) > 0 ? ' Cuando quieras, pasalo a Deudas para seguir quién te devuelve.' : ''}</p>
    ${c.aportes.length ? `<details class="card"><summary><strong>Aportes (${c.aportes.length})</strong></summary>${c.aportes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((a) => `<button class="row" data-action="editarAporte" data-id="${esc(p.id)}" data-a="${esc(a.id)}"><span class="grow"><span class="name">${esc(a.quien)}${a.nota ? ` · ${esc(a.nota)}` : ''}</span><span class="meta">${relDay(a.fecha)} · ${a.aMi ? 'te lo dio a vos' : 'lo pagó directo'}</span></span><span class="amount">${money(a.monto)}</span></button>`).join('')}</details>` : ''}
    ${c.personas.slice(1).some((x) => r1(x.saldo) < 0) && r1(yo.saldo) > 0 ? `<button class="btn small" data-action="aportesADeudas" data-id="${esc(p.id)}" style="align-self:flex-start">Anotar en Deudas lo que me deben</button>` : ''}`;
}
function aporteForm(p, a = {}) {
  return `<form class="form" data-submit="guardarAporte"><input type="hidden" name="id" value="${esc(p.id)}"><input type="hidden" name="a" value="${esc(a.id || '')}">
    <div class="field"><label for="ap-q">¿Quién?</label><select id="ap-q" name="quien">${(p.con || []).map((q) => `<option ${q === a.quien ? 'selected' : ''}>${esc(q)}</option>`).join('')}</select></div>
    <div class="field-row"><div class="field"><label for="ap-m">Monto</label><input id="ap-m" name="monto" inputmode="decimal" value="${a.monto || ''}" required placeholder="Ej: 50.000"></div>
      <div class="field"><label for="ap-f">Fecha</label><input id="ap-f" name="fecha" type="date" value="${esc(a.fecha || todayISO())}"></div></div>
    <div class="field"><label for="ap-n">Qué fue (opcional)</label><input id="ap-n" name="nota" value="${esc(a.nota || '')}" placeholder="Ej: Pagó el hotel" maxlength="40"></div>
    <label class="check"><input type="radio" name="aMi" value="0" ${!a.aMi ? 'checked' : ''}> <span>Lo pagó directo (no pasó por tu bolsillo)</span></label>
    <label class="check"><input type="radio" name="aMi" value="1" ${a.aMi ? 'checked' : ''}> <span>Te lo dio a vos para el proyecto</span></label>
    <button class="btn primary block" type="submit">Guardar</button>
    ${a.id ? `<button class="btn ghost block" type="button" data-action="borrarAporte" data-id="${esc(p.id)}" data-a="${esc(a.id)}">Borrar aporte</button>` : ''}
  </form>`;
}
const conDeTexto = (t) => [...new Set(String(t || '').split(/[,;\n]| y /).map((x) => x.trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).filter((x) => !/^(yo|vos)$/i.test(x)))].slice(0, 12);

const barra = (pct) => `<div class="pres-barra ${pct >= 1 ? 'mal' : pct >= 0.8 ? 'ojo' : 'bien'}"><span style="width:${Math.min(100, Math.round(pct * 100))}%"></span></div>`;

/** Pantalla propia: #/proyectos */
export function render(s) {
  const p = abierto && proyectoDe(s, abierto);
  return `<section class="screen">
    ${p ? screenHead(p.nombre, '', p.tipo && p.tipo !== 'otro' ? tipoDe(p)[1] : 'Proyecto').replace('data-action="goBack" aria-label="Volver"', 'data-action="irMetas" aria-label="Volver a Metas"') : screenHead('Proyectos', '<button class="btn small" data-action="nuevoProyecto">+ Nuevo</button>', 'Gastos agrupados por objetivo')}
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
        <span class="meta">${r.movs} movimiento${r.movs === 1 ? '' : 's'}${(p.con || []).length ? ` · entre ${p.con.length + 1}` : ''}${p.presupuesto ? ` · ${Math.round((r.gastado / p.presupuesto) * 100)}% de ${money(p.presupuesto)}` : ''}${p.fin && !p.cerrado ? ` · hasta el ${fechaTxt(p.fin)}` : ''}${p.conAhorros ? ' · con ahorros' : ''}</span>
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
  const objetivo = p.presupuesto || (r.meta && r.meta.target) || 0;
  const ahorroHtml = r.meta ? `<div class="card" style="gap:8px">
      <div class="split"><strong>Ahorro del proyecto</strong><button class="btn small green" data-action="pasarAhorros" data-tipo="extra" data-goal="${esc(r.meta.id)}" data-otro="1">+ Sumar ahorro</button></div>
      <div class="split"><span>Ahorrado</span><b>${money(r.ahorrado)}${objetivo ? ` <span class="small muted">de ${money(objetivo)}</span>` : ''}</b></div>
      ${objetivo ? barra(r.ahorrado / objetivo).replace('pres-barra mal', 'pres-barra bien').replace('pres-barra ojo', 'pres-barra bien') : ''}
      <div class="split"><span>Gastado</span><b>${money(r.gastado)}</b></div>
      <div class="split"><span>${r.queda >= 0 ? 'Te queda de lo ahorrado' : 'Gastaste más de lo ahorrado'}</span><b class="${r.queda >= 0 ? 'pos' : 'neg'}">${money(Math.abs(r.queda))}</b></div>
      <span class="small muted">Pasás plata desde Mi plata → Ahorros (elegís este proyecto como destino) o con "+ Sumar ahorro".</span>
    </div>` : '';
  return `<div class="card green" style="gap:6px">
      <span class="hero-label">${esc(p.nombre)}${p.cerrado ? ' · terminado' : ''}</span>
      <span class="hero-number" style="font-size:32px">${money(r.gastado)}</span>
      <span class="small on-green-muted">${p.presupuesto ? `de ${money(p.presupuesto)} de presupuesto · ${r.gastado <= p.presupuesto ? `quedan ${money(p.presupuesto - r.gastado)}` : `te pasaste ${money(r.gastado - p.presupuesto)}`}` : 'gastado en total'}</span>
      ${p.presupuesto ? barra(r.gastado / p.presupuesto) : ''}
      ${r.entro ? `<span class="small on-green-muted">Entró ${money(r.entro)} · resultado ${r.neto >= 0 ? '+' : '−'}${money(Math.abs(r.neto))}</span>` : ''}
      ${r.desde ? `<span class="small on-green-muted">Desde el ${fechaTxt(r.desde)}${r.hasta !== r.desde ? ` al ${fechaTxt(r.hasta)}` : ''} · ${p.conAhorros ? 'se paga con ahorros: no cuenta en "Hoy podés gastar"' : 'cuenta en "Hoy podés gastar"'}</span>` : ''}
    </div>
    ${ahorroHtml}
    ${ritmo(p, r)}
    ${compartidoHtml(s, p)}
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
    <div class="field"><label for="pr-c">¿Lo compartís? Con quién (opcional)</label><input id="pr-c" name="con" value="${esc((p.con || []).join(', '))}" placeholder="Ej: Sofi, Juan" maxlength="200" data-input="proyContar">
      <span class="hint" data-proy-n>${(p.con || []).length ? `Entre ${p.con.length + 1} personas (vos y ${p.con.length})` : 'Separá los nombres con coma. Se divide en partes iguales y te digo cuánto puso cada uno.'}</span></div>
    <label class="check"><input type="checkbox" name="ahorrar" ${p.metaId || !p.id ? 'checked' : ''}> <span>Voy a ahorrar para esto<br><span class="small muted">Juntás plata para el proyecto (el presupuesto es el objetivo) y después ves cuánto gastaste de lo ahorrado. Destildalo si solo querés agrupar gastos.</span></span></label>
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
  verProyecto(ctx, el) { abierto = el.dataset.id || null; if (location.hash === '#/proyectos') { ctx.render(); window.scrollTo(0, 0); } else ctx.go('proyectos'); },
  nuevoProyecto() { openModal('Nuevo proyecto', form()); },
  editarProyecto(ctx, el) { const p = proyectoDe(ctx.state, el.dataset.id); if (p) openModal('Editar proyecto', form(p)); },
  guardarProyecto(ctx, d) {
    const nombre = String(d.nombre || '').trim();
    if (!nombre) { toast('Ponele un nombre'); return; }
    let id = d.id;
    ctx.commit((s) => {
      s.proyectos = s.proyectos || [];
      const datos = { nombre, tipo: d.tipo || 'otro', fin: d.fin || '', presupuesto: num(d.presupuesto) || 0, conAhorros: !!d.conAhorros, cerrado: !!d.cerrado, con: conDeTexto(d.con) };
      let p = s.proyectos.find((x) => x.id === d.id);
      if (p) Object.assign(p, datos); else { id = uid(); p = { id, creado: todayISO(), ...datos }; s.proyectos.push(p); }
      // ahorro del proyecto: una meta enlazada
      s.goals = s.goals || [];
      const g = p.metaId && s.goals.find((x) => x.id === p.metaId);
      if (d.ahorrar) {
        if (g) Object.assign(g, { name: nombre, target: datos.presupuesto || g.target || 0, ...(datos.fin ? { deadline: datos.fin } : {}) });
        else { const nid = uid(); s.goals.push({ id: nid, name: nombre, target: datos.presupuesto || 0, saved: 0, tipo: 'proyecto', proyectoId: p.id, ...(datos.fin ? { deadline: datos.fin } : {}) }); p.metaId = nid; }
      } else if (g) {
        // si ya tenía plata ahorrada, la meta queda como meta común (no se pierde)
        if (g.saved > 0) { delete g.tipo; delete g.proyectoId; } else s.goals = s.goals.filter((x) => x.id !== g.id);
        delete p.metaId;
      }
    });
    abierto = id; closeModal(); toast(d.id ? 'Proyecto guardado' : d.ahorrar ? 'Proyecto creado: pasale plata desde Mi plata → Ahorros' : 'Proyecto creado: asignale gastos al cargarlos');
    if (location.hash === '#/proyectos') ctx.render(); else ctx.go('proyectos');
  },
  borrarProyecto(ctx, el) {
    const id = el.dataset.id; closeModal(); abierto = null;
    borrarConDeshacer(ctx, 'Proyecto borrado', (s) => {
      const p = (s.proyectos || []).find((x) => x.id === id);
      const g = p && p.metaId && (s.goals || []).find((x) => x.id === p.metaId);
      // lo ahorrado no se pierde: queda como meta común
      if (g) { if (g.saved > 0) { delete g.tipo; delete g.proyectoId; } else s.goals = s.goals.filter((x) => x.id !== g.id); }
      s.proyectos = (s.proyectos || []).filter((x) => x.id !== id);
      for (const x of [...s.expenses, ...s.incomes]) if (x.proyectoId === id) delete x.proyectoId;
    });
    ctx.go('ahorro');
  },
  proyContar(ctx, el) {
    const n = conDeTexto(el.value).length; const h = el.closest('.field').querySelector('[data-proy-n]');
    if (h) h.textContent = n ? `Entre ${n + 1} personas (vos y ${n})` : 'Separá los nombres con coma. Se divide en partes iguales y te digo cuánto puso cada uno.';
  },
  nuevoAporte(ctx, el) { const p = proyectoDe(ctx.state, el.dataset.id); if (p) openModal('Aporte', aporteForm(p)); },
  editarAporte(ctx, el) { const p = proyectoDe(ctx.state, el.dataset.id); const a = p && (p.aportes || []).find((x) => x.id === el.dataset.a); if (a) openModal('Aporte', aporteForm(p, a)); },
  guardarAporte(ctx, d) {
    const monto = Math.round(num(d.monto) * 100) / 100; if (!(monto > 0)) { toast('Poné el monto'); return; }
    ctx.commit((s) => {
      const p = proyectoDe(s, d.id); if (!p) return;
      p.aportes = p.aportes || [];
      const datos = { quien: d.quien, monto, fecha: d.fecha || todayISO(), nota: String(d.nota || '').trim().slice(0, 40), aMi: d.aMi === '1' };
      const a = p.aportes.find((x) => x.id === d.a);
      if (a) Object.assign(a, datos); else p.aportes.push({ id: uid(), ...datos });
    });
    closeModal(); toast(`Aporte de ${d.quien} guardado`);
  },
  borrarAporte(ctx, el) {
    ctx.commit((s) => { const p = proyectoDe(s, el.dataset.id); if (p) p.aportes = (p.aportes || []).filter((x) => x.id !== el.dataset.a); });
    closeModal(); toast('Aporte borrado');
  },
  aportesADeudas(ctx, el) {
    const p = proyectoDe(ctx.state, el.dataset.id); const c = p && cuentasProyecto(ctx.state, p); if (!c) return;
    let n = 0;
    ctx.commit((s) => {
      s.deudas = s.deudas || [];
      for (const x of c.personas.slice(1)) {
        const debe = Math.round(-x.saldo * 100) / 100; if (debe < 1) continue;
        const origen = `proy:${p.id}:${x.quien}`;
        const prev = s.deudas.find((dd) => dd.origen === origen);
        const datos = { tipo: 'meDeben', persona: x.quien, monto: debe, date: todayISO(), nota: `Proyecto ${p.nombre}`, origen };
        if (prev) Object.assign(prev, datos); else s.deudas.push({ id: uid(), pagos: [], ...datos });
        n++;
      }
    });
    toast(n ? `Listo: lo anoté en Deudas (${n} persona${n === 1 ? '' : 's'})` : 'Nadie te debe en este proyecto');
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
