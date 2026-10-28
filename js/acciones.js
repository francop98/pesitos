// Acciones compartidas entre pantallas: carga rápida, edición de
// movimientos, "¿Me lo compro?", comprobantes, cierre semanal,
// medios de pago, sugerencias de mejora y ajustes.

import { uid, emptyState, clear, migrate } from './almacenamiento.js';
import { parseEntry, merchantKey } from './interprete.js';
import { CATEGORIES, allCategories, catLabel, WALLETS, setCustomCategories, setCustomWallets, PROVINCES, provinceLabel, categoriasOrdenadas, soloEmoji } from './categorias.js';
import { money, esc, todayISO, num, monthKey, relDay, normalize, toISO, addDays, parseISO, MONTHS } from './formato.js';
import { parseAmount } from './interprete.js';
import { weekSummary } from './calculos.js';
import { suggestions, renderSuggestion } from './guia.js';
import { LESSONS } from './aprender.js';
import { buyImpact, expectedBalance, mainGoal, lastSalary } from './calculos.js';
import { demoState } from './ejemplo.js';
import { openModal, closeModal, modalBack, toast, setModalBody, icon, catIcon, borrarConDeshacer } from './interfaz.js';
import { OPTIONS_TEXT, DISCLAIMER, promosStatus } from './economista.js';
import { ratesAge, arsPer } from './cotizaciones.js';
import { listaCuentas, cuentaPrincipal, nombreCuenta } from './cuentas.js';
import { avancePresupuesto } from './presupuestos.js';
import { ASSETS } from './categorias.js';
import { extraerEtiquetas, etiquetasDeTexto } from './formato.js';
import { lastIpc, refreshLive } from './datosvivos.js';

