// Arranque como charla: pocas preguntas, una por vez, todas salteables.
// Lo demás lo pregunta la app de a poco (ver js/guide.js).

import { uid } from '../store.js';
import { todayISO, esc, money } from '../format.js';
import { parseAmount } from '../parser.js';
import { wordmark, icon, sprout } from '../ui.js';

const FOCUS = [
  { id: 'finmes', label: 'Llegar a fin de mes' },
  { id: 'orden', label: 'Saber en qué se me va la plata' },
  { id: 'crecer', label: 'Hacer crecer mis ahorros' },
  { id: 'otro', label: 'Otro' },
];
const MAIN_STEPS = ['nombre', 'sueldo', 'cobro', 'foco'];

const fresh = () => ({ name: '', salary: 0, payday: 1, paydayVaries: false, focus: '', focusText: '', goal: '', target: 0 });
let step = 'hola';
let trail = []; // [{ step, q, a }]
let draft = fresh();

function nextStep(cur) {
  switch (cur) {
    case 'hola': return 'nombre';
    case 'nombre': return 'sueldo';
    case 'sueldo': return draft.salary ? 'cobro' : 'foco';
    case 'cobro': return 'foco';
    case 'foco': return draft.focus === 'otro' ? 'otro' : 'listo';
    case 'otro': return draft.focusText ? 'monto' : 'listo';
    default: return 'listo';
  }
}

const chip = (value, label, extra = '') => `<button class="chip big ${extra}" data-action="guideNext" data-value="${esc(value)}">${esc(label)}</button>`;
const inputForm = (name, placeholder, mode = 'text', button = 'Seguir') => `<form class="quick" data-submit="guideInput" autocomplete="off">
    <label for="g-${name}" class="sr-only">${esc(placeholder)}</label>
    <input id="g-${name}" name="value" placeholder="${esc(placeholder)}" inputmode="${mode}" data-autofocus enterkeyhint="next">
    <button type="submit" class="icon-btn green" aria-label="${button}">${icon('send', 20, 2.2)}</button>
  </form>`;

function current() {
  const n = draft.name ? `, ${draft.name}` : '';
  switch (step) {
    case 'hola': return {
      bubbles: ['¡Hola! Soy Pesitos, tu economista de bolsillo.', 'Te ayudo a saber cuánto podés gastar, a ordenar tu plata y a llegar a lo que querés. Son 4 preguntas cortitas y arrancamos.'],
      controls: `<div class="chips">${chip('go', 'Dale, arranquemos', 'primary')}<button class="chip big" data-action="loadDemo">Mostrame un ejemplo primero</button></div>`,
    };
    case 'nombre': return {
      bubbles: ['¿Cómo te llamo?'],
      controls: `${inputForm('name', 'Tu nombre')}<div class="chips">${chip('', 'Saltear')}</div>`,
    };
    case 'sueldo': return {
      bubbles: [`Buenísimo${n}. ¿Cuánto cobrás por mes, más o menos?`],
      controls: `${inputForm('salary', 'Ej: 900.000', 'decimal')}<p class="small muted guide-hint">Con eso calculo cuánto podés gastar por día. Queda guardado solo en tu celular.</p><div class="chips">${chip('', 'Prefiero no decirlo ahora')}</div>`,
    };
    case 'cobro': return {
      bubbles: ['¿Qué día te pagan?'],
      controls: `<div class="chips">${chip('1', 'El 1')}${chip('5', 'El 5')}${chip('10', 'El 10')}${chip('31', 'Fin de mes')}${chip('var', 'Varía')}</div>${inputForm('payday', 'Otro día (1 a 31)', 'numeric')}`,
    };
    case 'foco': return {
      bubbles: ['Y lo más importante: ¿qué te gustaría lograr?'],
      controls: `<div class="chips stack">${FOCUS.map((f) => chip(f.id, f.label)).join('')}</div>`,
    };
    case 'otro': return {
      bubbles: ['Contame con tus palabras qué te gustaría lograr.'],
      controls: `${inputForm('otro', 'Ej: Irme de vacaciones en enero')}<div class="chips">${chip('', 'Prefiero no decirlo ahora')}</div>`,
    };
    case 'monto': return {
      bubbles: ['¿Necesitás juntar plata para eso? Si es así, ¿cuánto, más o menos?'],
      controls: `${inputForm('target', 'Ej: 1.500.000', 'decimal')}<div class="chips">${chip('', 'No hace falta juntar plata')}</div>`,
    };
    default: {
      const focusLine = {
        finmes: 'Te voy a avisar si vas muy rápido antes del cobro.',
        otro: draft.goal ? `Voy a ir midiendo cuánto te falta para "${draft.goal}".` : (draft.focusText ? 'Lo tengo en cuenta para mis sugerencias.' : ''),
        orden: 'Anotá tus gastos como te resulte cómodo, por ejemplo "Supermercado 48.000", y yo los ordeno.',
        crecer: 'Te voy a mostrar dónde puede rendir más tu plata.',
      }[draft.focus] || '';
      return {
        bubbles: [
          `¡Listo${n}! ${draft.salary ? 'Ya te puedo decir cuánto podés gastar por día.' : 'Cuando me cuentes cuánto cobrás, te digo cuánto podés gastar por día.'} ${focusLine}`.trim(),
          'Lo demás te lo voy preguntando de a poco, cuando haga falta. Nada de formularios.',
        ],
        controls: '<button class="btn primary block" data-action="guideFinish">Ver mi día</button>',
      };
    }
  }
}

