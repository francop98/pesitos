// Tarjetas de crédito: próximo resumen, cuotas pendientes y lo que ya
// tenés comprometido en los próximos meses.

import { money, esc, num, monthName, monthDiff } from './formato.js';
import { cardSummary } from './calculos.js';
import { icon, sprout, screenHead, openModal, closeModal, toast, borrarConDeshacer } from './interfaz.js';
import { agenda, dueLabel, bestBuyDay, statementDates, statementOf } from './agenda.js';
import { currentPromos } from './economista.js';
import { allWallets, walletName, catLabel } from './categorias.js';
import { cardPlan } from './flujo.js';
import { payOptions } from './pagos.js';
import { uid } from './almacenamiento.js';
import { lessonCard } from './aprender.js';

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
    <div class="topbar" style="flex-wrap:wrap;gap:4px 10px"><strong style="font-size:14px;min-width:0">Próximo pago: ${dueLabel(it).toLowerCase()}</strong><span style="font-weight:800;white-space:nowrap">${it.estimated ? '≈ ' : ''}${money(it.amount)}</span></div>
    <span class="small muted">${esc(it.sub)}</span>
    ${plan.fromSavings > 1 ? `<div class="result warn"><strong>Tu plata disponible cubre ${money(plan.fromSalary)}</strong><span class="text">Te faltarían ${money(plan.fromSavings)}: conviene sacarlos de tus ahorros antes que financiar la tarjeta.</span></div>`
      : '<div class="result ok"><strong>Lo cubrís con tu plata disponible</strong><span class="text">Pagalo completo: así no pagás intereses.</span></div>'}
    ${plan.tna ? `<span class="text">Si pagás solo el mínimo, lo que quede pendiente te costaría cerca de <b>${money(plan.monthlyCost)} por mes</b> por cada ${money(it.amount)} financiados (TNA ${plan.tna}% más IVA).</span>`
      : '<span class="small muted">Para calcular cuánto te costaría pagar solo el mínimo, cargá la tasa de financiación (TNA) que figura en tu resumen, en Editar.</span>'}
    ${it.autoDebit ? '<span class="small">Se debita solo: tené el saldo en la cuenta el día del vencimiento.</span>' : `<button class="btn small green" data-action="openPayment" data-key="${esc(it.key)}">Registrar el pago</button>`}
  </div>${best}`;
}

export const MARCAS = [['visa', 'Visa'], ['mastercard', 'Mastercard'], ['amex', 'American Express'], ['cabal', 'Cabal'], ['naranja', 'Naranja'], ['otra', 'Otra']];
const dias = (a, b) => Math.round((b - a) / 86400000);
const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Datos útiles de la tarjeta: días al cierre, disponible, dólares, cuotas que terminan, promos y costos.
// cargos que suma el banco al resumen: mantenimiento (+ IVA 21%), seguro y sellos (% provincial)
export function cargosResumen(c, consumos) {
  const lineas = [];
  if (c.comision) lineas.push(['Mantenimiento + IVA', c.comision * 1.21]);
  if (c.seguro) lineas.push(['Seguro y otros cargos', c.seguro]);
  if (c.sellos && consumos) lineas.push([`Impuesto de sellos (${String(c.sellos).replace('.', ',')}%)`, consumos * c.sellos / 100]);
  return { lineas, total: lineas.reduce((a, [, v]) => a + v, 0) };
}

function datosTarjeta(s, c, sum) {
  const { close, due } = statementDates(c, sum.current);
  const h = hoy0();
  const alCierre = dias(h, close); const alVto = dias(h, due);
  // gastos en dólares de este resumen
  const delResumen = s.expenses.filter((e) => !e.pending && e.cardId === c.id && statementOf(c, e.date) === sum.current);
  const usd = delResumen.filter((e) => e.currency === 'USD').reduce((a, e) => a + (Number(e.original) || 0) / (e.installments > 1 ? e.installments : 1), 0);
  // cuotas que terminan en este resumen: el mes que viene se liberan
  const terminan = sum.pending.filter((p) => p.last === sum.current);
  const libera = terminan.reduce((a, p) => a + p.each, 0);
  // en qué se fue este resumen (compras nuevas + cuotas que caen acá)
  const porCat = {};
  for (const e of s.expenses) {
    if (e.pending || e.cardId !== c.id) continue;
    const n = e.installments > 1 ? e.installments : 1;
    const k = monthDiff(statementOf(c, e.date), sum.current);
    if (k >= 0 && k < n) porCat[e.category] = (porCat[e.category] || 0) + e.amount / n;
  }
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  // promos de su banco o marca en los próximos 7 días
  const ids = [c.banco, c.marca].filter(Boolean);
  const promos = ids.length ? currentPromos(s).items.filter((p) => ids.includes(p.wallet)) : [];
  const disponible = c.limit ? Math.max(0, c.limit - sum.committed) : null;
  const dispCuotas = c.limitCuotas ? Math.max(0, c.limitCuotas - sum.pending.reduce((a, p) => a + p.remaining, 0)) : null;
  const cuotasQuedan = sum.pending.reduce((a, p) => a + p.left, 0);
  const cargos = cargosResumen(c, sum.next);
  const dato = (k, v, sub = '') => `<div class="t-dato"><span class="k">${k}</span><b>${v}</b>${sub ? `<span class="small muted">${sub}</span>` : ''}</div>`;
  return `<div class="card t-datos">
    <div class="t-grid">
      ${dato('Cierra', alCierre === 0 ? 'Hoy' : alCierre === 1 ? 'Mañana' : `En ${alCierre} días`, `${close.getDate()}/${close.getMonth() + 1}`)}
      ${dato('Vence', alVto === 0 ? 'Hoy' : alVto === 1 ? 'Mañana' : `En ${alVto} días`, `${due.getDate()}/${due.getMonth() + 1}`)}
      ${disponible !== null ? dato('Disponible', money(disponible), `de ${money(c.limit)}`) : dato('Disponible', '—', '<button class="link-btn" data-action="editCard" data-id="' + esc(c.id) + '">Cargá el límite</button>')}
      ${dato('Cuotas pendientes', `${cuotasQuedan}`, `${sum.pending.length} compra${sum.pending.length === 1 ? '' : 's'} · ${money(sum.pending.reduce((a, p) => a + p.remaining, 0))}`)}
      ${dispCuotas !== null ? dato('Disponible en cuotas', money(dispCuotas), `de ${money(c.limitCuotas)}`) : ''}
    </div>
    ${usd ? `<span class="small">💵 En este resumen tenés <b>US$ ${String(Math.round(usd * 100) / 100).replace('.', ',')}</b> en dólares. Si los pagás en dólares (comprados o de tu cuenta) evitás la percepción de impuestos que se cobra al pagarlos en pesos.</span>` : ''}
    ${libera ? `<span class="small">✅ En este resumen terminan ${terminan.length === 1 ? `las cuotas de <b>${esc(terminan[0].e.note)}</b>` : `<b>${terminan.length} compras en cuotas</b>`}: desde el próximo pagás ${money(libera)} menos por mes.</span>` : ''}
    ${cats.length ? `<span class="small muted">Este resumen se va en: ${cats.map(([k, v]) => `${esc(catLabel(k))} ${money(v)}`).join(' · ')}</span>` : ''}
    <button class="link-btn small" data-action="openAvisos" style="align-self:flex-start;text-align:left">🔔 Te aviso en el celular el día del cierre y el día antes del vencimiento. Configurar avisos ›</button>
    ${promos.length ? `<a class="small" href="#/beneficios">🏷️ ${promos.length} promo${promos.length === 1 ? '' : 's'} vigente${promos.length === 1 ? '' : 's'} con ${esc(ids.map(walletName).join(' / '))}. Ver beneficios ›</a>` : ''}
    ${cargos.total ? `<div class="t-cargos"><div class="split small"><span>Consumos del resumen</span><b>${money(sum.next)}</b></div>
      ${cargos.lineas.map(([k, v]) => `<div class="split small"><span>${k}</span><b>${money(v)}</b></div>`).join('')}
      <div class="split"><span><b>Resumen estimado</b></span><b>${money(sum.next + cargos.total)}</b></div>
      <span class="small muted">Los cargos son estimados con lo que cargaste. ${c.comision ? `El mantenimiento te cuesta ${money((c.comision * 1.21) * 12)} por año con IVA: pedí que te lo bonifiquen.` : ''}</span></div>`
    : '<span class="small muted">¿Tu resumen trae mantenimiento, seguro o sellos? <button class="link-btn" data-action="editCard" data-id="' + esc(c.id) + '">Cargalos</button> y te estimo el total real.</span>'}
  </div>`;
}

function cardBlock(s, c) {
  const sum = cardSummary(s, c);
  const max = Math.max(1, ...sum.months.map((m) => m.amount));
  return `<div class="card credit">
    <div class="credit-head">
      <span class="credit-name">${icon('card', 20)} ${esc(c.name)}${c.marca || c.banco ? `<span class="credit-sub">${esc([c.marca && c.marca !== 'otra' ? (MARCAS.find((m) => m[0] === c.marca) || [])[1] : '', c.banco ? walletName(c.banco) : ''].filter(Boolean).join(' · '))}</span>` : ''}</span>
      <span class="head-actions"><button class="chip" data-action="openImportar" data-medio="card:${c.id}">Importar</button>
      <button class="chip" data-action="editCard" data-id="${c.id}">Editar</button></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <span class="small on-green-muted">Resumen de ${monthName(sum.current, true)} · cierra el ${c.closeDay} · vence el ${c.dueDay}</span>
      <span style="font-size:32px;font-weight:800;letter-spacing:-1px">${money(sum.next)}</span>
    </div>
    ${c.limit ? `<div class="bar"><span style="width:${Math.min(100, Math.round(sum.used * 100))}%"></span></div>
      <div class="split on-green-muted"><span>Comprometido: ${money(sum.committed)}</span><span>Límite: ${money(c.limit)}</span></div>` : ''}
  </div>

  ${datosTarjeta(s, c, sum)}

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
    ${cuerpo(s)}
  </section>`;
}

/** Tarjetas, resúmenes y cuotas (también en Por pagar → Tarjetas). */
export function cuerpo(s) {
  const sums = s.cards.map((c) => ({ c, sum: cardSummary(s, c) }));
  const total = sums.reduce((a, x) => a + x.sum.next, 0);
  const comp = sums.reduce((a, x) => a + x.sum.committed, 0);
  const lim = s.cards.reduce((a, c) => a + (c.limit || 0), 0);
  return `
    ${s.cards.length > 1 ? `<div class="stat-grid">
      <div class="stat"><span class="k">Próximos resúmenes</span><span class="v">${money(total)}</span><span class="small muted">${s.cards.length} tarjetas</span></div>
      <div class="stat"><span class="k">Comprometido a futuro</span><span class="v">${money(comp)}</span><span class="small muted">${lim ? `disponible ${money(Math.max(0, lim - comp))}` : 'cuotas incluidas'}</span></div>
    </div>` : ''}
    ${s.cards.length ? s.cards.map((c) => cardBlock(s, c)).join('') : `<div class="card">
      <strong>Sumá tu tarjeta de crédito</strong>
      <p class="text muted">Con el día de cierre y de vencimiento te muestro cuánto viene en cada resumen, las cuotas que te quedan y cuánto tenés comprometido a futuro.</p>
      <button class="btn green small" data-action="newCard">Agregar tarjeta</button>
    </div>`}
    ${s.cards.length ? '<p class="small muted" style="margin:0">Para que una compra entre acá, elegí la tarjeta en "Medio de pago" al anotarla, o escribí su nombre en la carga rápida (por ejemplo: "Zapatillas 180.000 en 6 cuotas visa").</p>' : ''}
  `;
}

function cardForm(s, c = {}) {
  return `<form class="form" data-submit="saveCard">
    <input type="hidden" name="id" value="${esc(c.id || '')}">
    <div class="field"><label for="cd-n">Nombre</label><input id="cd-n" name="name" value="${esc(c.name || '')}" placeholder="Ej: Visa Galicia" required></div>
    <div class="field-row">
      <div class="field"><label for="cd-m">Marca</label><select id="cd-m" name="marca"><option value="">Elegí</option>${MARCAS.map(([v, l]) => `<option value="${v}" ${c.marca === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="cd-b">Banco o emisor</label><select id="cd-b" name="banco"><option value="">Elegí</option>${['Bancos', 'Billeteras'].map((k) => `<optgroup label="${k}">${allWallets().filter((w) => w.kind === k).map((w) => `<option value="${esc(w.id)}" ${c.banco === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cd-c">Día de cierre</label><input id="cd-c" name="closeDay" inputmode="numeric" value="${c.closeDay || ''}" placeholder="Ej: 25" required></div>
      <div class="field"><label for="cd-v">Día de vencimiento</label><input id="cd-v" name="dueDay" inputmode="numeric" value="${c.dueDay || ''}" placeholder="Ej: 5" required></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cd-l">Límite de compra</label><input id="cd-l" name="limit" inputmode="decimal" value="${c.limit || ''}" placeholder="Opcional"></div>
      <div class="field"><label for="cd-lc">Límite en cuotas</label><input id="cd-lc" name="limitCuotas" inputmode="decimal" value="${c.limitCuotas || ''}" placeholder="Si es distinto"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cd-t">TNA de financiación (%)</label><input id="cd-t" name="tna" inputmode="decimal" value="${c.tna || ''}" placeholder="Figura en el resumen"></div>
      <div class="field"><label for="cd-co">Mantenimiento por mes</label><input id="cd-co" name="comision" inputmode="decimal" value="${c.comision || ''}" placeholder="$ 0 si no cobra"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cd-se">Seguro y otros cargos</label><input id="cd-se" name="seguro" inputmode="decimal" value="${c.seguro || ''}" placeholder="$ por resumen"></div>
      <div class="field"><label for="cd-sl">Sellos (%)</label><input id="cd-sl" name="sellos" inputmode="decimal" value="${c.sellos ? String(c.sellos).replace('.', ',') : ''}" placeholder="Ej: 1,2"></div>
    </div>
    <span class="hint">Están en tu resumen, al final: "comisión mantenimiento", "seguro de vida" e "impuesto de sellos" (depende de la provincia). Así te muestro cuánto vas a pagar de verdad.</span>
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
    const data = { marca: d.marca || '', banco: d.banco || '', limitCuotas: num(d.limitCuotas), comision: num(d.comision), seguro: num(d.seguro), sellos: Math.min(10, parseFloat(String(d.sellos || '').replace(',', '.')) || 0), name: d.name.trim(), closeDay: Math.min(31, Math.max(1, parseInt(d.closeDay, 10) || 25)), dueDay: Math.min(31, Math.max(1, parseInt(d.dueDay, 10) || 5)), limit: num(d.limit), tna: parseFloat(String(d.tna || '').replace(',', '.')) || 0, payFrom: d.payFrom || '', autoDebit: !!d.autoDebit };
    ctx.commit((s) => {
      const c = s.cards.find((x) => x.id === d.id);
      if (c) Object.assign(c, data); else s.cards.push({ id: uid(), ...data });
    });
    closeModal(); toast('Tarjeta guardada');
  },
  deleteCard(ctx, el) {
    closeModal();
    borrarConDeshacer(ctx, 'Tarjeta borrada', (s) => {
      s.cards = s.cards.filter((c) => c.id !== el.dataset.id);
      s.expenses.forEach((e) => { if (e.cardId === el.dataset.id) delete e.cardId; });
    });
  },
};
