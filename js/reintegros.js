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
import { pesosABase } from './cotizaciones.js';

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
    out.push({ key: `p:${p.wallet}:${normalize(p.merchant || '').slice(0, 30)}:${p.pct}`, wallet: p.wallet, nombre: p.wallet === 'todos' ? 'Cualquier medio' : (p.walletName || walletName(p.wallet)), pct: Number(p.pct) || 0, cap: pesosABase(s, Number(p.cap) || 0), capPeriodo: p.capPeriod || 'semana', dias: p.days || [], categoria: catReal(p.category || ''), comercio: p.merchant || '', minimo: pesosABase(s, p.minPurchase || 0), cond: p.cond || '', origen: 'promo', ...(p.capUnknown && !p.cap ? { capDudoso: true } : {}), ...(p.verified ? { verificado: p.verified } : {}), validTo: p.validTo || '' });
  }
  // topes que aprendí de lo que de verdad te devolvieron
  const ap = s.topesAprendidos || {};
  for (const r of out) {
    const t = ap[r.key]; if (!t || !(t.cap > 0)) continue;
    if (!r.cap || t.cap < r.cap) { r.cap = t.cap; r.capPeriodo = t.periodo || r.capPeriodo; r.capAprendido = true; delete r.capDudoso; }
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
  // una transferencia no entra en las promos (casi todas piden pagar con QR o con la tarjeta)
  if (/\btransf/i.test(normalize(e.note || ''))) return null;
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
    v = Math.round(v * 100) / 100; // centavos: en dólares importan
    if (v > 0 && (!mejor || v > mejor.monto)) mejor = { monto: v, pct: r.pct, key: r.key, wallet: r.wallet === 'todos' ? w.wallets[0] : r.wallet, nombre: r.nombre, origen: r.origen, ...(r.capDudoso ? { aprox: true } : {}) };
  }
  if (!mejor) return null;
  const fecha = fechaAcredita(s, e.date, mejor.wallet, w);
  return { ...mejor, fecha, ...(w.cuenta ? { cuenta: w.cuenta } : {}), ...(w.cardId ? { cardId: w.cardId } : {}) };
}

// ---------- lo cobrado y lo que falta ----------
const vivos = (s) => (s.expenses || []).filter((e) => e.reintegro && !e.reintegro.no && e.reintegro.monto > 0);
// Un reintegro cuenta en tu saldo recién cuando confirmás que llegó (r.ok).
// Hasta entonces es "por cobrar" (antes de la fecha) o "a confirmar" (ya pasó la fecha).
const confirmados = (s) => vivos(s).filter((e) => e.reintegro.ok);
export const reintegrosCobrados = (s, desde = '0000-00-00', hasta = todayISO()) => confirmados(s).filter((e) => e.reintegro.fecha > desde && e.reintegro.fecha <= hasta);
export const reintegrosPendientes = (s) => vivos(s).filter((e) => !e.reintegro.ok && e.reintegro.fecha > todayISO());
export const reintegrosPorConfirmar = (s) => vivos(s).filter((e) => !e.reintegro.ok && e.reintegro.fecha <= todayISO());
export const totalReintegros = (lista) => lista.reduce((a, e) => a + e.reintegro.monto, 0);
export const reintegrosDelMes = (s, mk) => totalReintegros(confirmados(s).filter((e) => e.reintegro.fecha.slice(0, 7) === mk && e.reintegro.fecha <= todayISO()));
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
    const v = monto ? Math.round(Math.min(monto * r.pct / 100, r.cap || Infinity) * 100) / 100 : 0;
    if (monto && r.minimo && monto < r.minimo) continue;
    const tuyo = r.wallet === 'todos' || mias.has(r.wallet);
    const k = r.wallet;
    const prev = porWallet.get(k);
    if (!prev || v > prev.ahorro || (!monto && r.pct > prev.pct)) porWallet.set(k, { wallet: r.wallet, nombre: r.nombre, tuyo, pct: r.pct, cap: r.cap, capPeriodo: r.capPeriodo, capDudoso: r.capDudoso, ahorro: v, dias: r.dias, cond: r.cond, comercio: r.comercio, origen: r.origen });
  }
  return [...porWallet.values()].filter((x) => x.ahorro > 0 || !monto).sort((a, b) => b.ahorro - a.ahorro || b.pct - a.pct || b.tuyo - a.tuyo);
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const diasTxt = (d) => (!d || d.length === 7 ? 'todos los días' : d.length === 2 && d.includes(0) && d.includes(6) ? 'los fines de semana' : d.map((x) => DIAS_CORTOS[x]).join(', '));
export const capTxt = (o) => (o.cap ? `tope ${money(o.cap)}${o.capPeriodo === 'semana' ? ' por semana' : o.capPeriodo === 'mes' ? ' por mes' : ''}` : o.capDudoso ? 'tope sin confirmar' : 'sin tope');
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

