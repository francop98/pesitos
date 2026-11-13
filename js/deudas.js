// =========================================================
// Pesitos — deudas y préstamos: "me deben" y "debo"
// Se crean a mano o solas con un gasto compartido. Se cobran o pagan de a partes.
// =========================================================

import { money, esc, todayISO, relDay, num, parseISO } from './formato.js';
import { screenHead, openModal, closeModal, toast, icon, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { listaCuentas, cuentaPrincipal, saldoDeuda, pagadoDeuda, deudasAbiertas, totalMeDeben, totalDebo, deudaEnOtraMoneda, saldoDeudaBase } from './cuentas.js';
import { aBase, monedaBase } from './cotizaciones.js';
import { ASSETS } from './categorias.js';

// monedas para una deuda (la tuya primero)
const MONEDAS_DEUDA = ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP', 'USDT'];
const nfM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const simb = (m) => (m === 'ARS' ? '$' : (ASSETS.find((a) => a.id === m) || { sym: m }).sym + ' ');
/** Monto de la deuda en su moneda: "US$ 300" o "$300.000" */
const enSu = (s, d, v) => (deudaEnOtraMoneda(s, d) ? `${simb(d.moneda)}${nfM.format(Math.round(v * 100) / 100)}` : money(v));
/** "≈ $360.000 hoy" si la deuda es en otra moneda */
const aprox = (s, d) => (deudaEnOtraMoneda(s, d) && aBase(s, d.moneda) ? `≈ ${money(saldoDeudaBase(s, d))} hoy` : '');

const opcionesCuenta = (s, sel, ninguna = '') => `${ninguna ? `<option value="">${ninguna}</option>` : ''}${listaCuentas(s).map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;

function fila(s, d) {
  const saldo = saldoDeuda(d);
  const vencida = d.vence && d.vence < todayISO() && saldo > 0;
  return `<button class="row" data-action="abrirDeuda" data-id="${esc(d.id)}">
    <span class="cat-icon ${d.tipo === 'meDeben' ? 'green' : ''}">${icon(d.tipo === 'meDeben' ? 'down' : 'up', 18)}</span>
    <span class="grow"><span class="name">${esc(d.persona)}</span><span class="meta">${esc(d.nota || (d.tipo === 'meDeben' ? 'Te debe' : 'Le debés'))} · ${relDay(d.date)}${pagadoDeuda(d) ? ` · ya ${d.tipo === 'meDeben' ? 'te devolvió' : 'pagaste'} ${enSu(s, d, pagadoDeuda(d))}` : ''}${aprox(s, d) && saldo > 0.5 ? ` · ${aprox(s, d)}` : ''}</span></span>
    <span class="u-d-flex-dir-column-items-end-gap-4"><span class="amount ${d.tipo === 'meDeben' ? 'pos' : ''}">${enSu(s, d, saldo)}</span>${vencida ? '<span class="pill warn">Venció</span>' : ''}</span></button>`;
}

export function render(s) {
  const meDeben = deudasAbiertas(s, 'meDeben');
  const debo = deudasAbiertas(s, 'debo');
  const saldadas = (s.deudas || []).filter((d) => saldoDeuda(d) <= 0.5).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return `<section class="screen">
    ${screenHead('Deudas y préstamos', `<button class="btn small" data-action="nuevaDeuda">+ Nueva</button>`, 'Lo que te deben y lo que debés')}
    ${cuerpo(s)}
  </section>`;
}

/** Contenido de Deudas (también se muestra en Movimientos → Deudas). */
export function cuerpo(s) {
  const meDeben = deudasAbiertas(s, 'meDeben');
  const debo = deudasAbiertas(s, 'debo');
  const saldadas = (s.deudas || []).filter((d) => saldoDeuda(d) <= 0.5).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return `
    <div class="stat-grid">
      <div class="stat"><span class="k">Te deben</span><span class="v pos">${money(totalMeDeben(s))}</span><span class="small muted">${meDeben.length} persona${meDeben.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="k">Debés</span><span class="v">${money(totalDebo(s))}</span><span class="small muted">${debo.length} persona${debo.length === 1 ? '' : 's'}</span></div>
    </div>
    <div class="section-title"><span>Te deben</span></div>
    <div class="card tight">${meDeben.length ? meDeben.map((d) => fila(s, d)).join('') : '<p class="empty">Nadie te debe plata. Cuando prestes o pagues algo compartido, anotalo acá.</p>'}</div>
    <div class="section-title"><span>Debés</span></div>
    <div class="card tight">${debo.length ? debo.map((d) => fila(s, d)).join('') : '<p class="empty">No le debés a nadie.</p>'}</div>
    ${saldadas.length ? `<div class="section-title"><span>Saldadas</span></div><div class="card tight">${saldadas.map((d) => fila(s, d)).join('')}</div>` : ''}
    <p class="small muted">Los créditos con cuotas (préstamos personales, planes) se cargan como gasto fijo con cuotas en Movimientos. Los gastos compartidos crean su deuda solos.</p>
  `;
}

function formDeuda(s, d = {}) {
  return `<form class="form" data-submit="guardarDeuda">
    <input type="hidden" name="id" value="${esc(d.id || '')}">
    <div class="kind-toggle" role="group" aria-label="Tipo"><label class="kt"><input type="radio" name="tipo" value="meDeben" ${d.tipo !== 'debo' ? 'checked' : ''}> Me deben</label><label class="kt"><input type="radio" name="tipo" value="debo" ${d.tipo === 'debo' ? 'checked' : ''}> Debo</label></div>
    <div class="field-row"><div class="field"><label for="de-p">Persona</label><input id="de-p" name="persona" value="${esc(d.persona || '')}" required placeholder="Ej: Juan"></div>
    <div class="field"><label for="de-m">Monto</label><input id="de-m" name="monto" inputmode="decimal" value="${d.monto || ''}" required placeholder="Ej: 20.000"></div></div>
    <div class="field"><label for="de-mo">Moneda</label><select id="de-mo" name="moneda">${MONEDAS_DEUDA.map((m) => `<option value="${m}" ${m === (d.moneda || monedaBase(s)) ? 'selected' : ''}>${m === 'ARS' ? 'Pesos' : (ASSETS.find((a) => a.id === m) || {}).label}</option>`).join('')}</select>
      <span class="hint">Si prestaste o te prestaron dólares, cargala en dólares: te muestro cuánto es en ${monedaBase(s) === 'USD' ? 'dólares' : 'pesos'} con la cotización del día y podés cobrar o pagar en cualquiera de las dos.</span></div>
    <div class="field"><label for="de-n">¿Por qué? (opcional)</label><input id="de-n" name="nota" value="${esc(d.nota || '')}" placeholder="Ej: Le presté para el alquiler"></div>
    <div class="field-row"><div class="field"><label for="de-d">Fecha</label><input id="de-d" name="date" type="date" value="${esc(d.date || todayISO())}"></div>
    <div class="field"><label for="de-v">Vence (opcional)</label><input id="de-v" name="vence" type="date" value="${esc(d.vence || '')}"></div></div>
    ${d.origen ? '<span class="small muted">Viene de un gasto compartido.</span>' : `<div class="field"><label for="de-c">¿La plata salió o entró de una cuenta?</label><select id="de-c" name="cuenta">${opcionesCuenta(s, d.cuenta || '', 'No, ninguna')}</select><span class="hint">Si prestaste de tu cuenta o te prestaron a tu cuenta, el saldo se ajusta solo.</span></div>`}
    <button class="btn primary block" type="submit">Guardar</button>
    ${d.id ? `<button class="btn ghost block" type="button" data-action="borrarDeuda" data-id="${esc(d.id)}">Borrar</button>` : ''}
  </form>`;
}

export const actions = {
  nuevaDeuda(ctx) { openModal('Nueva deuda o préstamo', formDeuda(ctx.state)); },
  abrirDeuda(ctx, el) {
    const s = ctx.state; const d = (s.deudas || []).find((x) => x.id === el.dataset.id);
    if (!d) return;
    const saldo = saldoDeuda(d);
    openModal(d.tipo === 'meDeben' ? `${d.persona} te debe` : `Le debés a ${d.persona}`, `
      <div class="card"><span class="small muted">${esc(d.nota || '')}</span><span class="u-fs-28-fw-800">${enSu(s, d, saldo)}</span>
        ${aprox(s, d) ? `<span class="small">${aprox(s, d)}</span>` : ''}
        <span class="small muted">De ${enSu(s, d, d.monto)}${d.vence ? ` · vence el ${parseISO(d.vence).toLocaleDateString('es-AR')}` : ''}</span></div>
      ${saldo > 0.5 ? `<form class="form" data-submit="pagoDeuda"><input type="hidden" name="id" value="${esc(d.id)}">
        <div class="field-row"><div class="field"><label for="dp-m">${d.tipo === 'meDeben' ? 'Te devolvió' : 'Pagaste'}</label><input id="dp-m" name="monto" inputmode="decimal" placeholder="Todo: ${enSu(s, d, saldo)}"><input type="hidden" name="saldo" value="${saldo}"></div>
        ${deudaEnOtraMoneda(s, d) ? `<div class="field"><label for="dp-en">En</label><select id="dp-en" name="en"><option value="${d.moneda}">${(ASSETS.find((a) => a.id === d.moneda) || {}).label || d.moneda}</option><option value="base">${monedaBase(s) === 'USD' ? 'Dólares' : 'Pesos'}${aBase(s, d.moneda) ? ` (a ${money(aBase(s, d.moneda))} cada uno)` : ''}</option></select></div>` : ''}
        <div class="field"><label for="dp-c">${d.tipo === 'meDeben' ? 'Entró en' : 'Salió de'}</label><select id="dp-c" name="cuenta">${opcionesCuenta(s, cuentaPrincipal(s), 'Ninguna (efectivo sin seguir)')}</select></div></div>
<div class="field"><label for="dp-f">¿Cuándo?</label><input id="dp-f" name="date" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        <button class="btn green block" type="submit">${d.tipo === 'meDeben' ? 'Registrar cobro' : 'Registrar pago'}</button></form>
        <button class="btn block" data-action="avisarDeuda" data-id="${esc(d.id)}">${icon('send', 18)} ${d.tipo === 'meDeben' ? 'Recordarle por WhatsApp' : 'Avisarle por WhatsApp'}</button>` : '<p class="text pos"><b>Saldada.</b></p>'}
      ${(d.pagos || []).length ? `<div class="card tight">${d.pagos.map((p) => `<div class="row"><span class="grow"><span class="name">${d.tipo === 'meDeben' ? 'Cobraste' : 'Pagaste'}</span><span class="meta">${relDay(p.date)}</span></span><span class="amount">${enSu(s, d, p.monto)}</span></div>`).join('')}</div>` : ''}
      <button class="btn small" data-action="editarDeuda" data-id="${esc(d.id)}">Editar</button>`);
  },
  editarDeuda(ctx, el) { const d = (ctx.state.deudas || []).find((x) => x.id === el.dataset.id); if (d) openModal('Editar', formDeuda(ctx.state, d), { push: true }); },
  guardarDeuda(ctx, d) {
    const monto = num(d.monto);
    if (!monto || !String(d.persona || '').trim()) { toast('Completá persona y monto'); return; }
    ctx.commit((s) => {
      s.deudas = s.deudas || [];
      const prev = s.deudas.find((x) => x.id === d.id);
      const moneda = MONEDAS_DEUDA.includes(d.moneda) ? d.moneda : monedaBase(s);
      const item = { ...(prev || { id: uid(), pagos: [] }), tipo: d.tipo === 'debo' ? 'debo' : 'meDeben', persona: d.persona.trim().slice(0, 40), monto, nota: String(d.nota || '').trim().slice(0, 80), date: d.date || todayISO(), vence: d.vence || '', moneda };
      if (moneda !== monedaBase(s)) { if (!prev || prev.moneda !== moneda || !prev.tc) item.tc = aBase(s, moneda) || 0; } else delete item.tc;
      if (!item.origen) item.cuenta = d.cuenta || '';
      if (prev) Object.assign(prev, item); else s.deudas.push(item);
    });
    closeModal(); toast('Guardado');
  },
  pagoDeuda(ctx, d) {
    let monto = num(d.monto) || num(d.saldo); // vacío = todo lo que falta
    if (!monto) return;
    const x0 = (ctx.state.deudas || []).find((y) => y.id === d.id);
    const tc = x0 && deudaEnOtraMoneda(ctx.state, x0) ? aBase(ctx.state, x0.moneda) : 0;
    // pagado en tu moneda: lo paso a la moneda de la deuda
    if (num(d.monto) && d.en === 'base') { if (!tc) { toast('No tengo la cotización ahora'); return; } monto = monto / tc; }
    ctx.commit((s) => {
      const x = (s.deudas || []).find((y) => y.id === d.id);
      if (x) x.pagos = [...(x.pagos || []), { id: uid(), date: d.date && d.date <= todayISO() ? d.date : todayISO(), monto: Math.round(Math.min(monto, saldoDeuda(x)) * 100) / 100, cuenta: d.cuenta || '', ...(tc ? { tc } : {}) }];
    });
    closeModal(); toast('Anotado');
  },
  avisarDeuda(ctx, el) {
    const d = (ctx.state.deudas || []).find((x) => x.id === el.dataset.id);
    if (!d) return;
    const texto = d.tipo === 'meDeben'
      ? `¡Hola ${d.persona}! Te escribo por los ${enSu(ctx.state, d, saldoDeuda(d))}${d.nota ? ` de ${d.nota}` : ''}. Cuando puedas, avisame. ¡Gracias!`
      : `¡Hola ${d.persona}! Te debo ${enSu(ctx.state, d, saldoDeuda(d))}${d.nota ? ` de ${d.nota}` : ''}. Te los paso apenas pueda.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  },
  borrarDeuda(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Borrado', (s) => { s.deudas = (s.deudas || []).filter((x) => x.id !== el.dataset.id); }); },
};
