// Por pagar: agenda de vencimientos y cobros, proyección de la plata hasta
// el cobro, alerta si no alcanza, vista calendario, totales por cuenta,
// historial de cumplimiento y recordatorios.

import { money, esc, num, todayISO, parseISO, toISO, MONTHS, MONTHS_LONG, WEEKDAYS, addMonthKey, monthKey, addDays, startOfToday } from '../format.js';
import { allCategories, walletName } from '../categories.js';
import { payCycle } from '../calc.js';
import { agenda, agendaBetween, groups, pendingUntil, provisions, dueLabel, buildICS, REPEATS, repeatLabel, history, byAccount, statementDates, statementOf } from '../agenda.js';
import { projection, coverage, inflows } from '../cashflow.js';
import { icon, screenHead, openModal, closeModal, toast } from '../ui.js';
import { lessonCard } from '../learn.js';
import { uid } from '../store.js';

let view = 'lista';
let showPaid = false;
let calOffset = 0;
const shortDate = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`; };
const accountName = (id) => (id === 'efectivo' ? 'Efectivo' : walletName(id));

function row(it) {
  const tone = it.paid ? 'ok' : it.overdue ? 'warn' : it.days <= 3 ? 'lime' : '';
  const label = it.paid && it.paidInfo && it.paidInfo.auto ? 'Debitado' : dueLabel(it);
  return `<div class="row pay-row ${it.paid ? 'is-paid' : ''}">
    <span class="cat-icon ${it.kind === 'card' ? 'green' : ''}">${icon(it.icon, 18)}</span>
    <button class="grow" data-action="openPayment" data-key="${esc(it.key)}" style="background:none;border:none;text-align:left;padding:0">
      <span class="name">${esc(it.name)}</span>
      <span class="meta">${esc(it.sub)}${it.payWith ? ` · ${esc(accountName(it.payWith))}` : ''}</span>
      <span class="pill ${tone}" style="align-self:flex-start;margin-top:4px">${label}</span>
    </button>
    <span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="amount">${it.estimated ? '≈ ' : ''}${money(it.amount)}</span>
      ${it.paid ? '' : it.autoDebit ? '<span class="small muted">Se debita solo</span>' : `<button class="btn small green" data-action="markPaid" data-key="${esc(it.key)}" style="min-height:36px">Pagué</button>`}
    </span>
  </div>`;
}

function inRow(i) {
  return `<div class="row">
    <span class="cat-icon green">${icon('up', 18)}</span>
    <span class="grow"><span class="name">${esc(i.name)}</span><span class="meta">${esc(i.sub || '')} · ${shortDate(i.date)}</span></span>
    <span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="amount pos">${i.estimated ? '≈ ' : ''}+${money(i.amount)}</span>
    ${i.kind === 'income' && i.date <= todayISO() ? `<button class="btn small" data-action="markReceived" data-key="${esc(i.key)}" style="min-height:36px">Lo cobré</button>` : ''}</span>
  </div>`;
}

function section(title, list, note = '') {
  if (!list.length) return '';
  const total = list.reduce((a, i) => a + i.amount, 0);
  return `<div class="section-title"><span>${title}</span><span class="small" style="font-weight:800;color:var(--ink)">${money(total)}</span></div>
    ${note ? `<span class="small muted" style="margin-top:-8px">${note}</span>` : ''}
    <div class="card tight">${list.map(row).join('')}</div>`;
}

// gráfico de la plata disponible día a día hasta el cobro
function chart(pr) {
  const pts = pr.points;
  if (pts.length < 2) return '';
  const W = 350; const H = 120; const pad = 8;
  const vals = pts.map((p) => p.balance);
  const min = Math.min(0, ...vals); const max = Math.max(...vals, 1);
  const x = (i) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const mi = pts.findIndex((p) => p.date === pr.minDate);
  const zero = y(0);
  return `<svg role="img" aria-label="Plata disponible estimada hasta el cobro" viewBox="0 0 ${W} ${H + 18}" width="100%">
    ${min < 0 ? `<rect x="0" y="${zero}" width="${W}" height="${H - zero}" fill="rgba(242,179,61,.18)"/>` : ''}
    <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="rgba(255,255,255,.35)" stroke-dasharray="4 4"/>
    <polyline points="${line}" fill="none" stroke="#C6F36B" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => (p.out.length ? `<circle cx="${x(i)}" cy="${y(p.balance)}" r="3.5" fill="#FFFFFF"/>` : '')).join('')}
    ${mi >= 0 ? `<circle cx="${x(mi)}" cy="${y(pts[mi].balance)}" r="6" fill="${pts[mi].balance < 0 ? '#F2B33D' : '#C6F36B'}" stroke="#1F6F4A" stroke-width="2"/>` : ''}
    <text x="${pad}" y="${H + 14}" font-size="11" fill="#D6EBDF">Hoy</text>
    <text x="${W - pad}" y="${H + 14}" font-size="11" fill="#D6EBDF" text-anchor="end">Cobro ${shortDate(pr.until)}</text>
  </svg>`;
}

function calendar(s) {
  const mk = addMonthKey(monthKey(), calOffset);
  const [y, m] = mk.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const last = new Date(y, m, 0);
  const items = agendaBetween(s, first, last);
  const ins = inflows(s, first, last);
  const pd = Number(s.profile.payday) || 1;
  const closes = (s.cards || []).map((c) => ({ c, d: statementDates(c, mk).close }));
  const today = todayISO();
  const cells = [];
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell empty"></span>');
  let heavy = 0;
  const totals = {};
  items.forEach((i) => { totals[i.due] = (totals[i.due] || 0) + i.amount; });
  const maxDay = Math.max(1, ...Object.values(totals));
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = toISO(new Date(y, m - 1, d));
    const dayItems = items.filter((i) => i.due === iso);
    const dayIns = ins.filter((i) => i.date === iso);
    const isPay = d === Math.min(pd, last.getDate()) && !s.profile.paydayVaries;
    const isClose = closes.some((c) => toISO(c.d) === iso);
    const load = totals[iso] ? totals[iso] / maxDay : 0;
    if (load > 0.5) heavy++;
    const dots = [
      ...dayItems.map((i) => `<i class="dot ${i.paid ? 'paid' : i.overdue ? 'late' : 'out'}"></i>`),
      ...(isPay || dayIns.length ? ['<i class="dot in"></i>'] : []),
      ...(isClose ? ['<i class="dot close"></i>'] : []),
    ].slice(0, 4).join('');
    cells.push(`<button class="cal-cell ${iso === today ? 'today' : ''} ${load > 0.5 ? 'heavy' : ''}" data-action="openDay" data-day="${iso}" aria-label="${d} de ${MONTHS_LONG[m - 1]}${dayItems.length ? `, ${dayItems.length} pagos` : ''}">
      <span class="n">${d}</span><span class="dots">${dots}</span></button>`);
  }
  return `<div class="card">
    <div class="month-nav" style="background:var(--bg)">
      <button class="icon-btn" data-action="calMove" data-d="-1" aria-label="Mes anterior">${icon('back', 18, 2.2)}</button>
      <span>${MONTHS_LONG[m - 1][0].toUpperCase() + MONTHS_LONG[m - 1].slice(1)} ${y}</span>
      <button class="icon-btn" data-action="calMove" data-d="1" aria-label="Mes siguiente" style="transform:scaleX(-1)">${icon('back', 18, 2.2)}</button>
    </div>
    <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cal-head">${d}</span>`).join('')}${cells.join('')}</div>
    <div class="legend small"><span><i class="dot out"></i>Vence</span><span><i class="dot in"></i>Cobro</span><span><i class="dot close"></i>Cierre de tarjeta</span><span><i class="dot late"></i>Vencido</span></div>
    ${heavy ? '<span class="small muted">Los días resaltados son los más cargados del mes.</span>' : ''}
  </div>`;
}

export function render(s) {
  const items = agenda(s, 62);
  const g = groups(items);
  const cycle = payCycle(s);
  const untilPay = pendingUntil(items.filter((i) => !i.fromSavings), cycle.nextISO);
  const pr = projection(s);
  const cov = coverage(s, pr);
  const prov = provisions(s);
  const ins = inflows(s, startOfToday(), addDays(startOfToday(), 62));
  const weekItems = items.filter((i) => !i.paid && i.days <= 7);
  const accounts = byAccount(weekItems, accountName);
  const h = history(s);
  const empty = !items.length;

  return `<section class="screen">
    ${screenHead('Por pagar', '<button class="btn small" data-action="newBill">+ Pago</button>', 'Vencimientos, cobros y tu plata hasta el cobro')}

    <div class="card green" style="gap:6px;padding:20px">
      <span class="hero-label">Hasta tu próximo cobro (${shortDate(cycle.nextISO)}) tenés que pagar</span>
      <span style="font-size:34px;font-weight:800;letter-spacing:-1px">${money(untilPay)}</span>
      ${chart(pr)}
      <span class="small on-green-muted">${esc(cov.text)}${pr.estimated ? ' Estimado con lo que anotaste.' : ''}</span>
      ${pr.estimated ? '<button class="btn small" data-action="openClose" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent">Hacerlo exacto con mi saldo real</button>' : ''}
    </div>

    ${!cov.ok ? `<div class="card amber">
      <div class="tip-head"><span style="color:var(--amber)">${icon('bulb', 20)}</span><strong>Qué podés hacer</strong></div>
      ${cov.options.map((o) => `<p class="text">• ${esc(o)}</p>`).join('')}
    </div>` : ''}

    <div class="tabs" role="group" aria-label="Vista" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <button data-action="setPayView" data-v="lista" aria-pressed="${view === 'lista'}">Lista</button>
      <button data-action="setPayView" data-v="calendario" aria-pressed="${view === 'calendario'}">Calendario</button>
    </div>

    ${view === 'calendario' ? calendar(s) : `
      ${empty ? `<div class="card"><strong>Todavía no hay pagos en tu agenda</strong>
        <p class="text muted">Acá aparecen solos tus gastos fijos y los resúmenes de tus tarjetas. Sumá también pagos que no son mensuales: patente, seguro, matrícula, impuestos.</p>
        <button class="btn green small" data-action="newBill">Agregar un pago</button></div>` : ''}
      ${section('Vencidos', g.overdue, '¿Ya los pagaste? Marcalos para que no te avise más.')}
      ${section('Hoy', g.today)}
      ${section('Esta semana', g.week)}
      ${section('Este mes', g.month)}
      ${section('Más adelante', g.later)}
      ${ins.length ? `<div class="section-title"><span>Vas a cobrar</span><button data-action="newIncome">+ Cobro</button></div><div class="card tight">${ins.map(inRow).join('')}</div>`
        : '<div class="section-title"><span>Vas a cobrar</span><button data-action="newIncome">+ Cobro</button></div>'}
    `}

    ${accounts.length ? `<div class="section-title"><span>Esta semana, por cuenta</span></div>
    <div class="card tight">${accounts.map((a) => `<div class="row"><span class="cat-icon">${icon('wallet', 18)}</span><span class="grow"><span class="name">${esc(a.label)}</span><span class="meta">${a.items.map((i) => esc(i.name)).join(', ')}${a.auto ? ` · ${money(a.auto)} en débito automático` : ''}</span></span><span class="amount">${money(a.total)}</span></div>`).join('')}</div>
    <span class="small muted" style="margin-top:-6px">Tené ese saldo en cada cuenta antes de cada vencimiento${accounts.some((a) => a.auto) ? ', así no rebota ningún débito' : ''}.</span>` : ''}

    ${prov.length ? `<div class="section-title"><span>Ahorrando para pagos grandes</span></div>
    <div class="card tight">${prov.map((p) => `<div class="row"><span class="grow"><span class="name">${esc(p.bill.name)}</span><span class="meta">${money(p.bill.amount)} el ${shortDate(p.due)} · faltan ${p.months} meses</span></span><span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount">${money(p.monthly)}</span><span class="small muted">por mes</span></span></div>`).join('')}</div>
    <span class="small muted" style="margin-top:-6px">Ya está incluido en tu ahorro del mes: así cuando llegue el pago, la plata está.</span>` : ''}

    ${h.total || h.increases.length ? `<div class="section-title"><span>Tu historial</span></div>
    <div class="card">
      ${h.total ? `<div class="stat-grid three" style="gap:8px">
        <div class="quote"><span class="k">Racha a tiempo</span><span class="v">${h.streak} ${h.streak === 1 ? 'pago' : 'pagos'}</span></div>
        <div class="quote"><span class="k">A tiempo</span><span class="v">${h.onTime} de ${h.total}</span></div>
        <div class="quote"><span class="k">Con atraso</span><span class="v">${h.late}</span></div>
      </div>` : ''}
      ${h.increases.map((i) => `<span class="small"><b>${esc(i.name)}</b> subió ${Math.round((i.to / i.from - 1) * 100)}% (de ${money(i.from)} a ${money(i.to)}). Vale la pena comparar opciones.</span>`).join('')}
      ${h.late ? '<span class="small muted">Pagar a término evita recargos e intereses por mora.</span>' : h.total ? '<span class="small muted">¡Bien! Pagar a término te ahorra recargos e intereses.</span>' : ''}
    </div>` : ''}

    ${g.paid.length ? `<button class="btn small" data-action="togglePaid">${showPaid ? 'Ocultar' : 'Ver'} pagados (${g.paid.length})</button>${showPaid ? `<div class="card tight">${g.paid.map(row).join('')}</div>` : ''}` : ''}

    <div class="card">
      <strong style="font-size:14px">Recordatorios</strong>
      <p class="text muted">Sumá todos tus vencimientos al calendario del celular: te avisa el día anterior y el mismo día, aunque no abras la app.</p>
      <div class="btn-row">
        <button class="btn small green" data-action="downloadICS">${icon('calendar', 18)} Agregar al calendario</button>
        <button class="btn small" data-action="enableNotifications">Avisos en este dispositivo</button>
      </div>
    </div>

    ${(s.bills || []).length ? `<div class="section-title"><span>Tus pagos programados</span></div>
    <div class="card tight">${s.bills.map((b) => `<button class="row" data-action="editBill" data-id="${b.id}"><span class="grow"><span class="name">${esc(b.name)}</span><span class="meta">${repeatLabel(b.repeat)} · desde el ${shortDate(b.date)}${b.saveAhead ? ' · ahorrando de a poco' : ''}${b.autoDebit ? ' · débito automático' : ''}</span></span><span class="amount">${money(b.amount)}</span></button>`).join('')}</div>` : ''}

    ${(s.expectedIncomes || []).length ? `<div class="section-title"><span>Tus cobros programados</span></div>
    <div class="card tight">${s.expectedIncomes.map((c) => `<button class="row" data-action="editIncome" data-id="${c.id}"><span class="grow"><span class="name">${esc(c.name)}</span><span class="meta">${repeatLabel(c.repeat)} · desde el ${shortDate(c.date)}</span></span><span class="amount pos">+${money(c.amount)}</span></button>`).join('')}</div>` : ''}

    ${lessonCard(s, 'pagos')}
  </section>`;
}

