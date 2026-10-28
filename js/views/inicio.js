// Inicio: cuánto podés gastar hoy, tu meta, lo que necesita tu atención
// (sueldo del mes, ahorro, resumen semanal) y accesos rápidos.

import { money, esc, monthKey, MONTHS_LONG, MONTHS, num, todayISO, monthName, parseISO } from '../format.js';
import { budget, mainGoal, goalEta, goalPct, savedThisMonth, cardSummary, lastSalary, lastWeekStart, weekSummary } from '../calc.js';
import { insights } from '../advisor.js';
import { renderQuestion, suggestions, renderSuggestion } from '../guide.js';
import { lessonCard } from '../learn.js';
import { catLabel } from '../categories.js';
import { alerts, dueLabel, closings } from '../agenda.js';
import { projection, coverage } from '../cashflow.js';
import { wordmark, icon, sprout, ring, tipCard, quickForm, openModal, closeModal, toast } from '../ui.js';

const MODE_TEXT = {
  payFirst: (s) => `Elegiste apartar el ${s.rules.payFirst.pct}% apenas cobrás`,
  fixed: () => 'Elegiste apartar un monto fijo por mes',
  roundup: () => 'Elegiste redondear cada gasto',
};
const snoozed = (s, key) => (s.snooze || {})[key] && s.snooze[key] > todayISO();

function salaryCard(s, b) {
  if (!b.estimated || snoozed(s, 'salary')) return '';
  const last = lastSalary(s);
  const mk = b.cycle.startISO.slice(0, 7);
  const payISO = b.cycle.startISO;
  return `<div class="card ask">
    <div class="tip-head"><span class="cat-icon green" style="width:26px;height:26px;border-radius:8px">${icon('up', 16, 2.4)}</span><strong>¿Ya cobraste el sueldo de ${monthName(mk, true)}?</strong></div>
    <p class="text">Confirmalo y lo comparo con los meses anteriores y con la inflación. Así ves mes a mes si tu sueldo crece de verdad.</p>
    <form class="quick" data-submit="confirmSalary" autocomplete="off">
      <input type="hidden" name="date" value="${payISO <= todayISO() ? payISO : todayISO()}">
      <label class="sr-only" for="sal-c">Monto cobrado</label>
      <input id="sal-c" name="amount" inputmode="decimal" value="${last ? Math.round(last.amount).toLocaleString('es-AR') : ''}" placeholder="Ej: 900.000">
      <button type="submit" class="icon-btn green" aria-label="Confirmar sueldo">${icon('send', 20, 2.2)}</button>
    </form>
    <button class="btn ghost small" data-action="snoozeCard" data-key="salary" data-days="1" style="align-self:flex-start;min-height:36px;padding:0 4px">Todavía no cobré</button>
  </div>`;
}

function savingCard(s, b) {
  const mk = monthKey();
  if (!s.savingMode || s.savingMode === 'none' || s.setAside[mk] || snoozed(s, 'setAside')) return '';
  if (s.savingMode === 'leftover') {
    if (b.cycle.daysLeft > 3 || b.free <= 0) return '';
    return `<div class="card lime">
      <strong>Se termina tu mes y te sobran ${money(b.free)}</strong>
      <p class="text">Elegiste ahorrar lo que sobra a fin de mes. Pasalo a tu cuenta de ahorro y avisame.</p>
      <div class="btn-row"><button class="btn green small" data-action="setAsideDone" data-amount="${Math.round(b.free)}">Ya lo aparté</button><button class="btn small" data-action="snoozeCard" data-key="setAside" data-days="1">Todavía no</button></div>
    </div>`;
  }
  if (b.saving <= 0 || b.estimated) return '';
  return `<div class="card lime">
    <strong>Cobraste: apartá ${money(b.saving)}</strong>
    <p class="text">${esc(MODE_TEXT[s.savingMode] ? MODE_TEXT[s.savingMode](s) : 'Según tus reglas de ahorro')}${b.savingParts.length > 1 ? ` (incluye ${b.savingParts.map((p) => p.name).join(', ')})` : ''}. Pasalo a tu cuenta de ahorro antes de gastar y avisame.</p>
    <div class="btn-row"><button class="btn green small" data-action="setAsideDone" data-amount="${Math.round(b.saving)}">Ya lo aparté</button><button class="btn small" data-action="snoozeCard" data-key="setAside" data-days="1">Todavía no</button></div>
  </div>`;
}

// Si con los vencimientos y tu ritmo de gasto no alcanza hasta el cobro
function coverageAlert(s) {
  if (!s.fixed.length && !(s.cards || []).length && !(s.bills || []).length) return '';
  const pr = projection(s);
  if (pr.shortfall <= 0) return '';
  const cov = coverage(s, pr);
  return `<a class="card amber" href="#/pagos" style="text-decoration:none;color:inherit">
    <div class="tip-head"><span style="color:var(--amber)">${icon('bulb', 20)}</span><strong>Ojo: no te alcanzaría hasta el cobro</strong></div>
    <p class="text">${esc(cov.text)}</p>
    <span class="small" style="font-weight:700">Ver qué podés hacer →</span>
  </a>`;
}