export function render() {
  const c = current();
  const idx = MAIN_STEPS.indexOf(step);
  const progress = step === 'hola' || step === 'listo' ? '' : `<div class="dots" aria-label="Pregunta ${Math.min(idx < 0 ? 4 : idx + 1, 4)} de 4">${MAIN_STEPS.map((s, i) => `<span class="${i <= (idx < 0 ? 3 : idx) ? 'on' : ''}"></span>`).join('')}</div>`;
  const canBack = step !== 'hola' && step !== 'listo';
  return `<section class="guide">
    <header class="guide-top">
      ${canBack ? `<button class="icon-btn back on-green" data-action="guideBack" aria-label="Volver">${icon('back', 20, 2.2)}</button>` : '<span style="width:44px"></span>'}
      <div class="guide-brand">${wordmark(26, '#FFFFFF', '#C6F36B')}<span>Tu economista de bolsillo</span></div>
      <span style="width:44px;display:flex;justify-content:flex-end">${progress}</span>
    </header>
    <div class="chat guide-chat">
      ${trail.map((t) => `<div class="bubble bot faded">${esc(t.q)}</div><div class="bubble me">${esc(t.a)}</div>`).join('')}
      ${c.bubbles.map((b, i) => `<div class="bot-row">${i === 0 ? `<span class="bot-avatar">${sprout(18)}</span>` : '<span class="bot-avatar ghost"></span>'}<div class="bubble bot">${esc(b)}</div></div>`).join('')}
    </div>
    <div class="guide-controls">${c.controls}</div>
  </section>`;
}

function answer(ctx, raw, fromInput) {
  const value = String(raw ?? '').trim();
  const q = current().bubbles.slice(-1)[0];
  let shown = value;
  switch (step) {
    case 'hola': step = nextStep(step); ctx.render(); return;
    case 'nombre': draft.name = value.slice(0, 30); shown = value || 'Prefiero saltearlo'; break;
    case 'sueldo': {
      const n = value ? parseAmount(value) : 0;
      if (fromInput && !n) { ctx.toast('No entendí el monto. Ejemplo: 900.000'); return; }
      draft.salary = n; shown = n ? money(n) : 'Prefiero no decirlo ahora';
      break;
    }
    case 'cobro': {
      if (value === 'var') { draft.payday = 1; draft.paydayVaries = true; shown = 'Varía'; break; }
      const d = parseInt(value, 10);
      if (!d || d < 1 || d > 31) { ctx.toast('Poné un día entre 1 y 31'); return; }
      draft.payday = d; draft.paydayVaries = false; shown = d === 31 ? 'Fin de mes' : `El ${d}`;
      break;
    }
    case 'foco': draft.focus = value; shown = (FOCUS.find((f) => f.id === value) || {}).label || value; break;
    case 'otro': draft.focusText = value.slice(0, 80); shown = value || 'Prefiero no decirlo ahora'; break;
    case 'monto': {
      const n = value ? parseAmount(value) : 0;
      if (fromInput && !n) { ctx.toast('No entendí el monto. Ejemplo: 1.500.000'); return; }
      draft.target = n; draft.goal = n ? draft.focusText.slice(0, 40) : '';
      shown = n ? money(n) : 'No hace falta juntar plata';
      break;
    }
    default: return;
  }
  trail.push({ step, q, a: shown });
  step = nextStep(step);
  ctx.render();
}

export const actions = {
  guideNext(ctx, el) { answer(ctx, el.dataset.value, false); },
  guideInput(ctx, d) { if (String(d.value || '').trim()) answer(ctx, d.value, true); },
  guideBack(ctx) {
    const last = trail.pop();
    step = last ? last.step : 'hola';
    ctx.render();
  },
  guideFinish(ctx) {
    const d = draft;
    ctx.commit((s) => {
      s.ready = true;
      s.profile = { ...s.profile, name: d.name, payday: d.payday, paydayVaries: d.paydayVaries, focus: d.focus, focusText: d.focusText };
      if (d.salary) s.incomes.push({ id: uid(), date: todayISO(), amount: d.salary, type: 'sueldo', note: 'Sueldo' });
      if (d.goal) s.goals.push({ id: uid(), name: d.goal.charAt(0).toUpperCase() + d.goal.slice(1), target: d.target, saved: 0, monthly: 0, main: true });
    });
    step = 'hola'; trail = []; draft = fresh();
    ctx.go('inicio');
  },
};
