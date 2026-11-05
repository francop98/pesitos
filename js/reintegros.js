// =========================================================
// Pesitos — reintegros y cashback.
// Cuando anotás un gasto, busco si te corresponde un reintegro (promos de tus
// bancos y billeteras, o los cashback que cargaste vos), cuánto (con el tope) y
// cuándo te lo devuelven. Ese día se suma solo al saldo de tu cuenta (o baja el
// resumen de la tarjeta) y a "Te ahorraste".
//
// e.reintegro = { monto, fecha, wallet, nombre, pct, key, cuenta?, cardId?, no? }
// s.misBeneficios = [{ id, wallet, nombre, pct, cap, capPeriodo, dias: [], categoria, comercio }]
// s.acreditacion = { [wallet]: { tipo: 'momento'|'dias'|'semanal'|'mensual'|'resumen', n, dia } }
// =========================================================

import { normalize, toISO, parseISO, addDays, todayISO, money } from './formato.js';
import { currentPromos } from './economista.js';
import { walletName, allWallets, catReal } from './categorias.js';
import { statementOf, statementDates } from './agenda.js';

const share = (e) => (e.installments > 1 ? e.amount / e.installments : e.amount);
const GENERICO = /supermercado|farmacia|librer|rubro|todos los|gastronom|combustible|estaciones de servicio|tiendas adheridas|locales adheridos|comercios adheridos/;
const CERCANIA = /cercan|barrio|de proximidad/;

// ---------- de qué billetera es un gasto ----------
export function walletDeGasto(s, e) {
  if (e.cardId) {
    const c = (s.cards || []).find((x) => x.id === e.cardId);
    return c ? { wallets: [c.banco, c.marca, `card:${c.id}`].filter(Boolean), cardId: c.id, nombre: `Tarjeta ${c.name}` } : null;
  }
  const id = e.accountId || s.cuentaPrincipal;
  if (!id || id === 'efectivo') return null;
  return { wallets: [id], cuenta: id, nombre: walletName(id) };
}

// ---------- cuándo devuelve cada billetera ----------
export const TIPOS_ACREDITA = [
  ['momento', 'En el momento'],
  ['dias', 'A los X días'],
  ['semanal', 'Una vez por semana'],
  ['mensual', 'Una vez por mes'],
  ['resumen', 'En el resumen de la tarjeta'],
];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export { DIAS_SEMANA };
export function reglaAcredita(s, wallet, esTarjeta) {
  const r = (s.acreditacion || {})[wallet];
  if (r) return r;
  if (esTarjeta) return { tipo: 'resumen' };
  if (wallet === 'cuentadni') return { tipo: 'semanal', dia: 1 };
  return { tipo: 'dias', n: 7 };
}
export function textoAcredita(r) {
  if (r.tipo === 'momento') return 'en el momento';
  if (r.tipo === 'dias') return `a los ${r.n || 7} días`;
  if (r.tipo === 'semanal') return `la semana siguiente, el ${DIAS_SEMANA[r.dia ?? 1]}`;
  if (r.tipo === 'mensual') return `el ${r.dia || 10} del mes siguiente`;
  return 'en el resumen de la tarjeta';
}
function fechaAcredita(s, fechaGasto, wallet, ctx) {
  const r = reglaAcredita(s, ctx.cardId ? `card:${ctx.cardId}` : wallet, !!ctx.cardId);
  const d = parseISO(fechaGasto);
  if (r.tipo === 'momento') return fechaGasto;
  if (r.tipo === 'dias') return toISO(addDays(d, Number(r.n) || 7));
  if (r.tipo === 'semanal') {
    const lunesProx = addDays(d, ((8 - d.getDay()) % 7) || 7); // lunes de la semana siguiente
    return toISO(addDays(lunesProx, ((Number(r.dia ?? 1) + 6) % 7)));
  }
  if (r.tipo === 'mensual') { const x = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(28, Number(r.dia) || 10)); return toISO(x); }
  // resumen: el cierre del resumen donde cae la compra
  const card = (s.cards || []).find((c) => c.id === ctx.cardId);
  if (card) return toISO(statementDates(card, statementOf(card, fechaGasto)).close);
  return toISO(addDays(d, 30));
}