// Aviso antes del cierre de la tarjeta
function closingTip(s) {
  const c = closings(s, 1)[0];
  if (!c) return '';
  const when = c.days === 0 ? 'hoy' : 'mañana';
  return `<div class="card">
    <div class="tip-head"><span class="badge">${sprout(17)}</span><strong>La ${esc(c.card.name)} cierra ${when}</strong></div>
    <p class="text">Si tenés una compra grande en mente, hacela desde el ${c.bestDay.getDate()}/${c.bestDay.getMonth() + 1}: entra en el resumen siguiente y la pagás recién el ${c.nextDue.getDate()}/${c.nextDue.getMonth() + 1}.</p>
  </div>`;
}

// Avisos de vencimientos: lo vencido y lo que vence en los próximos 3 días
function payAlerts(s) {
  const list = alerts(s);
  if (!list.length) return '';
  const total = list.reduce((a, i) => a + i.amount, 0);
  const urgent = list.some((i) => i.days <= 0);
  return `<div class="card ${urgent ? 'amber' : 'ask'}">
    <div class="tip-head"><span style="color:${urgent ? 'var(--amber)' : 'var(--green)'}">${icon('calendar', 20)}</span><strong>${list.length === 1 ? 'Tenés un pago por vencer' : `Tenés ${list.length} pagos por vencer`}</strong></div>
    ${list.slice(0, 3).map((i) => `<div class="row" style="padding:6px 0;border-color:rgba(0,0,0,.06)">
      <span class="grow"><span class="name">${esc(i.name)}</span><span class="meta">${dueLabel(i)}${i.estimated ? ' · monto estimado' : ''}</span></span>
      <span class="amount">${money(i.amount)}</span>
      ${i.autoDebit ? '<span class="small muted">Débito</span>' : `<button class="btn small green" data-action="markPaid" data-key="${esc(i.key)}" style="min-height:36px">Pagué</button>`}
    </div>`).join('')}
    <span class="small">${list.length > 1 ? `Total: ${money(total)}. ` : ''}Asegurate de tener esa plata disponible.</span>
    <a class="btn small" href="#/pagos">Ver todo lo que tengo por pagar</a>
  </div>`;
}

function weekCard(s) {
  const key = lastWeekStart();
  if (s.weekSeen === key) return '';
  const w = weekSummary(s, key);
  if (!w.count) return '';
  const f = parseISO(w.from); const t = parseISO(w.to);
  return `<div class="card week">
    <div class="tip-head"><span class="cat-icon green" style="width:26px;height:26px;border-radius:8px">${icon('calendar', 16)}</span><strong>Tu semana del ${f.getDate()} al ${t.getDate()} de ${MONTHS[t.getMonth()].toLowerCase()}</strong></div>
    <span style="font-size:24px;font-weight:800">${money(w.spent)} gastados</span>
    <p class="text">${esc(w.verdict)}${w.top[0] ? ` Lo que más pesó: ${esc(w.top.slice(0, 2).map((c) => catLabel(c.cat).toLowerCase()).join(' y '))}.` : ''}</p>
    <div class="btn-row"><button class="btn small green" data-action="openWeek" data-week="${key}">Ver detalle</button><button class="btn small" data-action="dismissWeek" data-week="${key}">Listo</button></div>
  </div>`;
}