// Tus descuentos vigentes, con su tope y cuánto te queda para usar en el período
const PER_TXT = { semana: 'esta semana', mes: 'este mes', compra: 'por compra' };
export function topesDeTusMedios(s) {
  const mias = new Set([...(s.wallets || []), ...(s.cards || []).flatMap((c) => [c.banco, c.marca]).filter(Boolean)]);
  const hoy = todayISO();
  const vistas = new Set();
  return reglas(s).filter((r) => mias.has(r.wallet) && r.pct > 0).map((r) => {
    const per = r.cap ? periodoDe(hoy, r.capPeriodo) : null;
    const usado = per ? vivos(s).filter((e) => e.reintegro.key === r.key && periodoDe(e.date, r.capPeriodo) === per).reduce((a, e) => a + e.reintegro.monto, 0) : 0;
    return { ...r, usado, queda: r.cap ? Math.max(0, r.cap - usado) : null };
  }).filter((r) => { const k = `${r.wallet}|${r.comercio}|${r.categoria}|${r.pct}|${(r.dias || []).join('')}`; if (vistas.has(k)) return false; vistas.add(k); return true; })
    .sort((a, b) => (b.usado > 0) - (a.usado > 0) || b.pct - a.pct);
}
function topesHtml(s) {
  const l = topesDeTusMedios(s);
  if (!l.length) return '';
  const fila = (r) => {
    const donde = r.comercio ? esc(r.comercio) : r.categoria ? esc(catLabel(r.categoria)) : 'En todas tus compras';
    const tope = r.cap ? `<span class="tope-barra" role="img" aria-label="Usaste ${money(r.usado)} de ${money(r.cap)}"><span style="width:${Math.min(100, Math.round((r.usado / r.cap) * 100))}%"></span></span>
      <span class="meta"><b>Te queda ${money(r.queda)}</b> de ${money(r.cap)} ${PER_TXT[r.capPeriodo] || ''}${r.usado ? ` (usaste ${money(r.usado)})` : ''}</span>` : `<span class="meta">${r.capDudoso ? '⚠️ Tope sin confirmar: el banco no lo publica' : 'Sin tope'}</span>`;
    const aprendidoTxt = r.capAprendido ? '<span class="meta">Tope aprendido de lo que te devolvieron</span>' : '';
    return `<div class="row tope-fila"><span class="grow"><span class="name">${esc(r.nombre)} · ${r.pct}% <span class="tope-donde">${donde}</span></span>${tope}${aprendidoTxt}</span></div>`;
  };
  const primeras = l.slice(0, 6); const resto = l.slice(6);
  return `<div class="section-title"><span>Tus descuentos y topes</span></div>
    <div class="card tight">${primeras.map(fila).join('')}</div>
    ${resto.length ? `<details class="card"><summary><strong>Ver ${resto.length} más</strong></summary><div class="card tight" style="margin-top:8px">${resto.map(fila).join('')}</div></details>` : ''}`;
}

function filaConfirmar(e) {
  const r = e.reintegro;
  return `<div class="row reint-conf"><span class="grow"><span class="name">${esc(e.note)} · ${money(r.monto)}${r.aprox ? ' (hasta)' : ''}</span>
      <span class="meta">${esc(r.nombre)}${r.pct ? ` ${r.pct}%` : ''} · ${r.cardId ? 'en el resumen de la tarjeta' : 'en tu cuenta'} · tenía que llegar el ${fecha(r.fecha)}</span>
      <span class="btn-row"><button class="btn small green" data-action="reintLlego" data-id="${esc(e.id)}">Llegó</button><button class="btn small" data-action="reintOtro" data-id="${esc(e.id)}">Otro monto</button><button class="btn small ghost" data-action="reintNoLlego" data-id="${esc(e.id)}">No llegó</button></span></span></div>`;
}

