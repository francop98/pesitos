// Sueldo: evolución nominal vs real, mejor mes y crecimiento.

import { money, pct, esc, monthName, monthKey, addMonthKey, num, todayISO, toISO, MONTHS_LONG } from './formato.js';
import { salaryStats, lastSalary } from './calculos.js';
import { lastIpc } from './datosvivos.js';
import { sprout, icon, screenHead, openModal, closeModal, toast } from './interfaz.js';
import { uid } from './almacenamiento.js';
import { fechaDeCobro } from './feriados.js';
import { lessonCard } from './aprender.js';

function chart(series) {
  const pts = series.slice(-12);
  if (pts.length < 2) return '<p class="empty">Cargá al menos dos meses para ver la evolución.</p>';
  const W = 350; const H = 150; const pad = 10;
  const vals = pts.flatMap((p) => [p.nominal, p.real]);
  const min = Math.min(...vals) * 0.97; const max = Math.max(...vals) * 1.02;
  const x = (i) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v) => H - 10 - ((v - min) / (max - min || 1)) * (H - 24);
  const line = (k) => pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const labels = pts.map((p, i) => (i % 2 === pts.length % 2 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H + 14}" text-anchor="middle" font-size="11" style="fill:${i === pts.length - 1 ? 'var(--ink)' : 'var(--muted)'}" font-weight="${i === pts.length - 1 ? 800 : 500}">${monthName(p.mk)}</text>` : '')).join('');
  return `<svg role="img" aria-label="Sueldo de los últimos ${pts.length} meses, nominal y real" viewBox="0 0 ${W} ${H + 20}" width="100%">
    <line x1="0" y1="${H - 4}" x2="${W}" y2="${H - 4}" style="stroke:var(--track)"/>
    <polyline points="${line('nominal')}" fill="none" stroke="#9A9DA3" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${line('real')}" fill="none" stroke="#1F6F4A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(last.real)}" r="5" fill="#1F6F4A"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(last.nominal)}" r="4" fill="#9A9DA3"/>
    ${labels}
  </svg>`;
}

export function render(s) {
  const st = salaryStats(s);
  const history = [...s.incomes].filter((i) => i.type === 'sueldo').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const nextMk = (() => { const l = lastSalary(s); return l ? addMonthKey(l.date.slice(0, 7), 1) : monthKey(); })();

  let reading = '';
  if (st) {
    const parts = [];
    if (st.streak >= 2) parts.push(`Le ganaste a la inflación ${st.streak} meses seguidos.`);
    else if (st.streak === 1) parts.push('Este mes le ganaste a la inflación.');
    else if (st.series.length > 1) parts.push('Este mes tu sueldo perdió contra la inflación.');
    if (st.isBest) parts.push(`${MONTHS_LONG[Number(st.cur.mk.slice(5)) - 1][0].toUpperCase() + MONTHS_LONG[Number(st.cur.mk.slice(5)) - 1].slice(1)} es tu mejor mes en términos reales.`);
    if (st.toRecover > 0.005) parts.push(`Para volver a tu mejor mes (${monthName(st.best.mk, true)}) necesitás un aumento de ${pct(st.toRecover, 0, false)}: es un buen número para llevar a una negociación.`);
    if (s.rules.raiseHalf.on) parts.push(`Regla activa: el ${s.rules.raiseHalf.pct}% de cada aumento va a tus metas.`);
    reading = parts.join(' ');
  }

  return `<section class="screen">
    ${screenHead('Tu sueldo')}
    ${st ? `
    <div class="card" style="gap:12px">
      <div class="topbar" style="align-items:flex-start;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
          <span class="small muted" style="font-weight:600">${monthName(st.cur.mk, true).replace(/^./, (c) => c.toUpperCase())} · neto</span>
          <span style="font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1">${money(st.cur.nominal)}</span>
        </div>
        ${st.isBest ? '<span class="pill lime">Mejor mes real</span>' : ''}
      </div>
      ${chart(st.series)}
      <div class="legend"><span><i class="swatch" style="background:#1F6F4A"></i>Real (en pesos de hoy)</span><span class="muted"><i class="swatch" style="border-top:3px dashed #9A9DA3;height:0"></i>Nominal</span></div>
    </div>
    <div class="stat-grid three">
      <div class="stat three"><span class="k">Aumento ${st.span} meses</span><span class="v">${pct(st.nomGrowth, 0)}</span></div>
      <div class="stat three"><span class="k">Inflación ${st.span} meses</span><span class="v">${pct(st.inflation, 0)}</span></div>
      <div class="stat three"><span class="k">Crecimiento real</span><span class="v ${st.realGrowth >= 0 ? 'pos' : ''}">${pct(st.realGrowth)}</span></div>
    </div>
    <span class="small muted" style="margin-top:-6px">Inflación del INDEC, se actualiza sola${(() => {
      const l = lastIpc(s);
      const pend = l ? st.missing.filter((m) => m > l.mk).length : 0;
      return (l ? ` · último dato: ${monthName(l.mk, true)} ${l.mk.slice(0, 4)}.` : '.') + (pend ? ` ${pend === 1 ? 'El último mes se estima' : `Los últimos ${pend} meses se estiman`} hasta que el INDEC publique el dato.` : '');
    })()}</span>
    ${reading ? `<div class="card"><div class="tip-head"><span class="badge">${sprout(17)}</span><strong>Lo que dicen tus números</strong></div><p class="text">${esc(reading)}</p></div>` : ''}
    ` : '<div class="card"><p class="text">Cargá tus sueldos de los últimos meses y te muestro si le estás ganando a la inflación, tu mejor mes y cuánto creciste de verdad.</p></div>'}

    <div class="btn-row">
      <button class="btn primary" data-action="newSalary" data-mk="${nextMk}">Cargar sueldo de ${monthName(nextMk, true)}</button>
      <button class="btn" data-action="newEntry" data-kind="income" style="flex:0 0 auto">+ Extra</button>
    </div>
    <button class="btn small block" data-action="pastSalaries">${icon('calendar', 18)} Cargar sueldos de meses anteriores</button>

    ${history.length ? `<div class="section-title"><span>Últimos sueldos</span></div>
    <div class="card tight">${history.map((i) => `<button class="row" data-action="openEntry" data-id="${i.id}" data-kind="income"><span class="grow"><span class="name">${monthName(i.date.slice(0, 7), true).replace(/^./, (c) => c.toUpperCase())} ${i.date.slice(0, 4)}</span></span><span class="amount">${money(i.amount)}</span></button>`).join('')}</div>` : ''}
    ${lessonCard(s, 'sueldo')}
  </section>`;
}

