// =========================================================
// Pesitos — pantalla "Mis cuentas": saldo de cada cuenta, transferencias,
// ajustar con el saldo real y patrimonio.
// =========================================================

import { money, esc, todayISO, relDay, num } from './formato.js';
import { screenHead, openModal, closeModal, toast, icon, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { listaCuentas, cuentaPrincipal, saldoCuenta, cuentasConSaldo, movimientosDeCuenta, totalCuentas, nombreCuenta, patrimonio } from './cuentas.js';

const signo = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const opcionesCuenta = (s, sel) => listaCuentas(s).map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

export function render(s) {
  const todas = listaCuentas(s);
  const con = cuentasConSaldo(s);
  const ppal = cuentaPrincipal(s);
  const pat = patrimonio(s);
  return `<section class="screen">
    ${screenHead('Mis cuentas', `<button class="btn small" data-action="nuevaTransferencia">${icon('swap', 18)} Transferir</button>`, 'Cuánto tenés en cada lado')}
    <div class="card green" style="gap:6px">
      <span class="hero-label">${con.length ? 'Tenés en tus cuentas' : 'Cargá el saldo de tus cuentas'}</span>
      <span class="hero-number" style="font-size:34px">${con.length ? money(totalCuentas(s)) : '—'}</span>
      <span class="small on-green-muted">${con.length ? 'Se actualiza solo con lo que anotás. Si no coincide con tu banco, tocá la cuenta y ajustalo.' : 'Tocá una cuenta y poné cuánto tiene hoy: después se actualiza sola con cada gasto e ingreso.'}</span>
    </div>
    <div class="card tight">${todas.map((c) => { const sal = saldoCuenta(s, c.id); return `<button class="row" data-action="abrirCuenta" data-id="${esc(c.id)}">
      <span class="cat-icon ${c.id === ppal ? 'green' : ''}">${icon(c.id === 'efectivo' ? 'wallet' : 'card', 18)}</span>
      <span class="grow"><span class="name">${esc(c.name)}</span><span class="meta">${c.id === ppal ? 'Cuenta principal · ' : ''}${sal == null ? 'Sin saldo cargado' : `Desde el ${s.cuentas[c.id].desde.split('-').reverse().slice(0, 2).join('/')}`}</span></span>
      <span class="amount ${sal != null && sal < 0 ? 'neg' : ''}">${sal == null ? 'Cargar' : money(sal)}</span></button>`; }).join('')}</div>
    <p class="small muted">¿Falta una cuenta? Agregala en menú ☰ → Mis medios de pago. Las tarjetas de crédito están en <a href="#/tarjetas">Tarjetas</a>.</p>

    <div class="section-title"><span>Tu patrimonio</span><a href="#/deudas">Deudas y préstamos</a></div>
    <div class="card">
      <div class="split"><span>Cuentas</span><b>${money(pat.cuentas)}</b></div>
      <div class="split"><span>Ahorros e inversiones</span><b>${money(pat.ahorros)}</b></div>
      ${pat.meDeben ? `<div class="split"><span>Te deben</span><b>${money(pat.meDeben)}</b></div>` : ''}
      ${pat.tarjetas ? `<div class="split"><span>Tarjetas (lo que falta pagar)</span><b>−${money(pat.tarjetas)}</b></div>` : ''}
      ${pat.creditos ? `<div class="split"><span>Créditos y cuotas que faltan</span><b>−${money(pat.creditos)}</b></div>` : ''}
      ${pat.debo ? `<div class="split"><span>Debés a otras personas</span><b>−${money(pat.debo)}</b></div>` : ''}
      <div class="split" style="border-top:1px solid var(--line);padding-top:8px;font-size:16px"><span><b>Patrimonio neto</b></span><b class="${pat.neto >= 0 ? 'pos' : 'neg'}">${money(pat.neto)}</b></div>
      ${pat.conCuentas ? '' : '<span class="small muted">Para que sea exacto, cargá el saldo de tus cuentas.</span>'}
    </div>
    ${(s.transferencias || []).length ? `<div class="section-title"><span>Últimas transferencias</span></div>
    <div class="card tight">${s.transferencias.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((t) => `<button class="row" data-action="editarTransferencia" data-id="${esc(t.id)}">
      <span class="cat-icon">${icon('swap', 18)}</span><span class="grow"><span class="name">${esc(nombreCuenta(s, t.from))} → ${esc(nombreCuenta(s, t.to))}</span><span class="meta">${relDay(t.date)}${t.note ? ' · ' + esc(t.note) : ''}</span></span><span class="amount">${money(t.amount)}</span></button>`).join('')}</div>` : ''}
  </section>`;
}

function formTransferencia(s, t = {}) {
  const cuentas = listaCuentas(s);
  return `<form class="form" data-submit="guardarTransferencia">
    <input type="hidden" name="id" value="${esc(t.id || '')}">
    <div class="field-row"><div class="field"><label for="tr-f">Desde</label><select id="tr-f" name="from">${opcionesCuenta(s, t.from || cuentaPrincipal(s))}</select></div>
    <div class="field"><label for="tr-t">Hacia</label><select id="tr-t" name="to">${opcionesCuenta(s, t.to || (cuentas.find((c) => c.id !== (t.from || cuentaPrincipal(s))) || cuentas[0]).id)}</select></div></div>
    <div class="field-row"><div class="field"><label for="tr-a">Monto</label><input id="tr-a" name="amount" inputmode="decimal" value="${t.amount || ''}" required placeholder="Ej: 50.000"></div>
    <div class="field"><label for="tr-d">Fecha</label><input id="tr-d" name="date" type="date" value="${esc(t.date || todayISO())}" max="${todayISO()}"></div></div>
    <div class="field"><label for="tr-n">Nota (opcional)</label><input id="tr-n" name="note" value="${esc(t.note || '')}" placeholder="Ej: Retiré del cajero"></div>
    <span class="small muted">Pasar plata entre tus cuentas no es un gasto: no cambia lo que podés gastar.</span>
    <button class="btn primary block" type="submit">Guardar</button>
    ${t.id ? `<button class="btn ghost block" type="button" data-action="borrarTransferencia" data-id="${esc(t.id)}">Borrar</button>` : ''}
  </form>`;
}

export const actions = {
  abrirCuenta(ctx, el) {
    const s = ctx.state; const id = el.dataset.id;
    const c = s.cuentas && s.cuentas[id];
    const sal = saldoCuenta(s, id);
    const movs = c ? movimientosDeCuenta(s, id, c.desde).slice(0, 15) : [];
    openModal(nombreCuenta(s, id), `
      ${sal != null ? `<div class="card"><span class="small muted">Saldo de hoy</span><span style="font-size:28px;font-weight:800">${money(sal)}</span></div>` : ''}
      <form class="form" data-submit="ajustarSaldo"><input type="hidden" name="id" value="${esc(id)}">
        <div class="field"><label for="sa-v">${sal == null ? '¿Cuánto tenés hoy en esta cuenta?' : '¿No coincide? Poné el saldo real de hoy'}</label><input id="sa-v" name="saldo" inputmode="decimal" placeholder="Ej: 250.000" required></div>
        <button class="btn primary block" type="submit">${sal == null ? 'Guardar saldo' : 'Ajustar saldo'}</button></form>
      ${id !== cuentaPrincipal(s) ? `<button class="btn block" data-action="hacerPrincipal" data-id="${esc(id)}">Usarla como cuenta principal</button>` : '<span class="small muted">Es tu cuenta principal: los gastos rápidos salen de acá, salvo que elijas otra.</span>'}
      ${movs.length ? `<div class="section-title"><span>Últimos movimientos</span></div><div class="card tight">${movs.map((m) => `<div class="row"><span class="grow"><span class="name">${esc(m.texto)}</span><span class="meta">${relDay(m.date)}</span></span><span class="amount ${m.monto >= 0 ? 'pos' : ''}">${signo(m.monto)}</span></div>`).join('')}</div>` : ''}
      ${c ? `<button class="btn ghost small" data-action="quitarSaldo" data-id="${esc(id)}">Dejar de seguir el saldo de esta cuenta</button>` : ''}`);
  },
  ajustarSaldo(ctx, d) {
    const v = num(d.saldo);
    if (!String(d.saldo || '').trim()) return;
    ctx.commit((s) => { s.cuentas = { ...(s.cuentas || {}), [d.id]: { saldo: v, desde: todayISO() } }; if (!s.cuentaPrincipal) s.cuentaPrincipal = d.id; });
    closeModal(); toast('Saldo guardado: desde ahora se actualiza solo');
  },
  quitarSaldo(ctx, el) { ctx.commit((s) => { const c = { ...(s.cuentas || {}) }; delete c[el.dataset.id]; s.cuentas = c; }); closeModal(); },
  hacerPrincipal(ctx, el) { ctx.commit((s) => { s.cuentaPrincipal = el.dataset.id; }); closeModal(); toast('Listo, es tu cuenta principal'); },
  nuevaTransferencia(ctx) {
    if (listaCuentas(ctx.state).length < 2) { toast('Agregá otra cuenta en Mis medios de pago para poder transferir'); return; }
    openModal('Transferir entre cuentas', formTransferencia(ctx.state));
  },
  editarTransferencia(ctx, el) { const t = (ctx.state.transferencias || []).find((x) => x.id === el.dataset.id); if (t) openModal('Transferencia', formTransferencia(ctx.state, t)); },
  guardarTransferencia(ctx, d) {
    const amount = num(d.amount);
    if (!amount) { toast('Poné un monto'); return; }
    if (d.from === d.to) { toast('Elegí dos cuentas distintas'); return; }
    ctx.commit((s) => {
      s.transferencias = s.transferencias || [];
      const item = { id: d.id || uid(), date: d.date || todayISO(), from: d.from, to: d.to, amount, note: String(d.note || '').trim().slice(0, 60) };
      const i = s.transferencias.findIndex((x) => x.id === d.id);
      if (i >= 0) s.transferencias[i] = item; else s.transferencias.push(item);
    });
    closeModal(); toast('Transferencia guardada');
  },
  borrarTransferencia(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Transferencia borrada', (s) => { s.transferencias = (s.transferencias || []).filter((x) => x.id !== el.dataset.id); }); },
};
