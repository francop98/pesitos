// =========================================================
// Pesitos — pantalla "Mis cuentas": saldo de cada cuenta, transferencias,
// ajustar con el saldo real y patrimonio.
// =========================================================

import { money, esc, todayISO, relDay, num } from './formato.js';
import { screenHead, openModal, closeModal, toast, icon, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { tasaDe, textoTasa } from './rendimientos.js';
import { listaCuentas, cuentaPrincipal, saldoCuenta, cuentasConSaldo, movimientosDeCuenta, totalCuentas, nombreCuenta, patrimonio, detalleSaldo, cuentaPuedeRendir, tnaCuenta } from './cuentas.js';

const signo = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const opcionesCuenta = (s, sel) => listaCuentas(s).map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

export function render(s) {
  return `<section class="screen">
    ${screenHead('Saldo', `<button class="btn small" data-action="nuevaTransferencia">${icon('swap', 18)} Transferir</button>`, 'Cuánto tenés en cada cuenta')}
    ${cuerpo(s)}
  `;
}

/** Saldo de cada cuenta y transferencias (también en Mi plata → Cuentas). */
export function cuerpo(s) {
  const todas = listaCuentas(s);
  const con = cuentasConSaldo(s);
  const ppal = cuentaPrincipal(s);
  return `
    <div class="card green" style="gap:6px">
      <span class="hero-label">${con.length ? 'Tenés en tus cuentas' : 'Cargá el saldo de tus cuentas'}</span>
      <span class="hero-number" style="font-size:34px">${con.length ? money(totalCuentas(s)) : '—'}</span>
      <span class="small on-green-muted">${con.length ? `Se actualiza solo con lo que anotás${con.some((c) => tnaCuenta(s, c.id)) ? ' y con los intereses de las cuentas que rinden' : ''}. Si no coincide con tu banco, tocá la cuenta y ajustalo.` : 'Tocá una cuenta y poné cuánto tiene hoy: después se actualiza sola con cada gasto e ingreso.'}</span>
      ${con.length ? `<button class="link-btn on-green-muted" data-action="openComparar" style="align-self:flex-start">Comparar con el banco${s.comparacion && s.comparacion.ultima ? ` (última vez: ${relDay(s.comparacion.ultima).toLowerCase()})` : ''} ›</button>` : ''}
    </div>
    <div class="card tight">${todas.map((c) => { const sal = saldoCuenta(s, c.id); return `<button class="row" data-action="abrirCuenta" data-id="${esc(c.id)}">
      <span class="cat-icon ${c.id === ppal ? 'green' : ''}">${icon(c.id === 'efectivo' ? 'wallet' : 'card', 18)}</span>
      <span class="grow"><span class="name">${esc(c.name)}</span><span class="meta">${c.id === ppal ? 'Cuenta principal · ' : ''}${sal == null ? 'Sin saldo cargado' : `Desde el ${s.cuentas[c.id].desde.split('-').reverse().slice(0, 2).join('/')}`}${sal != null && tnaCuenta(s, c.id) ? ` · rinde ${textoTasa(tasaDe(s, c.id), money)}` : ''}</span></span>
      <span class="amount ${sal != null && sal < 0 ? 'neg' : ''}">${sal == null ? 'Cargar' : money(sal)}</span></button>`; }).join('')}</div>
    <p class="small muted">¿Falta una cuenta? Agregala en menú ☰ → Mis medios de pago. Las tarjetas de crédito están en <a href="#/tarjetas">Por pagar → Tarjetas</a>.</p>

    ${(s.transferencias || []).length ? `<div class="section-title"><span>Últimas transferencias</span></div>
    <div class="card tight">${s.transferencias.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((t) => `<button class="row" data-action="editarTransferencia" data-id="${esc(t.id)}">
      <span class="cat-icon">${icon('swap', 18)}</span><span class="grow"><span class="name">${esc(nombreCuenta(s, t.from))} → ${esc(nombreCuenta(s, t.to))}</span><span class="meta">${relDay(t.date)}${t.note ? ' · ' + esc(t.note) : ''}</span></span><span class="amount">${money(t.amount)}</span></button>`).join('')}</div>` : ''}
  </section>`;
}


/** Patrimonio neto: lo que tenés menos lo que debés (arriba de Mi plata). */
export function patrimonioHtml(s, abierto = false) {
  const pat = patrimonio(s);
  return `<div class="card patrimonio">
    <button class="pat-top" data-action="patToggle" aria-expanded="${abierto}"><span class="grow"><span class="small muted" style="font-weight:700">Tu patrimonio neto</span><b class="pat-v ${pat.neto >= 0 ? '' : 'neg'}">${money(pat.neto)}</b><span class="small muted">Lo que tenés menos lo que debés</span></span>${icon('chevron', 18)}</button>
    ${abierto ? `<div class="pat-detalle">
      <div class="split"><span>Cuentas</span><b>${money(pat.cuentas)}</b></div>
      <div class="split"><span>Ahorros e inversiones</span><b>${money(pat.ahorros)}</b></div>
      ${pat.meDeben ? `<div class="split"><span>Te deben</span><b>${money(pat.meDeben)}</b></div>` : ''}
      ${pat.tarjetas ? `<div class="split"><span>Tarjetas (lo que falta pagar)</span><b>−${money(pat.tarjetas)}</b></div>` : ''}
      ${pat.creditos ? `<div class="split"><span>Créditos y cuotas que faltan</span><b>−${money(pat.creditos)}</b></div>` : ''}
      ${pat.debo ? `<div class="split"><span>Debés a otras personas</span><b>−${money(pat.debo)}</b></div>` : ''}
      ${pat.conCuentas ? '' : '<span class="small muted">Para que sea exacto, cargá el saldo de tus cuentas.</span>'}
      <button class="btn small ghost" data-action="verDeudas" style="align-self:flex-start">Ver deudas y préstamos</button>
    </div>` : ''}
  </div>`;
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

// ---------- comparar con el banco (una vez por semana) ----------
// El saldo que calcula Pesitos puede alejarse del real (un gasto sin anotar, un débito,
// un reintegro distinto). Cada 7 días te pido que lo compares y ajusto la diferencia.
export function compararPendiente(s) {
  if (!cuentasConSaldo(s).length) return false;
  const u = s.comparacion && s.comparacion.ultima;
  if (!u) return true;
  return (Date.now() - new Date(u + 'T12:00:00').getTime()) / 86400000 >= 7;
}
export function compararCard(s) {
  if (!compararPendiente(s)) return '';
  const n = cuentasConSaldo(s).length;
  return `<div class="card"><div class="tip-head"><span style="color:var(--green)">${icon('scale', 20)}</span><strong>¿Tu saldo coincide con el del banco?</strong></div>
    <span class="text">Una vez por semana conviene comparar: si anotaste todo, coincide; si no, lo ajusto y seguimos desde el saldo real.</span>
    <div class="btn-row"><button class="btn small primary" data-action="openComparar">Comparar ${n === 1 ? 'mi cuenta' : `mis ${n} cuentas`}</button><button class="btn small" data-action="compararCoincide">Coinciden</button></div></div>`;
}

export const actions = {
  openComparar(ctx) {
    const s = ctx.state;
    openModal('Comparar con el banco', `<form class="form" data-submit="guardarComparar">
      <p class="text muted" style="margin:0">Abrí la app de cada banco o billetera y escribí el saldo de hoy. Si coincide, dejalo vacío.</p>
      ${cuentasConSaldo(s).map((c) => `<div class="field"><label for="cmp-${esc(c.id)}">${esc(c.name)}</label><input id="cmp-${esc(c.id)}" name="c_${esc(c.id)}" inputmode="decimal" placeholder="Pesitos: ${money(saldoCuenta(s, c.id) || 0)}"></div>`).join('')}
      <button class="btn primary block" type="submit">Listo</button></form>`);
  },
  guardarComparar(ctx, d) {
    const difs = [];
    ctx.commit((s) => {
      for (const c of cuentasConSaldo(s)) {
        const raw = String(d[`c_${c.id}`] || '').trim(); if (!raw) continue;
        const real = num(raw); const calc = saldoCuenta(s, c.id) || 0;
        if (Math.abs(real - calc) >= 1) difs.push(`${c.name}: ${real > calc ? '+' : '−'}${money(Math.abs(real - calc))}`);
        s.cuentas = { ...(s.cuentas || {}), [c.id]: { saldo: real, desde: todayISO() } };
      }
      s.comparacion = { ultima: todayISO(), difs: difs.slice(0, 6) };
    });
    closeModal();
    toast(difs.length ? `Ajustado. Diferencia: ${difs.join(' · ')}` : '¡Coincide todo!');
  },
  compararCoincide(ctx) {
    ctx.commit((s) => { s.comparacion = { ultima: todayISO(), difs: [] }; });
    toast('¡Bien! Te pregunto de nuevo en una semana');
  },
  abrirCuenta(ctx, el) {
    const s = ctx.state; const id = el.dataset.id;
    const c = s.cuentas && s.cuentas[id];
    const sal = saldoCuenta(s, id);
    const movs = c ? movimientosDeCuenta(s, id, c.desde).slice(0, 15) : [];
    const det = detalleSaldo(s, id);
    const noRinde = (s.cuentasRinden || {})[id] === false;
    const tObj = tasaDe(s, id); const tasaHoy = tObj && tObj.tna;
    openModal(nombreCuenta(s, id), `
      ${sal != null ? `<div class="card"><span class="small muted">Saldo de hoy</span><span style="font-size:28px;font-weight:800">${money(sal)}</span>${det && det.intereses >= 1 ? `<span class="small pos">Incluye +${money(det.intereses)} de intereses desde el ${c.desde.split('-').reverse().slice(0, 2).join('/')}</span>` : ''}</div>` : ''}
      ${cuentaPuedeRendir(id) ? `<div class="card"><div class="cuenta-rinde"><span class="grow"><strong>¿Te da intereses?</strong><br><span class="small muted">${tObj ? `Hoy rinde <b>${textoTasa(tObj, money)}</b>.${tObj.condiciones ? ` ${esc(tObj.condiciones)}.` : ''}<br>${esc(tObj.fuente || '')}${tObj.fecha ? `, vigente desde el ${String(tObj.fecha).slice(0, 10).split('-').reverse().join('/')}` : ''}. Se actualiza sola dos veces por día.${tObj.control ? `<br>ℹ️ ${esc(tObj.control)}` : ''}` : 'Busco la tasa del día apenas haya conexión.'}</span></span>
        <div class="tabs" style="grid-template-columns:repeat(2,minmax(0,1fr));flex:0 0 120px"><button data-action="cuentaRinde" data-id="${esc(id)}" data-v="1" aria-pressed="${!noRinde}">Sí</button><button data-action="cuentaRinde" data-id="${esc(id)}" data-v="0" aria-pressed="${noRinde}">No</button></div></div>
        <span class="small muted">Si es sí, sumo los intereses al saldo cada día, sobre lo que quedó en la cuenta a la noche.</span></div>` : ''}
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
  cuentaRinde(ctx, el) {
    const id = el.dataset.id; const si = el.dataset.v === '1';
    ctx.commit((s) => { s.cuentasRinden = { ...(s.cuentasRinden || {}), [id]: si }; });
    closeModal(); toast(si ? 'Listo: sumo los intereses todos los días' : 'Listo: no le sumo intereses');
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