export function render(s) {
  const b = budget(s);
  const g = mainGoal(s);
  const tips = insights(s);
  const sugg = suggestions(s);
  const initial = (s.profile.name || 'P').trim().charAt(0).toUpperCase();
  const days = b.cycle.daysLeft;
  const payText = s.profile.paydayVaries
    ? (days === 1 ? 'último día del mes' : `quedan ${days} días del mes`)
    : (days === 1 ? 'cobrás mañana' : `cobrás en ${days} días`);
  const pending = s.expenses.filter((e) => e.pending).length;
  const cards = s.cards.map((c) => ({ c, sum: cardSummary(s, c) })).filter((x) => x.sum.next > 0);

  return `<section class="screen">
    <div class="topbar">
      ${wordmark(26)}
      <button class="avatar" data-action="openSettings" aria-label="Ajustes">${esc(initial)}</button>
    </div>

    ${s.demo ? '<div class="card amber" style="padding:10px 14px"><span class="small">Estás viendo <b>datos de ejemplo</b>. Podés borrarlos desde Ajustes.</span></div>' : ''}

    <div class="card green" style="padding:22px;gap:4px">
      <span class="hero-label">${b.todayLeft >= 0 ? 'Hoy podés gastar' : 'Hoy te pasaste'}</span>
      <span class="hero-number">${b.noIncome ? '—' : money(Math.abs(b.todayLeft))}</span>
      <span class="small on-green-muted">${b.noIncome ? 'Indicá tu sueldo para empezar' : `Sin tocar tus metas · ${payText}`}${b.estimated ? ' · estimado con tu último sueldo' : ''}</span>
      <div class="bar" role="img" aria-label="Usaste el ${Math.round(b.usedPct * 100)}% de tu plata del ciclo"><span style="width:${Math.round(b.usedPct * 100)}%"></span></div>
      <div class="split on-green-muted"><span>Ciclo usado: ${Math.round(b.usedPct * 100)}%</span><span>Libre hasta el cobro: ${money(Math.max(0, b.free))}</span></div>
    </div>

    ${quickForm('q-home')}

    ${coverageAlert(s)}
    ${payAlerts(s)}
    ${closingTip(s)}
    ${salaryCard(s, b)}
    ${renderQuestion(s)}
    ${savingCard(s, b)}
    ${weekCard(s)}

    <div class="tiles">
      <button class="tile" data-action="openBuy">${icon('cart', 22)}<span>¿Me lo compro?</span></button>
      <a class="tile" href="#/pagos">${icon('calendar', 22)}<span>Por pagar</span></a>
      <a class="tile" href="#/beneficios">${icon('ticket', 22)}<span>Beneficios</span></a>
      <a class="tile" href="#/herramientas">${icon('swap', 22)}<span>Herramientas</span></a>
    </div>

    ${g ? `<a class="card goal-row" href="#/ahorro" style="text-decoration:none;color:inherit;flex-direction:row">
      ${ring(goalPct(g), 72, 8, `${g.name}: ${Math.round(goalPct(g) * 100)}%`)}
      <div class="grow" style="display:flex;flex-direction:column;gap:3px">
        <span class="small muted" style="font-weight:600">Meta principal</span>
        <span style="font-size:17px;font-weight:800">${esc(g.name)}</span>
        <span class="small muted">${g.target ? `${money(g.saved)} de ${money(g.target)} · ` : ''}${esc(goalEta(g).text.replace('A este ritmo llegás', 'llegás'))}</span>
      </div>
    </a>` : ''}

    ${pending ? `<button class="card amber" data-action="openPending" style="border:none;text-align:left;flex-direction:row;align-items:center"><span style="color:var(--amber)">${icon('receipt')}</span><span class="text" style="flex:1"><b>${pending} comprobante${pending > 1 ? 's' : ''} para confirmar.</b> Ya los categoricé.</span>${icon('chevron', 16)}</button>` : ''}

    ${cards.map(({ c, sum }) => `<a class="card" href="#/tarjetas" style="text-decoration:none;color:inherit;flex-direction:row;align-items:center">
      <span class="cat-icon green">${icon('card', 18)}</span>
      <span class="grow" style="display:flex;flex-direction:column;gap:1px;flex:1"><span style="font-weight:800;font-size:14px">${esc(c.name)} · resumen de ${monthName(sum.current, true)}</span><span class="small muted">${sum.pending.length} compra${sum.pending.length === 1 ? '' : 's'} en cuotas · vence el ${c.dueDay}</span></span>
      <span style="font-weight:800">${money(sum.next)}</span>
    </a>`).join('')}

    ${sugg[0] ? renderSuggestion(sugg[0]) : ''}
    ${sugg.length > 1 ? `<button class="btn small" data-action="openSuggestions" style="margin-top:-6px">Ver las ${sugg.length} sugerencias</button>` : ''}

    ${tips.slice(0, 2).map(tipCard).join('')}

    ${lessonCard(s, 'inicio')}

    <div class="card lime" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 16px">
      <span class="small" style="font-weight:700">Plata que te ahorró Pesitos en ${MONTHS_LONG[new Date().getMonth()]}</span>
      <span style="font-size:17px;font-weight:800">${money(savedThisMonth(s))}</span>
    </div>
  </section>`;
}

export const actions = {
  promoUsed(ctx, el) {
    const cap = num(el.dataset.id);
    openModal('¿Cuánto te ahorraste?', `<form class="form" data-submit="promoSaved">
      <div class="field"><label for="ps">Ahorro con la promo</label><input id="ps" name="amount" inputmode="numeric" value="${cap || ''}" placeholder="Ej: 8.000" required></div>
      <button class="btn primary block" type="submit">Sumar al contador</button>
    </form>`);
  },
  promoSaved(ctx, d) {
    const amount = num(d.amount);
    if (!amount) return;
    ctx.commit((s) => { const mk = monthKey(); s.savedByApp[mk] = (s.savedByApp[mk] || 0) + amount; });
    closeModal(); toast(`¡Bien! ${money(amount)} ahorrados`);
  },
};
