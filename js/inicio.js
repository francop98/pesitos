// Inicio: cuánto podés gastar hoy, tu meta, lo que necesita tu atención
// (sueldo del mes, ahorro, resumen semanal) y accesos rápidos.

import { money, esc, monthKey, MONTHS_LONG, MONTHS, num, todayISO, monthName, parseISO } from './formato.js';
import { budget, mainGoal, goalEta, goalPct, savedThisMonth, cardSummary, lastSalary, lastWeekStart, weekSummary } from './calculos.js';
import { insights } from './economista.js';
import { renderQuestion, suggestions, renderSuggestion } from './guia.js';
import { lessonCard } from './aprender.js';
import { catLabel } from './categorias.js';
import { alerts, dueLabel, closings } from './agenda.js';
import { projection, coverage } from './flujo.js';
import { reglaDeCobro } from './feriados.js';
import { alertaPresupuestos } from './presupuestos.js';
import { medioOptions } from './acciones.js';
import { instalada } from './menu.js';
import { bioDisponible, bloqueoActivo, bloqueoActions } from './bloqueo.js';
import { wordmark, icon, sprout, ring, tipCard, quickForm, openModal, closeModal, toast } from './interfaz.js';

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

// Todo lo que pide tu atención, ordenado por importancia.
// En Inicio se ve solo el primero; el resto queda en "Novedades".
function avisos(s, b) {
  const sugg = suggestions(s);
  const pending = s.expenses.filter((e) => e.pending).length;
  const lista = [
    payAlerts(s),
    coverageAlert(s),
    savingCard(s, b),
    salaryCard(s, b),
    renderQuestion(s),
    alertaPresupuestos(s),
    pending ? `<button class="card amber" data-action="openPending" style="border:none;text-align:left;flex-direction:row;align-items:center"><span style="color:var(--amber)">${icon('receipt')}</span><span class="text" style="flex:1"><b>${pending} comprobante${pending > 1 ? 's' : ''} para confirmar.</b> Ya los categoricé.</span>${icon('chevron', 16)}</button>` : '',
    closingTip(s),
    weekCard(s),
    huellaCard(),
    instalarCard(),
    sugg[0] ? renderSuggestion(sugg[0]) + (sugg.length > 1 ? `<button class="btn small" data-action="openSuggestions">Ver las ${sugg.length} sugerencias</button>` : '') : '',
    ...insights(s).slice(0, 2).map(tipCard),
    lessonCard(s, 'inicio'),
  ];
  return lista.filter((x) => x && x.trim());
}

function novedadesHtml(s) {
  const b = budget(s);
  const resto = avisos(s, b).slice(1);
  return `<div data-novedades>${resto.length ? resto.join('') : '<p class="empty">No hay nada más por ahora. ¡Todo en orden!</p>'}
    <div class="card lime" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 16px">
      <span class="small" style="font-weight:700">Plata que te ahorró Pesitos en ${MONTHS_LONG[new Date().getMonth()]}</span>
      <span style="font-size:17px;font-weight:800">${money(savedThisMonth(s))}</span>
    </div></div>`;
}

const ATAJOS = [
  ['openBuy', 'cart', '¿Me lo compro?'],
  ['#/pagos', 'calendar', 'Por pagar'],
  ['#/beneficios', 'ticket', 'Beneficios'],
  ['#/estadisticas', 'pie', 'Estadísticas'],
  ['#/cuentas', 'bank', 'Mis cuentas'],
  ['#/presupuestos', 'target', 'Presupuestos'],
  ['#/deudas', 'people', 'Deudas'],
  ['#/tarjetas', 'card', 'Tarjetas'],
  ['#/buscar', 'search', 'Buscar'],
  ['openImportar', 'upload', 'Importar'],
  ['#/herramientas', 'swap', 'Herramientas'],
  ['openAyuda', 'help', 'Ayuda'],
];
const tile = ([a, ic, l]) => (a.startsWith('#')
  ? `<a class="tile" href="${a}">${icon(ic, 22)}<span>${l}</span></a>`
  : `<button class="tile" data-action="${a}">${icon(ic, 22)}<span>${l}</span></button>`);