const catOptions = (sel) => allCategories().map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.emoji ? c.emoji + ' ' : '')}${esc(c.label)}</option>`).join('');
const MONEDAS = ASSETS.filter((a) => ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP', 'USDT'].includes(a.id));

/** Opciones de "con qué pagaste": cuentas y tarjetas de crédito. Valor: 'acc:<id>' o 'card:<id>'. */
export function medioOptions(s, sel, { conTarjetas = true, auto = false } = {}) {
  const ppal = cuentaPrincipal(s);
  return `${auto ? `<option value="">Automático (${esc(nombreCuenta(s, ppal))})</option>` : ''}
    <optgroup label="Cuentas">${listaCuentas(s).map((c) => `<option value="acc:${esc(c.id)}" ${sel === 'acc:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>
    ${conTarjetas && s.cards.length ? `<optgroup label="Tarjetas de crédito">${s.cards.map((c) => `<option value="card:${esc(c.id)}" ${sel === 'card:' + c.id ? 'selected' : ''}>Tarjeta ${esc(c.name)}</option>`).join('')}</optgroup>` : ''}`;
}
export const medioDe = (e) => (e.cardId ? `card:${e.cardId}` : e.accountId ? `acc:${e.accountId}` : '');

export function entryForm(s, e, kind) {
  const isIncome = kind === 'income';
  const cur = e.currency || 'ARS';
  const original = e.original || e.amount;
  const sh = e.shared || null;
  const splits = Array.isArray(e.splits) ? e.splits : [];
  const medio = medioDe(e) || `acc:${cuentaPrincipal(s)}`;
  const montoTxt = (v) => (v ? String(Math.round(v * 100) / 100).replace('.', ',') : '');
  return `<form class="form" data-submit="saveEntry" data-change-form="entry">
    <input type="hidden" name="id" value="${esc(e.id || '')}">
    <input type="hidden" name="kind" value="${kind}">
    <div class="field-row money-row">
      <div class="field"><label for="f-amount">${sh ? 'Total del gasto' : 'Monto'}</label><input id="f-amount" name="amount" inputmode="decimal" required value="${montoTxt(sh ? (cur === 'ARS' ? sh.total : original) : original)}" placeholder="Ej: 48.000"></div>
      <div class="field"><label for="f-cur">Moneda</label><select id="f-cur" name="currency" data-change="entryCurrency">${MONEDAS.map((a) => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${a.id === 'ARS' ? 'Pesos' : a.label}</option>`).join('')}</select></div>
    </div>
    <div class="field" data-cur-box ${cur === 'ARS' ? 'hidden' : ''}><label for="f-rate">Cotización (pesos por unidad)</label><input id="f-rate" name="rate" inputmode="decimal" value="${montoTxt(e.rate || (cur !== 'ARS' ? arsPer(s, cur) : 0))}"><span class="hint">La pongo sola con la cotización del día. Si pagaste con otra (por ejemplo, dólar tarjeta), cambiala.</span></div>
    <div class="field"><label for="f-note">Descripción</label><input id="f-note" name="note" value="${esc(e.note || '')}"></div>
    ${isIncome
      ? `<div class="field-row"><div class="field"><label for="f-type">Tipo</label><select id="f-type" name="type"><option value="sueldo" ${e.type === 'sueldo' ? 'selected' : ''}>Sueldo</option><option value="extra" ${e.type !== 'sueldo' ? 'selected' : ''}>Ingreso extra</option></select></div>
         <div class="field"><label for="f-acc">Entró en</label><select id="f-acc" name="medio">${medioOptions(s, medio, { conTarjetas: false })}</select></div></div>`
      : `<div class="field"><label for="f-cat">Categoría</label><select id="f-cat" name="category">${catOptions(e.category)}</select><span class="hint">Si la corregís, la próxima vez la reconozco sola.</span></div>
         <label class="check"><input type="checkbox" name="dividir" data-change="entryToggle" data-box="split" ${splits.length ? 'checked' : ''}> <span>Dividir en varias categorías<br><span class="small muted">Ej: en el súper compraste comida y cosas de limpieza.</span></span></label>
         <div class="split-box" data-box-id="split" ${splits.length ? '' : 'hidden'}>
           ${[0, 1, 2, 3].map((i) => `<div class="field-row"><select name="sc${i}" aria-label="Categoría ${i + 1}">${catOptions((splits[i] || {}).category || (i === 0 ? e.category : ''))}</select><input name="sa${i}" inputmode="decimal" aria-label="Monto ${i + 1}" placeholder="Monto" value="${montoTxt((splits[i] || {}).amount)}"></div>`).join('')}
           <span class="hint">Las partes tienen que sumar el total. La que dejes vacía no se usa.</span>
         </div>
         <div class="field-row"><div class="field"><label for="f-medio">Con qué pagaste</label><select id="f-medio" name="medio">${medioOptions(s, medio)}</select></div>
         <div class="field"><label for="f-inst">Cuotas (con tarjeta)</label><input id="f-inst" name="installments" inputmode="numeric" value="${e.installments || 1}"></div></div>`}
    <div class="field-row">
      <div class="field"><label for="f-date">Fecha</label><input id="f-date" name="date" type="date" value="${esc(e.date || todayISO())}"></div>
      <div class="field"><label for="f-tags">Etiquetas</label><input id="f-tags" name="tags" value="${esc((e.tags || []).join(', '))}" placeholder="Ej: vacaciones, auto"></div>
    </div>
    ${isIncome ? '' : `<label class="check"><input type="checkbox" name="compartido" data-change="entryToggle" data-box="shared" ${sh ? 'checked' : ''}> <span>Lo compartí con otras personas<br><span class="small muted">Cuento solo tu parte como gasto y te anoto lo que te deben (o lo que debés).</span></span></label>
    <div class="split-box" data-box-id="shared" ${sh ? '' : 'hidden'}>
      <div class="field-row"><div class="field"><label for="f-with">Con quién</label><input id="f-with" name="with" value="${esc((sh && sh.with) || '')}" placeholder="Ej: Juan"></div>
      <div class="field"><label for="f-payer">¿Quién pagó?</label><select id="f-payer" name="payer"><option value="yo" ${!sh || sh.paidByMe ? 'selected' : ''}>Yo</option><option value="otro" ${sh && !sh.paidByMe ? 'selected' : ''}>La otra persona</option></select></div></div>
      <div class="field"><label for="f-mine">Mi parte</label><input id="f-mine" name="mine" inputmode="decimal" value="${montoTxt(sh ? (cur === 'ARS' ? e.amount : e.amount / (e.rate || 1)) : '')}" placeholder="Ej: la mitad">
        <div class="chips" style="margin-top:6px">${[2, 3, 4].map((n) => `<button type="button" class="chip" data-action="entryParte" data-n="${n}">Entre ${n}</button>`).join('')}</div></div>
    </div>`}
    <button class="btn primary block" type="submit">${e.pending ? 'Confirmar' : 'Guardar'}</button>
    ${e.id ? `<button class="btn ghost block" type="button" data-action="deleteEntry" data-id="${esc(e.id)}" data-kind="${kind}">Borrar</button>` : ''}
  </form>`;
}

function pendingList(s) {
  const p = s.expenses.filter((e) => e.pending);
  if (!p.length) return '<p class="empty">No hay comprobantes pendientes.</p>';
  return `<div class="card tight">${p.map((e) => `<div class="row">
      <div class="grow"><span class="name">${esc(e.note)}</span><span class="meta">${catLabel(e.category)} · ${relDay(e.date)}</span></div>
      <span class="amount">${money(e.amount)}</span>
      <button class="btn small green" data-action="confirmPending" data-id="${e.id}">Ok</button>
      <button class="icon-btn" data-action="openEntry" data-push="1" data-id="${e.id}" data-kind="expense" aria-label="Revisar ${esc(e.note)}">${icon('chevron', 18)}</button>
    </div>`).join('')}</div>`;
}

function detectCard(s, text) {
  const t = normalize(text);
  const words = t.split(/[^a-z0-9]+/);
  const card = s.cards.find((c) => t.includes(normalize(c.name)) || normalize(c.name).split(/\s+/).some((w) => w.length >= 4 && words.includes(w)));
  if (card) return card.id;
  if (/\b(tarjeta|credito)\b/.test(t) && s.cards.length) return s.cards[0].id;
  return undefined;
}

function walletsBody(s) {
  const mine = new Set(s.wallets);
  const groups = ['Bancos', 'Billeteras', 'Tarjetas'];
  const all = [...WALLETS, ...(s.customWallets || [])];
  return `<p class="text muted">Tocá los que usás. Con eso cruzo los descuentos de cada día y te aviso el día antes.</p>
    ${groups.map((g) => `<div class="field"><label>${g}</label><div class="chips">${all.filter((w) => w.kind === g).map((w) => `<button class="chip toggle" data-action="toggleWallet" data-id="${esc(w.id)}" aria-pressed="${mine.has(w.id)}">${esc(w.name)}</button>`).join('')}</div></div>`).join('')}
    <form class="form card" data-submit="addWallet" autocomplete="off">
      <strong style="font-size:14px">¿No está el tuyo?</strong>
      <div class="field-row">
        <div class="field"><label for="w-n">Nombre</label><input id="w-n" name="name" placeholder="Ej: Banco Patagonia" list="w-n-list" required></div>
        <div class="field"><label for="w-k">Tipo</label><select id="w-k" name="kind">${groups.map((g) => `<option>${g}</option>`).join('')}</select></div>
      </div>
      <button class="btn small green" type="submit">Agregar</button>
      <span class="small muted">Si aparece en las sugerencias al escribir, ya tengo sus promos. Si no, igual lo anoto y se suman cuando aparezcan en las fuentes.</span>
      <datalist id="w-n-list">${[...new Set(((s.live && s.live.promos) || []).map((p) => p.walletName).filter(Boolean))].sort().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </form>
    <p class="small muted">${esc(promosStatus(s))}</p>
    <button class="btn primary block" data-action="closeModal">Listo</button>`;
}

// Administrar categorías: crear (con emoji opcional), ordenar y ocultar
function categoriesBody(s) {
  const prefs = s.catPrefs || {};
  const orden = prefs.orden || 'frecuentes';
  const ocultas = new Set(prefs.ocultas || []);
  const lista = categoriasOrdenadas(s, { conOcultas: true });
  return `<form class="form card" data-submit="saveCategory" autocomplete="off">
      <strong style="font-size:15px">Crear categoría</strong>
      <div class="field-row cat-new">
        <div class="field"><label for="cat-e">Emoji (opcional)</label><input id="cat-e" name="emoji" class="emoji-input" maxlength="8" placeholder="🙂" aria-describedby="cat-e-h"></div>
        <div class="field"><label for="cat-n">Nombre</label><input id="cat-n" name="label" placeholder="Ej: Mascotas" required maxlength="30"></div>
      </div>
      <span class="hint" id="cat-e-h">Para el emoji, tocá el campo y elegilo desde el teclado del celular (en la compu: Windows + punto).</span>
      <button class="btn primary block" type="submit">Crear categoría</button>
    </form>
    <div class="field"><span class="small" style="font-weight:700">Ordenar por</span>
      <div class="tabs">${[['frecuentes', 'Más usadas'], ['personalizado', 'A mi gusto'], ['alfabetico', 'A-Z']].map(([v, l]) => `<button type="button" data-action="catOrden" data-v="${v}" aria-pressed="${orden === v}">${l}</button>`).join('')}</div>
      <span class="hint">${orden === 'frecuentes' ? 'Primero las que más usaste en los últimos 3 meses.' : orden === 'personalizado' ? 'Usá las flechas para acomodarlas como quieras.' : 'Por orden alfabético.'} El ojo oculta una categoría de la carga rápida (no se borra).</span></div>
    <div class="card tight">${lista.map((c, i) => `<div class="row cat-admin ${ocultas.has(c.id) ? 'oculta' : ''}">
        <span class="cat-icon">${catIcon(c, 18)}</span><span class="grow"><span class="name">${esc(c.label)}</span>${c.custom ? '<span class="meta">Creada por vos</span>' : ''}</span>
        ${orden === 'personalizado' ? `<button class="icon-btn mini" data-action="catMover" data-id="${esc(c.id)}" data-dir="-1" aria-label="Subir ${esc(c.label)}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-btn mini" data-action="catMover" data-id="${esc(c.id)}" data-dir="1" aria-label="Bajar ${esc(c.label)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
        <button class="icon-btn mini" data-action="catOcultar" data-id="${esc(c.id)}" aria-label="${ocultas.has(c.id) ? 'Mostrar' : 'Ocultar'} ${esc(c.label)}" aria-pressed="${!ocultas.has(c.id)}">${ocultas.has(c.id) ? '🙈' : icon('eye', 18)}</button>
        ${c.custom ? `<button class="icon-btn mini" data-action="deleteCategory" data-id="${esc(c.id)}" aria-label="Borrar ${esc(c.label)}">${icon('close', 16)}</button>` : ''}
      </div>`).join('')}</div>`;
}

function weekDetail(w) {
  const d = (iso) => { const x = parseISO(iso); return `${x.getDate()} ${MONTHS[x.getMonth()].toLowerCase()}`; };
  return `<div class="card"><span class="small muted">Del ${d(w.from)} al ${d(w.to)}</span>
      <span style="font-size:28px;font-weight:800">${money(w.spent)}</span>
      <span class="text">${esc(w.verdict)}</span></div>
    ${w.top.length ? `<div class="card tight">${w.top.map((c) => `<div class="row"><span class="grow"><span class="name">${esc(catLabel(c.cat))}</span></span><span class="amount">${money(c.amount)}</span></div>`).join('')}</div>` : ''}
    ${w.income ? `<span class="small muted">Ingresos de la semana: ${money(w.income)}</span>` : ''}
    <p class="small muted">El resumen se arma solo cada lunes a las 00:00 con lo que anotaste. Si querés que también cuente lo que no anotaste (efectivo, gastos chicos), ajustalo con tu saldo real.</p>
    <button class="btn block" data-action="openClose" data-push="1">Ajustar con mi saldo real</button>`;
}

export const commonActions = {
  closeModal: () => closeModal(),
  goTo(ctx, el) { closeModal(); ctx.go(el.dataset.route); },
  modalBack: () => modalBack(),

  // ---------- carga rápida ----------
  setKind(ctx, el) {
    const form = el.closest('form');
    const kind = el.dataset.kind;
    form.querySelectorAll('[data-action=setKind]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    form.querySelector('input[name=kind]').value = kind;
    const input = form.querySelector('input[name=q]');
    input.placeholder = input.dataset[kind === 'income' ? 'phIncome' : 'phExpense'];
    form.classList.toggle('income', kind === 'income');
    input.focus();
  },
  quickAdd(ctx, data) {
    const { texto, tags } = extraerEtiquetas(data.q);
    const p = parseEntry(texto, ctx.state.learned);
    if (!p.amount) { toast('No encontré el monto. Ejemplo: "Supermercado 48.000"'); return; }
    const kind = data.kind === 'income' ? 'income' : 'expense';
    const [medioTipo, medioId] = String(data.medio || '').split(':');
    const cardId = kind === 'expense' ? (medioTipo === 'card' ? medioId : medioTipo === 'acc' ? undefined : detectCard(ctx.state, texto)) : undefined;
    const accountId = cardId ? undefined : (medioTipo === 'acc' ? medioId : cuentaPrincipal(ctx.state));
    const chosenCat = data.category && data.category !== 'auto' && data.category !== '__new' ? data.category : null;
    const category = chosenCat || p.category;
    // gastos en otra moneda: "Netflix US$ 10", "hotel 200 reales", "50 usd"
    const t = normalize(texto);
    const currency = /\b(us\$|u\$s|usd|dolar(es)?)\b|us\$|u\$s/.test(t) ? 'USD' : /\b(euros?|eur)\b|€/.test(t) ? 'EUR' : /\b(reales?|brl)\b|r\$/.test(t) ? 'BRL' : 'ARS';
    const rate = currency === 'ARS' ? 1 : arsPer(ctx.state, currency);
    if (currency !== 'ARS' && !rate) { toast('No tengo la cotización ahora: cargalo desde "Gasto detallado"'); return; }
    const amount = Math.round(p.amount * rate * 100) / 100;
    const moneda = currency === 'ARS' ? {} : { currency, original: p.amount, rate };
    const note = p.note.replace(/\b(us\$|u\$s|usd|dolares|dolar|euros?|reales?)\b/gi, '').replace(/\s+/g, ' ').trim() || p.note;
    // la fecha elegida en el selector manda; si quedó en hoy, vale la del texto ("ayer", "15/10")
    const date = data.date && data.date !== todayISO() ? data.date : p.date;
    const antes = kind === 'expense' ? avancePresupuesto(ctx.state, category) : null;
    ctx.commit((s) => {
      if (kind === 'income') s.incomes.push({ id: uid(), date, amount, type: /sueldo/i.test(texto) ? 'sueldo' : 'extra', note: note === 'Gasto' ? 'Ingreso' : note, ...(accountId ? { accountId } : {}), ...(tags.length ? { tags } : {}), ...moneda });
      else {
        s.expenses.push({ id: uid(), date, amount, category, note, installments: cardId ? p.installments : 1, ...(cardId ? { cardId } : { accountId }), ...(tags.length ? { tags } : {}), ...moneda });
        if (chosenCat && chosenCat !== p.category) { const key = merchantKey(note); if (key) s.learned[key] = chosenCat; }
      }
    });
    const when = date !== todayISO() ? ` (${relDay(date).toLowerCase()})` : '';
    const enMoneda = currency !== 'ARS' ? ` (${currency} ${String(p.amount).replace('.', ',')})` : '';
    let msg = kind === 'income'
      ? `Ingreso anotado: ${money(amount)}${enMoneda}${when}`
      : `Anotado en ${catLabel(category)}: ${money(amount)}${enMoneda}${p.installments > 1 && cardId ? ` en ${p.installments} cuotas` : ''}${cardId ? ' con tarjeta' : ''}${when}`;
    // aviso de presupuesto al cruzar el 80% o el 100%
    if (antes) {
      const ahora = avancePresupuesto(ctx.state, category);
      if (ahora && ahora.pct >= 1 && antes.pct < 1) msg += `. Ojo: te pasaste del presupuesto de ${catLabel(category)}`;
      else if (ahora && ahora.pct >= 0.8 && antes.pct < 0.8) msg += `. Llevás el ${Math.round(ahora.pct * 100)}% del presupuesto de ${catLabel(category)}`;
    }
    toast(msg);
  },
  pickCat(ctx, el) {
    const form = el.closest('form');
    form.querySelector('[name=category]').value = el.dataset.id;
    form.querySelectorAll('[data-action=pickCat]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  },
  openCatManager(ctx) { openModal('Categorías', `<div id="cats-body">${categoriesBody(ctx.state)}</div>`); },
  catOrden(ctx, el) {
    ctx.update((s) => {
      s.catPrefs = { ...(s.catPrefs || {}), orden: el.dataset.v };
      if (el.dataset.v === 'personalizado' && !(s.catPrefs.lista || []).length) s.catPrefs.lista = categoriasOrdenadas({ ...s, catPrefs: { orden: 'frecuentes' } }, { conOcultas: true }).map((c) => c.id);
    });
    setModalBody('#cats-body', categoriesBody(ctx.state)); ctx.render();
  },
  catMover(ctx, el) {
    ctx.update((s) => {
      const ids = categoriasOrdenadas(s, { conOcultas: true }).map((c) => c.id);
      const i = ids.indexOf(el.dataset.id); const j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      s.catPrefs = { ...(s.catPrefs || {}), orden: 'personalizado', lista: ids };
    });
    setModalBody('#cats-body', categoriesBody(ctx.state)); ctx.render();
  },
  catOcultar(ctx, el) {
    ctx.update((s) => {
      const set = new Set((s.catPrefs && s.catPrefs.ocultas) || []);
      if (set.has(el.dataset.id)) set.delete(el.dataset.id); else set.add(el.dataset.id);
      s.catPrefs = { ...(s.catPrefs || {}), ocultas: [...set] };
    });
    setModalBody('#cats-body', categoriesBody(ctx.state)); ctx.render();
  },

  // ---------- categorías propias ----------
  openCategories(ctx) { openModal('Categorías', `<div id="cats-body">${categoriesBody(ctx.state)}</div>`); },

  saveCategory(ctx, d) {
    const label = String(d.label || '').trim().slice(0, 30);
    if (!label) return;
    if (allCategories().some((c) => normalize(c.label) === normalize(label))) { toast('Esa categoría ya existe'); return; }
    const emoji = soloEmoji(d.emoji);
    if (String(d.emoji || '').trim() && !emoji) toast('Ese campo es solo para un emoji: lo dejé sin emoji');
    ctx.commit((s) => { s.customCategories.push({ id: 'c_' + uid(), label: label.charAt(0).toUpperCase() + label.slice(1), ...(emoji ? { emoji } : {}) }); setCustomCategories(s.customCategories); });
    setModalBody('#cats-body', categoriesBody(ctx.state));
    toast(`Categoría "${label}" creada`);
  },
  deleteCategory(ctx, el) {
    ctx.commit((s) => {
      s.customCategories = s.customCategories.filter((c) => c.id !== el.dataset.id);
      s.expenses.forEach((e) => { if (e.category === el.dataset.id) e.category = 'otros'; });
      for (const k of Object.keys(s.learned)) if (s.learned[k] === el.dataset.id) delete s.learned[k];
      setCustomCategories(s.customCategories);
    });
    setModalBody('#cats-body', categoriesBody(ctx.state));
    toast('Categoría borrada (sus gastos pasaron a "Otros")');
  },

  newEntry(ctx, el) {
    const kind = el.dataset.kind || 'expense';
    openModal(kind === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto', entryForm(ctx.state, {}, kind));
  },
  openEntry(ctx, el) {
    const kind = el.dataset.kind || 'expense';
    const list = kind === 'income' ? ctx.state.incomes : ctx.state.expenses;
    const e = list.find((x) => x.id === el.dataset.id);
    if (!e) return;
    openModal(kind === 'income' ? 'Editar ingreso' : (e.pending ? 'Revisar comprobante' : 'Editar gasto'), entryForm(ctx.state, e, kind), { push: !!el.dataset.push });
  },
  entryCurrency(ctx, el) {
    const f = el.closest('form');
    const box = f.querySelector('[data-cur-box]');
    box.hidden = el.value === 'ARS';
    const r = arsPer(ctx.state, el.value);
    if (el.value !== 'ARS' && r) f.querySelector('[name=rate]').value = String(Math.round(r * 100) / 100).replace('.', ',');
  },
  entryToggle(ctx, el) {
    const box = el.closest('form').querySelector(`[data-box-id="${el.dataset.box}"]`);
    if (box) box.hidden = !el.checked;
    if (el.dataset.box === 'shared') { const l = el.closest('form').querySelector('label[for=f-amount]'); if (l) l.textContent = el.checked ? 'Total del gasto' : 'Monto'; }
  },
  entryParte(ctx, el) {
    const f = el.closest('form');
    const total = num(f.querySelector('[name=amount]').value);
    if (total) f.querySelector('[name=mine]').value = String(Math.round((total / Number(el.dataset.n)) * 100) / 100).replace('.', ',');
  },
  saveEntry(ctx, d) {
    const original = num(d.amount);
    if (!original) { toast('Ingresá un monto válido'); return; }
    const currency = d.currency || 'ARS';
    const rate = currency === 'ARS' ? 1 : (num(d.rate) || arsPer(ctx.state, currency));
    if (!rate) { toast('Poné la cotización de esa moneda'); return; }
    const ars = (v) => Math.round(v * rate * 100) / 100;
    const tags = etiquetasDeTexto(d.tags);
    const [medioTipo, medioId] = String(d.medio || '').split(':');
    const moneda = currency === 'ARS' ? {} : { currency, original, rate };
    let msg = 'Guardado';
    ctx.commit((s) => {
      s.deudas = s.deudas || [];
      if (d.kind === 'income') {
        const item = { id: d.id || uid(), date: d.date || todayISO(), amount: ars(original), type: d.type, note: d.note || (d.type === 'sueldo' ? 'Sueldo' : 'Ingreso'), ...moneda };
        if (medioTipo === 'acc') item.accountId = medioId;
        if (tags.length) item.tags = tags;
        const i = s.incomes.findIndex((x) => x.id === d.id);
        if (i >= 0) s.incomes[i] = item; else s.incomes.push(item);
        return;
      }
      const prev = s.expenses.find((x) => x.id === d.id);
      const id = d.id || uid();
      const total = ars(original);
      // compartido: el gasto es solo tu parte; lo demás queda como deuda
      let amount = total; let shared = null;
      if (d.compartido) {
        const mine = ars(num(d.mine));
        if (!mine || mine > total) { msg = ''; return; }
        amount = mine;
        shared = { total, paidByMe: d.payer !== 'otro', with: String(d.with || '').trim().slice(0, 40) || 'Otra persona' };
      }
      // dividido en categorías
      let splits = [];
      if (d.dividir) {
        splits = [0, 1, 2, 3].map((i) => ({ category: d['sc' + i], amount: ars(num(d['sa' + i])) })).filter((p) => p.amount > 0);
        const suma = splits.reduce((a, p) => a + p.amount, 0);
        if (splits.length > 1 && Math.abs(suma - total) > 1) { msg = `Las partes suman ${money(suma)} y el total es ${money(total)}`; return; }
        // si es compartido, cada parte se achica en proporción a lo que te toca
        if (shared) splits = splits.map((p) => ({ ...p, amount: Math.round((p.amount * amount / total) * 100) / 100 }));
      }
      const main = splits && splits.length ? splits.slice().sort((a, b) => b.amount - a.amount)[0].category : d.category;
      const item = { id, date: d.date || todayISO(), amount, category: main, note: d.note || catLabel(main), installments: Math.max(1, parseInt(d.installments, 10) || 1), ...moneda };
      if (medioTipo === 'card') item.cardId = medioId; else if (medioTipo === 'acc') item.accountId = medioId;
      if (!item.cardId) item.installments = 1;
      if (splits && splits.length > 1) item.splits = splits;
      if (tags.length) item.tags = tags;
      if (shared) item.shared = shared;
      if (prev && prev.category !== item.category && !item.splits) {
        const key = merchantKey(item.note);
        if (key) s.learned[key] = item.category;
      }
      // deuda vinculada al gasto compartido
      const prevDeuda = s.deudas.find((x) => x.origen === id);
      if (shared) {
        const tipo = shared.paidByMe ? 'meDeben' : 'debo';
        const monto = shared.paidByMe ? Math.round((total - amount) * 100) / 100 : amount;
        const datos = { tipo, persona: shared.with, monto, date: item.date, nota: item.note, origen: id };
        if (prevDeuda) Object.assign(prevDeuda, datos); else if (monto > 0) s.deudas.push({ id: uid(), pagos: [], ...datos });
        msg = shared.paidByMe ? `Guardado: ${shared.with} te debe ${money(monto)}` : `Guardado: le debés ${money(monto)} a ${shared.with}`;
      } else if (prevDeuda && !(prevDeuda.pagos || []).length) s.deudas = s.deudas.filter((x) => x !== prevDeuda);
      const i = s.expenses.findIndex((x) => x.id === d.id);
      if (i >= 0) s.expenses[i] = item; else s.expenses.push(item);
    });
    if (!msg) { toast('Revisá "Mi parte": tiene que ser menor o igual al total'); return; }
    if (msg.startsWith('Las partes')) { toast(msg); return; }
    closeModal();
    toast(msg);
  },
  deleteEntry(ctx, el) {
    const key = el.dataset.kind === 'income' ? 'incomes' : 'expenses';
    const it = ctx.state[key].find((x) => x.id === el.dataset.id);
    closeModal();
    borrarConDeshacer(ctx, `Borraste ${it ? `"${it.note}"` : 'el movimiento'}`, (s) => {
      s[key] = s[key].filter((x) => x.id !== el.dataset.id);
      s.deudas = (s.deudas || []).filter((x) => x.origen !== el.dataset.id || (x.pagos || []).length);
    });
  },

  // ---------- ¿Me lo compro? ----------
  openBuy() {
    openModal('¿Me lo compro?', `<form class="form" data-submit="buyCheck">
      <div class="field"><label for="b-amount">¿Cuánto cuesta?</label><input id="b-amount" name="amount" inputmode="decimal" placeholder="Ej: 90.000" required></div>
      <button class="btn primary block" type="submit">Ver impacto</button>
    </form><div id="buy-result"></div>`);
  },
  buyCheck(ctx, d) {
    const amount = num(d.amount);
    if (!amount) return;
    const r = buyImpact(ctx.state, amount);
    const sal = lastSalary(ctx.state);
    const workDays = sal ? amount / (sal.amount / 22) : 0;
    setModalBody('#buy-result', `<div class="result ${r.level}"><strong>${esc(r.title)}</strong><span class="text">${esc(r.text)}</span>${r.extra ? `<span class="text">${esc(r.extra)}</span>` : ''}</div>
      ${workDays ? `<div class="card"><span class="text">Equivale a <b>${workDays < 1 ? `${Math.max(1, Math.round(workDays * 8))} horas` : `${workDays.toFixed(1).replace('.', ',')} días`}</b> de tu trabajo. Antes de decidir, preguntate: ¿lo necesito o lo quiero? Si es un gusto, esperá 48 horas: si las ganas siguen, adelante.</span></div>` : ''}
      <button class="btn small" data-action="openInstallments" data-push="1">¿Y si lo pago en cuotas?</button>`);
  },

  // ---------- comprobantes ----------
  openPaste() {
    openModal('Cargar comprobante', `<div class="chips" style="margin-bottom:12px"><button class="chip" data-action="openTicket" data-push="1">${icon('camera', 16)} Foto del ticket</button><button class="chip" data-action="openImportar" data-push="1">${icon('upload', 16)} Importar resumen o Excel</button></div>
      <p class="text muted">Desde Mercado Pago o la app de tu banco tocá <b>Compartir</b> y elegí Pesitos (con la app instalada). También podés copiar el texto del comprobante y pegarlo acá.</p>
      <form class="form" data-submit="pasteSubmit">
        <div class="field"><label for="p-text">Texto del comprobante</label><textarea id="p-text" name="text" placeholder="Pagaste $ 12.500,00 a FARMACITY" required></textarea></div>
        <button class="btn primary block" type="submit">Leer comprobante</button>
      </form>`);
  },
  pasteSubmit(ctx, d) {
    const ok = addPendingFromText(ctx, d.text);
    if (ok === 'bill') { closeModal(); toast('Tiene vencimiento: lo agendé en Por pagar y te aviso antes'); }
    else if (ok) { closeModal(); toast('Quedó para confirmar en Movimientos'); }
    else toast('No encontré un monto en ese texto');
  },
  openPending(ctx) { openModal('Comprobantes para confirmar', `<div id="pending-body">${pendingList(ctx.state)}</div>`); },
  confirmPending(ctx, el) {
    ctx.commit((s) => { const e = s.expenses.find((x) => x.id === el.dataset.id); if (e) delete e.pending; });
    setModalBody('#pending-body', pendingList(ctx.state));
    toast('Confirmado');
  },

  // ---------- cierre semanal ----------
  openClose(ctx, el) {
    const exp = expectedBalance(ctx.state);
    openModal('Ajustar con mi saldo', `<p class="text">${ctx.state.lastClose
      ? `¿Cuánto tenés en total hoy entre cuentas, billeteras y efectivo? No incluyas ahorros ni inversiones. Según lo anotado deberías tener cerca de <b>${money(exp)}</b>. La diferencia la sumo como "gastos varios".`
      : 'Indicá cuánto tenés hoy entre cuentas, billeteras y efectivo (sin ahorros ni inversiones). Lo tomo como punto de partida: la próxima vez que ajustes, completo solo lo que no anotaste.'}</p>
      <form class="form" data-submit="closeSubmit">
        <div class="field"><label for="c-bal">Saldo total hoy</label><input id="c-bal" name="balance" inputmode="decimal" placeholder="Ej: 250.000" required></div>
        <button class="btn primary block" type="submit">Ajustar</button>
      </form>`, { push: !!(el && el.dataset && el.dataset.push) });
  },
  closeSubmit(ctx, d) {
    const bal = num(d.balance);
    const exp = expectedBalance(ctx.state);
    const today = todayISO();
    let msg = 'Listo. Desde hoy hago el cierre con este saldo.';
    ctx.commit((s) => {
      if (exp != null) {
        const diff = exp - bal;
        if (diff > 500) {
          s.expenses.push({ id: uid(), date: today, amount: Math.round(diff), category: 'varios', note: 'Gastos varios (cierre semanal)', installments: 1 });
          msg = `Sumé ${money(diff)} como gastos varios. Panorama completo sin anotar cada café.`;
        } else if (diff < -500) msg = `Tenés ${money(-diff)} más de lo esperado. ¿Un ingreso sin anotar?`;
        else msg = 'Todo cuadra. ¡Bien ahí!';
      }
      s.lastClose = { date: today, balance: bal };
    });
    closeModal();
    toast(msg);
  },

  // ---------- págate primero ----------
  setAsideDone(ctx, el) {
    const amount = num(el.dataset.amount);
    ctx.commit((s) => {
      s.setAside[monthKey()] = true;
      const g = mainGoal(s);
      if (g) g.saved += amount;
      s.transfers.push({ id: uid(), date: todayISO(), amount, note: 'Págate primero' });
    });
    toast(`¡Bien! ${money(amount)} apartados para tus metas`);
  },
  setAsideLater(ctx) {
    ctx.commit((s) => { s.setAsideSnooze = todayISO(); });
    toast('Dale, te lo recuerdo mañana');
  },

  // ---------- medios de pago ----------
  openWallets(ctx) { openModal('Mis medios de pago', `<div id="wallets-body">${walletsBody(ctx.state)}</div>`); },
  toggleWallet(ctx, el) {
    ctx.commit((s) => {
      const set = new Set(s.wallets);
      if (set.has(el.dataset.id)) set.delete(el.dataset.id); else set.add(el.dataset.id);
      s.wallets = [...set];
    });
    setModalBody('#wallets-body', walletsBody(ctx.state));
  },
  addWallet(ctx, d) {
    const name = String(d.name || '').trim().slice(0, 40);
    if (!name) return;
    const id = 'x:' + normalize(name).replace(/[^a-z0-9]+/g, '-');
    ctx.commit((s) => {
      if (!s.customWallets.some((w) => w.id === id) && !WALLETS.some((w) => normalize(w.name) === normalize(name))) s.customWallets.push({ id, name, kind: d.kind });
      if (!s.wallets.includes(id)) s.wallets.push(id);
      setCustomWallets(s.customWallets);
    });
    setModalBody('#wallets-body', walletsBody(ctx.state));
    const key = (t) => normalize(t).replace(/\b(banco|tarjeta|de|del|la|el)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    const tiene = ((ctx.state.live && ctx.state.live.promos) || []).some((p) => p.walletName && key(p.walletName) === key(name));
    toast(tiene ? `${name} agregado: ya tengo sus promos` : `${name} agregado. Todavía no hay promos suyas en las fuentes: te las muestro cuando aparezcan`);
  },

  // ---------- resumen semanal automático ----------
  openWeek(ctx, el) {
    const w = weekSummary(ctx.state, el.dataset.week);
    openModal('Tu semana', weekDetail(w));
  },
  dismissWeek(ctx, el) { ctx.commit((s) => { s.weekSeen = el.dataset.week; }); },

  // ---------- sueldo del mes ----------
  confirmSalary(ctx, d) {
    const amount = parseAmount(d.amount);
    if (!amount) { toast('Ingresá el monto que cobraste'); return; }
    ctx.commit((s) => { s.incomes.push({ id: uid(), date: d.date || todayISO(), amount, type: 'sueldo', note: 'Sueldo' }); });
    toast('Sueldo confirmado: ya lo comparo con los meses anteriores');
  },
  snoozeCard(ctx, el) {
    ctx.commit((s) => { s.snooze[el.dataset.key] = toISO(addDays(new Date(), Number(el.dataset.days || 1))); });
    toast('Dale, te lo recuerdo más adelante');
  },

  // ---------- sugerencias y aprendizaje ----------
  openSuggestions(ctx) {
    const list = suggestions(ctx.state);
    openModal('Sugerencias de Pesitos', `<p class="text muted">Están ordenadas por cuánto afectan tu plata por mes: arriba la que más.</p>${list.map(renderSuggestion).join('') || '<p class="empty">No hay sugerencias por ahora.</p>'}`);
  },
  openLesson(ctx, el) {
    const l = LESSONS.find((x) => x.id === el.dataset.id);
    if (!l) return;
    openModal(l.title, `<div class="lesson">${l.body.map((p) => `<p class="text">${esc(p)}</p>`).join('')}</div>${l.tool ? `<button class="btn green block" data-action="goTo" data-route="${l.tool.route}">${esc(l.tool.label)}</button>` : ''}`, { push: !!el.dataset.push });
    ctx.update((s) => { s.lessonsSeen[l.id] = todayISO(); });
  },

  // ---------- sugerencias de mejora ----------
  fixToVariable(ctx, el) {
    ctx.commit((s) => { s.fixed = s.fixed.filter((f) => f.id !== el.dataset.id); });
    toast('Listo: ahora lo anotás como gasto variable cuando ocurra');
  },
  deleteDuplicate(ctx, el) {
    borrarConDeshacer(ctx, 'Borrado: ya no se cuenta dos veces', (s) => { s.expenses = s.expenses.filter((e) => e.id !== el.dataset.id); });
  },
  makeFixed(ctx, el) {
    ctx.commit((s) => {
      s.fixed.push({ id: uid(), name: el.dataset.name, amount: num(el.dataset.amount), dueDay: parseInt(el.dataset.day, 10) || 10 });
      s.dismissed[el.dataset.sid] = true;
    });
    toast(`${el.dataset.name} ahora es un gasto fijo`);
  },
  dismissSuggestion(ctx, el) {
    ctx.commit((s) => { s.dismissed[el.dataset.sid] = true; });
    toast('Entendido, no te lo vuelvo a sugerir');
  },

  // ---------- opciones de ahorro ----------
  showOptions() {
    openModal('¿Dónde pongo mis ahorros?', `<p class="text" style="white-space:pre-line">${esc(OPTIONS_TEXT)}</p><p class="small muted">${DISCLAIMER}</p>`);
  },

  // ---------- copia de seguridad (el menú está en js/menu.js) ----------
  exportData(ctx) {
    const blob = new Blob([JSON.stringify(ctx.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `pesitos-${todayISO()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importData(ctx, el) {
    const file = el.files && el.files[0];
    if (!file) return;
    file.text().then((txt) => {
      try { ctx.replace({ ...migrate(JSON.parse(txt)), ready: true }); closeModal(); toast('Copia importada'); }
      catch { toast('Ese archivo no es una copia de Pesitos'); }
    });
  },
  loadDemo(ctx) { ctx.replace(demoState()); closeModal(); ctx.go('inicio'); toast('Datos de ejemplo cargados'); },
  resetAll(ctx, el) {
    if (el.dataset.confirm !== 'yes') { el.dataset.confirm = 'yes'; el.textContent = 'Tocá de nuevo para borrar todo'; return; }
    clear(); ctx.replace({ ...emptyState(), profile: { ...emptyState().profile, name: ctx.state.profile.name } }); closeModal();
  },
};

export function addPendingFromText(ctx, text) {
  const p = parseEntry(text, ctx.state.learned);
  if (!p.amount) return false;
  // boleta o factura con vencimiento ("vence el 15/11"): se agenda como pago
  const v = normalize(text).match(/venc\w*[^\d]{0,15}(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (v) {
    const now = new Date();
    let y = v[3] ? (v[3].length === 2 ? 2000 + Number(v[3]) : Number(v[3])) : now.getFullYear();
    let due = new Date(y, Number(v[2]) - 1, Number(v[1]));
    if (!v[3] && due < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)) due = new Date(y + 1, Number(v[2]) - 1, Number(v[1]));
    const name = p.note.replace(/\bvenc\w*\b.*$/i, '').trim() || 'Pago';
    ctx.commit((s) => { s.bills = s.bills || []; s.bills.push({ id: uid(), name, amount: p.amount, date: toISO(due), repeat: 'once', category: p.category, payWith: '', autoDebit: false, saveAhead: false }); });
    return 'bill';
  }
  ctx.commit((s) => {
    if (p.kind === 'income') s.incomes.push({ id: uid(), date: p.date, amount: p.amount, type: p.incomeType, note: p.note });
    else s.expenses.push({ id: uid(), date: p.date, amount: p.amount, category: p.category, note: p.note, installments: p.installments, pending: true });
  });
  return true;
}
