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
import { openModal, closeModal, modalBack, toast, setModalBody, icon, catIcon } from './interfaz.js';
import { OPTIONS_TEXT, DISCLAIMER, promosStatus } from './economista.js';
import { ratesAge } from './cotizaciones.js';
import { lastIpc, refreshLive } from './datosvivos.js';

const catOptions = (sel) => allCategories().map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.label}</option>`).join('');
const cardOptions = (s, sel) => `<option value="">Efectivo, débito o transferencia</option>${s.cards.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>Tarjeta ${esc(c.name)}</option>`).join('')}`;

function entryForm(s, e, kind) {
  const isIncome = kind === 'income';
  return `<form class="form" data-submit="saveEntry">
    <input type="hidden" name="id" value="${esc(e.id || '')}">
    <input type="hidden" name="kind" value="${kind}">
    <div class="field"><label for="f-amount">Monto</label><input id="f-amount" name="amount" inputmode="decimal" required value="${e.amount ? Math.round(e.amount) : ''}" placeholder="Ej: 48.000"></div>
    <div class="field"><label for="f-note">Descripción</label><input id="f-note" name="note" value="${esc(e.note || '')}"></div>
    ${isIncome
      ? `<div class="field"><label for="f-type">Tipo</label><select id="f-type" name="type"><option value="sueldo" ${e.type === 'sueldo' ? 'selected' : ''}>Sueldo</option><option value="extra" ${e.type !== 'sueldo' ? 'selected' : ''}>Ingreso extra</option></select></div>`
      : `<div class="field"><label for="f-cat">Categoría</label><select id="f-cat" name="category">${catOptions(e.category)}</select><span class="hint">Si la corregís, la próxima vez la reconozco sola.</span></div>
         <div class="field"><label for="f-card">Medio de pago</label><select id="f-card" name="cardId">${cardOptions(s, e.cardId)}</select></div>`}
    <div class="field-row">
      <div class="field"><label for="f-date">Fecha</label><input id="f-date" name="date" type="date" value="${esc(e.date || todayISO())}"></div>
      ${isIncome ? '' : `<div class="field"><label for="f-inst">Cuotas</label><input id="f-inst" name="installments" inputmode="numeric" value="${e.installments || 1}"></div>`}
    </div>
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
    const p = parseEntry(data.q, ctx.state.learned);
    if (!p.amount) { toast('No encontré el monto. Ejemplo: "Supermercado 48.000"'); return; }
    const kind = data.kind === 'income' ? 'income' : 'expense';
    const cardId = kind === 'expense' ? detectCard(ctx.state, data.q) : undefined;
    const chosenCat = data.category && data.category !== 'auto' && data.category !== '__new' ? data.category : null;
    const category = chosenCat || p.category;
    // la fecha elegida en el selector manda; si quedó en hoy, vale la del texto ("ayer", "15/10")
    const date = data.date && data.date !== todayISO() ? data.date : p.date;
    ctx.commit((s) => {
      if (kind === 'income') s.incomes.push({ id: uid(), date, amount: p.amount, type: /sueldo/i.test(data.q) ? 'sueldo' : 'extra', note: p.note === 'Gasto' ? 'Ingreso' : p.note });
      else {
        s.expenses.push({ id: uid(), date, amount: p.amount, category, note: p.note, installments: p.installments, ...(cardId ? { cardId } : {}) });
        if (chosenCat && chosenCat !== p.category) { const key = merchantKey(p.note); if (key) s.learned[key] = chosenCat; }
      }
    });
    const when = date !== todayISO() ? ` (${relDay(date).toLowerCase()})` : '';
    toast(kind === 'income'
      ? `Ingreso anotado: ${money(p.amount)}${when}`
      : `Anotado en ${catLabel(category)}: ${money(p.amount)}${p.installments > 1 ? ` en ${p.installments} cuotas` : ''}${cardId ? ' con tarjeta' : ''}${when}`);
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
  saveEntry(ctx, d) {
    const amount = num(d.amount);
    if (!amount) { toast('Ingresá un monto válido'); return; }
    ctx.commit((s) => {
      if (d.kind === 'income') {
        const item = { id: d.id || uid(), date: d.date || todayISO(), amount, type: d.type, note: d.note || (d.type === 'sueldo' ? 'Sueldo' : 'Ingreso') };
        const i = s.incomes.findIndex((x) => x.id === d.id);
        if (i >= 0) s.incomes[i] = item; else s.incomes.push(item);
      } else {
        const prev = s.expenses.find((x) => x.id === d.id);
        const item = { id: d.id || uid(), date: d.date || todayISO(), amount, category: d.category, note: d.note || catLabel(d.category), installments: Math.max(1, parseInt(d.installments, 10) || 1) };
        if (d.cardId) item.cardId = d.cardId;
        if (prev && prev.category !== d.category) {
          const key = merchantKey(item.note);
          if (key) s.learned[key] = d.category;
        }
        const i = s.expenses.findIndex((x) => x.id === d.id);
        if (i >= 0) s.expenses[i] = item; else s.expenses.push(item);
      }
    });
    closeModal();
    toast('Guardado');
  },
  deleteEntry(ctx, el) {
    const key = el.dataset.kind === 'income' ? 'incomes' : 'expenses';
    ctx.commit((s) => { s[key] = s[key].filter((x) => x.id !== el.dataset.id); });
    closeModal();
    toast('Borrado');
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
    openModal('Cargar comprobante', `<p class="text muted">Desde Mercado Pago o la app de tu banco tocá <b>Compartir</b> y elegí Pesitos (con la app instalada). También podés copiar el texto del comprobante y pegarlo acá.</p>
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
    ctx.commit((s) => { s.expenses = s.expenses.filter((e) => e.id !== el.dataset.id); });
    toast('Borrado: ya no se cuenta dos veces');
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