export function render(s) {
  const b = budget(s);
  const g = mainGoal(s);
  const days = b.cycle.daysLeft;
  const payText = reglaDeCobro(s.profile).tipo === 'varia'
    ? (days === 1 ? 'último día del mes' : `quedan ${days} días del mes`)
    : (days === 1 ? 'cobrás mañana' : `cobrás en ${days} días`);
  const lista = avisos(s, b);
  const mas = lista.length - 1;
  // si "Novedades" está abierto, se actualiza solo
  setTimeout(() => { const n = document.querySelector('#modal:not([hidden]) [data-novedades]'); if (n) n.outerHTML = novedadesHtml(s); }, 0);

  return `<section class="screen">
    <div class="topbar">
      <div class="head-left"><button class="icon-btn menu-btn" data-action="openMenu" aria-label="Menú">${icon('menu', 22)}</button>${wordmark(26)}</div>
      <button class="icon-btn" data-action="openAyuda" aria-label="Ayuda">${icon('help', 22)}</button>
    </div>

    ${s.demo ? '<div class="card amber" style="padding:10px 14px"><span class="small">Estás viendo <b>datos de ejemplo</b>. Podés borrarlos desde el menú ☰ → Copia de seguridad.</span></div>' : ''}

    <div class="card green hero">
      <span class="hero-label">${b.todayLeft >= 0 ? 'Hoy podés gastar' : 'Hoy te pasaste'}</span>
      <span class="hero-number">${b.noIncome ? '—' : money(Math.abs(b.todayLeft))}</span>
      <div class="bar" role="img" aria-label="Usaste el ${Math.round(b.usedPct * 100)}% de tu plata del ciclo"><span style="width:${Math.round(b.usedPct * 100)}%"></span></div>
      <span class="small on-green-muted">${b.noIncome ? 'Contame cuánto cobrás para empezar' : `${payText} · te quedan ${money(Math.max(0, b.free))} libres`}${b.estimated ? ' · estimado' : ''}</span>
    </div>

    ${quickForm('q-home', s, medioOptions(s, '', { auto: true }))}

    ${lista[0] || ''}
    ${mas > 0 ? `<button class="novedades-btn" data-action="openNovedades"><span class="nov-dot">${mas}</span><span class="grow">${mas === 1 ? 'Tenés 1 aviso más' : `Tenés ${mas} avisos más`}</span>${icon('chevron', 16)}</button>` : ''}

    <div class="tiles">
      ${ATAJOS.slice(0, 3).map(tile).join('')}
      <button class="tile" data-action="openAtajos">${icon('grid', 22)}<span>Más</span></button>
    </div>

    ${g ? `<a class="card goal-row" href="#/ahorro" style="text-decoration:none;color:inherit;flex-direction:row">
      ${ring(goalPct(g), 56, 7, `${g.name}: ${Math.round(goalPct(g) * 100)}%`)}
      <div class="grow" style="display:flex;flex-direction:column;gap:2px">
        <span class="small muted" style="font-weight:600">Tu meta</span>
        <span style="font-size:16px;font-weight:800">${esc(g.name)}</span>
        <span class="small muted">${esc(goalEta(g).text.replace('A este ritmo llegás', 'Llegás'))}</span>
      </div>
    </a>` : ''}
  </section>`;
}

// Sugerencia de entrar con huella o cara (si el dispositivo lo permite y no hay bloqueo)
const K_HUELLA = 'pesitos_huella_no';
let hayBio = null;
bioDisponible().then((v) => { hayBio = v; });
function huellaCard() {
  let no = false;
  try { no = localStorage.getItem(K_HUELLA) === '1'; } catch { /* nada */ }
  if (no || !hayBio || bloqueoActivo()) return '';
  return `<div class="card card-huella">
    <div class="tip-head"><span style="color:var(--green)">${icon('lock', 20)}</span><strong>Entrá con tu huella o tu cara</strong></div>
    <span class="text">Cada vez que abras Pesitos te pide la huella (o la cara) del celular. Así nadie que lo agarre ve tu plata, y vos entrás al toque.</span>
    <div class="btn-row"><button class="btn small ghost" data-action="huellaNo">Ahora no</button><button class="btn small primary" data-action="huellaSi">Activar</button></div>
  </div>`;
}

// Sugerencia de instalar (solo si se abre desde el navegador y no la descartó)
const K_INSTALAR = 'pesitos_instalar_no';
function instalarCard() {
  let no = false;
  try { no = localStorage.getItem(K_INSTALAR) === '1'; } catch { /* nada */ }
  if (no || instalada()) return '';
  return `<div class="card card-instalar">
    <div class="tip-head"><span style="color:var(--green)">${icon('phone', 20)}</span><strong>Instalá Pesitos en tu celular</strong></div>
    <span class="text">Queda en la pantalla de inicio como cualquier app: abre más rápido, funciona sin conexión, te puede avisar los vencimientos y podés compartirle tus comprobantes.</span>
    <div class="btn-row"><button class="btn small ghost" data-action="instalarNo">No, gracias</button><button class="btn small primary" data-action="instalarApp">Instalar</button></div>
  </div>`;
}

export const actions = {
  openNovedades(ctx) { openModal('Novedades', novedadesHtml(ctx.state)); },
  openAtajos() { openModal('Todo Pesitos', `<div class="tiles">${ATAJOS.map(tile).join('')}</div>`); },
  async huellaSi(ctx) { await bloqueoActions.bloqueoBio(); ctx.render(); },
  huellaNo(ctx) { try { localStorage.setItem(K_HUELLA, '1'); } catch { /* nada */ } ctx.render(); toast('Listo. Si cambiás de idea, está en Menú → Bloqueo con huella o PIN'); },
  instalarNo(ctx) { try { localStorage.setItem(K_INSTALAR, '1'); } catch { /* nada */ } ctx.render(); toast('Listo. Si cambiás de idea, está en Menú → La app'); },
  promoUsed(ctx, el) {
    const cap = num(el.dataset.id);
    openModal('¿Cuánto te ahorraste?', `<form class="form" data-submit="promoSaved">
      <div class="field"><label for="ps">Ahorro con la promo</label><input id="ps" name="amount" inputmode="decimal" value="${cap || ''}" placeholder="Ej: 8.000" required></div>
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
