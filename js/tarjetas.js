// Tarjetas de crédito: próximo resumen, cuotas pendientes y lo que ya
// tenés comprometido en los próximos meses.

import { money, esc, num, monthName, addMonthKey } from './formato.js';
import { aBase } from './cotizaciones.js';
import { cardSummary } from './calculos.js';
import { icon, sprout, screenHead, openModal, closeModal, toast, borrarConDeshacer } from './interfaz.js';
import { agenda, bestBuyDay, statementDates, statementOf, detalleResumen } from './agenda.js';
import { currentPromos } from './economista.js';
import { allWallets, walletName, catLabel } from './categorias.js';
import { cardPlan } from './flujo.js';
import { payOptions } from './pagos.js';
import { uid } from './almacenamiento.js';
import { guessCategory } from './interprete.js';

// Plan para pagar el próximo resumen (con tu plata disponible o no)
function planBlock(s, c, it) {
  if (!it || it.paid) return '';
  const plan = cardPlan(s, c, it);
  return `<div class="card">
    ${plan.fromSavings > 1 ? `<div class="result warn"><strong>Tu plata disponible cubre ${money(plan.fromSalary)}</strong><span class="text">Te faltarían ${money(plan.fromSavings)}: conviene sacarlos de tus ahorros antes que financiar la tarjeta.</span></div>`
      : '<div class="result ok"><strong>Lo cubrís con tu plata disponible</strong><span class="text">Pagalo completo: así no pagás intereses.</span></div>'}
    ${plan.tna ? `<span class="small">Si pagás solo una parte, lo que quede pasa al próximo resumen con interés: unos <b>${money(plan.monthlyCost)}</b> por mes si financiaras todo (TNA ${String(plan.tna).replace('.', ',')}% + IVA).</span>`
      : `<span class="small muted">Si alguna vez pagás solo una parte, cargá la tasa (TNA) en <button class="link-btn" data-action="editCard" data-id="${esc(c.id)}">Editar</button> y te calculo el interés.</span>`}
  </div>`;
}

