// =========================================================
// Pesitos — deudas y préstamos: "me deben" y "debo"
// Se crean a mano o solas con un gasto compartido. Se cobran o pagan de a partes.
// =========================================================

import { money, esc, todayISO, relDay, num, parseISO } from './formato.js';
import { screenHead, openModal, closeModal, toast, icon, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { listaCuentas, cuentaPrincipal, saldoDeuda, pagadoDeuda, deudasAbiertas, totalMeDeben, totalDebo } from './cuentas.js';

const opcionesCuenta = (s, sel, ninguna = '') => `${ninguna ? `<option value="">${ninguna}</option>` : ''}${listaCuentas(s).map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;

function fila(d) {
  const saldo = saldoDeuda(d);
  const vencida = d.vence && d.vence < todayISO() && saldo > 0;
  return `<button class="row" data-action="abrirDeuda" data-id="${esc(d.id)}">
    <span class="cat-icon ${d.tipo === 'meDeben' ? 'green' : ''}">${icon(d.tipo === 'meDeben' ? 'down' : 'up', 18)}</span>
    <span class="grow"><span class="name">${esc(d.persona)}</span><span class="meta">${esc(d.nota || (d.tipo === 'meDeben' ? 'Te debe' : 'Le debés'))} · ${relDay(d.date)}${pagadoDeuda(d) ? ` · ya ${d.tipo === 'meDeben' ? 'te devolvió' : 'pagaste'} ${money(pagadoDeuda(d))}` : ''}</span></span>
    <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="amount ${d.tipo === 'meDeben' ? 'pos' : ''}">${money(saldo)}</span>${vencida ? '<span class="pill warn">Venció</span>' : ''}</span></button>`;
}

export function render(s) {
  const meDeben = deudasAbiertas(s, 'meDeben');
  const debo = deudasAbiertas(s, 'debo');
  const saldadas = (s.deudas || []).filter((d) => saldoDeuda(d) <= 0.5).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return `<section class="screen">
    ${screenHead('Deudas y préstamos', `<button class="btn small" data-action="nuevaDeuda">+ Nueva</button>`, 'Lo que te deben y lo que debés')}
    <div class="stat-grid">
      <div class="stat"><span class="k">Te deben</span><span class="v pos">${money(totalMeDeben(s))}</span><span class="small muted">${meDeben.length} persona${meDeben.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="k">Debés</span><span class="v">${money(totalDebo(s))}</span><span class="small muted">${debo.length} persona${debo.length === 1 ? '' : 's'}</span></div>
    </div>
    <div class="section-title"><span>Te deben</span></div>
    <div class="card tight">${meDeben.length ? meDeben.map(fila).join('') : '<p class="empty">Nadie te debe plata. Cuando prestes o pagues algo compartido, anotalo acá.</p>'}</div>
    <div class="section-title"><span>Debés</span></div>
    <div class="card tight">${debo.length ? debo.map(fila).join('') : '<p class="empty">No le debés a nadie.</p>'}</div>
    ${saldadas.length ? `<div class="section-title"><span>Saldadas</span></div><div class="card tight">${saldadas.map(fila).join('')}</div>` : ''}
    <p class="small muted">Los créditos con cuotas (préstamos personales, planes) se cargan como gasto fijo con cuotas en Movimientos. Los gastos compartidos crean su deuda solos.</p>
  </section>`;
}

function formDeuda(s, d = {}) {
  return `<form class="form" data-submit="guardarDeuda">
    <input type="hidden" name="id" value="${esc(d.id || '')}">
    <div class="kind-toggle" role="group" aria-label="Tipo"><label class="kt"><input type="radio" name="tipo" value="meDeben" ${d.tipo !== 'debo' ? 'checked' : ''}> Me deben</label><label class="kt"><input type="radio" name="tipo" value="debo" ${d.tipo === 'debo' ? 'checked' : ''}> Debo</label></div>
    <div class="field-row"><div class="field"><label for="de-p">Persona</label><input id="de-p" name="persona" value="${esc(d.persona || '')}" required placeholder="Ej: Juan"></div>
    <div class="field"><label for="de-m">Monto</label><input id="de-m" name="monto" inputmode="decimal" value="${d.monto || ''}" required placeholder="Ej: 20.000"></div></div>
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
      <div class="card"><span class="small muted">${esc(d.nota || '')}</span><span style="font-size:28px;font-weight:800">${money(saldo)}</span>
        <span class="small muted">De ${money(d.monto)}${d.vence ? ` · vence el ${parseISO(d.vence).toLocaleDateString('es-AR')}` : ''}</span></div>
      ${saldo > 0.5 ? `<form class="form" data-submit="pagoDeuda"><input type="hidden" name="id" value="${esc(d.id)}">
        <div class="field-row"><div class="field"><label for="dp-m">${d.tipo === 'meDeben' ? 'Te devolvió' : 'Pagaste'}</label><input id="dp-m" name="monto" inputmode="decimal" value="${Math.round(saldo)}"></div>
        <div class="field"><label for="dp-c">${d.tipo === 'meDeben' ? 'Entró en' : 'Salió de'}</label><select id="dp-c" name="cuenta">${opcionesCuenta(s, cuentaPrincipal(s), 'Ninguna (efectivo sin seguir)')}</select></div></div>
        <button class="btn green block" type="submit">${d.tipo === 'meDeben' ? 'Registrar cobro' : 'Registrar pago'}</button></form>
        <button class="btn block" data-action="avisarDeuda" data-id="${esc(d.id)}">${icon('send', 18)} ${d.tipo === 'meDeben' ? 'Recordarle por WhatsApp' : 'Avisarle por WhatsApp'}</button>` : '<p class="text pos"><b>Saldada.</b></p>'}
      ${(d.pagos || []).length ? `<div class="card tight">${d.pagos.map((p) => `<div class="row"><span class="grow"><span class="name">${d.tipo === 'meDeben' ? 'Cobraste' : 'Pagaste'}</span><span class="meta">${relDay(p.date)}</span></span><span class="amount">${money(p.monto)}</span></div>`).join('')}</div>` : ''}
      <button class="btn small" data-action="editarDeuda" data-id="${esc(d.id)}">Editar</button>`);
  },
  editarDeuda(ctx, el) { const d = (ctx.state.deudas || []).find((x) => x.id === el.dataset.id); if (d) openModal('Editar', formDeuda(ctx.state, d), { push: true }); },
  guardarDeuda(ctx, d) {
    const monto = num(d.monto);
    if (!monto || !String(d.persona || '').trim()) { toast('Completá persona y monto'); return; }
    ctx.commit((s) => {
      s.deudas = s.deudas || [];
      const prev = s.deudas.find((x) => x.id === d.id);
      const item = { ...(prev || { id: uid(), pagos: [] }), tipo: d.tipo === 'debo' ? 'debo' : 'meDeben', persona: d.persona.trim().slice(0, 40), monto, nota: String(d.nota || '').trim().slice(0, 80), date: d.date || todayISO(), vence: d.vence || '' };
      if (!item.origen) item.cuenta = d.cuenta || '';
      if (prev) Object.assign(prev, item); else s.deudas.push(item);
    });
    closeModal(); toast('Guardado');
  },
  pagoDeuda(ctx, d) {
    const monto = num(d.monto);
    if (!monto) return;
    ctx.commit((s) => {
      const x = (s.deudas || []).find((y) => y.id === d.id);
      if (x) x.pagos = [...(x.pagos || []), { id: uid(), date: todayISO(), monto: Math.min(monto, saldoDeuda(x)), cuenta: d.cuenta || '' }];
    });
    closeModal(); toast('Anotado');
  },
  avisarDeuda(ctx, el) {
    const d = (ctx.state.deudas || []).find((x) => x.id === el.dataset.id);
    if (!d) return;
    const texto = d.tipo === 'meDeben'
      ? `¡Hola ${d.persona}! Te escribo por los ${money(saldoDeuda(d))}${d.nota ? ` de ${d.nota}` : ''}. Cuando puedas, avisame. ¡Gracias!`
      : `¡Hola ${d.persona}! Te debo ${money(saldoDeuda(d))}${d.nota ? ` de ${d.nota}` : ''}. Te los paso apenas pueda.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  },
  borrarDeuda(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Borrado', (s) => { s.deudas = (s.deudas || []).filter((x) => x.id !== el.dataset.id); }); },
};
