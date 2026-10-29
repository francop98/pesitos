// Beneficios: descuentos y reintegros de tus bancos, billeteras y tarjetas,
// día por día. Se actualizan solos (ver js/datosvivos.js y api/).

import { money, esc, num, WEEKDAYS } from './formato.js';
import { allCategories, catLabel, walletName } from './categorias.js';
import { promosForDay, promosStatus } from './economista.js';
import { icon, screenHead, openModal, closeModal, toast, borrarConDeshacer } from './interfaz.js';
import { lessonCard } from './aprender.js';
import { uid } from './almacenamiento.js';

let catFilter = 'all';
let medioFilter = 'all';
const expanded = new Set(); // días con "Ver más" abierto
const PER_DAY = 8;
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const FILTERS = [['all', 'Todos los rubros'], ['super', 'Súper'], ['comida', 'Comida'], ['salud', 'Farmacia'], ['transporte', 'Combustible'], ['hogar', 'Hogar'], ['ropa', 'Ropa'], ['ocio', 'Salidas'], ['delivery', 'Delivery']];

function dayBlock(s, offset) {
  const day = (new Date().getDay() + offset) % 7;
  const ps = promosForDay(s, day).filter((p) => (catFilter === 'all' || p.category === catFilter) && (medioFilter === 'all' || p.wallet === medioFilter || (medioFilter === 'todos' && p.wallet === 'todos')));
  if (!ps.length) return '';
  const label = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : cap(WEEKDAYS[day]);
  const open = expanded.has(day);
  const shown = open ? ps : ps.slice(0, PER_DAY);
  const zone = (p) => (p.zone && !/nacional/i.test(p.zone) ? ` · solo ${p.zone}` : '');
  return `<div class="section-title"><span>${label}</span><span class="small muted">${ps.length} promo${ps.length === 1 ? '' : 's'}</span></div>
    <div class="card tight">${shown.map((p) => `<div class="row" style="align-items:flex-start">
      <span class="promo-pct">${p.pct}%</span>
      <span class="grow"><span class="name" style="white-space:normal">${esc(p.merchant || catLabel(p.category))}</span>
        <span class="meta">${esc(p.name)} · ${esc(catLabel(p.category))}${p.cap ? ` · tope ${money(p.cap)}${p.capPeriod ? ` por ${esc(p.capPeriod)}` : ''}` : (p.capUnknown ? ' · tope sin publicar' : ' · sin tope')}${p.minPurchase ? ` · compra mínima ${money(p.minPurchase)}` : ''}${esc(zone(p))}</span>
        ${p.cond ? `<span class="meta">${esc(p.cond)}</span>` : ''}</span>
    </div>`).join('')}
    ${ps.length > PER_DAY ? `<button class="btn ghost small" data-action="promoMore" data-day="${day}">${open ? 'Ver menos' : `Ver ${ps.length - PER_DAY} más`}</button>` : ''}</div>`;
}

export function render(s) {
  const has = (s.wallets || []).length;
  if (!['all', 'todos', ...(s.wallets || [])].includes(medioFilter)) medioFilter = 'all';
  const week = has ? [0, 1, 2, 3, 4, 5, 6].map((o) => dayBlock(s, o)).join('') : '';
  return `<section class="screen">
    ${screenHead('Beneficios', '', 'Descuentos de tus medios de pago')}

    ${has ? `<div class="card filtros-promos">
      <div class="field-row">
        <div class="field"><label for="pf-medio">Medio de pago</label><select id="pf-medio" data-change="promoMedio"><option value="all">Todos los míos</option>${s.wallets.map((w) => `<option value="${esc(w)}" ${medioFilter === w ? 'selected' : ''}>${esc(walletName(w))}</option>`).join('')}<option value="todos" ${medioFilter === 'todos' ? 'selected' : ''}>Con cualquier medio</option></select></div>
        <div class="field"><label for="pf-cat">Rubro</label><select id="pf-cat" data-change="promoCat">${FILTERS.map(([id, l]) => `<option value="${id}" ${catFilter === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <button class="btn ghost small" data-action="openWallets" style="align-self:flex-start">${icon('wallet', 16)} Cambiar mis medios de pago</button>
    </div>` : `<div class="card"><p class="text muted">Elegí tus bancos, billeteras y tarjetas y te muestro qué descuentos tenés cada día.</p><button class="btn primary" data-action="openWallets">Elegir mis medios de pago</button></div>`}

    ${week || (has ? '<div class="card"><p class="text muted">No encontré promos para tus medios de pago con este filtro.</p></div>' : '')}

    <span class="small muted">${esc(promosStatus(s))} Antes de pagar, confirmá las condiciones en la app de tu banco o billetera.</span>

    <div class="section-title"><span>Promos que cargaste</span><button data-action="newPromo">+ Agregar</button></div>
    <div class="card tight">
      ${s.promos.length ? s.promos.map((p) => `<div class="row">
        <span class="grow"><span class="name">${esc(p.name)} · ${p.pct}%</span><span class="meta">${cap(WEEKDAYS[p.day])} · ${catLabel(p.category)}${p.cap ? ` · tope ${money(p.cap)}` : ''}</span></span>
        <button class="chip" data-action="deletePromo" data-id="${p.id}">Borrar</button>
      </div>`).join('') : '<p class="empty">¿Conocés una promo que no aparece? Cargala y te aviso el día antes.</p>'}
    </div>
    ${lessonCard(s, 'beneficios')}
  </section>`;
}

export const actions = {
  promoFilter(ctx, el) { catFilter = el.dataset.id; ctx.render(); },
  promoCat(ctx, el) { catFilter = el.value; ctx.render(); },
  promoMedio(ctx, el) { medioFilter = el.value; ctx.render(); },
  promoMore(ctx, el) { const d = Number(el.dataset.day); if (expanded.has(d)) expanded.delete(d); else expanded.add(d); ctx.render(); },
  newPromo() {
    openModal('Nueva promo', `<form class="form" data-submit="savePromo">
      <div class="field"><label for="pr-n">Banco, billetera o tarjeta</label><input id="pr-n" name="name" required placeholder="Ej: Cuenta DNI, Mercado Pago"></div>
      <div class="field-row">
        <div class="field"><label for="pr-d">Día</label><select id="pr-d" name="day">${WEEKDAYS.map((w, i) => `<option value="${i}">${cap(w)}</option>`).join('')}</select></div>
        <div class="field"><label for="pr-c">Rubro</label><select id="pr-c" name="category">${allCategories().filter((c) => !['varios', 'otros'].includes(c.id)).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="pr-p">Descuento %</label><input id="pr-p" name="pct" inputmode="decimal" required></div>
        <div class="field"><label for="pr-t">Tope de reintegro</label><input id="pr-t" name="cap" inputmode="decimal" placeholder="Opcional"></div>
      </div>
      <button class="btn primary block" type="submit">Guardar</button>
    </form>`);
  },
  savePromo(ctx, d) {
    ctx.commit((s) => { s.promos.push({ id: uid(), name: d.name.trim(), day: Number(d.day), category: d.category, pct: num(d.pct), cap: num(d.cap) }); });
    closeModal(); toast('Promo guardada: te aviso el día antes');
  },
  deletePromo(ctx, el) { borrarConDeshacer(ctx, 'Promo borrada', (s) => { s.promos = s.promos.filter((p) => p.id !== el.dataset.id); }); },
};

