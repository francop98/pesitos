// Tarjetas de crédito: próximo resumen, cuotas pendientes y lo que ya
// tenés comprometido en los próximos meses.

import { money, esc, num, monthName } from '../format.js';
import { cardSummary } from '../calc.js';
import { icon, sprout, screenHead, openModal, closeModal, toast } from '../ui.js';
import { agenda, dueLabel, bestBuyDay } from '../agenda.js';
import { cardPlan } from '../cashflow.js';
import { payOptions } from './pagos.js';
import { uid } from '../store.js';
import { lessonCard } from '../learn.js';

// Plan para pagar el próximo resumen + mejor día para compras grandes
function planBlock(s, c) {
  const it = agenda(s, 62).find((i) => i.kind === 'card' && i.refId === c.id && !i.paid);
  const bb = bestBuyDay(c);
  const best = `<div class="card">
    <div class="tip-head"><span class="badge">${sprout(17)}</span><strong>Mejor día para compras grandes: el ${bb.best.getDate()}</strong></div>
    <p class="text">Lo que compres desde el ${bb.best.getDate()}/${bb.best.getMonth() + 1} (el día después del cierre) lo pagás recién el ${bb.due.getDate()}/${bb.due.getMonth() + 1}: unos ${bb.days} días de financiación sin costo.</p>
  </div>`;
  if (!it) return best;
  const plan = cardPlan(s, c, it);
  return `<div class="card">
    <div class="topbar"><strong style="font-size:14px">Próximo pago: ${dueLabel(it).toLowerCase()}</strong><span style="font-weight:800">${it.estimated ? '≈ ' : ''}${money(it.amount)}</span></div>
    <span class="small muted">${esc(it.sub)}</span>
    ${plan.fromSavings > 1 ? `<div class="result warn"><strong>Tu plata disponible cubre ${money(plan.fromSalary)}</strong><span class="text">Te faltarían ${money(plan.fromSavings)}: conviene sacarlos de tus ahorros antes que financiar la tarjeta.</span></div>`
      : '<div class="result ok"><strong>Lo cubrís con tu plata disponible</strong><span class="text">Pagalo completo: así no pagás intereses.</span></div>'}
    ${plan.tna ? `<span class="text">Si pagás solo el mínimo, lo que quede pendiente te costaría cerca de <b>${money(plan.monthlyCost)} por mes</b> por cada ${money(it.amount)} financiados (TNA ${plan.tna}% más IVA).</span>`
      : '<span class="small muted">Para calcular cuánto te costaría pagar solo el mínimo, cargá la tasa de financiación (TNA) que figura en tu resumen, en Editar.</span>'}
    ${it.autoDebit ? '<span class="small">Se debita solo: tené el saldo en la cuenta el día del vencimiento.</span>' : `<button class="btn small green" data-action="openPayment" data-key="${esc(it.key)}">Registrar el pago</button>`}
  </div>${best}`;
}

function cardBlock(s, c) {
  const sum = cardSummary(s, c);
  const max = Math.max(1, ...sum.months.map((m) => m.amount));
  return `<div class="card credit">
    <div class="credit-head">
      <span class="credit-name">${icon('card', 20)} ${esc(c.name)}</span>
      <button class="chip" data-action="editCard" data-id="${c.id}">Editar</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <span class="small on-green-muted">Resumen de ${monthName(sum.current, true)} · cierra el ${c.closeDay} · vence el ${c.dueDay}</span>
      <span style="font-size:32px;font-weight:800;letter-spacing:-1px">${money(sum.next)}</span>
    </div>
    ${c.limit ? `<div class="bar"><span style="width:${Math.min(100, Math.round(sum.used * 100))}%"></span></div>
      <div class="split on-green-muted"><span>Comprometido: ${money(sum.committed)}</span><span>Límite: ${money(c.limit)}</span></div>` : ''}
  </div>

  ${planBlock(s, c)}

  <div class="card">
    <strong style="font-size:14px">Próximos resúmenes</strong>
    <div class="months-bars" role="img" aria-label="Lo que ya tenés comprometido en los próximos 6 meses">
      ${sum.months.map((m, i) => `<div class="mbar"><span class="mval">${m.amount ? money(m.amount).replace('$', '') : '—'}</span><span class="mcol" style="height:${Math.max(4, Math.round((m.amount / max) * 90))}px;${i === 0 ? 'background:var(--green)' : ''}"></span><span class="mlabel">${monthName(m.mk)}</span></div>`).join('')}
    </div>
    <span class="small muted">Montos en pesos de cuotas ya compradas. Cada mes que pasa se libera una parte.</span>
  </div>

  <div class="section-title"><span>Cuotas pendientes</span></div>
  <div class="card tight">
    ${sum.pending.length ? sum.pending.map((p) => `<button class="row" data-action="openEntry" data-id="${p.e.id}" data-kind="expense">
      <span class="grow"><span class="name">${esc(p.e.note)}</span><span class="meta">Cuota ${Math.min(p.next, p.n)} de ${p.n} · ${money(p.each)} por mes · termina en ${monthName(p.last, true)}</span>
        <span class="bar" style="height:5px;margin-top:6px"><span style="width:${Math.round(((p.n - p.left) / p.n) * 100)}%"></span></span></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount">${money(p.remaining)}</span><span class="small muted">restan ${p.left}</span></span>
    </button>`).join('') : '<p class="empty">No tenés compras en cuotas en esta tarjeta.</p>'}
  </div>`;
}

