// Beneficios: descuentos y reintegros de tus bancos, billeteras y tarjetas,
// día por día. Se actualizan solos (ver js/datosvivos.js y api/).

import { money, esc, num, WEEKDAYS } from './formato.js';
import { allCategories, catLabel, walletName, CATEGORIES } from './categorias.js';
import { promosForDay, promosStatus } from './economista.js';
import { icon, screenHead, openModal, closeModal, toast, borrarConDeshacer } from './interfaz.js';
import { lessonCard } from './aprender.js';
import { uid } from './almacenamiento.js';
import { promoKey, promosARenovar } from './datosvivos.js';
import * as nube from './sincronizacion.js';

const vistas = new Map(); // promos que se muestran, por clave (para "Avisar un error")
const fechaCorta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const finDeMes = () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth() + 1, 0); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };

// Promos de tus medios que vencieron hace poco: ¿las renovaron?
function renovarHtml(s) {
  const l = promosARenovar(s);
  if (!l.length) return '';
  return `<div class="section-title"><span>¿Las renovaron?</span></div>
    <p class="small muted u-m-0">Vencieron hace poco y todavía no apareció la nueva. Mientras no me confirmes, no las uso para calcular reintegros.</p>
    <div class="card tight">${l.map((p) => { const k = promoKey(p); vistas.set(k, p); return `<div class="row renovar-fila"><span class="promo-pct">${p.pct}%</span>
      <span class="grow"><span class="name u-ws-normal">${esc(p.merchant || catLabel(p.category))}</span><span class="meta">${esc(p.walletName || walletName(p.wallet))} · venció el ${fechaCorta(p.validTo)}</span>
      <span class="btn-row"><button class="btn small green" data-action="promoSigue" data-k="${esc(k)}">Sigue vigente</button><button class="btn small ghost" data-action="promoYaNo" data-k="${esc(k)}">Ya no está</button></span></span></div>`; }).join('')}</div>
    <span class="small muted">Fijate en la app de tu banco o billetera. Si sigue, la uso hasta fin de mes o hasta que aparezca la nueva.</span>`;
}

let catFilter = 'all';
let medioFilter = 'all';
const expanded = new Set(); // días con "Ver más" abierto
const PER_DAY = 8;
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const FILTERS = [['all', 'Todos los rubros'], ...CATEGORIES.filter((c) => c.id !== 'otros').map((c) => [c.id, c.label])];

function dayBlock(s, offset) {
  const day = (new Date().getDay() + offset) % 7;
  const ps = promosForDay(s, day).filter((p) => (catFilter === 'all' || p.category === catFilter) && (medioFilter === 'all' || p.wallet === medioFilter || (medioFilter === 'todos' && p.wallet === 'todos')));
  if (!ps.length) return '';
  const label = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : cap(WEEKDAYS[day]);
  const open = expanded.has(day);
  const shown = open ? ps : ps.slice(0, PER_DAY);
  const zone = (p) => (p.zone && !/nacional/i.test(p.zone) ? ` · solo ${p.zone}` : '');
  return `<div class="section-title"><span>${label}</span><span class="small muted">${ps.length} promo${ps.length === 1 ? '' : 's'}</span></div>
    <div class="card tight">${shown.map((p) => `<div class="row u-items-start">
      <span class="promo-pct">${p.pct}%</span>
      <span class="grow"><span class="name u-ws-normal">${esc(p.merchant || catLabel(p.category))}</span>
        <span class="meta">${esc(p.name)} · ${esc(catLabel(p.category))}${p.cap ? ` · tope ${money(p.cap)}${p.capPeriod ? ` por ${esc(p.capPeriod)}` : ''}` : (p.capUnknown ? ' · tope sin publicar' : ' · sin tope')}${p.minPurchase ? ` · compra mínima ${money(p.minPurchase)}` : ''}${esc(zone(p))}</span>
        ${p.cond ? `<span class="meta">${esc(p.cond)}</span>` : ''}
        <span class="promo-acciones">${offset === 0 ? `<button class="chip promo-usada" data-action="promoUsed" data-id="${esc(String(p.cap || ''))}">Lo aproveché</button>` : ''}${p.source === 'catalog' ? (() => { const k = promoKey(p); vistas.set(k, p); return `<button class="link-btn small" data-action="avisarError" data-k="${esc(k)}">Avisar un error</button>`; })() : ''}</span></span>
    </div>`).join('')}
    ${ps.length > PER_DAY ? `<button class="btn ghost small" data-action="promoMore" data-day="${day}">${open ? 'Ver menos' : `Ver ${ps.length - PER_DAY} más`}</button>` : ''}</div>`;
}