// ---------- reglas que aplican ----------
function reglas(s) {
  const out = [];
  for (const p of currentPromos(s).items || []) {
    out.push({ key: `p:${p.wallet}:${normalize(p.merchant || '').slice(0, 30)}:${p.pct}`, wallet: p.wallet, nombre: p.wallet === 'todos' ? 'Cualquier medio' : (p.walletName || walletName(p.wallet)), pct: Number(p.pct) || 0, cap: Number(p.cap) || 0, capPeriodo: p.capPeriod || 'semana', dias: p.days || [], categoria: catReal(p.category || ''), comercio: p.merchant || '', minimo: p.minPurchase || 0, cond: p.cond || '', origen: 'promo' });
  }
  for (const b of s.misBeneficios || []) {
    out.push({ key: `b:${b.id}`, wallet: b.wallet, nombre: b.nombre || walletName(b.wallet), pct: Number(b.pct) || 0, cap: Number(b.cap) || 0, capPeriodo: b.capPeriodo || 'mes', dias: b.dias && b.dias.length ? b.dias : [0, 1, 2, 3, 4, 5, 6], categoria: b.categoria || '', comercio: b.comercio || '', minimo: 0, cond: b.cond || '', origen: 'mio' });
  }
  return out;
}

// ¿la regla vale para este texto/categoría? (sin mirar el día)
function coincide(r, texto, categoria) {
  const t = ' ' + normalize(texto || '').replace(/[^a-z0-9]+/g, ' ') + ' ';
  const marcas = String(r.comercio || '').split(/[,/]| y /).map((x) => normalize(x).replace(/[^a-z0-9]+/g, ' ').trim()).filter((x) => x.length >= 3);
  if (CERCANIA.test(normalize(r.comercio || ''))) return false; // comercios de barrio: no los puedo distinguir de una cadena
  const generica = !marcas.length || GENERICO.test(normalize(r.comercio || ''));
  if (marcas.some((m) => !GENERICO.test(m) && t.includes(' ' + m.split(' ')[0] + ' '))) return true;
  if (generica && r.categoria && categoria && r.categoria === catReal(categoria)) return true;
  return r.origen === 'mio' && !r.categoria && !r.comercio; // cashback en todo
}

// rango del período del tope
function periodo(fecha, p) {
  const d = parseISO(fecha);
  if (p === 'mes') return fecha.slice(0, 7);
  if (p === 'compra') return null;
  const lunes = addDays(d, -((d.getDay() + 6) % 7));
  return `s${toISO(lunes)}`;
}
function periodoDe(fecha, p) { return p === 'mes' ? fecha.slice(0, 7) : periodo(fecha, p); }

/** Calcula el reintegro de un gasto (o null). */
export function detectarReintegro(s, e) {
  if (!e || e.pending || !e.amount || e.fromPayment) return null;
  const w = walletDeGasto(s, e); if (!w) return null;
  const dia = parseISO(e.date).getDay();
  const monto = share(e) === e.amount ? e.amount : e.amount; // el reintegro va sobre el total de la compra
  let mejor = null;
  const todas = reglas(s);
  // si hay una promo específica del comercio en esa billetera, las genéricas del rubro no aplican
  const especificas = new Set(todas.filter((r) => r.comercio && !GENERICO.test(normalize(r.comercio)) && coincide(r, e.note, '')).map((r) => r.wallet));
  for (const r of todas) {
    if (!(w.wallets.includes(r.wallet) || r.wallet === 'todos')) continue;
    if (especificas.has(r.wallet) && !(r.comercio && !GENERICO.test(normalize(r.comercio)) && coincide(r, e.note, ''))) continue;
    if (!r.dias.includes(dia)) continue;
    if (r.minimo && monto < r.minimo) continue;
    if (!coincide(r, e.note, e.category)) continue;
    let v = monto * r.pct / 100;
    if (r.cap) {
      const per = periodoDe(e.date, r.capPeriodo);
      const usado = per ? (s.expenses || []).filter((x) => x.id !== e.id && x.reintegro && !x.reintegro.no && x.reintegro.key === r.key && periodoDe(x.date, r.capPeriodo) === per).reduce((a, x) => a + x.reintegro.monto, 0) : 0;
      v = Math.max(0, Math.min(v, r.cap - usado));
    }
    v = Math.round(v);
    if (v > 0 && (!mejor || v > mejor.monto)) mejor = { monto: v, pct: r.pct, key: r.key, wallet: r.wallet === 'todos' ? w.wallets[0] : r.wallet, nombre: r.nombre, origen: r.origen };
  }
  if (!mejor) return null;
  const fecha = fechaAcredita(s, e.date, mejor.wallet, w);
  return { ...mejor, fecha, ...(w.cuenta ? { cuenta: w.cuenta } : {}), ...(w.cardId ? { cardId: w.cardId } : {}) };
}

