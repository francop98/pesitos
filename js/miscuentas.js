// =========================================================
// Pesitos — pantalla "Mis cuentas": saldo de cada cuenta, transferencias,
// ajustar con el saldo real y patrimonio.
// =========================================================

import { money, esc, todayISO, relDay, num, parseISO, MONTHS } from './formato.js';
const shortDate = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`; };
import { screenHead, openModal, closeModal, toast, icon, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { tasaDe, textoTasa, valorHoy } from './rendimientos.js';
import { budget, metaDiario } from './calculos.js';
import { monedaBase } from './cotizaciones.js';
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

// ---------- pasar plata de una cuenta a ahorros ----------
// Cuánto te toca apartar en este ciclo según tu forma de ahorrar y tus reglas,
// cuánto ya pasaste y cuánto falta. Tipos de pase:
//  regla: lo que te tocaba ahorrar (ya estaba descontado de "Hoy podés gastar")
//  extra: algo más, de lo que tenías para gastar (baja "Hoy podés gastar")
//  mover: plata que ya estaba ahorrada en la cuenta (solo cambia de lugar)
export function ahorroDelCiclo(s) {
  const b = budget(s);
  const sobra = s.savingMode === 'leftover';
  const toca = Math.round(sobra ? Math.max(0, b.free) : b.saving);
  const enCiclo = (s.transfers || []).filter((t) => t.date >= b.cycle.startISO && t.date < b.cycle.nextISO);
  const pasado = Math.round(enCiclo.filter((t) => (t.tipo ? t.tipo === 'regla' : !t.deDiario)).reduce((a, t) => a + t.amount, 0));
  return { b, sobra, toca, pasado, falta: Math.max(0, toca - pasado), partes: sobra ? [] : b.savingParts };
}
// ---------- el único lugar para pasar plata a ahorros (Mi plata → Ahorros) ----------
// Junta lo que te toca por tu forma de ahorrar, lo que no gastaste de tus días y "otro monto".
export function panelAhorrar(s) {
  const a = ahorroDelCiclo(s);
  const b = a.b;
  const meta = metaDiario(s);
  const sinForma = !s.savingMode || s.savingMode === 'none';
  const fila = (titulo, sub, monto, attrs, hecho = '') => `<div class="row" style="cursor:default">
      <span class="grow"><span class="name">${titulo}</span><span class="meta">${sub}</span></span>
      ${hecho ? `<span class="pill ok">${hecho}</span>` : `<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><b class="amount">${money(monto)}</b><button class="btn small green" data-action="pasarAhorros" ${attrs}>Pasar</button></span>`}
    </div>`;
  const filas = [];
  if (sinForma) filas.push(`<div class="row" style="cursor:default"><span class="grow"><span class="name">Lo de cada mes</span><span class="meta">Todavía no elegiste cuánto ahorrar por mes.</span></span><a class="btn small" href="#/formaahorro">Elegir</a></div>`);
  else if (a.sobra) filas.push(b.cycle.daysLeft <= 3 && a.toca > 0 ? fila('Lo que te sobró del mes', 'Elegiste ahorrar lo que sobra', a.toca, `data-monto="${a.toca}" data-tipo="regla"`)
    : `<div class="row" style="cursor:default"><span class="grow"><span class="name">Lo que te sobre del mes</span><span class="meta">Elegiste ahorrar lo que sobra: te lo propongo cuando falten 3 días para el cobro${a.toca > 0 ? ` (hoy serían ${money(a.toca)})` : ''}.</span></span></div>`);
  else if (a.toca > 0) filas.push(fila('Lo de este mes', a.pasado ? `Según tu forma de ahorrar (${money(a.toca)}). Ya pasaste ${money(a.pasado)}` : `Según tu forma de ahorrar${a.partes.length > 1 ? ` (${a.partes.map((p) => esc(p.name)).join(', ')})` : ''}`, a.falta, `data-monto="${a.falta}" data-tipo="regla"`, a.falta <= 0 ? 'Listo ✓' : ''));
  if (b.paraAhorrar >= 1) filas.push(fila('Lo que no gastaste de tus días', meta ? `Va a "${esc(meta.name)}"` : 'Lo que te sobró de días anteriores', b.paraAhorrar, `data-monto="${Math.round(b.paraAhorrar)}" data-tipo="extra"${meta ? ` data-goal="${esc(meta.id)}"` : ''}`));
  const ultimos = (s.transfers || []).filter((t) => t.holdingId || t.deDiario || t.tipo).slice(-3).reverse();
  return `<div class="card" style="gap:8px">
    <div class="split"><strong>Pasar a ahorros</strong><button class="btn small" data-action="pasarAhorros" data-tipo="extra">Otro monto</button></div>
    <div class="tight" style="display:flex;flex-direction:column">${filas.join('')}</div>
    ${ultimos.length ? `<span class="small muted">Últimos: ${ultimos.map((t) => `${money(t.amount)} el ${shortDate(t.date)}`).join(' · ')}</span>` : ''}
    <div class="btn-row"><a class="link-btn" href="#/formaahorro">Cambiar cuánto ahorro por mes</a><button class="link-btn" data-action="openDiario">Qué pasa con lo que no gasto</button></div>
  </div>`;
}

function formAhorrar(s, monto = 0, tipoForzado = '', metaId = '') {
  const base = monedaBase(s);
  const lugares = (s.holdings || []).filter((h) => (h.currency || 'ARS') === base);
  const g = (metaId && (s.goals || []).find((x) => x.id === metaId)) || (s.goals || []).find((x) => x.main) || (s.goals || [])[0];
  const a = ahorroDelCiclo(s);
  const sugerido = monto || a.falta;
  const tipo = tipoForzado || (a.falta > 0 && !monto ? 'regla' : 'extra');
  const sinForma = !s.savingMode || s.savingMode === 'none';
  const resumen = sinForma ? '<div class="card"><strong>Todavía no elegiste cómo ahorrar</strong><span class="small">Si elegís una forma (por ejemplo, apartar el 10% apenas cobrás), te digo cuánto pasar cada mes. <a href="#/formaahorro">Elegir</a></span></div>'
    : a.sobra ? `<div class="card lime"><strong>Elegiste ahorrar lo que te sobra</strong><span class="small">${a.b.cycle.daysLeft <= 3 ? `Se termina el mes y te sobran <b>${money(a.toca)}</b>: eso es lo que te toca pasar.` : `Hoy te sobrarían ${money(a.toca)}, pero faltan ${a.b.cycle.daysLeft} días: lo ideal es pasarlo cuando termine el mes.`}</span></div>`
    : `<div class="card lime"><strong>${a.falta > 0 ? `Este mes te toca pasar ${money(a.falta)}` : 'Este mes ya apartaste lo que te toca'}</strong>
      ${a.partes.map((p) => `<div class="split small"><span>${esc(p.name)}</span><b>${money(p.amount)}</b></div>`).join('')}
      <div class="split small"><span>Total según tus reglas</span><b>${money(a.toca)}</b></div>
      ${a.pasado ? `<div class="split small"><span>Ya pasaste</span><b>−${money(a.pasado)}</b></div>` : ''}
      <span class="small">Eso ya está descontado de tu "Hoy podés gastar": pasarlo no te baja lo que podés gastar.</span></div>`;
  const op = (v, t, d) => `<label class="check"><input type="radio" name="tipo" value="${v}" ${v === tipo ? 'checked' : ''}> <span>${t}<br><span class="small muted">${d}</span></span></label>`;
  return `<form class="form" data-submit="guardarAhorrar">
    ${resumen}
    <div class="field-row"><div class="field"><label for="ah-a">¿Cuánto pasás?</label><input id="ah-a" name="amount" inputmode="decimal" required value="${sugerido ? Math.round(sugerido).toLocaleString('es-AR') : ''}" placeholder="Ej: 50.000"></div>
    <div class="field"><label for="ah-f">¿De qué cuenta sale?</label><select id="ah-f" name="from">${opcionesCuenta(s, cuentaPrincipal(s))}</select></div></div>
    <div class="field"><label for="ah-h">¿A dónde va?</label><select id="ah-h" name="holding" data-change="ahorrarLugar">
      ${lugares.map((h) => `<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('')}
      <option value="__nuevo" ${lugares.length ? '' : 'selected'}>Otro lugar (lo agrego)</option></select></div>
    <div class="field-row" data-ah-nuevo ${lugares.length ? 'hidden' : ''}><div class="field"><label for="ah-n">Nombre del lugar</label><input id="ah-n" name="nombre" placeholder="Ej: Frasco Naranja X"></div>
      <div class="field"><label for="ah-t">Tasa anual (si rinde)</label><input id="ah-t" name="tna" inputmode="decimal" placeholder="Ej: 30"></div></div>
    ${(s.goals || []).length ? `<div class="field"><label for="ah-g">Sumarlo a una meta (opcional)</label><select id="ah-g" name="goal"><option value="">Ninguna</option>${s.goals.map((x) => `<option value="${esc(x.id)}" ${g && x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><span class="label-like">¿Qué es esta plata?</span>
      ${sinForma ? '' : op('regla', a.sobra ? 'Lo que me sobró del mes' : 'Lo que me toca ahorrar este mes', a.sobra ? 'Baja tu "Hoy podés gastar" (es lo que te quedaba libre).' : 'No cambia tu "Hoy podés gastar": ya estaba descontado.')}
      ${op('extra', 'Algo extra, de lo que tenía para gastar', 'Baja tu "Hoy podés gastar".')}
      ${op('mover', 'Plata que ya tenía ahorrada en la cuenta', 'Solo la cambio de lugar: no toca lo que podés gastar.')}</div>
    <span class="small muted">Baja el saldo de la cuenta de la que sale y suma a tus ahorros (y a la meta, si elegiste una).</span>
    <button class="btn primary block" type="submit">Pasar a ahorros</button>
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
  pasarAhorros(ctx, el) { const ds = (el && el.dataset) || {}; openModal('Pasar a ahorros', formAhorrar(ctx.state, num(ds.monto), ds.tipo || '', ds.goal || '')); },
  ahorrarLugar(ctx, el) { const f = el.closest('form'); f.querySelector('[data-ah-nuevo]').hidden = el.value !== '__nuevo'; },
  guardarAhorrar(ctx, d) {
    const amount = Math.round(num(d.amount) * 100) / 100;
    if (!(amount > 0)) { toast('Poné un monto'); return; }
    const saldo = saldoCuenta(ctx.state, d.from);
    let lugar = ''; let meta = ''; let delMes = false;
    ctx.commit((s) => {
      s.holdings = s.holdings || [];
      let h = s.holdings.find((x) => x.id === d.holding);
      if (!h) {
        const tna = num(d.tna);
        h = { id: uid(), type: /plazo/i.test(d.nombre || '') ? 'plazo_fijo' : /colch|efectivo/i.test(d.nombre || '') ? 'efectivo' : 'remunerada', name: String(d.nombre || '').trim() || 'Ahorro', amount: 0, currency: monedaBase(s), rinde: tna > 0 ? 'manual' : 'no', tna: tna > 0 ? tna : 0, since: tna > 0 ? todayISO() : '' };
        s.holdings.push(h);
      }
      // si rinde, sumo sobre el valor de hoy (con los intereses) y arranca de nuevo
      if (h.since) { h.amount = Math.round(valorHoy(s, h) * 100) / 100 + amount; h.since = todayISO(); } else h.amount = Math.round((Number(h.amount) || 0) * 100 + amount * 100) / 100;
      lugar = h.name;
      const g = (s.goals || []).find((x) => x.id === d.goal);
      if (g) { g.saved += amount; meta = g.name; }
      s.transfers = s.transfers || [];
      const tipo = d.tipo || 'extra';
      const baja = tipo === 'extra' || (tipo === 'regla' && s.savingMode === 'leftover');
      s.transfers.push({ id: uid(), date: todayISO(), amount, accountId: d.from, holdingId: h.id, tipo, ...(g ? { goalId: g.id } : {}), ...(baja ? { deDiario: true } : {}), note: `A ahorros: ${h.name}` });
      delMes = baja;
    });
    // si ya pasaste todo lo que te tocaba, no te lo recuerdo más este mes
    if (d.tipo === 'regla') { const a = ahorroDelCiclo(ctx.state); if (a.falta <= 0) ctx.update((s) => { s.setAside = { ...(s.setAside || {}), [todayISO().slice(0, 7)]: true }; }); }
    closeModal();
    toast(`Listo: ${money(amount)} a ${lugar}${meta ? ` (meta "${meta}")` : ''}${delMes ? '. Bajó tu "Hoy podés gastar"' : d.tipo === 'regla' ? '. Es lo de tus reglas: lo que podés gastar no cambia' : ''}${saldo != null && amount > saldo ? '. Ojo: es más de lo que tenías en la cuenta' : ''}`);
  },
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