const payOptions = (s, sel) => `<option value="">Sin asignar</option><option value="efectivo" ${sel === 'efectivo' ? 'selected' : ''}>Efectivo</option>${(s.wallets || []).map((w) => `<option value="${esc(w)}" ${w === sel ? 'selected' : ''}>${esc(walletName(w))}</option>`).join('')}`;
export { payOptions };

function billForm(s, b = {}) {
  return `<form class="form" data-submit="saveBill">
    <input type="hidden" name="id" value="${esc(b.id || '')}">
    <div class="field"><label for="bl-n">¿Qué tenés que pagar?</label><input id="bl-n" name="name" value="${esc(b.name || '')}" placeholder="Ej: Patente, seguro del auto, matrícula" required></div>
    <div class="field-row">
      <div class="field"><label for="bl-a">Monto</label><input id="bl-a" name="amount" inputmode="decimal" value="${b.amount || ''}" placeholder="Ej: 45.000" required></div>
      <div class="field"><label for="bl-d">Vence el</label><input id="bl-d" name="date" type="date" value="${b.date || todayISO()}" required></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="bl-r">Se repite</label><select id="bl-r" name="repeat">${REPEATS.map((r) => `<option value="${r.id}" ${r.id === (b.repeat || 'once') ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
      <div class="field"><label for="bl-c">Categoría</label><select id="bl-c" name="category">${allCategories().map((c) => `<option value="${c.id}" ${c.id === (b.category || 'otros') ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="bl-w">Se paga con</label><select id="bl-w" name="payWith">${payOptions(s, b.payWith)}</select></div>
    <label class="check"><input type="checkbox" name="autoDebit" ${b.autoDebit ? 'checked' : ''}> <span>Débito automático<br><span class="small muted">Se marca como pagado solo el día del vencimiento. Te aviso que tengas saldo.</span></span></label>
    <label class="check"><input type="checkbox" name="saveAhead" ${b.saveAhead ? 'checked' : ''}> <span>Ahorrar de a poco para este pago<br><span class="small muted">Ideal para pagos grandes: lo divido en los meses que faltan y lo sumo a tu ahorro.</span></span></label>
    <button class="btn primary block" type="submit">Guardar</button>
    ${b.id ? `<button class="btn ghost block" type="button" data-action="deleteBill" data-id="${b.id}">Borrar</button>` : ''}
  </form>`;
}

function incomeForm(c = {}) {
  return `<form class="form" data-submit="saveIncome">
    <input type="hidden" name="id" value="${esc(c.id || '')}">
    <p class="text muted">Para cobros que no son tu sueldo: un alquiler que cobrás, un trabajo, una venta en cuotas. El sueldo y el aguinaldo los estimo solo.</p>
    <div class="field"><label for="in-n">¿Qué vas a cobrar?</label><input id="in-n" name="name" value="${esc(c.name || '')}" placeholder="Ej: Alquiler del departamento" required></div>
    <div class="field-row">
      <div class="field"><label for="in-a">Monto</label><input id="in-a" name="amount" inputmode="decimal" value="${c.amount || ''}" placeholder="Ej: 250.000" required></div>
      <div class="field"><label for="in-d">Fecha</label><input id="in-d" name="date" type="date" value="${c.date || todayISO()}" required></div>
    </div>
    <div class="field"><label for="in-r">Se repite</label><select id="in-r" name="repeat">${REPEATS.map((r) => `<option value="${r.id}" ${r.id === (c.repeat || 'monthly') ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
    <button class="btn primary block" type="submit">Guardar</button>
    ${c.id ? `<button class="btn ghost block" type="button" data-action="deleteIncome" data-id="${c.id}">Borrar</button>` : ''}
  </form>`;
}

function findItem(s, key) { return agenda(s, 400).find((i) => i.key === key); }

export const actions = {
  setPayView(ctx, el) { view = el.dataset.v; ctx.render(); },
  calMove(ctx, el) { calOffset += Number(el.dataset.d); ctx.render(); },
  openDay(ctx, el) {
    const iso = el.dataset.day; const d = parseISO(iso);
    const items = agendaBetween(ctx.state, d, d);
    const ins = inflows(ctx.state, d, d);
    const closes = (ctx.state.cards || []).filter((c) => toISO(statementDates(c, statementOf(c, iso)).close) === iso);
    openModal(`${WEEKDAYS[d.getDay()][0].toUpperCase() + WEEKDAYS[d.getDay()].slice(1)} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`,
      `${items.length ? `<div class="card tight">${items.map(row).join('')}</div>` : ''}
       ${ins.length ? `<div class="card tight">${ins.map(inRow).join('')}</div>` : ''}
       ${closes.map((c) => `<div class="card"><strong>Cierra la tarjeta ${esc(c.name)}</strong><span class="text muted">Lo que compres desde mañana entra en el resumen siguiente.</span></div>`).join('')}
       ${!items.length && !ins.length && !closes.length ? '<p class="empty">Nada para este día.</p>' : ''}
       <button class="btn small" data-action="newBill" data-date="${iso}">+ Agendar un pago este día</button>`);
  },
  togglePaid(ctx) { showPaid = !showPaid; ctx.render(); },
  newBill(ctx, el) { openModal('Nuevo pago', billForm(ctx.state, el && el.dataset.date ? { date: el.dataset.date } : {})); },
  editBill(ctx, el) { const b = (ctx.state.bills || []).find((x) => x.id === el.dataset.id); if (b) openModal('Editar pago', billForm(ctx.state, b)); },
  saveBill(ctx, d) {
    const amount = num(d.amount);
    if (!amount || !String(d.name || '').trim()) { toast('Completá qué pagás y el monto'); return; }
    ctx.commit((s) => {
      s.bills = s.bills || [];
      const data = { name: d.name.trim(), amount, date: d.date, repeat: d.repeat, category: d.category, payWith: d.payWith || '', autoDebit: !!d.autoDebit, saveAhead: !!d.saveAhead };
      const b = s.bills.find((x) => x.id === d.id);
      if (b) { if (b.amount !== amount) data.lastAmount = b.amount; Object.assign(b, data); } else s.bills.push({ id: uid(), ...data });
    });
    closeModal(); toast('Pago agendado: te aviso antes del vencimiento');
  },
  deleteBill(ctx, el) { ctx.commit((s) => { s.bills = s.bills.filter((b) => b.id !== el.dataset.id); }); closeModal(); },

  newIncome() { openModal('Nuevo cobro', incomeForm()); },
  editIncome(ctx, el) { const c = (ctx.state.expectedIncomes || []).find((x) => x.id === el.dataset.id); if (c) openModal('Editar cobro', incomeForm(c)); },
  saveIncome(ctx, d) {
    const amount = num(d.amount);
    if (!amount || !String(d.name || '').trim()) { toast('Completá qué cobrás y el monto'); return; }
    ctx.commit((s) => {
      s.expectedIncomes = s.expectedIncomes || [];
      const data = { name: d.name.trim(), amount, date: d.date, repeat: d.repeat };
      const c = s.expectedIncomes.find((x) => x.id === d.id);
      if (c) Object.assign(c, data); else s.expectedIncomes.push({ id: uid(), ...data });
    });
    closeModal(); toast('Cobro agendado');
  },
  deleteIncome(ctx, el) { ctx.commit((s) => { s.expectedIncomes = s.expectedIncomes.filter((c) => c.id !== el.dataset.id); }); closeModal(); },
  markReceived(ctx, el) {
    const key = el.dataset.key;
    const it = inflows(ctx.state, addDays(startOfToday(), -62), startOfToday()).find((i) => i.key === key);
    if (!it) return;
    ctx.commit((s) => {
      s.received = s.received || {};
      s.received[key] = { date: todayISO(), amount: it.amount };
      s.incomes.push({ id: uid(), date: it.date, amount: it.amount, type: 'extra', note: it.name });
    });
    toast(`${it.name}: cobrado`);
  },

  openPayment(ctx, el) {
    const it = findItem(ctx.state, el.dataset.key);
    if (!it) return;
    const goto = it.kind === 'card' ? '<button class="btn block" data-action="goTo" data-route="tarjetas">Ver el plan de pago de la tarjeta</button>'
      : it.kind === 'bill' ? `<button class="btn block" data-action="editBill" data-id="${it.refId}">Editar este pago</button>`
      : `<button class="btn block" data-action="editFixed" data-id="${it.refId}">Editar el gasto fijo</button>`;
    openModal(it.name, `<div class="card"><span class="small muted">${esc(it.sub)}</span><span style="font-size:28px;font-weight:800">${it.estimated ? '≈ ' : ''}${money(it.amount)}</span><span class="pill ${it.overdue ? 'warn' : ''}" style="align-self:flex-start">${it.paid && it.paidInfo && it.paidInfo.auto ? 'Debitado automáticamente' : dueLabel(it)}</span>
      ${it.payWith ? `<span class="small">Se paga con ${esc(accountName(it.payWith))}</span>` : ''}
      ${it.paidInfo && !it.paidInfo.auto ? `<span class="small">Pagado el ${shortDate(it.paidInfo.date)} · ${money(it.paidInfo.amount)}</span>` : ''}</div>
      ${it.paid ? (it.paidInfo && it.paidInfo.auto ? '' : `<button class="btn block" data-action="unmarkPaid" data-key="${esc(it.key)}">Marcar como no pagado</button>`) : `<form class="form" data-submit="markPaidForm">
        <input type="hidden" name="key" value="${esc(it.key)}">
        <div class="field-row">
          <div class="field"><label for="pp-a">Monto pagado</label><input id="pp-a" name="amount" inputmode="decimal" value="${Math.round(it.amount)}"></div>
          <div class="field"><label for="pp-d">Fecha</label><input id="pp-d" name="date" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        </div>
        ${it.kind === 'card' ? '<span class="small muted">Si pagaste el mínimo o una parte, poné el monto: te muestro cuánto quedó.</span>' : ''}
        <button class="btn green block" type="submit">Marcar como pagado</button>
      </form>`}
      ${goto}`);
  },
  markPaid(ctx, el) { pay(ctx, el.dataset.key); },
  markPaidForm(ctx, d) { pay(ctx, d.key, num(d.amount), d.date); closeModal(); },
  unmarkPaid(ctx, el) {
    const key = el.dataset.key;
    ctx.commit((s) => {
      delete s.paid[key];
      s.expenses = s.expenses.filter((e) => e.fromPayment !== key);
    });
    closeModal(); toast('Marcado como pendiente');
  },
  downloadICS(ctx) {
    const blob = new Blob([buildICS(ctx.state)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pesitos-pagos.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Abrí el archivo para sumarlo a tu calendario');
  },
  async enableNotifications(ctx) {
    if (!('Notification' in window)) { toast('Este navegador no permite avisos'); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { ctx.update((s) => { s.notifiedOn = ''; }); toast('Listo: cuando abras la app te aviso lo que vence'); }
    else toast('No se activaron los avisos. Podés usar el calendario.');
  },
};

function pay(ctx, key, amount, date) {
  const it = findItem(ctx.state, key);
  if (!it) return;
  const paidAmount = amount || it.amount;
  const when = date || todayISO();
  let msg = `${it.name}: pagado`;
  ctx.commit((s) => {
    const prev = s.paid[key];
    const total = (prev ? Number(prev.amount) : 0) + paidAmount;
    s.paid[key] = { date: when, amount: total, due: it.due, onTime: when <= it.due };
    // los pagos programados no están en otro lado: se anotan como gasto
    if (it.kind === 'bill') {
      const b = s.bills.find((x) => x.id === it.refId);
      s.expenses.push({ id: uid(), date: when, amount: paidAmount, category: (b && b.category) || 'otros', note: it.name, installments: 1, fromPayment: key, ...(b && b.saveAhead ? { fromSavings: true } : {}) });
    }
  });
  if (it.kind === 'card' && paidAmount < it.amount - 1) msg = `Pagaste ${money(paidAmount)} de ${money(it.amount)}: quedan ${money(it.amount - paidAmount)} que generan intereses en el próximo resumen.`;
  else if (when > it.due) msg = `${it.name}: pagado (con ${Math.round((parseISO(when) - parseISO(it.due)) / 86400000)} días de atraso)`;
  toast(msg);
}