export function render(s) {
  return `<section class="screen">
    ${screenHead('Tarjetas', '<button class="btn small" data-action="newCard">+ Tarjeta</button>', 'Resúmenes y cuotas')}
    ${s.cards.length ? s.cards.map((c) => cardBlock(s, c)).join('') : `<div class="card">
      <strong>Sumá tu tarjeta de crédito</strong>
      <p class="text muted">Con el día de cierre y de vencimiento te muestro cuánto viene en cada resumen, las cuotas que te quedan y cuánto tenés comprometido a futuro.</p>
      <button class="btn green small" data-action="newCard">Agregar tarjeta</button>
    </div>`}
    ${s.cards.length ? '<p class="small muted" style="margin:0">Para que una compra entre acá, elegí la tarjeta en "Medio de pago" al anotarla, o escribí su nombre en la carga rápida (por ejemplo: "Zapatillas 180.000 en 6 cuotas visa").</p>' : ''}
    ${lessonCard(s, 'tarjetas')}
  </section>`;
}

function cardForm(s, c = {}) {
  return `<form class="form" data-submit="saveCard">
    <input type="hidden" name="id" value="${esc(c.id || '')}">
    <div class="field"><label for="cd-n">Nombre</label><input id="cd-n" name="name" value="${esc(c.name || '')}" placeholder="Ej: Visa Galicia" required></div>
    <div class="field-row">
      <div class="field"><label for="cd-c">Día de cierre</label><input id="cd-c" name="closeDay" inputmode="numeric" value="${c.closeDay || 25}"></div>
      <div class="field"><label for="cd-v">Día de vencimiento</label><input id="cd-v" name="dueDay" inputmode="numeric" value="${c.dueDay || 5}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cd-l">Límite de compra</label><input id="cd-l" name="limit" inputmode="numeric" value="${c.limit || ''}" placeholder="Opcional"></div>
      <div class="field"><label for="cd-t">TNA de financiación (%)</label><input id="cd-t" name="tna" inputmode="decimal" value="${c.tna || ''}" placeholder="Figura en el resumen"></div>
    </div>
    <div class="field"><label for="cd-w">El resumen lo pagás con</label><select id="cd-w" name="payFrom">${payOptions(s, c.payFrom)}</select></div>
    <label class="check"><input type="checkbox" name="autoDebit" ${c.autoDebit ? 'checked' : ''}> <span>Débito automático del pago total<br><span class="small muted">Te aviso que tengas el saldo antes del vencimiento.</span></span></label>
    <button class="btn primary block" type="submit">Guardar</button>
    ${c.id ? `<button class="btn ghost block" type="button" data-action="deleteCard" data-id="${c.id}">Borrar tarjeta</button>` : ''}
  </form>`;
}

export const actions = {
  newCard(ctx) { openModal('Nueva tarjeta', cardForm(ctx.state)); },
  editCard(ctx, el) { const c = ctx.state.cards.find((x) => x.id === el.dataset.id); if (c) openModal('Editar tarjeta', cardForm(ctx.state, c)); },
  saveCard(ctx, d) {
    const data = { name: d.name.trim(), closeDay: Math.min(31, Math.max(1, parseInt(d.closeDay, 10) || 25)), dueDay: Math.min(31, Math.max(1, parseInt(d.dueDay, 10) || 5)), limit: num(d.limit), tna: parseFloat(String(d.tna || '').replace(',', '.')) || 0, payFrom: d.payFrom || '', autoDebit: !!d.autoDebit };
    ctx.commit((s) => {
      const c = s.cards.find((x) => x.id === d.id);
      if (c) Object.assign(c, data); else s.cards.push({ id: uid(), ...data });
    });
    closeModal(); toast('Tarjeta guardada');
  },
  deleteCard(ctx, el) {
    ctx.commit((s) => {
      s.cards = s.cards.filter((c) => c.id !== el.dataset.id);
      s.expenses.forEach((e) => { if (e.cardId === el.dataset.id) delete e.cardId; });
    });
    closeModal(); toast('Tarjeta borrada');
  },
};
