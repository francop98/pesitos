// Asesor: reglas de ahorro (y propias), desafíos (y propios), medios de
// aprendizaje y consultas.

import { money, esc, num, monthKey, todayISO } from './formato.js';
import { allCategories, catLabel, CHALLENGE_TYPES, CUSTOM_RULE_TYPES } from './categorias.js';
import { challengeStatus, allChallenges, answer, DISCLAIMER } from './economista.js';
import { LESSONS } from './aprender.js';
import { budget } from './calculos.js';
import { sprout, icon, screenHead, openModal, closeModal, toast } from './interfaz.js';
import { uid } from './almacenamiento.js';

const MODE_LABEL = (s) => ({
  payFirst: `Apartás el ${s.rules.payFirst.pct}% apenas cobrás.`,
  fixed: 'Apartás un monto fijo por mes.',
  leftover: 'Ahorrás lo que te sobra a fin de mes.',
  roundup: 'Redondeás cada gasto y la diferencia va al ahorro.',
  none: 'Por ahora no elegiste ahorrar. Cuando quieras, elegí una forma.',
}[s.savingMode] || 'Todavía no elegiste cómo ahorrar.');

const BUILTIN = [
  { key: 'payFirst', name: 'Págate primero', text: (r) => `El día que cobrás, apartás el ${r.pct}% del sueldo`, param: 'pct', unit: '%' },
  { key: 'raiseHalf', name: 'Ahorro por aumento', text: (r) => `El ${r.pct}% de cada aumento va a tus metas`, param: 'pct', unit: '%' },
  { key: 'extraPct', name: 'Ingresos extra', text: (r) => `El ${r.pct}% de cada ingreso extra va al ahorro`, param: 'pct', unit: '%' },
  { key: 'roundup', name: 'Redondeo', text: (r) => `Cada gasto se redondea a ${money(r.to)} y la diferencia va al ahorro`, param: 'to', unit: '$' },
  { key: 'r503020', name: '50 / 30 / 20', text: () => 'Necesidades, gustos y al menos 20% de ahorro' },
];
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const catOpts = (sel) => allCategories().filter((c) => !['varios', 'otros'].includes(c.id)).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.label}</option>`).join('');

function customText(c) {
  if (c.type === 'pctSalary') return `El ${c.value}% del sueldo`;
  if (c.type === 'fixedMonthly') return `${money(c.value)} por mes`;
  return `El ${c.value}% de lo que gastás en ${catLabel(c.category).toLowerCase()}`;
}

export function render(s) {
  const ch = challengeStatus(s);
  const chat = s.chat.slice(-8);
  const b = budget(s);
  return `<section class="screen">
    ${screenHead('Tu asesor', '', 'Ahorro, desafíos, aprendizaje y consultas')}

    <div class="card">
      <div class="topbar"><strong style="font-size:14px">Tu forma de ahorrar</strong><button class="chip" data-action="changeMode">Cambiar</button></div>
      <span class="text">${esc(MODE_LABEL(s))}</span>
      <button class="btn ghost small" data-action="openLesson" data-id="modos" style="align-self:flex-start;min-height:36px;padding:0 4px">¿Cuál me conviene?</button>
    </div>

    <div class="section-title"><span>Reglas de ahorro</span><button data-action="newRule">+ Crear regla</button></div>
    <div class="card tight">
      ${BUILTIN.map((r) => { const v = s.rules[r.key]; return `<div class="row">
        <span class="grow"><span class="name">${r.name}</span><span class="meta">${esc(r.text(v))}</span></span>
        ${r.param ? `<button class="chip" data-action="editRule" data-key="${r.key}" aria-label="Cambiar ${r.name}">${r.unit === '$' ? money(v[r.param]) : v[r.param] + '%'}</button>` : ''}
        <button class="switch" role="switch" aria-checked="${v.on}" aria-label="${r.name}" data-action="toggleRule" data-key="${r.key}"></button>
      </div>`; }).join('')}
      ${s.rules.custom.map((c) => `<div class="row">
        <button class="grow" data-action="editCustomRule" data-id="${c.id}" style="background:none;border:none;text-align:left;padding:0"><span class="name">${esc(c.name)} <span class="pill">Propia</span></span><span class="meta">${esc(customText(c))}</span></button>
        <button class="switch" role="switch" aria-checked="${c.on}" aria-label="${esc(c.name)}" data-action="toggleCustomRule" data-id="${c.id}"></button>
      </div>`).join('')}
    </div>
    ${b.saving > 0 ? `<span class="small muted" style="margin-top:-6px">Este ciclo tus reglas apartan ${money(b.saving)}: ${b.savingParts.map((p) => `${esc(p.name)} ${money(p.amount)}`).join(' · ')}.</span>` : ''}

    <div class="section-title"><span>Desafíos</span><button data-action="newChallenge">+ Crear desafío</button></div>
    ${ch ? `<div class="card">
      <div class="topbar"><strong style="font-size:14px">${esc(ch.def.name)}</strong><span class="pill ${ch.broken ? 'warn' : 'lime'}">${ch.broken ? 'Se cortó' : ch.done ? '¡Completado!' : `Día ${ch.day} de ${ch.def.days}`}</span></div>
      <div class="bar"><span style="width:${Math.round(ch.pct * 100)}%"></span></div>
      <span class="small muted">${esc(ch.detail)} ${ch.broken ? 'No pasa nada: podés empezar de nuevo.' : `Llevás unos ${money(ch.estimate)} ahorrados frente a tu ritmo habitual.`}</span>
      <div class="btn-row">
        ${ch.done ? `<button class="btn small green" data-action="claimChallenge" data-amount="${ch.estimate}">Sumar al contador</button>` : ''}
        ${ch.broken ? `<button class="btn small green" data-action="startChallenge" data-id="${ch.def.id}">Empezar de nuevo</button>` : ''}
        <button class="btn small" data-action="stopChallenge">${ch.broken || ch.done ? 'Cerrar desafío' : 'Abandonar'}</button>
      </div>
    </div>` : `<div class="card"><span class="small muted">Elegí uno y te muestro cuánto ahorrás frente a tu ritmo de siempre.</span>
      <div class="chips">${allChallenges(s).map((c) => `<button class="chip" data-action="startChallenge" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>`}

    <div class="tiles two">
      <a class="tile" href="#/beneficios">${icon('ticket', 22)}<span>Beneficios y promos</span></a>
      <a class="tile" href="#/herramientas">${icon('swap', 22)}<span>Herramientas</span></a>
    </div>

    <div class="section-title"><span>Aprendé en 1 minuto</span></div>
    <div class="card tight">
      ${LESSONS.map((l) => `<button class="row" data-action="openLesson" data-id="${l.id}"><span class="grow"><span class="name" style="white-space:normal">${esc(l.title)}</span></span>${s.lessonsSeen[l.id] ? '<span class="pill ok">Leída</span>' : ''}${icon('chevron', 16)}</button>`).join('')}
    </div>

    <div class="section-title"><span>Consultale a Pesitos</span>${s.chat.length ? '<button data-action="clearChat">Limpiar</button>' : ''}</div>
    <div class="chat">
      ${chat.length ? chat.map((m) => `<div class="bubble ${m.from}">${esc(m.text)}</div>`).join('') : '<div class="bubble bot">Hola. Consultame si te conviene pagar en cuotas, si te podés comprar algo, qué promos tenés o si le ganaste a la inflación.</div>'}
    </div>
    <div class="chips">
      ${['¿12 cuotas o contado con 10%? $300.000', '¿Me compro algo de $80.000?', '¿Qué promos tengo esta semana?', '¿Le gané a la inflación?'].map((q) => `<button class="chip" data-action="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>
    <form class="quick" data-submit="askForm" autocomplete="off">
      <label for="ask" class="sr-only">Escribí tu consulta</label>
      <input id="ask" name="q" placeholder="Escribí tu consulta" enterkeyhint="send">
      <button type="submit" class="icon-btn green" aria-label="Enviar">${icon('send', 20, 2.2)}</button>
    </form>
    <p class="small muted" style="margin:0">${DISCLAIMER}</p>
  </section>`;
}

function ruleForm(c = {}) {
  return `<form class="form" data-submit="saveCustomRule">
    <input type="hidden" name="id" value="${esc(c.id || '')}">
    <div class="field"><label for="r-n">Nombre</label><input id="r-n" name="name" value="${esc(c.name || '')}" placeholder="Ej: Impuesto al antojo" required></div>
    <div class="field"><label for="r-t">¿Cuánto apartar?</label><select id="r-t" name="type">${CUSTOM_RULE_TYPES.map((t) => `<option value="${t.id}" ${t.id === c.type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label for="r-v">Valor (% o $)</label><input id="r-v" name="value" inputmode="decimal" value="${c.value || ''}" placeholder="Ej: 10" required></div>
      <div class="field"><label for="r-c">Categoría</label><select id="r-c" name="category">${catOpts(c.category)}</select><span class="hint">Solo para la opción por categoría.</span></div>
    </div>
    <button class="btn primary block" type="submit">Guardar regla</button>
    ${c.id ? `<button class="btn ghost block" type="button" data-action="deleteCustomRule" data-id="${c.id}">Borrar regla</button>` : ''}
  </form>`;
}

function challengeForm() {
  return `<form class="form" data-submit="saveChallenge">
    <div class="field"><label for="ch-n">Nombre</label><input id="ch-n" name="name" placeholder="Ej: Un mes sin comprar ropa" required></div>
    <div class="field"><label for="ch-t">Tipo</label><select id="ch-t" name="type">${CHALLENGE_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label for="ch-c">Categoría</label><select id="ch-c" name="category">${catOpts('delivery')}</select></div>
      <div class="field"><label for="ch-d">Duración (días)</label><input id="ch-d" name="days" inputmode="numeric" value="30"></div>
    </div>
    <div class="field"><label for="ch-a">Monto (tope o gasto mínimo)</label><input id="ch-a" name="amount" inputmode="decimal" placeholder="Ej: 20.000"><span class="hint">Para "No pasar un monto": el tope. Para "Sin gastos chicos": el monto mínimo.</span></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:14px;font-weight:600;min-height:44px"><input type="checkbox" name="start" checked style="width:20px;height:20px"> Empezarlo hoy</label>
    <button class="btn primary block" type="submit">Crear desafío</button>
  </form>`;
}

function ask(ctx, q) {
  const text = String(q || '').trim();
  if (!text) return;
  const reply = answer(text, ctx.state);
  ctx.commit((s) => { s.chat.push({ from: 'me', text }, { from: 'bot', text: reply }); s.chat = s.chat.slice(-30); });
  requestAnimationFrame(() => document.getElementById('ask')?.scrollIntoView({ block: 'center' }));
}

export const actions = {
  changeMode(ctx) {
    ctx.commit((s) => { s.savingMode = null; delete s.asked.savingMode; s.askLog = null; });
    ctx.go('inicio');
    toast('Elegí tu forma de ahorrar en Inicio');
  },
  toggleRule(ctx, el) { ctx.commit((s) => { s.rules[el.dataset.key].on = !s.rules[el.dataset.key].on; }); },
  editRule(ctx, el) {
    const r = BUILTIN.find((x) => x.key === el.dataset.key);
    const v = ctx.state.rules[r.key][r.param];
    openModal(r.name, `<form class="form" data-submit="saveRuleParam"><input type="hidden" name="key" value="${r.key}">
      <div class="field"><label for="rp">${r.unit === '$' ? 'Redondear a' : 'Porcentaje'}</label>
      ${r.unit === '$' ? `<select id="rp" name="value">${[100, 500, 1000, 5000].map((n) => `<option value="${n}" ${n === v ? 'selected' : ''}>${money(n)}</option>`).join('')}</select>` : `<input id="rp" name="value" inputmode="decimal" value="${v}">`}</div>
      <button class="btn primary block" type="submit">Guardar</button></form>`);
  },
  saveRuleParam(ctx, d) {
    const r = BUILTIN.find((x) => x.key === d.key);
    const v = Math.max(1, num(d.value));
    ctx.commit((s) => { s.rules[r.key][r.param] = r.unit === '%' ? Math.min(100, v) : v; s.rules[r.key].on = true; });
    closeModal(); toast('Regla actualizada');
  },
  newRule() { openModal('Crear regla de ahorro', ruleForm()); },
  editCustomRule(ctx, el) { const c = ctx.state.rules.custom.find((x) => x.id === el.dataset.id); if (c) openModal('Editar regla', ruleForm(c)); },
  saveCustomRule(ctx, d) {
    const value = num(d.value);
    if (!value) { toast('Indicá un valor'); return; }
    ctx.commit((s) => {
      const data = { name: d.name.trim(), type: d.type, value, category: d.category };
      const c = s.rules.custom.find((x) => x.id === d.id);
      if (c) Object.assign(c, data); else s.rules.custom.push({ id: uid(), on: true, ...data });
    });
    closeModal(); toast('Regla guardada y activada');
  },
  toggleCustomRule(ctx, el) { ctx.commit((s) => { const c = s.rules.custom.find((x) => x.id === el.dataset.id); if (c) c.on = !c.on; }); },
  deleteCustomRule(ctx, el) { ctx.commit((s) => { s.rules.custom = s.rules.custom.filter((x) => x.id !== el.dataset.id); }); closeModal(); },

  newChallenge() { openModal('Crear desafío', challengeForm()); },
  saveChallenge(ctx, d) {
    const days = Math.min(365, Math.max(1, parseInt(d.days, 10) || 30));
    const amount = num(d.amount);
    if ((d.type === 'capCat' || d.type === 'noSmall') && !amount) { toast('Indicá el monto'); return; }
    const id = uid();
    ctx.commit((s) => {
      s.customChallenges.push({ id, name: d.name.trim(), days, type: d.type, category: d.category, amount });
      if (d.start) s.challenge = { id, start: todayISO() };
    });
    closeModal(); toast(d.start ? '¡Arrancó tu desafío!' : 'Desafío creado');
  },
  startChallenge(ctx, el) { ctx.commit((s) => { s.challenge = { id: el.dataset.id, start: todayISO() }; }); toast('¡Arrancó el desafío!'); },
  stopChallenge(ctx) { ctx.commit((s) => { s.challenge = null; }); },
  claimChallenge(ctx, el) {
    const amount = num(el.dataset.amount);
    ctx.commit((s) => { const mk = monthKey(); s.savedByApp[mk] = (s.savedByApp[mk] || 0) + amount; s.challenge = null; });
    toast(`¡Desafío cumplido! ${money(amount)} al contador`);
  },

  ask(ctx, el) { ask(ctx, el.dataset.q); },
  askForm(ctx, d) { ask(ctx, d.q); },
  clearChat(ctx) { ctx.commit((s) => { s.chat = []; }); },
};