export const actions = {
  newSalary(ctx, el) {
    const mk = el.dataset.mk;
    const last = lastSalary(ctx.state);
    openModal(`Sueldo de ${monthName(mk, true)}`, `<form class="form" data-submit="saveSalary">
      <div class="field"><label for="sal-a">Neto cobrado</label><input id="sal-a" name="amount" inputmode="decimal" value="${last ? last.amount : ''}" placeholder="Ej: 900.000" required></div>
      <div class="field"><label for="sal-d">Fecha de cobro</label><input id="sal-d" name="date" type="date" value="${toISO(fechaDeCobro(ctx.state.profile, Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1))}" ><span class="hint">Podés elegir una fecha anterior para cargar sueldos de otros meses.</span></div>
      <button class="btn primary block" type="submit">Guardar</button>
    </form>`);
  },
  // varios meses de una: los últimos 12 que no tienen sueldo cargado
  pastSalaries(ctx) {
    const s = ctx.state;
    const loaded = new Set(s.incomes.filter((i) => i.type === 'sueldo').map((i) => i.date.slice(0, 7)));
    const months = [];
    for (let k = 1; k <= 12; k++) { const mk = addMonthKey(monthKey(), -k); if (!loaded.has(mk)) months.push(mk); }
    openModal('Sueldos anteriores', months.length ? `<form class="form" data-submit="savePastSalaries">
      <p class="text muted" style="margin:0">Completá los que te acuerdes (el neto que cobraste). Los que dejes vacíos no se cargan. Con más meses, mejor te muestro si le ganás a la inflación.</p>
      ${months.map((mk) => `<div class="field"><label for="ps-${mk}">${monthName(mk, true).replace(/^./, (c) => c.toUpperCase())} ${mk.slice(0, 4)}</label><input id="ps-${mk}" name="m_${mk}" inputmode="decimal" placeholder="Ej: 850.000"></div>`).join('')}
      <div class="field"><label for="ps-x">¿Es de un mes más viejo?</label><div class="field-row"><input id="ps-x" name="otherMonth" type="month" max="${addMonthKey(monthKey(), -1)}"><input name="otherAmount" inputmode="decimal" placeholder="Monto"></div></div>
      <button class="btn primary block" type="submit">Guardar</button></form>`
      : `<p class="text">Ya tenés cargados los sueldos de los últimos 12 meses. Si querés uno más viejo, elegí el mes:</p>
      <form class="form" data-submit="savePastSalaries"><div class="field-row"><input name="otherMonth" type="month" max="${addMonthKey(monthKey(), -1)}" aria-label="Mes"><input name="otherAmount" inputmode="decimal" placeholder="Monto" aria-label="Monto"></div><button class="btn primary block" type="submit">Guardar</button></form>`);
  },
  savePastSalaries(ctx, d) {
    const fecha = (mk) => toISO(fechaDeCobro(ctx.state.profile, Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1));
    const add = Object.entries(d).filter(([k, v]) => k.startsWith('m_') && num(v)).map(([k, v]) => ({ mk: k.slice(2), amount: num(v) }));
    if (/^\d{4}-\d{2}$/.test(d.otherMonth || '') && num(d.otherAmount)) add.push({ mk: d.otherMonth, amount: num(d.otherAmount) });
    if (!add.length) { toast('Completá al menos un mes'); return; }
    ctx.commit((s) => {
      for (const x of add) {
        s.incomes = s.incomes.filter((i) => !(i.type === 'sueldo' && i.date.slice(0, 7) === x.mk));
        s.incomes.push({ id: uid(), date: fecha(x.mk), amount: x.amount, type: 'sueldo', note: 'Sueldo' });
      }
    });
    closeModal(); toast(add.length === 1 ? 'Sueldo cargado' : `Cargué ${add.length} sueldos`);
  },
  saveSalary(ctx, d) {
    const amount = num(d.amount);
    if (!amount) return;
    const prev = lastSalary(ctx.state);
    const isLatest = !prev || (d.date || '') >= prev.date;
    let msg = 'Sueldo cargado';
    ctx.commit((s) => {
      s.incomes.push({ id: uid(), date: d.date, amount, type: 'sueldo', note: 'Sueldo' });
      if (isLatest && prev && amount > prev.amount) {
        const raise = amount - prev.amount;
        msg = `Tu sueldo subió ${money(raise)}`;
        const g = s.goals.find((x) => x.main) || s.goals[0];
        const part = Math.round((raise * (s.rules.raiseHalf.pct || 50)) / 100);
        if (s.rules.raiseHalf.on && g) { g.monthly = (g.monthly || 0) + part; msg += `: sumé ${money(part)} al aporte mensual de "${g.name}"`; }
      }
    });
    closeModal(); toast(msg);
  },
};