// ---------- lo cobrado y lo que falta ----------
const vivos = (s) => (s.expenses || []).filter((e) => e.reintegro && !e.reintegro.no && e.reintegro.monto > 0);
export const reintegrosCobrados = (s, desde = '0000-00-00', hasta = todayISO()) => vivos(s).filter((e) => e.reintegro.fecha > desde && e.reintegro.fecha <= hasta);
export const reintegrosPendientes = (s) => vivos(s).filter((e) => e.reintegro.fecha > todayISO());
export const totalReintegros = (lista) => lista.reduce((a, e) => a + e.reintegro.monto, 0);
export const reintegrosDelMes = (s, mk) => totalReintegros(vivos(s).filter((e) => e.reintegro.fecha.slice(0, 7) === mk && e.reintegro.fecha <= todayISO()));
/** Para la cuenta: reintegros acreditados en esa cuenta entre dos fechas. */
export const reintegrosDeCuenta = (s, id, desde, hasta) => reintegrosCobrados(s, desde, hasta).filter((e) => e.reintegro.cuenta === id);
/** Para la tarjeta: lo que baja el resumen de ese mes. */
export function reintegrosDeResumen(s, card, mk) {
  return totalReintegros(vivos(s).filter((e) => e.reintegro.cardId === card.id && statementOf(card, e.reintegro.fecha) === mk));
}