export const MARCAS = [['visa', 'Visa'], ['mastercard', 'Mastercard'], ['amex', 'American Express'], ['cabal', 'Cabal'], ['naranja', 'Naranja'], ['otra', 'Otra']];
const dias = (a, b) => Math.round((b - a) / 86400000);
const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dm = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
const usdTxt = (v) => `US$ ${(Math.round(v * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const enDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 0 ? `hace ${-n} días` : `en ${n} días`);

// qué tarjeta está abierta, qué pestaña y qué resumen (0 = el actual)
let abierta = '';
let pestania = 'resumen';
let desfase = 0;

const itemDe = (s, c, mk) => agenda(s, 200).find((i) => i.key === `card:${c.id}:${mk}`);

// ---------- lista de tarjetas ----------
function lista(s) {
  const filas = s.cards.map((c) => {
    const mk = statementOf(c, new Date().toISOString().slice(0, 10));
    const det = detalleResumen(s, c, mk);
    const { close, due } = statementDates(c, mk);
    const pago = (s.paid || {})[`card:${c.id}:${mk}`];
    const h = hoy0();
    const estado = pago ? '<span class="pill ok">Pagado</span>' : close > h ? `<span class="small muted">Cierra ${enDias(dias(h, close))} · vence el ${dm(due)}</span>` : `<span class="small ${dias(h, due) <= 3 ? 'warn-text' : 'muted'}">Vence ${enDias(dias(h, due))} (${dm(due)})</span>`;
    return `<button class="row" data-action="abrirTarjeta" data-id="${esc(c.id)}">
      <span class="ico">${icon('card', 18)}</span>
      <span class="grow"><span class="name" style="white-space:normal">${esc(c.name)}</span>${estado}</span>
      <span style="display:flex;flex-direction:column;align-items:flex-end">${det.pagaUsd && det.usd && det.pesos < 1 ? `<span class="amount">${usdTxt(det.usd)}</span>` : `<span class="amount">${money(det.pesos)}</span>${det.pagaUsd && det.usd ? `<span class="small muted">+ ${usdTxt(det.usd)}</span>` : ''}`}</span>
    </button>`;
  }).join('');
  const total = s.cards.reduce((a, c) => a + detalleResumen(s, c, statementOf(c, new Date().toISOString().slice(0, 10))).total, 0);
  return `<div class="card green" style="gap:4px">
      <span class="hero-label">Próximos resúmenes, entre todas</span>
      <span style="font-size:30px;font-weight:800;letter-spacing:-1px">${money(total)}</span>
      <span class="small on-green-muted">Tocá una tarjeta para ver el detalle, las cuotas y pagarla.</span>
    </div>
    <div class="card tight">${filas}</div>`;
}

// ---------- una tarjeta ----------
function cabecera(s, c, det, mk) {
  const { close, due, cambiadas } = statementDates(c, mk);
  const actual = statementOf(c, new Date().toISOString().slice(0, 10));
  const h = hoy0();
  const pago = (s.paid || {})[`card:${c.id}:${mk}`];
  const it = itemDe(s, c, mk);
  const abierto = close > h;
  const parcial = pago && pago.amount && pago.amount < det.total - 1;
  const estado = parcial ? (due < h ? `Pagaste ${money(pago.amount)}: los ${money(det.total - pago.amount)} que faltaron pasaron al resumen siguiente, con interés` : `Pagaste ${money(pago.amount)}: te faltan ${money(det.total - pago.amount)}. Si no los pagás antes del vencimiento, pasan al próximo resumen con interés`)
    : pago ? `Pagado el ${dm(new Date(pago.date + 'T12:00'))}`
    : abierto ? `Abierto: puede subir hasta el cierre (${enDias(dias(h, close))})`
    : due < h ? 'Ya venció' : `Cerrado: es lo que tenés que pagar · vence ${enDias(dias(h, due))}`;
  return `<div class="card credit" style="gap:10px">
    <div class="credit-head">
      <span class="credit-name">${icon('card', 20)} ${esc(c.name)}</span>
      <button class="chip" data-action="editCard" data-id="${esc(c.id)}">Editar</button>
    </div>
    <div class="t-mes">
      <button class="icon-btn" data-action="tarjetaMes" data-d="-1" aria-label="Resumen anterior" ${desfase <= -2 ? 'disabled' : ''}>‹</button>
      <span><b>Resumen de ${monthName(mk, true)}</b>${mk === actual ? '' : `<span class="small on-green-muted"> · ${mk < actual ? 'anterior' : 'próximo'}</span>`}</span>
      <button class="icon-btn" data-action="tarjetaMes" data-d="1" aria-label="Resumen siguiente" ${desfase >= 6 ? 'disabled' : ''}>›</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-size:32px;font-weight:800;letter-spacing:-1px">${det.pagaUsd && det.usd && det.pesos < 1 ? usdTxt(det.usd) : `${money(det.pesos)}${det.pagaUsd && det.usd ? `<span style="font-size:18px"> + ${usdTxt(det.usd)}</span>` : ''}`}</span>
      <span class="small on-green-muted">Cierra el ${dm(close)} · vence el ${dm(due)}${cambiadas ? ' (fechas corregidas)' : ''} · <button class="link-btn on-green-link" data-action="editarFechasResumen" data-id="${esc(c.id)}" data-mk="${mk}">cambiar</button></span>
      <span class="small">${esc(estado)}</span>
    </div>
    <div class="t-acciones">
      <button class="btn small" data-action="nuevaCompraTarjeta" data-card="${esc(c.id)}">+ Compra</button>
      ${it && !it.paid ? `<button class="btn small green" data-action="openPayment" data-key="${esc(it.key)}">${parcial ? 'Pagar el resto' : 'Pagar'}</button>` : pago && !pago.auto ? `<button class="btn small" data-action="openPayment" data-key="card:${esc(c.id)}:${mk}">Ver pago</button>` : ''}
      <button class="btn small" data-action="openImportar" data-medio="card:${esc(c.id)}">Importar resumen</button>
    </div>
  </div>`;
}

function tabResumen(s, c, det, mk) {
  const actual = statementOf(c, new Date().toISOString().slice(0, 10));
  const filas = det.lineas.map((l) => {
    const meta = [l.n > 1 ? `Cuota ${l.cuota} de ${l.n}` : 'En 1 pago', l.n > 1 ? (l.e.interes ? `con interés (+${String(l.e.interes.recargo).replace('.', ',')}%)` : 'sin interés') : '', new Date(l.e.date + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ');
    return `<button class="row" data-action="openEntry" data-id="${esc(l.e.id)}" data-kind="expense">
      <span class="grow"><span class="name">${esc(l.e.note || catLabel(l.e.category))}</span><span class="meta">${meta}</span></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount">${l.usd ? usdTxt(l.usd) : money(l.monto)}</span>${l.usd ? `<span class="small muted">≈ ${money(l.monto)}</span>` : ''}</span>
    </button>`;
  }).join('');
  const linea = (k, v, cls = '', hint = '') => `<div class="split small ${cls}"><span>${k}${hint ? `<br><span class="muted">${hint}</span>` : ''}</span><b style="white-space:nowrap">${v}</b></div>`;
  return `<div class="card tight">
      ${filas || `<p class="empty">${mk >= actual ? 'Todavía no hay compras en este resumen.' : 'No hubo compras en este resumen.'}</p>`}
    </div>
    <div class="card t-cuenta">
      ${linea(`Compras y cuotas (${det.lineas.length})`, money(det.consumos))}
      ${det.reintegros ? linea('Reintegros', `− ${money(det.reintegros)}`, 'ok-text') : ''}
      ${det.cargos.map((x) => linea(esc(x.label), money(x.v), '', x.k === 'perc' ? 'Se recupera: la descontás de Ganancias o pedís la devolución a ARCA. Si pagás los dólares con dólares, no se cobra.' : x.k === 'saldo' ? 'Pagaste menos que el total.' : '')).join('')}
      <div class="split t-total"><span><b>${det.pagaUsd && det.usd ? 'A pagar en pesos' : 'Total a pagar'}</b></span><b>${money(det.pesos)}</b></div>
      ${det.pagaUsd && det.usd ? `<div class="split"><span><b>A pagar en dólares</b></span><b>${usdTxt(det.usd)}</b></div>` : ''}
      ${det.usd && !det.pagaUsd ? `<span class="small muted">Los dólares los paso a pesos con la cotización de hoy: el banco usa la del día del cierre, así que puede cambiar un poco. Si los vas a pagar con dólares, cambialo en <button class="link-btn" data-action="editCard" data-id="${esc(c.id)}">Editar</button>.</span>` : ''}
      ${!c.comision && !c.seguro && !c.sellos ? `<span class="small muted">¿Tu resumen trae mantenimiento, seguro o sellos? <button class="link-btn" data-action="editCard" data-id="${esc(c.id)}">Cargalos</button> y el total te da igual al del banco.</span>` : ''}
    </div>
    ${mk === actual ? planBlock(s, c, itemDe(s, c, mk)) : ''}`;
}

function tabCuotas(s, c, sum) {
  const max = Math.max(1, ...sum.months.map((m) => m.amount));
  const terminan = sum.pending.filter((p) => p.last === sum.current);
  const libera = terminan.reduce((a, p) => a + p.each, 0);
  return `<div class="card">
      <strong style="font-size:14px">Lo que ya tenés comprometido</strong>
      <div class="months-bars" role="img" aria-label="Lo que ya tenés comprometido en los próximos 6 meses">
        ${sum.months.map((m, i) => `<div class="mbar"><span class="mval">${m.amount ? money(m.amount).replace('$', '') : '—'}</span><span class="mcol" style="height:${Math.max(4, Math.round((m.amount / max) * 90))}px;${i === 0 ? 'background:var(--green)' : ''}"></span><span class="mlabel">${monthName(m.mk)}</span></div>`).join('')}
      </div>
      <span class="small muted">Cuotas de compras que ya hiciste. Total pendiente: <b>${money(sum.pending.reduce((a, p) => a + p.remaining, 0))}</b>.</span>
      ${libera ? `<span class="small">✅ En este resumen terminan ${terminan.length === 1 ? `las cuotas de <b>${esc(terminan[0].e.note)}</b>` : `<b>${terminan.length} compras en cuotas</b>`}: desde el próximo pagás ${money(libera)} menos.</span>` : ''}
    </div>
    <div class="card tight">
      ${sum.pending.length ? sum.pending.map((p) => `<button class="row" data-action="openEntry" data-id="${p.e.id}" data-kind="expense">
        <span class="grow"><span class="name">${esc(p.e.note)}</span><span class="meta">Cuota ${Math.min(p.next, p.n)} de ${p.n} · ${money(p.each)} por mes · termina en ${monthName(p.last, true)}${p.e.interes ? ` · con interés (+${String(p.e.interes.recargo).replace('.', ',')}%)` : ' · sin interés'}</span>
          <span class="bar" style="height:5px;margin-top:6px"><span style="width:${Math.round(((p.n - p.left) / p.n) * 100)}%"></span></span></span>
        <span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount">${money(p.remaining)}</span><span class="small muted">restan ${p.left}</span></span>
      </button>`).join('') : '<p class="empty">No tenés compras en cuotas en esta tarjeta.</p>'}
    </div>`;
}

function tabTarjeta(s, c, sum) {
  const bb = bestBuyDay(c);
  const disponible = c.limit ? Math.max(0, c.limit - sum.committed) : null;
  const dispCuotas = c.limitCuotas ? Math.max(0, c.limitCuotas - sum.pending.reduce((a, p) => a + p.remaining, 0)) : null;
  const ids = [c.banco, c.marca].filter(Boolean);
  const promos = ids.length ? currentPromos(s).items.filter((p) => ids.includes(p.wallet)) : [];
  const dato = (k, v, sub = '') => `<div class="t-dato"><span class="k">${k}</span><b>${v}</b>${sub ? `<span class="small muted">${sub}</span>` : ''}</div>`;
  const costos = [c.tna ? `TNA ${String(c.tna).replace('.', ',')}%` : '', c.comision ? `mantenimiento ${money(c.comision)} + IVA` : '', c.seguro ? `seguro ${money(c.seguro)}` : '', c.sellos ? `sellos ${String(c.sellos).replace('.', ',')}%` : ''].filter(Boolean).join(' · ');
  return `<div class="card t-datos">
      <div class="t-grid">
        ${disponible !== null ? dato('Disponible', money(disponible), `de ${money(c.limit)}`) : dato('Disponible', '—', `<button class="link-btn" data-action="editCard" data-id="${esc(c.id)}">Cargá el límite</button>`)}
        ${dispCuotas !== null ? dato('Disponible en cuotas', money(dispCuotas), `de ${money(c.limitCuotas)}`) : dato('Comprometido', money(sum.committed), 'incluye cuotas')}
        ${dato('Cierre', `día ${c.closeDay}`, 'de cada mes')}
        ${dato('Vencimiento', `día ${c.dueDay}`, c.autoDebit ? 'débito automático' : c.payFrom ? `pagás con ${esc(walletName(c.payFrom))}` : '')}
      </div>
      ${c.limit ? `<div class="bar"><span style="width:${Math.min(100, Math.round(sum.used * 100))}%"></span></div><span class="small muted">Usás el ${Math.round(sum.used * 100)}% del límite contando las cuotas que vienen.</span>` : ''}
    </div>
    <div class="card">
      <div class="tip-head"><span class="badge">${sprout(17)}</span><strong>Mejor día para compras grandes: el ${bb.best.getDate()}</strong></div>
      <p class="text">Lo que compres desde el ${dm(bb.best)} lo pagás recién el ${dm(bb.due)}: unos ${bb.days} días sin costo.</p>
    </div>
    <div class="card tight">
      <button class="row" data-action="openAvisos"><span class="ico">🔔</span><span class="grow"><span class="name">Recordatorios</span><span class="meta">Te aviso el día del cierre y el día antes del vencimiento</span></span>${icon('chevron', 16)}</button>
      <button class="row" data-action="editCard" data-id="${esc(c.id)}"><span class="ico">🧾</span><span class="grow"><span class="name">Costos e impuestos</span><span class="meta">${costos || 'Sin cargar: mantenimiento, seguro, sellos y tasa'} · dólares ${c.dolares === 'usd' ? 'pagados en dólares' : 'pagados en pesos (+30%)'}</span></span>${icon('chevron', 16)}</button>
      ${promos.length ? `<a class="row" href="#/beneficios"><span class="ico">🏷️</span><span class="grow"><span class="name">${promos.length} promo${promos.length === 1 ? '' : 's'} vigente${promos.length === 1 ? '' : 's'}</span><span class="meta">Con ${esc(ids.map(walletName).join(' / '))}</span></span>${icon('chevron', 16)}</a>` : ''}
    </div>`;
}

function detalle(s, c) {
  const actual = statementOf(c, new Date().toISOString().slice(0, 10));
  const mk = addMonthKey(actual, desfase);
  const det = detalleResumen(s, c, mk);
  const sum = cardSummary(s, c);
  const tab = (v, l) => `<button role="tab" data-action="tarjetaTab" data-v="${v}" aria-pressed="${pestania === v}">${l}</button>`;
  return `${s.cards.length > 1 ? `<button class="link-btn" data-action="abrirTarjeta" data-id="" style="align-self:flex-start">‹ Todas las tarjetas</button>` : ''}
    ${cabecera(s, c, det, mk)}
    <div class="tabs" role="tablist" aria-label="Tarjeta" style="grid-template-columns:repeat(3,minmax(0,1fr))">${tab('resumen', 'Resumen')}${tab('cuotas', `Cuotas${sum.pending.length ? ` (${sum.pending.length})` : ''}`)}${tab('tarjeta', 'Datos')}</div>
    ${pestania === 'cuotas' ? tabCuotas(s, c, sum) : pestania === 'tarjeta' ? tabTarjeta(s, c, sum) : tabResumen(s, c, det, mk)}`;
}

export function render(s) {
  return `<section class="screen">
    ${screenHead('Tarjetas', '<button class="btn small" data-action="newCard">+ Tarjeta</button>', 'Resúmenes y cuotas')}
    ${cuerpo(s)}
  </section>`;
}

/** Tarjetas (en Por pagar → Tarjetas): la lista y, al tocar una, todo lo de esa tarjeta. */
export function cuerpo(s) {
  if (!s.cards.length) return `<div class="card">
      <strong>Sumá tu tarjeta de crédito</strong>
      <p class="text muted">Con el cierre y el vencimiento te muestro cuánto viene en cada resumen (con impuestos y cargos), las cuotas que te quedan y te aviso antes de que venza.</p>
      <button class="btn green small" data-action="newCard">Agregar tarjeta</button>
    </div>`;
  const c = s.cards.length === 1 ? s.cards[0] : s.cards.find((x) => x.id === abierta);
  if (!c) return `${lista(s)}
    <button class="btn primary block" data-action="nuevaCompraTarjeta">${icon('card', 18)} Cargar una compra con tarjeta</button>`;
  return detalle(s, c);
}

function compraForm(s, cardId) {
  return `<form class="form" data-submit="guardarCompraTarjeta">
    <div class="field"><label for="ct-c">Tarjeta</label><select id="ct-c" name="cardId">${s.cards.map((c) => `<option value="${esc(c.id)}" ${c.id === cardId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ct-n">¿Qué compraste?</label><input id="ct-n" name="note" required placeholder="Ej: Heladera, zapatillas"></div>
    <div class="field-row"><div class="field"><label for="ct-a">Precio</label><input id="ct-a" name="amount" inputmode="decimal" required placeholder="Ej: 540.000"></div>
      <div class="field"><label for="ct-m">Moneda</label><select id="ct-m" name="moneda"><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></div></div>
    <div class="field"><label for="ct-q">Cuotas</label><input id="ct-q" name="n" inputmode="numeric" placeholder="1 si es en un pago"></div>
    <div class="field"><label for="ct-i">¿Las cuotas tienen interés?</label><select id="ct-i" name="interes" data-change="compraInteres"><option value="no">Sin interés</option><option value="si">Con interés</option></select></div>
    <div class="field" data-ct-int hidden><label for="ct-t">Total que pagás en cuotas</label><input id="ct-t" name="totalCuotas" inputmode="decimal" placeholder="Ej: 620.000"><span class="hint">Lo dice el comercio o el ticket ("total financiado"). Te muestro cuánto interés pagás.</span></div>
    <div class="field"><label for="ct-d">Fecha</label><input id="ct-d" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
    <span class="hint">Calculo el valor de cada cuota y en qué resumen cae. En dólares (Netflix, Spotify, compras afuera) te sumo la percepción del 30% si los pagás en pesos. Si tiene reintegro, cargalo cuando llegue: baja el resumen.</span>
    <button class="btn primary block" type="submit">Guardar</button></form>`;
}

// nombre automático: marca, banco y últimos 4 números
export function nombreTarjeta(c) {
  const marca = c.marca && c.marca !== 'otra' ? (MARCAS.find((m) => m[0] === c.marca) || [])[1] : '';
  const banco = c.banco ? walletName(c.banco) : '';
  const base = [marca, banco].filter(Boolean).join(' ') || c.alias || 'Tarjeta';
  return c.last4 ? `${base} ••${c.last4}` : base;
}
// tarjetas viejas (sin marca ni banco): los adivino del nombre para no tener que cargarlos de nuevo
function adivinar(c) {
  const n = String(c.name || '').toLowerCase();
  const marca = c.marca || (MARCAS.find(([v, l]) => v !== 'otra' && (n.includes(v) || n.includes(l.toLowerCase()) || (v === 'mastercard' && /\bmaster\b/.test(n)))) || [''])[0];
  const banco = c.banco || (allWallets().find((w) => n.includes(String(w.name).toLowerCase()) || n.includes(String(w.id).toLowerCase())) || {}).id || '';
  return { ...c, marca, banco };
}
function cardForm(s, c0 = {}) {
  const c = c0.id ? adivinar(c0) : c0;
  return `<form class="form" data-submit="saveCard">
    <input type="hidden" name="id" value="${esc(c.id || '')}">
    <div class="field-row">
      <div class="field"><label for="cd-m">Marca</label><select id="cd-m" name="marca" required><option value="">Elegí</option>${MARCAS.map(([v, l]) => `<option value="${v}" ${c.marca === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="cd-b">Banco o emisor</label><select id="cd-b" name="banco"><option value="">Elegí</option>${['Bancos', 'Billeteras'].map((k) => `<optgroup label="${k}">${allWallets().filter((w) => w.kind === k).map((w) => `<option value="${esc(w.id)}" ${c.banco === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    </div>
    <div class="field"><label for="cd-4">Últimos 4 números</label><input id="cd-4" name="last4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(c.last4 || '')}" placeholder="Ej: 4821"><span class="hint">Para distinguirla si tenés más de una. El nombre lo armo solo (por ejemplo, "Visa Galicia ••4821").</span></div>
    <div class="field-row">
      <div class="field"><label for="cd-c">Día de cierre</label><input id="cd-c" name="closeDay" inputmode="numeric" value="${c.closeDay || ''}" placeholder="Ej: 25" required></div>
      <div class="field"><label for="cd-v">Día de vencimiento</label><input id="cd-v" name="dueDay" inputmode="numeric" value="${c.dueDay || ''}" placeholder="Ej: 5" required></div>
    </div>
    <span class="hint" style="margin-top:-6px">Los de siempre, más o menos. Si un mes cambian, los corregís desde la tarjeta en "Cambiar fechas de este resumen".</span>
    <div class="field-row">
      <div class="field"><label for="cd-l">Límite de compra</label><input id="cd-l" name="limit" inputmode="decimal" value="${c.limit || ''}" placeholder="Opcional"></div>
      <div class="field"><label for="cd-lc">Límite en cuotas</label><input id="cd-lc" name="limitCuotas" inputmode="decimal" value="${c.limitCuotas || ''}" placeholder="Si es distinto"></div>
    </div>
    <div class="field"><label for="cd-w">El resumen lo pagás con</label><select id="cd-w" name="payFrom">${payOptions(s, c.payFrom)}</select></div>
    <div class="field"><label for="cd-us">Lo que gastás en dólares lo pagás</label><select id="cd-us" name="dolares"><option value="pesos" ${c.dolares !== 'usd' ? 'selected' : ''}>En pesos (te cobran 30% de percepción)</option><option value="usd" ${c.dolares === 'usd' ? 'selected' : ''}>Con dólares (sin percepción)</option></select></div>
    <label class="check"><input type="checkbox" name="autoDebit" ${c.autoDebit ? 'checked' : ''}> <span>Débito automático del pago total<br><span class="small muted">Te aviso que tengas el saldo antes del vencimiento.</span></span></label>
    <details class="card"><summary><strong>Costos del resumen</strong> <span class="small muted">(opcional)</span></summary>
      <span class="small muted">Sirven para dos cosas: decirte cuánto vas a pagar de verdad (con los cargos fijos que suma el banco) y cuánto te costaría pagar solo el mínimo. Están al final del resumen.</span>
      <div class="field-row">
        <div class="field"><label for="cd-t">Tasa de financiación (TNA %)</label><input id="cd-t" name="tna" inputmode="decimal" value="${c.tna || ''}" placeholder="Ej: 80"></div>
        <div class="field"><label for="cd-co">Mantenimiento por mes</label><input id="cd-co" name="comision" inputmode="decimal" value="${c.comision || ''}" placeholder="$ 0 si no cobra"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="cd-se">Seguro y otros cargos</label><input id="cd-se" name="seguro" inputmode="decimal" value="${c.seguro || ''}" placeholder="$ por resumen"></div>
        <div class="field"><label for="cd-sl">Impuesto de sellos (%)</label><input id="cd-sl" name="sellos" inputmode="decimal" value="${c.sellos ? String(c.sellos).replace('.', ',') : ''}" placeholder="Ej: 1,2"></div>
      </div>
      <span class="hint">TNA: lo que te cobran de interés si no pagás el total. Sellos: un impuesto provincial que algunos bancos suman a cada resumen.</span>
    </details>
    <button class="btn primary block" type="submit">Guardar</button>
    ${c.id ? `<button class="btn ghost block" type="button" data-action="deleteCard" data-id="${c.id}">Borrar tarjeta</button>` : ''}
  </form>`;
}

// fechas de un resumen puntual (cambian mes a mes: el banco las informa en el resumen anterior)
function fechasForm(s, c, desde) {
  const mk = desde || statementOf(c, new Date().toISOString().slice(0, 10));
  const fila = (m) => { const d = statementDates(c, m); const iso = (x) => x.toISOString().slice(0, 10); return `<div class="card form"><strong>Resumen de ${monthName(m, true)}</strong>
      <input type="hidden" name="mk_${m}" value="1">
      <div class="field-row"><div class="field"><label for="fc-${m}">Cierra el</label><input id="fc-${m}" name="cierre_${m}" type="date" value="${iso(d.close)}"></div>
      <div class="field"><label for="fv-${m}">Vence el</label><input id="fv-${m}" name="vence_${m}" type="date" value="${iso(d.due)}"></div></div></div>`; };
  return `<form class="form" data-submit="guardarFechasResumen"><input type="hidden" name="id" value="${esc(c.id)}">
    <p class="small muted" style="margin:0">Cada resumen trae las fechas del próximo ("próximo cierre" y "próximo vencimiento"). Si cambian, ponelas acá: corrijo en qué resumen cae cada compra y los avisos.</p>
    ${fila(mk)}${fila(addMonthKey(mk, 1))}
    <button class="btn primary block" type="submit">Guardar</button></form>`;
}

export const actions = {
  editarFechasResumen(ctx, el) { const c = ctx.state.cards.find((x) => x.id === el.dataset.id); if (c) openModal('Fechas del resumen', fechasForm(ctx.state, c, el.dataset.mk), { push: !document.getElementById('modal').hidden }); },
  guardarFechasResumen(ctx, d) {
    ctx.commit((s) => {
      const c = s.cards.find((x) => x.id === d.id); if (!c) return;
      c.fechas = { ...(c.fechas || {}) };
      for (const k of Object.keys(d)) if (k.startsWith('mk_')) { const m = k.slice(3); if (d['cierre_' + m] && d['vence_' + m]) c.fechas[m] = { cierre: d['cierre_' + m], vence: d['vence_' + m] }; }
    });
    closeModal(); toast('Listo: actualicé las fechas del resumen');
  },
  nuevaCompraTarjeta(ctx, el) { openModal('Compra con tarjeta', compraForm(ctx.state, (el && el.dataset.card) || (ctx.state.cards[0] || {}).id), { push: !!(el && el.dataset && el.dataset.push) }); },
  compraInteres(ctx, el) { el.closest('form').querySelector('[data-ct-int]').hidden = el.value !== 'si'; },
  guardarCompraTarjeta(ctx, d) {
    const precio = num(d.amount); const n = Math.max(1, Math.min(72, parseInt(d.n, 10) || 1));
    if (!precio || !String(d.note || '').trim()) { toast('Completá qué compraste y el precio'); return; }
    const total = d.interes === 'si' && n > 1 && num(d.totalCuotas) > precio ? num(d.totalCuotas) : precio;
    const usd = d.moneda === 'USD';
    const rate = usd ? aBase(ctx.state, 'USD') : 1;
    if (usd && !rate) { toast('No tengo la cotización del dólar ahora: probá en un rato'); return; }
    const r2 = (v) => Math.round(v * 100) / 100;
    ctx.commit((s) => { s.expenses.push({ id: uid(), date: d.date || new Date().toISOString().slice(0, 10), amount: r2(total * rate), category: guessCategory(d.note, s.learned), note: String(d.note).trim(), installments: n, cardId: d.cardId, ...(usd ? { currency: 'USD', original: total, rate } : {}), ...(total > precio ? { interes: { precio, recargo: Math.round((total / precio - 1) * 1000) / 10 } } : {}) }); });
    abierta = d.cardId; desfase = 0; pestania = 'resumen';
    closeModal();
    const m = (v) => (usd ? `US$ ${r2(v)}` : money(v));
    toast(n > 1 ? `Listo: ${n} cuotas de ${m(total / n)}${total > precio ? ` (con ${m(total - precio)} de interés)` : ' sin interés'}` : 'Listo: compra cargada en la tarjeta');
  },
  abrirTarjeta(ctx, el) { abierta = el.dataset.id || ''; desfase = 0; pestania = 'resumen'; ctx.render(); window.scrollTo(0, 0); },
  verTarjeta(ctx, el) { abierta = el.dataset.id || ''; desfase = 0; pestania = 'resumen'; closeModal(); ctx.go('tarjetas'); },
  tarjetaTab(ctx, el) { pestania = el.dataset.v; ctx.render(); },
  tarjetaMes(ctx, el) { desfase = Math.max(-2, Math.min(6, desfase + Number(el.dataset.d))); pestania = 'resumen'; ctx.render(); },
  newCard(ctx) { openModal('Nueva tarjeta', cardForm(ctx.state)); },
  editCard(ctx, el) { const c = ctx.state.cards.find((x) => x.id === el.dataset.id); if (c) openModal('Editar tarjeta', cardForm(ctx.state, c)); },
  saveCard(ctx, d) {
    const last4 = String(d.last4 || '').replace(/\D/g, '').slice(-4);
    const data = { marca: d.marca || '', banco: d.banco || '', last4, limitCuotas: num(d.limitCuotas), comision: num(d.comision), seguro: num(d.seguro), sellos: Math.min(10, parseFloat(String(d.sellos || '').replace(',', '.')) || 0), closeDay: Math.min(31, Math.max(1, parseInt(d.closeDay, 10) || 25)), dueDay: Math.min(31, Math.max(1, parseInt(d.dueDay, 10) || 5)), limit: num(d.limit), tna: parseFloat(String(d.tna || '').replace(',', '.')) || 0, payFrom: d.payFrom || '', autoDebit: !!d.autoDebit, dolares: d.dolares === 'usd' ? 'usd' : 'pesos' };
    data.name = nombreTarjeta(data);
    ctx.commit((s) => {
      const c = s.cards.find((x) => x.id === d.id);
      if (c) Object.assign(c, data); else s.cards.push({ id: uid(), ...data });
    });
    closeModal(); toast(`Tarjeta guardada: ${data.name}`);
  },
  deleteCard(ctx, el) {
    closeModal();
    borrarConDeshacer(ctx, 'Tarjeta borrada', (s) => {
      s.cards = s.cards.filter((c) => c.id !== el.dataset.id);
      s.expenses.forEach((e) => { if (e.cardId === el.dataset.id) delete e.cardId; });
    });
  },
};
