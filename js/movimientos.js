// Movimientos: ingresos y gastos separados, fijos que se cargan solos,
// sugerencias de mejora y acceso a tarjetas.

import { money, esc, monthKey, addMonthKey, monthDiff, monthName, relDay, num, MONTHS_LONG } from './formato.js';

const monthLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}`; };
import { catById, catLabel } from './categorias.js';
import { monthExpenses, monthIncome, fixedTotal, fixedActive, fixedProgress } from './calculos.js';
import { parseAmount } from './interprete.js';
import { suggestions, renderSuggestion } from './guia.js';
import { medioOptions } from './acciones.js';
import { icon, catIcon, screenHead, quickForm, openModal, closeModal, toast, borrarConDeshacer } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { lessonCard } from './aprender.js';
import { agenda } from './agenda.js';
import { payOptions } from './pagos.js';
import { nombreCuenta } from './cuentas.js';

let filter = 'todo';
let offset = 0; // meses hacia atrás

const tagsHtml = (t) => ((t && t.length) ? `<span class="tags">${t.map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}</span>` : '');
const enMoneda = (x) => (x.currency && x.currency !== 'ARS' ? ` · ${x.currency} ${String(x.original).replace('.', ',')}` : '');

export function expenseRow(s, e) {
  const c = catById(e.category);
  const green = ['super', 'salud', 'hogar'].includes(c.id);
  const card = e.cardId ? s.cards.find((x) => x.id === e.cardId) : null;
  const medio = card ? esc(card.name) : (e.accountId ? esc(nombreCuenta(s, e.accountId)) : '');
  const cat = e.splits && e.splits.length > 1 ? `${e.splits.length} categorías` : c.label;
  return `<button class="row" data-action="openEntry" data-id="${e.id}" data-kind="expense">
    <span class="cat-icon ${green ? 'green' : ''}">${catIcon(c, 18)}</span>
    <span class="grow"><span class="name">${esc(e.note)}</span><span class="meta">${relDay(e.date)} · ${esc(cat)}${e.installments > 1 ? ` · ${e.installments} cuotas` : ''}${medio ? ` · ${medio}` : ''}${enMoneda(e)}${e.shared ? ` · tu parte (con ${esc(e.shared.with)})` : ''}</span>${tagsHtml(e.tags)}</span>
    <span class="amount">−${money(e.amount)}</span>
  </button>`;
}
export function incomeRow(i, s = null) {
  return `<button class="row" data-action="openEntry" data-id="${i.id}" data-kind="income">
    <span class="cat-icon green">${icon('up', 18)}</span>
    <span class="grow"><span class="name">${esc(i.note)}</span><span class="meta">${relDay(i.date)} · ${i.type === 'sueldo' ? 'Sueldo' : 'Ingreso extra'}${s && i.accountId ? ` · ${esc(nombreCuenta(s, i.accountId))}` : ''}${enMoneda(i)}</span>${tagsHtml(i.tags)}</span>
    <span class="amount pos">+${money(i.amount)}</span>
  </button>`;
}

export function render(s) {
  const mk = addMonthKey(monthKey(), -offset);
  const exp = monthExpenses(s, mk);
  const inc = monthIncome(s, mk);
  const fixed = fixedTotal(s, mk);
  const pending = s.expenses.filter((e) => e.pending).length;
  const today = new Date().getDate();
  const sugg = suggestions(s);

  const exps = s.expenses.filter((e) => !e.pending && e.date.slice(0, 7) === mk).map((e) => ({ ...e, _k: 'e' }));
  const incs = s.incomes.filter((i) => i.date.slice(0, 7) === mk).map((i) => ({ ...i, _k: 'i' }));
  const list = filter === 'gastos' ? exps : filter === 'ingresos' ? incs : [...exps, ...incs];
  list.sort((a, b) => b.date.localeCompare(a.date));
  const top = Object.entries(exp.byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return `<section class="screen">
    ${screenHead('Movimientos', `<span class="head-actions"><a class="icon-btn" href="#/buscar" aria-label="Buscar movimientos">${icon('search', 20)}</a><button class="icon-btn" data-action="openImportar" aria-label="Importar movimientos">${icon('upload', 20)}</button><a class="btn small" href="#/tarjetas">${icon('card', 18)} Tarjetas</a></span>`)}

    <div class="month-nav">
      <button class="icon-btn" data-action="monthPrev" aria-label="Mes anterior">${icon('back', 18, 2.2)}</button>
      <span>${monthName(mk, true).replace(/^./, (c) => c.toUpperCase())} ${mk.slice(0, 4)}</span>
      <button class="icon-btn" data-action="monthNext" aria-label="Mes siguiente" ${offset === 0 ? 'disabled' : ''} style="transform:scaleX(-1)">${icon('back', 18, 2.2)}</button>
    </div>

    <div class="stat-grid">
      <div class="stat"><span class="k">Ingresos</span><span class="v pos">${money(inc)}</span><span class="small muted">${incs.length} movimiento${incs.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="k">Gastos</span><span class="v">${money(exp.total + fixed)}</span><span class="small muted">Fijos ${money(fixed)} · Variables ${money(exp.total)}</span></div>
    </div>

    ${quickForm('q-mov', s, medioOptions(s, '', { auto: true }))}

    ${(() => { const it = agenda(s, 7).filter((i) => !i.paid && i.days <= 7); const t = it.reduce((a, i) => a + i.amount, 0);
      return `<a class="card" href="#/pagos" style="text-decoration:none;color:inherit;flex-direction:row;align-items:center">
        <span class="cat-icon green">${icon('calendar', 18)}</span>
        <span style="display:flex;flex-direction:column;gap:1px;flex:1"><span style="font-weight:800;font-size:14px">Por pagar</span><span class="small muted">${it.length ? `${it.length} vencimiento${it.length > 1 ? 's' : ''} esta semana` : 'Nada vence esta semana'}</span></span>
        <span style="font-weight:800">${it.length ? money(t) : ''}</span>${icon('chevron', 16)}</a>`; })()}

    ${pending ? `<button class="card amber" data-action="openPending" style="border:none;text-align:left;flex-direction:row;align-items:center"><span style="color:var(--amber)">${icon('receipt')}</span><span class="text" style="flex:1"><b>${pending} comprobante${pending > 1 ? 's' : ''} para confirmar.</b> Ya los categoricé, solo revisalos.</span>${icon('chevron', 16)}</button>` : ''}

    ${sugg.map(renderSuggestion).join('')}

    ${top.length ? `<div class="card"><div class="topbar"><strong style="font-size:14px">En qué se fue (variables)</strong><button class="chip" data-action="openCategories">Categorías</button></div>
      ${top.map(([cat, v]) => `<div style="display:flex;flex-direction:column;gap:4px"><div class="split" style="font-size:13px"><span>${catLabel(cat)}</span><b>${money(v)}</b></div><div class="bar" style="height:6px"><span style="width:${Math.round((v / top[0][1]) * 100)}%"></span></div></div>`).join('')}
    </div>` : ''}

    <div class="section-title"><span>Gastos fijos · se descuentan solos</span><button data-action="newFixed">+ Agregar</button></div>
    <div class="card tight">
      ${s.fixed.length ? s.fixed.filter((f) => fixedActive(f, mk) || (f.endMonth && f.endMonth >= addMonthKey(mk, -2))).map((f) => {
        if (!fixedActive(f, mk)) return `<button class="row" data-action="editFixed" data-id="${f.id}"><span class="grow"><span class="name">${esc(f.name)}</span><span class="meta">Terminó en ${monthLabel(f.endMonth)}</span></span><span class="pill ok">Terminado</span></button>`;
        const prog = fixedProgress(f, mk);
        const extra = [prog ? `Cuota ${prog.actual} de ${prog.total}` : (f.endMonth ? `Hasta ${monthLabel(f.endMonth)}` : ''), f.variable ? 'Varía mes a mes' : ''].filter(Boolean).join(' · ');
        const up = !f.variable && f.lastAmount && f.amount > f.lastAmount * 1.03;
        const isPaid = !!(s.paid || {})[`fixed:${f.id}:${mk}`];
        const status = up ? `<span class="pill warn">Subió ${Math.round((f.amount / f.lastAmount - 1) * 100)}%</span>` : isPaid ? '<span class="pill ok">Pagado</span>' : (offset === 0 && Number(f.dueDay) < today ? '<span class="pill warn">¿Lo pagaste?</span>' : `<span class="pill">Vence el ${f.dueDay}</span>`);
        return `<button class="row" data-action="editFixed" data-id="${f.id}"><span class="grow"><span class="name">${esc(f.name)}</span>${extra ? `<span class="meta">${extra}</span>` : ''}</span><span class="amount">${f.variable ? '≈ ' : ''}${money(f.amount)}</span>${status}</button>`;
      }).join('') : `<div style="padding:14px 0;display:flex;flex-direction:column;gap:8px"><p class="text"><b>¿Qué es un gasto fijo?</b> Lo que pagás todos los meses por un monto parecido: alquiler, expensas, servicios, prepaga, cuotas, suscripciones.</p><p class="text muted">Cargalos una vez con el nombre que quieras y los descuento solos. Si algo no cuadra, te lo sugiero.</p></div>`}
    </div>

    <div class="tabs" role="group" aria-label="Filtro">
      ${['todo', 'gastos', 'ingresos'].map((f) => `<button data-action="setFilter" data-f="${f}" aria-pressed="${filter === f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
    </div>
    <div class="card tight">
      ${list.length ? list.map((x) => (x._k === 'e' ? expenseRow(s, x) : incomeRow(x, s))).join('') : '<p class="empty">Todavía no hay movimientos.</p>'}
    </div>
    ${lessonCard(s, 'movimientos')}
    <div class="btn-row">
      <button class="btn small" data-action="newEntry" data-kind="expense">+ Gasto detallado</button>
      <button class="btn small" data-action="newEntry" data-kind="income">+ Ingreso</button>
    </div>
  </section>`;
}

function fixedForm(s, f = {}) {
  const ideas = ['Alquiler', 'Expensas', 'Luz', 'Gas', 'Internet', 'Celular', 'Prepaga', 'Gimnasio', 'Colegio', 'Seguro del auto'];
  return `<form class="form" data-submit="saveFixed">
    <input type="hidden" name="id" value="${esc(f.id || '')}">
    ${f.id ? '' : '<p class="text muted">Ponele el nombre que quieras. Si tenés varios, cargalos de a uno.</p>'}
    <div class="field"><label for="fx-n">Nombre</label><input id="fx-n" name="name" value="${esc(f.name || '')}" placeholder="Ej: Alquiler" required></div>
    ${f.id ? '' : `<div class="chips">${ideas.map((i) => `<button type="button" class="chip" data-action="fillFixedName" data-name="${i}">${i}</button>`).join('')}</div>`}
    <div class="field-row">
      <div class="field"><label for="fx-a">Monto mensual</label><input id="fx-a" name="amount" inputmode="decimal" value="${f.amount ? String(f.amount).replace('.', ',') : ''}" placeholder="Ej: 230.000" required></div>
      <div class="field"><label for="fx-d">Día de vencimiento</label><input id="fx-d" name="dueDay" inputmode="numeric" value="${f.dueDay || 10}"></div>
    </div>
    <label class="check"><input type="checkbox" name="variable" ${f.variable ? 'checked' : ''}> <span>El monto cambia mes a mes<br><span class="small muted">Por reajustes, descuentos que reclamás o consumo. Uso el último que pagaste y, cuando marcás "Pagué", te pregunto cuánto fue.</span></span></label>
    <div class="field"><label for="fx-h">¿Hasta cuándo lo pagás?</label><select id="fx-h" name="hasta" data-change="fixedHastaChanged">
      <option value="siempre" ${!f.endMonth ? 'selected' : ''}>Todos los meses, sin fecha de fin</option>
      <option value="cuotas" ${f.endMonth && f.totalCuotas ? 'selected' : ''}>Tiene cuotas (crédito, préstamo, plan)</option>
      <option value="mes" ${f.endMonth && !f.totalCuotas ? 'selected' : ''}>Hasta un mes en particular</option></select></div>
    <div class="field-row" data-hasta="cuotas" ${f.endMonth && f.totalCuotas ? '' : 'hidden'}>
      <div class="field"><label for="fx-ct">Total de cuotas</label><input id="fx-ct" name="totalCuotas" inputmode="numeric" value="${f.totalCuotas || ''}" placeholder="Ej: 24"></div>
      <div class="field"><label for="fx-cr">Cuotas que te faltan pagar</label><input id="fx-cr" name="restantes" inputmode="numeric" value="${f.endMonth && f.totalCuotas ? Math.max(0, monthDiff(monthKey(), f.endMonth) + 1) : ''}" placeholder="Ej: 18"><span class="hint">Contando la de este mes si todavía no la pagaste.</span></div>
    </div>
    <div class="field" data-hasta="mes" ${f.endMonth && !f.totalCuotas ? '' : 'hidden'}><label for="fx-em">Último mes que lo pagás</label><input id="fx-em" name="endMonth" type="month" value="${esc(f.endMonth || '')}" min="${monthKey()}"></div>
    <div class="field"><label for="fx-w">Se paga con</label><select id="fx-w" name="payWith">${payOptions(s, f.payWith)}</select></div>
    <label class="check"><input type="checkbox" name="autoDebit" ${f.autoDebit ? 'checked' : ''}> <span>Débito automático<br><span class="small muted">Se da por pagado solo el día del vencimiento; te aviso que tengas saldo.</span></span></label>
    <span class="small muted">${f.variable ? 'Cada vez que pagás, actualizo el monto aproximado.' : 'Si cambia el monto, te aviso cuánto subió.'} Cuando termina, deja de descontarse solo.</span>
    <button class="btn primary block" type="submit">Guardar</button>
    ${f.id ? '' : '<button class="btn block" type="submit" name="again" value="1">Guardar y cargar otro</button>'}
    ${f.id ? `<button class="btn ghost block" type="button" data-action="deleteFixed" data-id="${f.id}">Borrar</button>` : ''}
  </form>`;
}

export const actions = {
  setFilter(ctx, el) { filter = el.dataset.f; ctx.render(); },
  monthPrev(ctx) { offset += 1; ctx.render(); },
  monthNext(ctx) { offset = Math.max(0, offset - 1); ctx.render(); },
  newFixed(ctx) { openModal('Nuevo gasto fijo', fixedForm(ctx.state)); },
  fillFixedName(ctx, el) { const i = document.getElementById('fx-n'); if (i) { i.value = el.dataset.name; document.getElementById('fx-a')?.focus(); } },
  editFixed(ctx, el) { const f = ctx.state.fixed.find((x) => x.id === el.dataset.id); if (f) openModal('Gasto fijo', fixedForm(ctx.state, f)); },
  fixedHastaChanged(ctx, el) {
    const f = el.closest('form');
    f.querySelectorAll('[data-hasta]').forEach((x) => { x.hidden = x.dataset.hasta !== el.value; });
  },
  saveFixed(ctx, d) {
    const amount = num(d.amount) || parseAmount(d.amount);
    // fin: por cuotas restantes o por mes elegido
    let endMonth = ''; let totalCuotas = 0;
    if (d.hasta === 'cuotas') {
      const rest = parseInt(d.restantes, 10) || 0; totalCuotas = parseInt(d.totalCuotas, 10) || 0;
      if (!rest) { toast('Decime cuántas cuotas te faltan'); return; }
      const paidThisMonth = d.id && (ctx.state.paid || {})[`fixed:${d.id}:${monthKey()}`];
      endMonth = addMonthKey(monthKey(), rest - (paidThisMonth ? 0 : 1));
      if (totalCuotas < rest) totalCuotas = rest;
    } else if (d.hasta === 'mes') {
      if (!/^\d{4}-\d{2}$/.test(d.endMonth || '')) { toast('Elegí el último mes'); return; }
      endMonth = d.endMonth;
    }
    const extra = { variable: !!d.variable, endMonth, totalCuotas };
    if (!amount || !String(d.name || '').trim()) { toast('Completá nombre y monto'); return; }
    const again = d.again === '1';
    ctx.commit((s) => {
      const f = s.fixed.find((x) => x.id === d.id);
      if (f) {
        if (f.amount !== amount) f.lastAmount = f.amount;
        Object.assign(f, { name: d.name.trim(), amount, dueDay: parseInt(d.dueDay, 10) || f.dueDay, payWith: d.payWith || '', autoDebit: !!d.autoDebit, ...extra });
      } else s.fixed.push({ id: uid(), name: d.name.trim(), amount, dueDay: parseInt(d.dueDay, 10) || 10, payWith: d.payWith || '', autoDebit: !!d.autoDebit, ...extra });
    });
    if (again) { openModal('Nuevo gasto fijo', fixedForm(ctx.state)); toast(`${d.name.trim()} guardado`); }
    else { closeModal(); toast('Gasto fijo guardado'); }
  },
  deleteFixed(ctx, el) { closeModal(); borrarConDeshacer(ctx, 'Gasto fijo borrado', (s) => { s.fixed = s.fixed.filter((x) => x.id !== el.dataset.id); }); },
};