// ---------- ¿con qué conviene pagar? ----------
/** Opciones para pagar algo: [{ wallet, nombre, tuyo, pct, cap, ahorro, dias, cond, origen }] */
export function conQuePagar(s, { texto, categoria, monto }) {
  const mias = new Set([...(s.wallets || []), ...(s.cards || []).flatMap((c) => [c.banco, c.marca]).filter(Boolean)]);
  const porWallet = new Map();
  for (const r of reglas(s)) {
    if (!coincide(r, texto, categoria)) continue;
    const v = Math.round(Math.min(monto * r.pct / 100, r.cap || Infinity));
    if (r.minimo && monto < r.minimo) continue;
    const tuyo = r.wallet === 'todos' || mias.has(r.wallet);
    const k = r.wallet;
    const prev = porWallet.get(k);
    if (!prev || v > prev.ahorro) porWallet.set(k, { wallet: r.wallet, nombre: r.nombre, tuyo, pct: r.pct, cap: r.cap, capPeriodo: r.capPeriodo, ahorro: v, dias: r.dias, cond: r.cond, comercio: r.comercio, origen: r.origen });
  }
  return [...porWallet.values()].filter((x) => x.ahorro > 0).sort((a, b) => b.ahorro - a.ahorro || b.tuyo - a.tuyo);
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const diasTxt = (d) => (!d || d.length === 7 ? 'todos los días' : d.length === 2 && d.includes(0) && d.includes(6) ? 'los fines de semana' : d.map((x) => DIAS_CORTOS[x]).join(', '));
export const capTxt = (o) => (o.cap ? `tope ${money(o.cap)}${o.capPeriodo === 'semana' ? ' por semana' : o.capPeriodo === 'mes' ? ' por mes' : ''}` : 'sin tope');
export const nombreMedio = (id) => (allWallets().find((w) => w.id === id) || {}).name || id;

// =========================================================
// Pantalla: #/reintegros
// =========================================================
import { esc, num } from './formato.js';
import { icon, screenHead, openModal, closeModal, toast, setModalBody, catIcon } from './interfaz.js';
import { allCategories, catLabel, catById } from './categorias.js';
import { uid } from './almacenamiento.js';
import { merchantKey, guessCategory } from './interprete.js';

const fecha = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
// medios del usuario a los que se les puede configurar la acreditación
function misMedios(s) {
  const out = [];
  for (const w of allWallets()) if ((s.wallets || []).includes(w.id) && w.kind !== 'Tarjetas') out.push({ id: w.id, nombre: w.name, tarjeta: false });
  for (const c of s.cards || []) out.push({ id: `card:${c.id}`, nombre: `Tarjeta ${c.name}`, tarjeta: true });
  return out;
}

export function render(s) {
  const pend = reintegrosPendientes(s);
  const hoy = todayISO(); const mk = hoy.slice(0, 7);
  const cob = reintegrosCobrados(s, toISO(addDays(new Date(), -45)), hoy);
  const fila = (e) => `<button class="row" data-action="openEntry" data-id="${esc(e.id)}" data-kind="expense">
      <span class="cat-icon">${catIcon(catById(e.category), 18)}</span>
      <span class="grow"><span class="name">${esc(e.note)}</span><span class="meta">${esc(e.reintegro.nombre)}${e.reintegro.pct ? ` ${e.reintegro.pct}%` : ''} · compra del ${fecha(e.date)} · ${e.reintegro.fecha > hoy ? `llega el ${fecha(e.reintegro.fecha)}` : `llegó el ${fecha(e.reintegro.fecha)}`}</span></span>
      <span class="amount pos">+${money(e.reintegro.monto)}</span></button>`;
  return `<section class="screen">
    ${screenHead('Reintegros y cashback', '<button class="btn small" data-action="nuevoBeneficio">+ Cashback</button>', 'Lo que te devuelven por tus compras')}
    <div class="stat-grid">
      <div class="stat"><span class="k">Por cobrar</span><span class="v">${money(totalReintegros(pend))}</span><span class="small muted">${pend.length} compra${pend.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="k">Cobrado este mes</span><span class="v pos">${money(reintegrosDelMes(s, mk))}</span><span class="small muted">ya sumado a tu saldo</span></div>
    </div>
    <div class="section-title"><span>Por cobrar</span></div>
    ${pend.length ? `<div class="card tight">${pend.sort((a, b) => a.reintegro.fecha.localeCompare(b.reintegro.fecha)).map(fila).join('')}</div>`
      : '<p class="empty">Nada pendiente. Cuando anotes una compra con un medio que tiene promo o cashback, lo calculo solo.</p>'}
    <button class="btn block" data-action="openConQuePagar">${icon('ticket', 18)} ¿Con qué conviene pagar?</button>
    <div class="section-title"><span>Tus cashback y beneficios propios</span><button data-action="nuevoBeneficio">+ Agregar</button></div>
    ${(s.misBeneficios || []).length ? `<div class="card tight">${s.misBeneficios.map((b) => `<button class="row" data-action="editarBeneficio" data-id="${esc(b.id)}">
        <span class="grow"><span class="name">${esc(b.nombre || nombreMedio(b.wallet))} · ${b.pct}%</span><span class="meta">${b.comercio ? esc(b.comercio) : b.categoria ? esc(catLabel(b.categoria)) : 'En todas tus compras'} · ${diasTxt(b.dias)} · ${capTxt(b)}</span></span>
        ${icon('chevron', 16)}</button>`).join('')}</div>`
      : '<p class="small muted" style="margin:0">Las promos de bancos y billeteras las traigo solas. Acá cargás las que no aparecen: por ejemplo, el cashback de una billetera (Claro Pay, Personal Pay…) o un reintegro de tu banco.</p>'}
    <div class="section-title"><span>Cuándo te devuelve cada uno</span></div>
    <div class="card tight">${misMedios(s).map((m) => { const r = reglaAcredita(s, m.id, m.tarjeta); return `<button class="row" data-action="editarAcredita" data-id="${esc(m.id)}">
        <span class="grow"><span class="name">${esc(m.nombre)}</span><span class="meta">${textoAcredita(r)}</span></span>${icon('chevron', 16)}</button>`; }).join('') || '<p class="empty">Cargá tus bancos y billeteras en Menú → Mis medios de pago.</p>'}</div>
    ${cob.length ? `<details class="card"><summary><strong>Cobrados (últimos 45 días)</strong> · ${money(totalReintegros(cob))}</summary><div class="card tight" style="margin-top:8px">${cob.map(fila).join('')}</div></details>` : ''}
    <p class="small muted" style="margin:0">El día que llega cada reintegro se suma solo a tu saldo (o baja el resumen si pagaste con tarjeta), a "Hoy podés gastar" y a "Te ahorraste". Si no te llegó, abrí la compra y corregilo.</p>
  </section>`;
}

function beneficioForm(s, b = {}) {
  const medios = misMedios(s);
  const dias = b.dias && b.dias.length ? b.dias : [0, 1, 2, 3, 4, 5, 6];
  return `<form class="form" data-submit="guardarBeneficio">
    <input type="hidden" name="id" value="${esc(b.id || '')}">
    <div class="field"><label for="bf-w">Con qué medio</label><select id="bf-w" name="wallet" required>${medios.map((m) => `<option value="${esc(m.id)}" ${m.id === b.wallet ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}
      <optgroup label="Otros (no los tenés cargados)">${allWallets().filter((w) => !medios.some((m) => m.id === w.id)).map((w) => `<option value="${esc(w.id)}" ${w.id === b.wallet ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</optgroup></select></div>
    <div class="field"><label for="bf-n">Nombre (opcional)</label><input id="bf-n" name="nombre" value="${esc(b.nombre || '')}" placeholder="Ej: Cashback pagando servicios" maxlength="40"></div>
    <div class="field-row">
      <div class="field"><label for="bf-p">Te devuelven (%)</label><input id="bf-p" name="pct" inputmode="decimal" value="${b.pct || ''}" placeholder="Ej: 10" required></div>
      <div class="field"><label for="bf-c">Tope (opcional)</label><input id="bf-c" name="cap" inputmode="decimal" value="${b.cap || ''}" placeholder="Sin tope"></div>
    </div>
    <div class="field"><label for="bf-cp">El tope es</label><select id="bf-cp" name="capPeriodo">${[['mes', 'Por mes'], ['semana', 'Por semana'], ['compra', 'Por compra']].map(([v, l]) => `<option value="${v}" ${(b.capPeriodo || 'mes') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><span class="label-like">Días</span><div class="chips dias-chips">${DIAS_SEMANA.map((d, i) => `<label class="chip toggle"><input type="checkbox" name="d${i}" ${dias.includes(i) ? 'checked' : ''}> ${d.slice(0, 3)}</label>`).join('')}</div></div>
    <div class="field-row">
      <div class="field"><label for="bf-cat">En qué (opcional)</label><select id="bf-cat" name="categoria"><option value="">Todas las compras</option>${allCategories().map((c) => `<option value="${c.id}" ${c.id === b.categoria ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="bf-co">Comercio (opcional)</label><input id="bf-co" name="comercio" value="${esc(b.comercio || '')}" placeholder="Ej: Claro"></div>
    </div>
    <span class="hint">Si ponés un comercio, solo cuenta cuando la compra lo menciona (por ejemplo "Claro 25.000").</span>
    <button class="btn primary block" type="submit">Guardar</button>
    ${b.id ? `<button class="btn ghost block" type="button" data-action="borrarBeneficio" data-id="${esc(b.id)}">Borrar</button>` : ''}
  </form>`;
}

function acreditaForm(s, id) {
  const tarjeta = id.startsWith('card:');
  const r = reglaAcredita(s, id, tarjeta);
  const nombre = (misMedios(s).find((m) => m.id === id) || {}).nombre || id;
  return `<form class="form" data-submit="guardarAcredita">
    <input type="hidden" name="id" value="${esc(id)}">
    <p class="text muted" style="margin:0">¿Cuándo te devuelve ${esc(nombre)} los reintegros y el cashback? Así sé qué día sumarlos a tu saldo.</p>
    <div class="field"><label for="ac-t">Se acreditan</label><select id="ac-t" name="tipo" data-change="acreditaTipo">${TIPOS_ACREDITA.filter(([v]) => tarjeta || v !== 'resumen').map(([v, l]) => `<option value="${v}" ${r.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field" data-ac="dias" ${r.tipo === 'dias' ? '' : 'hidden'}><label for="ac-n">¿A los cuántos días?</label><input id="ac-n" name="n" type="number" min="1" max="90" value="${r.n || 7}"></div>
    <div class="field" data-ac="semanal" ${r.tipo === 'semanal' ? '' : 'hidden'}><label for="ac-d">¿Qué día?</label><select id="ac-d" name="dia">${DIAS_SEMANA.map((d, i) => `<option value="${i}" ${Number(r.dia ?? 1) === i ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="hint">Lo de una semana (de lunes a domingo) llega ese día de la semana siguiente.</span></div>
    <div class="field" data-ac="mensual" ${r.tipo === 'mensual' ? '' : 'hidden'}><label for="ac-m">¿Qué día del mes siguiente?</label><input id="ac-m" name="diaMes" type="number" min="1" max="28" value="${r.tipo === 'mensual' ? r.dia || 10 : 10}"></div>
    <button class="btn primary block" type="submit">Guardar</button>
  </form>`;
}

// ---------- ¿Con qué conviene pagar? ----------
function aPagar(s) {
  const out = [];
  for (const f of s.fixed || []) if (f.amount) out.push({ texto: f.name, categoria: guessCategory(f.name, s.learned), monto: f.amount, tipo: 'Gasto fijo' });
  for (const b of s.bills || []) if (b.amount) out.push({ texto: b.name, categoria: b.category, monto: b.amount, tipo: 'Pago' });
  // lo que más comprás (últimos 60 días)
  const desde = toISO(addDays(new Date(), -60)); const g = {};
  for (const e of s.expenses || []) {
    if (e.pending || e.date < desde) continue;
    const k = merchantKey(e.note || ''); if (!k) continue;
    const x = g[k] = g[k] || { texto: e.note, categoria: e.category, total: 0, n: 0 }; x.total += e.amount; x.n++;
  }
  for (const x of Object.values(g).sort((a, b) => b.total - a.total).slice(0, 8)) out.push({ texto: x.texto, categoria: x.categoria, monto: Math.round(x.total / x.n), tipo: `${x.n} ${x.n === 1 ? 'compra' : 'compras'}` });
  return out;
}
function opcionHtml(o, monto) {
  return `<div class="cqp-op ${o.tuyo ? 'tuyo' : ''}"><span class="grow"><b>${esc(o.nombre)}</b>${o.tuyo ? '' : ' <span class="pill">No lo tenés</span>'}<span class="small muted">${o.pct}% · ${diasTxt(o.dias)} · ${capTxt(o)}${o.cond ? ` · ${esc(o.cond.slice(0, 90))}` : ''}</span></span>
    <b class="pos">−${money(o.ahorro)}</b></div>`;
}
function cqpResultados(s, item) {
  const ops = conQuePagar(s, item);
  if (!ops.length) return '<p class="small muted" style="margin:0">No encontré promos ni cashback para esto. Si tu billetera tiene uno, cargalo en Reintegros → + Cashback.</p>';
  const tuyas = ops.filter((o) => o.tuyo).slice(0, 2); const otras = ops.filter((o) => !o.tuyo).slice(0, 2);
  return `${tuyas.map((o) => opcionHtml(o, item.monto)).join('')}${otras.length && (!tuyas.length || otras[0].ahorro > tuyas[0].ahorro) ? otras.map((o) => opcionHtml(o, item.monto)).join('') : ''}`;
}
export function mejorConTusMedios(s, item) {
  const o = conQuePagar(s, item).find((x) => x.tuyo);
  return o && o.ahorro > 0 ? o : null;
}
function cqpBody(s, q = '', m = 0) {
  const lista = aPagar(s);
  return `<div class="card"><div class="field"><label for="cqp-q">¿Qué vas a pagar?</label><input id="cqp-q" value="${esc(q)}" placeholder="Ej: Claro, Coto, nafta" data-input="cqpBuscar" autocomplete="off"></div>
      <div class="field"><label for="cqp-m">¿Cuánto?</label><input id="cqp-m" inputmode="decimal" value="${m || ''}" placeholder="Ej: 30.000" data-input="cqpBuscar"></div>
      <div data-cqp-res>${q && m ? cqpResultados(s, { texto: q, categoria: guessCategory(q, s.learned), monto: m }) : '<span class="small muted">Escribí el comercio o servicio y el monto.</span>'}</div></div>
    ${lista.length ? `<div class="section-title"><span>Tus pagos y compras de siempre</span></div>
    ${lista.map((it) => `<div class="card cqp"><div class="split"><strong>${esc(it.texto)}</strong><span class="small muted">${esc(it.tipo)} · ${money(it.monto)}</span></div>${cqpResultados(s, it)}</div>`).join('')}` : ''}
    <p class="small muted" style="margin:0">Uso las promos vigentes de bancos y billeteras (se actualizan solas todos los días) y los cashback que cargaste vos. Revisá las condiciones antes de pagar.</p>`;
}

export const actions = {
  openConQuePagar(ctx) { openModal('¿Con qué conviene pagar?', cqpBody(ctx.state)); },
  cqpBuscar(ctx) {
    const q = document.getElementById('cqp-q')?.value.trim() || ''; const m = num(document.getElementById('cqp-m')?.value);
    const r = document.querySelector('[data-cqp-res]'); if (!r) return;
    r.innerHTML = q && m ? cqpResultados(ctx.state, { texto: q, categoria: guessCategory(q, ctx.state.learned), monto: m }) : '<span class="small muted">Escribí el comercio o servicio y el monto.</span>';
  },
  nuevoBeneficio(ctx) { openModal('Cashback o reintegro', beneficioForm(ctx.state), { push: true }); },
  editarBeneficio(ctx, el) { const b = (ctx.state.misBeneficios || []).find((x) => x.id === el.dataset.id); if (b) openModal('Cashback o reintegro', beneficioForm(ctx.state, b)); },
  guardarBeneficio(ctx, d) {
    const pct = parseFloat(String(d.pct || '').replace(',', '.')) || 0;
    if (!pct || pct > 100) { toast('Poné el % que te devuelven'); return; }
    const dias = [0, 1, 2, 3, 4, 5, 6].filter((i) => d[`d${i}`]);
    const datos = { wallet: d.wallet, nombre: String(d.nombre || '').trim().slice(0, 40), pct, cap: num(d.cap), capPeriodo: d.capPeriodo || 'mes', dias: dias.length ? dias : [0, 1, 2, 3, 4, 5, 6], categoria: d.categoria || '', comercio: String(d.comercio || '').trim().slice(0, 40) };
    ctx.commit((s) => {
      s.misBeneficios = s.misBeneficios || [];
      const b = s.misBeneficios.find((x) => x.id === d.id);
      if (b) Object.assign(b, datos); else s.misBeneficios.push({ id: uid(), ...datos });
    });
    closeModal(); toast('Guardado. Lo voy a usar al anotar tus compras');
  },
  borrarBeneficio(ctx, el) { ctx.commit((s) => { s.misBeneficios = (s.misBeneficios || []).filter((x) => x.id !== el.dataset.id); }); closeModal(); toast('Borrado'); },
  editarAcredita(ctx, el) { openModal('Cuándo se acredita', acreditaForm(ctx.state, el.dataset.id)); },
  acreditaTipo(ctx, el) { el.closest('form').querySelectorAll('[data-ac]').forEach((n) => { n.hidden = n.dataset.ac !== el.value; }); },
  guardarAcredita(ctx, d) {
    const r = { tipo: d.tipo };
    if (d.tipo === 'dias') r.n = Math.max(1, Math.min(90, parseInt(d.n, 10) || 7));
    if (d.tipo === 'semanal') r.dia = Number(d.dia);
    if (d.tipo === 'mensual') r.dia = Math.max(1, Math.min(28, parseInt(d.diaMes, 10) || 10));
    ctx.commit((s) => {
      s.acreditacion = { ...(s.acreditacion || {}), [d.id]: r };
      // recalculo la fecha de los reintegros que todavía no llegaron
      for (const e of s.expenses || []) {
        const x = e.reintegro; if (!x || x.no || x.manual || x.fecha <= todayISO()) continue;
        const id = x.cardId ? `card:${x.cardId}` : x.wallet;
        if (id !== d.id && x.wallet !== d.id) continue;
        const nuevo = detectarReintegro(s, e); if (nuevo) e.reintegro = nuevo;
      }
    });
    closeModal(); toast('Listo');
  },
};
