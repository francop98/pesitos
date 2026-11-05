// Ahorro e inversiones: cuánto tenés, dónde y en qué moneda, cotizaciones
// en vivo, conversor y metas.

import { reintegrosCobrados, totalReintegros } from './reintegros.js';
import { money, pesos, esc, num, todayISO, monthName, monedaActual } from './formato.js';
import { holdingsTotal, holdingArs, goalEta, goalPct } from './calculos.js';
import { HOLDING_TYPES, holdingType, ASSETS, assetById } from './categorias.js';
import { insights } from './economista.js';
import { arsPer, convert, refreshRates, ratesAge, ratesStale, DOLARES, dolarRef, nombreDolar } from './cotizaciones.js';
import { planAhorroHtml } from './asesor.js';
import { cuerpo as cuerpoCuentas, patrimonioHtml } from './miscuentas.js';
import { cuerpo as sueldoCuerpo } from './sueldo.js';
import { ring, tipCard, icon, screenHead, openModal, closeModal, toast, setModalBody, borrarConDeshacer, ojoMontos, taparMontos } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { lessonCard } from './aprender.js';
import { BILLETERAS_QUE_RINDEN, tnaDe, valorHoy, rinde, refreshRendimientos, tasaDe, textoTasa, nombreBilletera } from './rendimientos.js';
import { parseAmount } from './interprete.js';

const nf = (d) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export function fmtAsset(amount, assetId) {
  if (String(assetId).startsWith('USD')) return `US$ ${nf(2).format(amount)}`;
  const a = assetById(assetId);
  if (a.id === 'ARS') return pesos(amount);
  return `${a.sym} ${nf(a.decimals).format(amount)}`;
}