export function render(s) {
  const has = (s.wallets || []).length;
  if (!['all', 'todos', ...(s.wallets || [])].includes(medioFilter)) medioFilter = 'all';
  const week = has ? [0, 1, 2, 3, 4, 5, 6].map((o) => dayBlock(s, o)).join('') : '';
  return `<section class="screen">
    ${screenHead('Beneficios', '', 'Descuentos de tus medios de pago')}
    <div class="btn-row"><a class="btn small" href="#/reintegros">${icon('coins', 16)} Mis reintegros</a></div>

    ${has ? `<div class="card filtros-promos">
      <div class="field-row">
        <div class="field"><label for="pf-medio">Medio de pago</label><select id="pf-medio" data-change="promoMedio"><option value="all">Todos los míos</option>${s.wallets.map((w) => `<option value="${esc(w)}" ${medioFilter === w ? 'selected' : ''}>${esc(walletName(w))}</option>`).join('')}<option value="todos" ${medioFilter === 'todos' ? 'selected' : ''}>Con cualquier medio</option></select></div>
        <div class="field"><label for="pf-cat">Rubro</label><select id="pf-cat" data-change="promoCat">${FILTERS.map(([id, l]) => `<option value="${id}" ${catFilter === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <button class="btn ghost small u-self-start" data-action="openWallets">${icon('wallet', 16)} Cambiar mis medios de pago</button>
    </div>` : `<div class="card"><p class="text muted">Elegí tus bancos, billeteras y tarjetas y te muestro qué descuentos tenés cada día.</p><button class="btn primary" data-action="openWallets">Elegir mis medios de pago</button></div>`}

    ${week || (has ? '<div class="card"><p class="text muted">No encontré promos para tus medios de pago con este filtro.</p></div>' : '')}

    ${has ? renovarHtml(s) : ''}

    <span class="small muted">${esc(promosStatus(s))} Antes de pagar, confirmá las condiciones en la app de tu banco o billetera.</span>

    <div class="section-title"><span>Promos que cargaste</span><button data-action="newPromo">+ Agregar</button></div>
    <div class="card tight">
      ${s.promos.length ? s.promos.map((p) => `<div class="row">
        <span class="grow"><span class="name">${esc(p.name)} · ${p.pct}%</span><span class="meta">${cap(WEEKDAYS[p.day])} · ${catLabel(p.category)}${p.cap ? ` · tope ${money(p.cap)}` : ''}</span></span>
        <button class="chip" data-action="deletePromo" data-id="${p.id}">Borrar</button>
      </div>`).join('') : '<p class="empty">¿Conocés una promo que no aparece? Cargala y te aviso el día antes.</p>'}
    </div>
  </section>`;
}

const MOTIVOS = [['noExiste', 'Ya no existe o terminó'], ['pct', 'El % está mal'], ['tope', 'El tope está mal'], ['dias', 'Los días están mal'], ['otro', 'Otra cosa']];
export const actions = {
  promoSigue(ctx, el) { ctx.commit((s) => { s.promosRenovadas = { ...(s.promosRenovadas || {}), [el.dataset.k]: finDeMes() }; }); toast('Listo: la uso hasta fin de mes'); },
  promoYaNo(ctx, el) { ctx.commit((s) => { s.promosOcultas = { ...(s.promosOcultas || {}), [el.dataset.k]: new Date().toISOString().slice(0, 10) }; }); toast('Listo: no la muestro más'); },
  avisarError(ctx, el) {
    const p = vistas.get(el.dataset.k); if (!p) return;
    openModal('Avisar un error', `<form class="form" data-submit="enviarError"><input type="hidden" name="k" value="${esc(el.dataset.k)}">
      <div class="card"><strong>${p.pct}% · ${esc(p.merchant || catLabel(p.category))}</strong><span class="small muted">${esc(p.walletName || walletName(p.wallet))}</span></div>
      <div class="field"><span class="label-like">¿Qué está mal?</span><div class="ahorro-ops">${MOTIVOS.map(([v, l], i) => `<label class="ahorro-op"><input type="radio" name="motivo" value="${v}" ${i === 0 ? 'checked' : ''} class="u-pos-absolute-op-0"><b>${l}</b></label>`).join('')}</div></div>
      <div class="field"><label for="ae-t">Contame más (opcional)</label><input id="ae-t" name="texto" maxlength="300" placeholder="Ej: el tope es $8.000, no $10.000"></div>
      <span class="hint">Le llega al equipo de Pesitos para corregirlo. Si ya no existe, deja de aparecerte a vos enseguida.</span>
      <button class="btn primary block" type="submit">Enviar</button></form>`);
  },
  async enviarError(ctx, d) {
    const p = vistas.get(d.k); if (!p) return;
    if (d.motivo === 'noExiste') ctx.commit((s) => { s.promosOcultas = { ...(s.promosOcultas || {}), [d.k]: new Date().toISOString().slice(0, 10) }; });
    closeModal();
    try { await nube.enviarReporte({ uid: ctx.uid }, { medio: p.walletName || walletName(p.wallet), comercio: p.merchant || catLabel(p.category), pct: p.pct, motivo: d.motivo, texto: d.texto }); toast('¡Gracias! Lo vamos a revisar'); }
    catch (e) { console.warn(e); toast('No pude enviarlo ahora. Probá más tarde.'); }
  },
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
        <div class="field"><label for="pr-p">Descuento %</label><input id="pr-p" name="pct" inputmode="decimal" required placeholder="Ej: 20"></div>
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