export function render(s) {
  const pend = reintegrosPendientes(s);
  const conf = reintegrosPorConfirmar(s);
  const hoy = todayISO(); const mk = hoy.slice(0, 7);
  const cob = reintegrosCobrados(s, toISO(addDays(new Date(), -45)), hoy);
  const fila = (e) => `<button class="row" data-action="openEntry" data-id="${esc(e.id)}" data-kind="expense">
      <span class="cat-icon">${catIcon(catById(e.category), 18)}</span>
      <span class="grow"><span class="name">${esc(e.note)}</span><span class="meta">${esc(e.reintegro.nombre)}${e.reintegro.pct ? ` ${e.reintegro.pct}%` : ''}${e.reintegro.aprox ? ' (tope sin confirmar)' : ''} · compra del ${fecha(e.date)} · ${e.reintegro.fecha > hoy ? `llega el ${fecha(e.reintegro.fecha)}` : `llegó el ${fecha(e.reintegro.fecha)}`}</span></span>
      <span class="amount pos">+${money(e.reintegro.monto)}</span></button>`;
  return `<section class="screen">
    ${screenHead('Reintegros y cashback', '<button class="btn small" data-action="nuevoBeneficio">+ Cashback</button>', 'Lo que te devuelven por tus compras')}
    <div class="stat-grid">
      <div class="stat"><span class="k">Por cobrar</span><span class="v">${money(totalReintegros(pend))}</span><span class="small muted">${pend.length} compra${pend.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="k">Cobrado este mes</span><span class="v pos">${money(reintegrosDelMes(s, mk))}</span><span class="small muted">confirmados</span></div>
    </div>
    ${conf.length ? `<div class="section-title"><span>¿Te llegaron? (${conf.length})</span></div>
    <p class="small muted" style="margin:0">Se suman a tu saldo recién cuando me confirmás que llegaron y por cuánto. Así tu saldo no se aleja del real.</p>
    <div class="card tight">${conf.sort((a, b) => a.reintegro.fecha.localeCompare(b.reintegro.fecha)).map(filaConfirmar).join('')}</div>` : ''}
    <div class="section-title"><span>Por cobrar</span></div>
    ${pend.length ? `<div class="card tight">${pend.sort((a, b) => a.reintegro.fecha.localeCompare(b.reintegro.fecha)).map(fila).join('')}</div>`
      : '<p class="empty">Nada pendiente. Cuando anotes una compra con un medio que tiene promo o cashback, lo calculo solo.</p>'}
    ${topesHtml(s)}
    <div class="section-title"><span>Tus cashback y beneficios propios</span><button data-action="nuevoBeneficio">+ Agregar</button></div>
    ${(s.misBeneficios || []).length ? `<div class="card tight">${s.misBeneficios.map((b) => `<button class="row" data-action="editarBeneficio" data-id="${esc(b.id)}">
        <span class="grow"><span class="name">${esc(b.nombre || nombreMedio(b.wallet))} · ${b.pct}%</span><span class="meta">${b.comercio ? esc(b.comercio) : b.categoria ? esc(catLabel(b.categoria)) : 'En todas tus compras'} · ${diasTxt(b.dias)} · ${capTxt(b)}</span></span>
        ${icon('chevron', 16)}</button>`).join('')}</div>`
      : '<p class="small muted" style="margin:0">Las promos de bancos y billeteras las traigo solas. Acá cargás las que no aparecen: por ejemplo, el cashback de una billetera (Claro Pay, Personal Pay…) o un reintegro de tu banco.</p>'}
    <div class="section-title"><span>Cuándo te devuelve cada uno</span></div>
    <p class="small muted" style="margin:0">Personalizá cuándo te devuelve cada uno: tocá el banco o la billetera y cambiá el día.</p>
    <div class="card tight">${misMedios(s).map((m) => { const r = reglaAcredita(s, m.id, m.tarjeta); return `<button class="row" data-action="editarAcredita" data-id="${esc(m.id)}">
        <span class="grow"><span class="name">${esc(m.nombre)}</span><span class="meta">${textoAcredita(r)}</span></span>${icon('chevron', 16)}</button>`; }).join('') || '<p class="empty">Cargá tus bancos y billeteras en Menú → Mis medios de pago.</p>'}</div>
    ${cob.length ? `<details class="card"><summary><strong>Cobrados (últimos 45 días)</strong> · ${money(totalReintegros(cob))}</summary><div class="card tight" style="margin-top:8px">${cob.map(fila).join('')}</div></details>` : ''}
    <p class="small muted" style="margin:0">Cuando llega la fecha te pregunto si te llegó y por cuánto. Recién ahí se suma a tu saldo (o baja el resumen si pagaste con tarjeta), a "Hoy podés gastar" y a "Te ahorraste". Así el saldo de Pesitos no se separa del de tu banco.</p>
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
    <div class="field" data-ac="dias" ${r.tipo === 'dias' ? '' : 'hidden'}><label for="ac-n">¿A los cuántos días?</label><input id="ac-n" name="n" type="number" min="1" max="90" value="${r.tipo === 'dias' && r.n ? r.n : ''}" placeholder="7"></div>
    <div class="field" data-ac="semanal" ${r.tipo === 'semanal' ? '' : 'hidden'}><label for="ac-d">¿Qué día?</label><select id="ac-d" name="dia">${DIAS_SEMANA.map((d, i) => `<option value="${i}" ${Number(r.dia ?? 1) === i ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="hint">Lo de una semana (de lunes a domingo) llega ese día de la semana siguiente.</span></div>
    <div class="field" data-ac="mensual" ${r.tipo === 'mensual' ? '' : 'hidden'}><label for="ac-m">¿Qué día del mes siguiente?</label><input id="ac-m" name="diaMes" type="number" min="1" max="28" value="${r.tipo === 'mensual' && r.dia ? r.dia : ''}" placeholder="10"></div>
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
  const hoy = (o.dias || []).includes(new Date().getDay());
  return `<div class="cqp-op ${o.tuyo ? 'tuyo' : ''}"><span class="grow"><span><b>${esc(o.nombre)}</b> · ${o.pct}%${o.tuyo ? '' : ' <span class="pill">No la tenés</span>'}${hoy ? ' <span class="chip-mini">Hoy</span>' : ''}</span><span class="small muted">${diasTxt(o.dias)} · ${capTxt(o)}${o.comercio ? ` · ${esc(o.comercio)}` : ''}${o.cond ? ` · ${esc(o.cond.slice(0, 90))}` : ''}</span></span>
    ${monto ? `<b class="pos">−${money(o.ahorro)}</b>` : ''}</div>`;
}
function cqpResultados(s, item, todo = false) {
  const ops = conQuePagar(s, item);
  if (!ops.length) return '<p class="small muted" style="margin:0">No encontré reintegros, cashback ni beneficios para esto en ningún banco o billetera. Si tenés uno que no aparece, cargalo en Reintegros → + Cashback.</p>';
  const tuyas = ops.filter((o) => o.tuyo); const otras = ops.filter((o) => !o.tuyo);
  if (!todo) return `${tuyas.slice(0, 2).map((o) => opcionHtml(o, item.monto)).join('')}${otras.length && (!tuyas.length || otras[0].ahorro > tuyas[0].ahorro) ? otras.slice(0, 1).map((o) => opcionHtml(o, item.monto)).join('') : ''}`;
  const mejorTuya = tuyas[0];
  const conviene = otras.filter((o) => !mejorTuya || (item.monto ? o.ahorro > mejorTuya.ahorro : o.pct > mejorTuya.pct));
  return `<span class="cqp-sub">Con lo que tenés</span>
    ${tuyas.length ? tuyas.slice(0, 5).map((o) => opcionHtml(o, item.monto)).join('') : '<p class="small muted" style="margin:0">Con tus bancos y billeteras no hay nada para esto.</p>'}
    ${conviene.length ? `<span class="cqp-sub">Con otra billetera o banco que no tenés</span>${conviene.slice(0, 4).map((o) => opcionHtml(o, item.monto)).join('')}
    <span class="small muted">Muchas billeteras (MODO, Mercado Pago, Ualá…) se abren gratis en minutos. Fijate si te conviene por lo que gastás.</span>` : ''}`;
}
export function mejorConTusMedios(s, item) {
  const o = conQuePagar(s, item).find((x) => x.tuyo);
  return o && o.ahorro > 0 ? o : null;
}
const cqpItem = (s, q, m) => ({ texto: q, categoria: guessCategory(q, s.learned), monto: m || 0 });
function cqpBody(s, q = '', m = 0) {
  const lista = aPagar(s);
  return `<div class="card"><div class="field"><label for="cqp-q">¿Qué vas a pagar?</label><input id="cqp-q" value="${esc(q)}" placeholder="Ej: Coto, nafta, farmacia, Claro" data-input="cqpBuscar" autocomplete="off" enterkeyhint="search"></div>
      <div class="field"><label for="cqp-m">¿Cuánto? <span class="muted">(opcional)</span></label><input id="cqp-m" inputmode="decimal" value="${m || ''}" placeholder="Para calcular cuánto te devuelven" data-input="cqpBuscar"></div>
      <div data-cqp-res>${q ? cqpResultados(s, cqpItem(s, q, m), true) : '<span class="small muted">Escribí el comercio, rubro o servicio y te busco reintegros, cashback y beneficios en tus bancos y billeteras, y en las que no tenés.</span>'}</div></div>
    ${lista.length ? `<details class="card"><summary><strong>Tus pagos y compras de siempre</strong></summary>
    ${lista.map((it) => `<div class="cqp" style="margin-top:10px"><div class="split"><strong>${esc(it.texto)}</strong><span class="small muted">${esc(it.tipo)} · ${money(it.monto)}</span></div>${cqpResultados(s, it)}</div>`).join('')}</details>` : ''}
    <p class="small muted" style="margin:0">Uso las promos vigentes de bancos y billeteras (se actualizan solas todos los días) y los cashback que cargaste vos. Revisá las condiciones antes de pagar.</p>`;
}

// ---------- confirmar que llegó ----------
const reintDe = (s, id) => (s.expenses || []).find((e) => e.id === id && e.reintegro);
export const confirmarActions = {
  reintLlego(ctx, el) {
    ctx.commit((s) => { const e = reintDe(s, el.dataset.id); if (e) { e.reintegro.ok = true; if (e.reintegro.fecha > todayISO()) e.reintegro.fecha = todayISO(); } });
    toast('Listo: lo sumé a tu saldo');
  },
  reintOtro(ctx, el) {
    const e = reintDe(ctx.state, el.dataset.id); if (!e) return;
    openModal('¿Cuánto te llegó?', `<form class="form" data-submit="reintOtroGuardar"><input type="hidden" name="id" value="${esc(e.id)}">
      <div class="field"><label for="ro-m">Monto que te devolvieron</label><input id="ro-m" name="monto" inputmode="decimal" placeholder="Esperaba ${money(e.reintegro.monto)}" required></div>
      <span class="hint">Si te devolvieron menos porque el banco tiene un tope, lo tengo en cuenta la próxima vez.</span>
      <button class="btn primary block" type="submit">Guardar</button></form>`);
  },
  reintOtroGuardar(ctx, d) {
    const v = Math.round(num(d.monto) * 100) / 100; if (!(v >= 0)) return;
    let aprendido = 0;
    ctx.commit((s) => {
      const e = reintDe(s, d.id); if (!e) return;
      e.reintegro.esperado = e.reintegro.esperado || e.reintegro.monto;
      if (v === 0) { e.reintegro.no = true; e.reintegro.noLlego = true; } else { e.reintegro.monto = v; e.reintegro.ok = true; if (e.reintegro.fecha > todayISO()) e.reintegro.fecha = todayISO(); }
      // te devolvieron menos de lo calculado: lo más probable es que el banco tenga un tope (o uno más bajo).
      // Aprendo ese tope: lo que te devolvieron en total en ese período con esa promo.
      if (v > 0 && v < e.reintegro.esperado - 1 && e.reintegro.key && !e.reintegro.manual) {
        const regla = reglas(s).find((x) => x.key === e.reintegro.key);
        const per = (regla && regla.capPeriodo) || 'semana';
        const p0 = periodoDe(e.date, per);
        const total = (s.expenses || []).filter((x) => x.reintegro && x.reintegro.ok && !x.reintegro.no && x.reintegro.key === e.reintegro.key && periodoDe(x.date, per) === p0).reduce((a, x) => a + x.reintegro.monto, 0);
        if (total > 0) { s.topesAprendidos = { ...(s.topesAprendidos || {}), [e.reintegro.key]: { cap: Math.round(total * 100) / 100, periodo: per, desde: todayISO() } }; aprendido = total; }
      }
    });
    closeModal(); toast(v ? `Listo: sumé ${money(v)} a tu saldo${aprendido ? `. Anoto que el tope de esa promo es ${money(aprendido)}: lo uso la próxima` : ''}` : 'Listo: no te llegó nada');
  },
  reintNoLlego(ctx, el) {
    ctx.commit((s) => { const e = reintDe(s, el.dataset.id); if (e) { e.reintegro.no = true; e.reintegro.noLlego = true; } });
    toast('Listo: no lo cuento. Si después llega, abrí la compra y cargalo');
  },
};

export const actions = {
  openConQuePagar(ctx) { openModal('¿Con qué conviene pagar?', cqpBody(ctx.state)); },
  cqpBuscar(ctx) {
    const q = document.getElementById('cqp-q')?.value.trim() || ''; const m = num(document.getElementById('cqp-m')?.value);
    const r = document.querySelector('[data-cqp-res]'); if (!r) return;
    r.innerHTML = q.length >= 2 ? cqpResultados(ctx.state, cqpItem(ctx.state, q, m), true) : '<span class="small muted">Escribí el comercio, rubro o servicio.</span>';
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