// Cotizaciones que se pueden mostrar (vos elegís cuáles)
export const COTIZ_OPCIONES = [
  ...DOLARES.map(([id, nombre]) => ({ id, nombre, grupo: 'Dólares' })),
  { id: 'EUR', nombre: 'Euro', grupo: 'Otras monedas' }, { id: 'BRL', nombre: 'Real', grupo: 'Otras monedas' },
  { id: 'UYU', nombre: 'Peso uruguayo', grupo: 'Otras monedas' }, { id: 'CLP', nombre: 'Peso chileno', grupo: 'Otras monedas' },
  { id: 'BTC', nombre: 'Bitcoin', grupo: 'Cripto y oro' }, { id: 'ETH', nombre: 'Ethereum', grupo: 'Cripto y oro' },
  { id: 'USDT', nombre: 'USDT', grupo: 'Cripto y oro' }, { id: 'XAU', nombre: 'Oro (gramo)', grupo: 'Cripto y oro' },
];
const COTIZ_DEF = ['oficial', 'blue', 'bolsa', 'tarjeta', 'EUR', 'BTC'];
const cotizElegidas = (s) => ((s.settings || {}).cotizVer && s.settings.cotizVer.length ? s.settings.cotizVer : COTIZ_DEF);
function filaCotiz(s, id) {
  const r = s.rates || {}; const c = r.crypto || {}; const dol = r.dolares || {};
  const o = COTIZ_OPCIONES.find((x) => x.id === id); if (!o) return null;
  if (dol[id] || DOLARES.some(([x]) => x === id)) { const d = dol[id] || (id === 'blue' ? r.USD : null); return { label: o.nombre, main: d ? `${d.compra ? `${pesos(d.compra)} / ` : ''}${pesos(d.venta)}` : null, sub: d && d.compra ? 'compra / venta' : 'venta', ref: id === dolarRef(s) }; }
  if (['EUR', 'BRL', 'UYU', 'CLP'].includes(id)) return { label: o.nombre, main: r[id] ? pesos(r[id].venta) : null, sub: 'venta' };
  const usdV = c[id]; const ars = usdV ? arsPer(s, id) : 0;
  return { label: o.nombre, main: usdV ? `US$ ${nf(id === 'BTC' || id === 'ETH' ? 0 : 2).format(usdV)}` : null, sub: ars ? pesos(ars) : '' };
}
function quotes(s) {
  const rows = cotizElegidas(s).map((id) => filaCotiz(s, id)).filter(Boolean);
  const any = rows.some((x) => x.main);
  return `<div class="card">
    <div class="topbar"><strong style="font-size:14px">Cotizaciones</strong>
      <span class="head-actions"><button class="chip" data-action="elegirCotiz">${icon('grid', 14, 2.2)} Elegir</button><button class="chip" data-action="refreshQuotes" aria-label="Actualizar cotizaciones">${icon('refresh', 14, 2.2)}</button></span></div>
    ${any ? `<div class="quotes">${rows.map((x) => `<div class="quote"><span class="k">${x.label}${x.ref ? ' <span class="chip-mini">Tu referencia</span>' : ''}</span><span class="v">${x.main || '—'}</span><span class="small muted">${x.sub || ''}</span></div>`).join('')}</div>`
      : '<p class="text muted">Todavía no pude traer las cotizaciones (sin conexión). Se cargan solas apenas haya internet.</p>'}
    ${any && ratesStale(s) ? `<span class="pill warn" style="align-self:flex-start">Sin conexión: valores de ${ratesAge(s)}</span>` : ''}
    <span class="small muted">Se actualizan solas cada 5 minutos · dólares y monedas vía DolarApi · cripto y oro vía CoinGecko · ${ratesAge(s)}</span>
  </div>`;
}
function elegirCotizBody(s) {
  const sel = new Set(cotizElegidas(s));
  const grupos = [...new Set(COTIZ_OPCIONES.map((o) => o.grupo))];
  return `<p class="small muted" style="margin:0">Tocá las que querés ver en Ahorros.</p>
    ${grupos.map((g) => `<span class="small" style="font-weight:800">${g}</span><div class="chips">${COTIZ_OPCIONES.filter((o) => o.grupo === g).map((o) => `<button class="chip toggle" data-action="toggleCotiz" data-id="${o.id}" aria-pressed="${sel.has(o.id)}">${esc(o.nombre)}</button>`).join('')}</div>`).join('')}
    <div class="field"><label for="dol-ref">Dólar para pasar tus ahorros y gastos en dólares a pesos</label><select id="dol-ref" data-change="setDolarRef">${DOLARES.map(([id, n]) => `<option value="${id}" ${id === dolarRef(s) ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <span class="hint">Si cobrás o ahorrás en dólares por el banco, el MEP o el oficial suelen ser los más reales.</span></div>`;
}

let vista = 'cuentas'; // 'cuentas' | 'mis' | 'sueldo' | 'plan'
let patAbierto = false;
/** Abrir Mi plata en una pestaña (las rutas viejas #/cuentas llegan acá). */
export function renderVista(s, v) { vista = v; return render(s); }

export function render(s) {
  const total = holdingsTotal(s);
  const items = s.holdings.map((h) => ({ ...h, ars: holdingArs(s, h) }));
  const tips = insights(s).filter((t) => t.id === 'idle' && !((s.tipsNo || {}).idle >= todayISO()));
  const metasHtml = `
    <div class="section-title"><span>Metas</span><button data-action="openGoalForm">+ Nueva meta</button></div>
    ${taparMontos(`<div class="card tight">
      ${s.goals.length ? s.goals.map((g) => `<button class="row" data-action="openGoal" data-id="${g.id}">
        ${ring(goalPct(g), 40, 5, `${g.name}`)}
        <span class="grow"><span class="name">${esc(g.name)}${g.main ? ' <span class="pill lime" style="margin-left:4px">Principal</span>' : ''}</span><span class="meta">${g.target ? `${money(g.saved)} de ${money(g.target)} · ` : ''}${esc(goalEta(g).text)}</span></span>
        <span class="amount">${Math.round(goalPct(g) * 100)}%</span>
      </button>`).join('') : '<p class="empty">¿Para qué estás ahorrando? Creá una meta (un viaje, un fondo de emergencia) y te muestro cuánto llevás y cuándo llegás.</p>'}
    </div>`, 'ahorro')}
`;

  return `<section class="screen">
    ${screenHead('Mi plata', ojoMontos('ahorro'))}

    ${taparMontos(patrimonioHtml(s, patAbierto), 'ahorro')}

    <div class="tabs tabs-4" role="tablist" aria-label="Sección" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <button role="tab" data-action="ahorroVista" data-v="cuentas" aria-pressed="${vista === 'cuentas'}">Cuentas</button>
      <button role="tab" data-action="ahorroVista" data-v="mis" aria-pressed="${vista === 'mis'}">Ahorros</button>
      <button role="tab" data-action="ahorroVista" data-v="sueldo" aria-pressed="${vista === 'sueldo'}">Sueldo</button>
      <button role="tab" data-action="ahorroVista" data-v="plan" aria-pressed="${vista === 'plan'}">Plan</button>
    </div>
    ${vista === 'sueldo' ? sueldoCuerpo(s, 'ahorro') : ''}

    ${vista === 'cuentas' ? `<div class="btn-row"><button class="btn small" data-action="nuevaTransferencia">${icon('swap', 18)} Transferir entre cuentas</button></div>
    ${taparMontos(cuerpoCuentas(s), 'ahorro')}` : ''}

    ${vista === 'mis' ? taparMontos(`<div class="card green" style="gap:12px;padding:20px">
      <span class="hero-label">Tenés ahorrado (en ${monedaActual() === 'USD' ? 'dólares' : 'pesos'})</span>
      <span style="font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1">${money(total)}</span>
      ${total > 0 ? `<div class="dist" role="img" aria-label="Distribución de tus ahorros">${items.filter((h) => h.ars > 0).map((h) => `<span style="width:${(h.ars / total) * 100}%;background:${holdingType(h.type).color}"></span>`).join('')}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:2px">
        ${items.map((h) => `<button class="row" data-action="editHolding" data-id="${h.id}" style="color:#fff;border-color:rgba(255,255,255,.12);padding:8px 0">
          <span style="width:10px;height:10px;border-radius:3px;background:${holdingType(h.type).color};flex-shrink:0"></span>
          <span class="grow"><span class="name" style="font-weight:600">${esc(h.name || holdingType(h.type).label)}</span>${h.currency !== 'ARS' ? `<span class="meta on-green-muted">${fmtAsset(h.amount, h.currency)}</span>` : ''}${tnaDe(s, h) ? `<span class="meta on-green-muted">${h.rinde && tasaDe(s, h.rinde) ? `${esc(nombreBilletera(h.rinde))}: ${textoTasa(tasaDe(s, h.rinde), money)}` : `Rinde ${String(tnaDe(s, h)).replace('.', ',')}% anual`}${valorHoy(s, h) - h.amount >= 1 ? ` · +${money(valorHoy(s, h) - h.amount)} de intereses` : ''}</span>` : ''}</span>
          <span class="amount">${h.ars ? money(h.ars) : fmtAsset(h.amount, h.currency)}</span>
        </button>`).join('') || '<span class="small on-green-muted">Todavía no cargaste dónde tenés tus ahorros.</span>'}
      </div>
      <button class="btn small lime" data-action="newHolding">+ Agregar dónde ahorrás</button>
    </div>`, 'ahorro') : ''}

    ${vista === 'mis' ? `
    ${(() => { const tot = Object.values(s.savedByApp || {}).reduce((a, v) => a + (Number(v) || 0), 0) + totalReintegros(reintegrosCobrados(s)); const meses = Object.keys(s.savedByApp || {}).filter((k) => s.savedByApp[k] > 0).sort(); return tot ? `<button class="card mov-ahorro" data-action="ahorroPesitosInfo"><span class="grow"><b class="t">En total te ahorraste con Pesitos</b><span class="small">Reintegros, promos y desafíos${meses.length ? ` desde ${monthName(meses[0], true)} ${meses[0].slice(0, 4)}` : ''}</span></span><b class="v">${money(tot)}</b></button>` : ''; })()}
    ${quotes(s)}

    ${tips.map(tipCard).join('')}

    <div class="btn-row"><button class="btn" data-action="openRinde">${icon('percent', 18)} ¿Dónde rinde más hoy?</button><button class="btn" data-action="showOptions">¿Dónde conviene ahorrar?</button></div>
    ` : vista === 'plan' ? planAhorroHtml(s, metasHtml) : ''}
  </section>`;
}

function goalForm(g = {}) {
  return `<form class="form" data-submit="saveGoal">
    <input type="hidden" name="id" value="${esc(g.id || '')}">
    ${g.id ? '' : '<p class="small muted" style="margin:0">Una meta es para qué ahorrás. Te muestro cuánto llevás y en qué mes llegás. Cada vez que apartes plata, tocá la meta y sumala con <b>Aportar</b>.</p>'}
    <div class="field"><label for="g-n">Meta</label><input id="g-n" name="name" value="${esc(g.name || '')}" placeholder="Ej: Viaje, fondo de emergencia, auto" required></div>
    <div class="field-row">
      <div class="field"><label for="g-t">Cuánto necesitás</label><input id="g-t" name="target" inputmode="decimal" value="${g.target || ''}" placeholder="Ej: 1.500.000"></div>
      <div class="field"><label for="g-s">Ya tenés</label><input id="g-s" name="saved" inputmode="decimal" value="${g.saved || ''}" placeholder="Ej: 0"></div>
    </div>
    <div class="field"><label for="g-m">Aporte por mes</label><input id="g-m" name="monthly" inputmode="decimal" value="${g.monthly || ''}" placeholder="Ej: 100.000"><span class="hint">Con esto calculo cuándo llegás.</span></div>
    <label class="check"><input type="checkbox" name="main" ${g.main ? 'checked' : ''}> <span>Es mi meta principal<br><span class="small muted">Aparece en Inicio con su avance. Podés tener una sola; si marcás otra, esta deja de serlo.</span></span></label>
    <span class="small muted">La meta no cambia lo que podés gastar por día. Lo que apartás cada mes lo define tu forma de ahorrar (acá en Mi plata → Plan).</span>
    <button class="btn primary block" type="submit">Guardar</button>
    ${g.id ? `<button class="btn ghost block" type="button" data-action="deleteGoal" data-id="${g.id}">Borrar meta</button>` : ''}
  </form>`;
}

// ¿Rinde intereses? Billeteras con tasa automática u otra tasa que cargás vos
function rindeFields(s, h, type) {
  const tasas = (s.rendimientos && s.rendimientos.tasas) || {};
  const sel = h.rinde || (rinde(type) ? (type === 'plazo_fijo' ? 'manual' : '') : 'no');
  const pf = Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {}).sort((a, b) => b[1] - a[1]);
  const pfHint = pf.length ? `Hoy los bancos pagan entre ${String(pf[pf.length - 1][1]).replace('.', ',')}% y ${String(pf[0][1]).replace('.', ',')}% anual para clientes.` : '';
  const since = h.since || todayISO();
  return `<div class="rinde-box" ${rinde(type) ? '' : 'hidden'}>
    <div class="field"><label for="h-r">¿Te da intereses?</label><select id="h-r" name="rinde" data-change="rindeChanged">
      <option value="" ${!sel ? 'selected' : ''}>Elegí…</option>
      ${BILLETERAS_QUE_RINDEN.map((b) => `<option value="${b.id}" ${sel === b.id ? 'selected' : ''}>${b.nombre}${tasas[b.id] ? ` · hoy ${String(tasas[b.id].tna).replace('.', ',')}%${tasas[b.id].tope ? ` hasta ${money(tasas[b.id].tope)}` : ''}` : ''}</option>`).join('')}
      <option value="manual" ${sel === 'manual' ? 'selected' : ''}>Otra: escribo la tasa (TNA)</option>
      <option value="no" ${sel === 'no' ? 'selected' : ''}>No da intereses</option></select>
      <span class="hint">Con las billeteras de la lista, la tasa se actualiza sola todos los días.</span></div>
    <div class="field-row">
      <div class="field" data-tna ${sel === 'manual' ? '' : 'hidden'}><label for="h-tna">Tasa anual (TNA %)</label><input id="h-tna" name="tna" inputmode="decimal" value="${h.tna ? String(h.tna).replace('.', ',') : ''}" placeholder="Ej: 32,5"></div>
      <div class="field"><label for="h-since">Este monto lo tenés desde</label><input id="h-since" name="since" type="date" value="${esc(since)}" max="${todayISO()}"></div>
    </div>
    ${type === 'plazo_fijo' && pfHint ? `<span class="small muted">${pfHint}</span>` : ''}
    <span class="small muted">Desde esa fecha te sumo los intereses de cada día. Cuando veas tu saldo real, actualizá el monto y listo.</span>
  </div>`;
}

function holdingForm(h = {}, s = {}) {
  const type = h.type || 'remunerada';
  return `<form class="form" data-submit="saveHolding">
    <input type="hidden" name="id" value="${esc(h.id || '')}">
    <div class="field"><label for="h-t">¿Dónde o en qué?</label><select id="h-t" name="type" data-change="holdingTypeChanged">${HOLDING_TYPES.map((t) => `<option value="${t.id}" ${t.id === type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
    <div class="field"><label for="h-n">Nombre</label><input id="h-n" name="name" value="${esc(h.name || '')}" placeholder="Ej: Mercado Pago, Plazo fijo Provincia, Binance"></div>
    <div class="field-row">
      <div class="field"><label for="h-a">Cantidad</label><input id="h-a" name="amount" inputmode="decimal" value="${h.amount ?? ''}" placeholder="Ej: 300.000" required></div>
      <div class="field"><label for="h-c">Moneda o activo</label><select id="h-c" name="currency">${ASSETS.map((a) => `<option value="${a.id}" ${a.id === (h.currency || holdingType(type).asset) ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>
    </div>
    <span class="small muted">Cargá la cantidad en su moneda (por ejemplo, 0,005 bitcoin o 10 gramos de oro): la paso a pesos con la cotización del día.</span>
    ${rindeFields(s, h, type)}
    <div class="field"><label for="h-m">Vence el (plazos fijos, opcional)</label><input id="h-m" name="maturity" type="date" value="${esc(h.maturity || '')}"><span class="hint">Te lo muestro en "Vas a cobrar" y te aviso para renovarlo o moverlo.</span></div>
    <button class="btn primary block" type="submit">Guardar</button>
    ${h.id ? `<button class="btn ghost block" type="button" data-action="deleteHolding" data-id="${h.id}">Borrar</button>` : ''}
  </form>`;
}

// conversor: pesos, todos los dólares, otras monedas, cripto y oro
const CONV = () => [['ARS', 'Pesos'], ...DOLARES.map(([id, n]) => [`USD:${id}`, n]), ...ASSETS.filter((a) => !['ARS', 'USD'].includes(a.id)).map((a) => [a.id, a.label])];
const convLabel = (id) => (CONV().find(([x]) => x === id) || [, assetById(id).label])[1];
function converterBody(s, d = { amount: '', from: `USD:${dolarRef(s)}`, to: 'ARS' }) {
  const opts = (sel) => CONV().map(([id, l]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${l}</option>`).join('');
  const r = convert(s, d.amount, d.from, d.to);
  return `<form class="form" data-submit="convert">
    <div class="field"><label for="cv-a">Cantidad</label><input id="cv-a" name="amount" inputmode="decimal" value="${d.amount === '' ? '' : esc(String(d.amount))}" placeholder="Ej: 100"></div>
    <div class="conv-row">
      <div class="field"><label for="cv-f">De</label><select id="cv-f" name="from">${opts(d.from)}</select></div>
      <button type="button" class="icon-btn" data-action="swapCurrencies" aria-label="Invertir monedas">${icon('swap', 20)}</button>
      <div class="field"><label for="cv-t">A</label><select id="cv-t" name="to">${opts(d.to)}</select></div>
    </div>
    <button class="btn primary block" type="submit">Convertir</button>
  </form>
  <div class="result ok"><span class="small">${esc(String(d.amount).replace('.', ','))} ${esc(convLabel(d.from))} =</span><strong style="font-size:24px">${r == null ? 'Sin cotización' : fmtAsset(r, d.to)}</strong><span class="small">Con cotización de venta · ${ratesAge(s)}</span></div>`;
}

export const actions = {
  ahorroVista(ctx, el) { vista = el.dataset.v; ctx.render(); },
  patToggle(ctx) { patAbierto = !patAbierto; ctx.render(); },
  refreshQuotes(ctx) {
    toast('Actualizando cotizaciones…');
    refreshRates(ctx, true).then((ok) => toast(ok ? 'Cotizaciones actualizadas' : 'Sin conexión: uso las últimas guardadas'));
  },
  elegirCotiz(ctx) { openModal('Cotizaciones', `<div id="cotiz-body" class="form">${elegirCotizBody(ctx.state)}</div>`); },
  toggleCotiz(ctx, el) {
    ctx.commit((s) => {
      s.settings = s.settings || {};
      const cur = new Set(cotizElegidas(s)); const id = el.dataset.id;
      if (cur.has(id)) { if (cur.size > 1) cur.delete(id); } else cur.add(id);
      s.settings.cotizVer = COTIZ_OPCIONES.map((o) => o.id).filter((x) => cur.has(x));
    });
    setModalBody('#cotiz-body', elegirCotizBody(ctx.state));
  },
  setDolarRef(ctx, el) { ctx.commit((s) => { s.settings.dolarRef = el.value; }); toast(`Uso el ${nombreDolar(el.value).toLowerCase()} para tus dólares`); },
  openConverter(ctx) { openModal('Conversor de monedas', `<div id="conv-body">${converterBody(ctx.state)}</div>`); },
  convert(ctx, d) {
    const raw = String(d.amount || '').trim();
    const amount = parseFloat((/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g, '') : raw).replace(',', '.')) || 0;
    setModalBody('#conv-body', converterBody(ctx.state, { amount, from: d.from, to: d.to }));
  },
  swapCurrencies(ctx, el) {
    const f = el.closest('form');
    const a = f.querySelector('[name=from]'); const b = f.querySelector('[name=to]');
    [a.value, b.value] = [b.value, a.value];
    f.requestSubmit();
  },
  holdingTypeChanged(ctx, el) {
    const t = holdingType(el.value);
    const f = el.closest('form');
    const cur = f.querySelector('[name=currency]');
    if (cur) cur.value = t.asset;
    const box = f.querySelector('.rinde-box');
    if (box) box.hidden = !rinde(el.value);
  },
  rindeChanged(ctx, el) {
    const f = el.closest('form');
    const t = f.querySelector('[data-tna]');
    if (t) t.hidden = el.value !== 'manual';
  },
  openGoalForm() { openModal('Nueva meta', goalForm()); },
  openGoal(ctx, el) {
    const g = ctx.state.goals.find((x) => x.id === el.dataset.id);
    if (!g) return;
    openModal(g.name, `<div class="card"><strong>${g.target ? `${money(g.saved)} de ${money(g.target)}` : `${money(g.saved)} juntados`}</strong><span class="text muted">${esc(goalEta(g).text)}</span></div>
      <form class="form" data-submit="contribute">
        <input type="hidden" name="id" value="${g.id}">
        <div class="field"><label for="c-a">Sumar a esta meta</label><input id="c-a" name="amount" inputmode="decimal" placeholder="Ej: 50.000" required></div>
        <button class="btn green block" type="submit">Aportar</button>
      </form>
      <button class="btn small block" data-action="editGoal" data-id="${g.id}">Editar meta</button>`);
  },
  editGoal(ctx, el) {
    const g = ctx.state.goals.find((x) => x.id === el.dataset.id);
    if (g) openModal('Editar meta', goalForm(g), { push: true });
  },
  contribute(ctx, d) {
    const amount = num(d.amount);
    if (!amount) return;
    let done = false; let name = '';
    ctx.commit((s) => {
      const g = s.goals.find((x) => x.id === d.id);
      if (!g) return;
      g.saved += amount; name = g.name; done = g.target > 0 && g.saved >= g.target;
      s.transfers.push({ id: uid(), date: todayISO(), amount, note: `Aporte a ${g.name}` });
    });
    closeModal(); toast(done ? `¡Cumpliste "${name}"!` : `Sumaste ${money(amount)} a "${name}"`);
  },
  saveGoal(ctx, d) {
    if (!String(d.name || '').trim()) return;
    ctx.commit((s) => {
      const data = { name: d.name.trim(), target: num(d.target), saved: num(d.saved), monthly: num(d.monthly), main: !!d.main };
      if (data.main) s.goals.forEach((g) => { g.main = false; });
      if (!s.goals.length) data.main = true;
      const g = s.goals.find((x) => x.id === d.id);
      if (g) Object.assign(g, data); else s.goals.push({ id: uid(), ...data });
    });
    closeModal(); toast('Meta guardada');
  },
  deleteGoal(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Meta borrada', (s) => { s.goals = s.goals.filter((x) => x.id !== el.dataset.id); }); },
  newHolding(ctx) { refreshRendimientos(ctx); openModal('¿Dónde ahorrás?', holdingForm({}, ctx.state)); },
  editHolding(ctx, el) {
    const h = ctx.state.holdings.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const hoy = valorHoy(ctx.state, h);
    // el formulario muestra el valor de hoy (con intereses); si no lo cambiás, se mantiene la fecha
    const vista = hoy !== h.amount ? { ...h, amount: Math.round(hoy * 100) / 100, since: todayISO(), _orig: h.amount } : h;
    openModal('Editar', holdingForm(vista, ctx.state));
  },
  saveHolding(ctx, d) {
    const amount = num(d.amount) || parseAmount(d.amount);
    if (!amount) { toast('Ingresá una cantidad'); return; }
    const tna = num(d.tna);
    ctx.commit((s) => {
      const conRinde = rinde(d.type) && d.rinde && d.rinde !== 'no';
      const data = { type: d.type, name: d.name.trim() || holdingType(d.type).label.replace(/ \(.*\)$/, ''), amount, currency: d.currency, maturity: d.maturity || '',
        rinde: rinde(d.type) ? (d.rinde || '') : 'no', tna: d.rinde === 'manual' ? tna : 0, since: conRinde ? (d.since || todayISO()) : '' };
      const h = s.holdings.find((x) => x.id === d.id);
      if (h) Object.assign(h, data); else s.holdings.push({ id: uid(), ...data });
    });
    closeModal(); toast('Guardado');
  },
  deleteHolding(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Ahorro borrado', (s) => { s.holdings = s.holdings.filter((x) => x.id !== el.dataset.id); }); },
};
