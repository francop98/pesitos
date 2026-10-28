// Ahorro e inversiones: cuánto tenés, dónde y en qué moneda, cotizaciones
// en vivo, conversor y metas.

import { money, esc, num, todayISO } from './formato.js';
import { holdingsTotal, holdingArs, goalEta, goalPct } from './calculos.js';
import { HOLDING_TYPES, holdingType, ASSETS, assetById } from './categorias.js';
import { insights } from './economista.js';
import { arsPer, convert, refreshRates, ratesAge, ratesStale } from './cotizaciones.js';
import { ring, tipCard, icon, screenHead, openModal, closeModal, toast, setModalBody, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { lessonCard } from './aprender.js';
import { BILLETERAS_QUE_RINDEN, tnaDe, valorHoy, rinde, refreshRendimientos } from './rendimientos.js';
import { parseAmount } from './interprete.js';

const nf = (d) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export function fmtAsset(amount, assetId) {
  const a = assetById(assetId);
  if (a.id === 'ARS') return money(amount);
  return `${a.sym} ${nf(a.decimals).format(amount)}`;
}

function quotes(s) {
  const r = s.rates || {};
  const c = r.crypto || {};
  const rows = [
    { label: 'Dólar blue', main: r.USD ? `${money(r.USD.compra)} / ${money(r.USD.venta)}` : null, sub: 'compra / venta' },
    { label: 'Euro', main: r.EUR ? money(r.EUR.venta) : null, sub: 'venta' },
    { label: 'Real', main: r.BRL ? money(r.BRL.venta) : null, sub: 'venta' },
    { label: 'Bitcoin', main: c.BTC ? `US$ ${nf(0).format(c.BTC)}` : null, sub: c.BTC && arsPer(s, 'BTC') ? money(arsPer(s, 'BTC')) : '' },
    { label: 'Oro (onza)', main: c.XAU ? `US$ ${nf(0).format(c.XAU)}` : null, sub: c.XAU && arsPer(s, 'XAU') ? money(arsPer(s, 'XAU')) : '' },
  ];
  const any = rows.some((x) => x.main);
  return `<div class="card">
    <div class="topbar"><strong style="font-size:14px">Cotizaciones</strong>
      <button class="chip" data-action="refreshQuotes">${icon('refresh', 14, 2.2)} Actualizar</button></div>
    ${any ? `<div class="quotes">${rows.map((x) => `<div class="quote"><span class="k">${x.label}</span><span class="v">${x.main || '—'}</span><span class="small muted">${x.sub || ''}</span></div>`).join('')}</div>`
      : '<p class="text muted">Todavía no pude traer las cotizaciones (sin conexión). Se cargan solas apenas haya internet.</p>'}
    ${any && ratesStale(s) ? `<span class="pill warn" style="align-self:flex-start">Sin conexión: valores de ${ratesAge(s)}</span>` : ''}
    <span class="small muted">Se actualizan solas cada 5 minutos · dólar blue de DolarHoy y monedas vía DolarApi · cripto y oro vía CoinGecko · ${ratesAge(s)}</span>
    <button class="btn small" data-action="openConverter">${icon('swap', 18)} Conversor de monedas</button>
  </div>`;
}

export function render(s) {
  const total = holdingsTotal(s);
  const items = s.holdings.map((h) => ({ ...h, ars: holdingArs(s, h) }));
  const tips = insights(s).filter((t) => t.id === 'idle');

  return `<section class="screen">
    ${screenHead('Ahorro e inversiones')}

    <div class="card green" style="gap:12px;padding:20px">
      <span class="hero-label">Tenés ahorrado (en pesos)</span>
      <span style="font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1">${money(total)}</span>
      ${total > 0 ? `<div class="dist" role="img" aria-label="Distribución de tus ahorros">${items.filter((h) => h.ars > 0).map((h) => `<span style="width:${(h.ars / total) * 100}%;background:${holdingType(h.type).color}"></span>`).join('')}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:2px">
        ${items.map((h) => `<button class="row" data-action="editHolding" data-id="${h.id}" style="color:#fff;border-color:rgba(255,255,255,.12);padding:8px 0">
          <span style="width:10px;height:10px;border-radius:3px;background:${holdingType(h.type).color};flex-shrink:0"></span>
          <span class="grow"><span class="name" style="font-weight:600">${esc(h.name || holdingType(h.type).label)}</span>${h.currency !== 'ARS' ? `<span class="meta on-green-muted">${fmtAsset(h.amount, h.currency)}</span>` : ''}${tnaDe(s, h) ? `<span class="meta on-green-muted">Rinde ${String(tnaDe(s, h)).replace('.', ',')}% anual${valorHoy(s, h) - h.amount >= 1 ? ` · +${money(valorHoy(s, h) - h.amount)} de intereses` : ''}</span>` : ''}</span>
          <span class="amount">${h.ars ? money(h.ars) : fmtAsset(h.amount, h.currency)}</span>
        </button>`).join('') || '<span class="small on-green-muted">Todavía no cargaste dónde tenés tus ahorros.</span>'}
      </div>
      <button class="btn small lime" data-action="newHolding">+ Agregar dónde ahorrás</button>
    </div>

    ${quotes(s)}

    <div class="section-title"><span>Metas</span><button data-action="openGoalForm">+ Nueva meta</button></div>
    <div class="card tight">
      ${s.goals.length ? s.goals.map((g) => `<button class="row" data-action="openGoal" data-id="${g.id}">
        ${ring(goalPct(g), 40, 5, `${g.name}`)}
        <span class="grow"><span class="name">${esc(g.name)}${g.main ? ' <span class="pill lime" style="margin-left:4px">Principal</span>' : ''}</span><span class="meta">${g.target ? `${money(g.saved)} de ${money(g.target)} · ` : ''}${esc(goalEta(g).text)}</span></span>
        <span class="amount">${Math.round(goalPct(g) * 100)}%</span>
      </button>`).join('') : '<p class="empty">Creá una meta y te digo cuánto apartar y cuándo llegás.</p>'}
    </div>

    ${tips.map(tipCard).join('')}

    <button class="btn" data-action="showOptions">¿Dónde conviene poner mis ahorros?</button>
    ${lessonCard(s, 'ahorro')}
  </section>`;
}

function goalForm(g = {}) {
  return `<form class="form" data-submit="saveGoal">
    <input type="hidden" name="id" value="${esc(g.id || '')}">
    <div class="field"><label for="g-n">Meta</label><input id="g-n" name="name" value="${esc(g.name || '')}" placeholder="Ej: Viaje, fondo de emergencia, auto" required></div>
    <div class="field-row">
      <div class="field"><label for="g-t">Cuánto necesitás</label><input id="g-t" name="target" inputmode="decimal" value="${g.target || ''}" placeholder="Ej: 1.500.000"></div>
      <div class="field"><label for="g-s">Ya tenés</label><input id="g-s" name="saved" inputmode="decimal" value="${g.saved || 0}"></div>
    </div>
    <div class="field"><label for="g-m">Aporte por mes</label><input id="g-m" name="monthly" inputmode="decimal" value="${g.monthly || ''}" placeholder="Ej: 100.000"><span class="hint">Con esto calculo cuándo llegás.</span></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:14px;font-weight:600;min-height:44px"><input type="checkbox" name="main" ${g.main ? 'checked' : ''} style="width:20px;height:20px"> Es mi meta principal</label>
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
      ${BILLETERAS_QUE_RINDEN.map((b) => `<option value="${b.id}" ${sel === b.id ? 'selected' : ''}>${b.nombre}${tasas[b.id] ? ` · hoy ${String(tasas[b.id].tna).replace('.', ',')}% anual` : ''}</option>`).join('')}
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
    <span class="small muted">Cargá la cantidad en su moneda (por ejemplo, 0,005 bitcoin o 2 onzas de oro): la paso a pesos con la cotización del día.</span>
    ${rindeFields(s, h, type)}
    <div class="field"><label for="h-m">Vence el (plazos fijos, opcional)</label><input id="h-m" name="maturity" type="date" value="${esc(h.maturity || '')}"><span class="hint">Te lo muestro en "Vas a cobrar" y te aviso para renovarlo o moverlo.</span></div>
    <button class="btn primary block" type="submit">Guardar</button>
    ${h.id ? `<button class="btn ghost block" type="button" data-action="deleteHolding" data-id="${h.id}">Borrar</button>` : ''}
  </form>`;
}

function converterBody(s, d = { amount: 100, from: 'USD', to: 'ARS' }) {
  const opts = (sel) => ASSETS.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.label}</option>`).join('');
  const r = convert(s, d.amount, d.from, d.to);
  return `<form class="form" data-submit="convert">
    <div class="field"><label for="cv-a">Cantidad</label><input id="cv-a" name="amount" inputmode="decimal" value="${d.amount}"></div>
    <div class="conv-row">
      <div class="field"><label for="cv-f">De</label><select id="cv-f" name="from">${opts(d.from)}</select></div>
      <button type="button" class="icon-btn" data-action="swapCurrencies" aria-label="Invertir monedas">${icon('swap', 20)}</button>
      <div class="field"><label for="cv-t">A</label><select id="cv-t" name="to">${opts(d.to)}</select></div>
    </div>
    <button class="btn primary block" type="submit">Convertir</button>
  </form>
  <div class="result ok"><span class="small">${esc(String(d.amount).replace('.', ','))} ${assetById(d.from).label} =</span><strong style="font-size:24px">${r == null ? 'Sin cotización' : fmtAsset(r, d.to)}</strong><span class="small">Con cotización de venta · ${ratesAge(s)}</span></div>`;
}

export const actions = {
  refreshQuotes(ctx) {
    toast('Actualizando cotizaciones…');
    refreshRates(ctx, true).then((ok) => toast(ok ? 'Cotizaciones actualizadas' : 'Sin conexión: uso las últimas guardadas'));
  },
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
