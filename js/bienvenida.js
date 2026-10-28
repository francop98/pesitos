// Arranque como charla: pocas preguntas, una por vez, todas salteables.
// Lo demás lo pregunta la app de a poco (ver js/guia.js).
// Si la cuenta ya trae el nombre (por ejemplo, con Google), no lo pregunta.
// Preguntas: nombre → sueldo → cuándo cobrás → provincia → ciudad → medios de pago.

import { uid } from './almacenamiento.js';
import { todayISO, esc, money, normalize } from './formato.js';
import { parseAmount } from './interprete.js';
import { wordmark, icon, sprout } from './interfaz.js';
import { PROVINCES, provinceLabel, WALLETS } from './categorias.js';
import { entenderCobro, textoDeCobro, fechaDeCobro } from './feriados.js';

const ALL_STEPS = ['nombre', 'sueldo', 'cobro', 'provincia', 'ciudad', 'medios'];
const mainSteps = () => (knownName ? ALL_STEPS.slice(1) : ALL_STEPS);
const WALLET_GROUPS = ['Billeteras', 'Bancos', 'Tarjetas'];

const fresh = () => ({ name: '', salary: 0, payRule: null, province: '', city: '', wallets: [], customWallets: [] });
let step = 'hola';
let trail = []; // [{ step, q, a }]
let draft = fresh();
let knownName = ''; // nombre que vino con la cuenta
let nota = '';      // aclaración de Pesitos (por ejemplo, "no entendí")

function nextStep(cur) {
  switch (cur) {
    case 'hola': return knownName ? 'sueldo' : 'nombre';
    case 'nombre': return 'sueldo';
    case 'sueldo': return 'cobro';
    case 'cobro': return 'provincia';
    case 'provincia': return draft.province ? 'ciudad' : 'medios';
    case 'ciudad': return 'medios';
    default: return 'listo';
  }
}

const chip = (value, label, extra = '') => `<button class="chip big ${extra}" data-action="guideNext" data-value="${esc(value)}">${esc(label)}</button>`;
const inputForm = (name, placeholder, mode = 'text', button = 'Seguir', extra = '') => `<form class="quick" data-submit="guideInput" autocomplete="off">
    <label for="g-${name}" class="sr-only">${esc(placeholder)}</label>
    <input id="g-${name}" name="value" placeholder="${esc(placeholder)}" inputmode="${mode}" data-autofocus enterkeyhint="next" ${extra}>
    <button type="submit" class="icon-btn green" aria-label="${button}">${icon('send', 20, 2.2)}</button>
  </form>`;

function proximoCobro(regla) {
  const t = new Date(); const hoy = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const p = { payRule: regla };
  let f = fechaDeCobro(p, t.getFullYear(), t.getMonth());
  if (f < hoy) { const nx = new Date(t.getFullYear(), t.getMonth() + 1, 1); f = fechaDeCobro(p, nx.getFullYear(), nx.getMonth()); }
  return f;
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function current() {
  const n = draft.name ? `, ${draft.name}` : '';
  switch (step) {
    case 'hola': return {
      bubbles: [`¡Hola${knownName ? ', ' + knownName : ''}! Soy Pesitos, tu economista de bolsillo.`, `Te ayudo a saber cuánto podés gastar, a ordenar tu plata y a encontrar descuentos. Son ${mainSteps().length} preguntas cortitas y arrancamos.`],
      controls: `<div class="chips">${chip('go', 'Dale, arranquemos', 'primary')}<button class="chip big" data-action="loadDemo">Mostrame un ejemplo primero</button></div>`,
    };
    case 'nombre': return {
      bubbles: ['¿Cómo te llamo?'],
      controls: `${inputForm('name', 'Tu nombre')}<div class="chips">${chip('', 'Saltear')}</div>`,
    };
    case 'sueldo': return {
      bubbles: [`Buenísimo${n}. ¿Cuánto cobrás por mes, más o menos?`],
      controls: `${inputForm('salary', 'Ej: 900.000', 'decimal')}<p class="small muted guide-hint">Con eso calculo cuánto podés gastar por día. Queda guardado cifrado en tu cuenta: solo lo ves vos.</p><div class="chips">${chip('', 'Prefiero no decirlo ahora')}</div>`,
    };
    case 'cobro': return {
      bubbles: ['¿Cuándo cobrás? Tocá una opción o escribilo como te salga: "el 5", "4.º día hábil", "último día hábil"…'],
      controls: `<div class="chips">${chip('dia:1', 'El 1')}${chip('dia:5', 'El 5')}${chip('dia:10', 'El 10')}${chip('habil:1', '1.er día hábil')}${chip('habil:5', '5.º día hábil')}${chip('ultimoHabil', 'Último día hábil')}${chip('ultimo', 'Último día del mes')}${chip('varia', 'Varía')}</div>
        ${inputForm('cobro', 'O escribilo: ej. 4.º día hábil, el 15')}`,
    };
    case 'provincia': return {
      bubbles: ['¿En qué provincia vivís? Muchas promos valen solo en una provincia, así te muestro las tuyas.'],
      controls: `<form class="quick" data-submit="guideInput"><label for="g-prov" class="sr-only">Provincia</label><select id="g-prov" name="value"><option value="">Elegí tu provincia…</option>${PROVINCES.map((p) => `<option value="${esc(p)}">${esc(provinceLabel(p))}</option>`).join('')}</select><button type="submit" class="icon-btn green" aria-label="Seguir">${icon('send', 20, 2.2)}</button></form>
        <div class="chips">${chip('', 'Prefiero no decirlo')}</div>`,
    };
    case 'ciudad': return {
      bubbles: ['¿Y en qué ciudad? Algunas promos son solo para una ciudad.'],
      controls: `${inputForm('city', 'Ej: Bahía Blanca', 'text', 'Seguir', 'autocomplete="address-level2" maxlength="40"')}<div class="chips">${chip('', 'Saltear')}</div>`,
    };
    case 'medios': return {
      bubbles: ['Última: ¿qué bancos, billeteras y tarjetas usás? Tocá todos los que tengas y te aviso el día antes qué descuentos tenés.'],
      controls: `${WALLET_GROUPS.map((g) => `<span class="small muted guide-hint"><b>${g}</b></span><div class="chips">${WALLETS.filter((w) => w.kind === g).map((w) => `<button class="chip toggle" data-action="guideToggleWallet" data-id="${w.id}" aria-pressed="${draft.wallets.includes(w.id)}">${esc(w.name)}</button>`).join('')}</div>`).join('')}
        ${draft.customWallets.length ? `<div class="chips">${draft.customWallets.map((c) => `<button class="chip toggle" data-action="guideRemoveCustom" data-name="${esc(c)}" aria-pressed="true">${esc(c)} ✕</button>`).join('')}</div>` : ''}
        ${inputForm('otro', '¿Otro? Escribilo: ej. Banco Patagonia', 'text', 'Agregar', 'list="g-wallet-list" maxlength="40"')}
        <datalist id="g-wallet-list">${OTROS_CONOCIDOS.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <button class="btn primary block" data-action="guideNext" data-value="ok">${draft.wallets.length + draft.customWallets.length ? `Listo (${draft.wallets.length + draft.customWallets.length})` : 'No uso ninguno de estos'}</button>`,
    };
    default: {
      const regla = draft.payRule;
      return {
        bubbles: [
          `¡Listo${n}! ${draft.salary ? 'Ya te puedo decir cuánto podés gastar por día.' : 'Cuando me cuentes cuánto cobrás, te digo cuánto podés gastar por día.'}${regla && regla.tipo !== 'varia' ? ` Tu próximo cobro es el ${DIAS[proximoCobro(regla).getDay()]} ${proximoCobro(regla).getDate()}/${proximoCobro(regla).getMonth() + 1}.` : ''}`,
          'Lo demás te lo voy preguntando de a poco, cuando haga falta. Nada de formularios.',
        ],
        controls: '<button class="btn primary block" data-action="guideFinish">Ver mi día</button>',
      };
    }
  }
}

// Bancos y billeteras que no están en la lista principal pero tienen promos en la fuente
const OTROS_CONOCIDOS = ['Banco Patagonia', 'Banco Comafi', 'Banco Hipotecario', 'Banco Santa Fe', 'Banco San Juan', 'Banco Santa Cruz', 'Banco del Chubut', 'Banco de Corrientes', 'Banco Provincia del Neuquén', 'Banco de La Pampa', 'Banco del Sol', 'Banco Columbia', 'Carrefour Banco', 'Cencopay', 'Tarjeta Clarín 365', 'Buepp', 'Prex', 'YOY', 'Tarjeta SOL', 'Tarjeta TCI', 'Sidecreer', 'Credicuotas'];

export function render(s) {
  knownName = ((s && s.profile && s.profile.name) || '').trim().split(' ')[0].slice(0, 30);
  if (knownName && !draft.name) draft.name = knownName;
  const c = current();
  const MAIN_STEPS = mainSteps();
  const total = MAIN_STEPS.length;
  const idx = MAIN_STEPS.indexOf(step);
  const progress = step === 'hola' || step === 'listo' ? '' : `<div class="dots" aria-label="Pregunta ${Math.min(idx < 0 ? total : idx + 1, total)} de ${total}">${MAIN_STEPS.map((x, i) => `<span class="${i <= (idx < 0 ? total - 1 : idx) ? 'on' : ''}"></span>`).join('')}</div>`;
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
      ${nota ? `<div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot aviso" role="alert">${esc(nota)}</div></div>` : ''}
    </div>
    <div class="guide-controls">${c.controls}</div>
  </section>`;
}

function reglaDeChip(v) {
  const [tipo, num] = String(v).split(':');
  if (tipo === 'dia') return { tipo: 'dia', dia: Number(num) };
  if (tipo === 'habil') return { tipo: 'habil', n: Number(num) };
  if (['ultimoHabil', 'ultimo', 'varia'].includes(tipo)) return { tipo };
  return null;
}

function answer(ctx, raw, fromInput) {
  const value = String(raw ?? '').trim();
  const q = current().bubbles.slice(-1)[0];
  let shown = value;
  nota = '';
  switch (step) {
    case 'hola': step = nextStep(step); ctx.render(); return;
    case 'nombre': draft.name = value.slice(0, 30); shown = value || 'Prefiero saltearlo'; break;
    case 'sueldo': {
      const n = value ? parseAmount(value) : 0;
      if (fromInput && !n) { nota = 'No entendí el monto. Probá así: 900.000'; ctx.render(); return; }
      draft.salary = n; shown = n ? money(n) : 'Prefiero no decirlo ahora';
      break;
    }
    case 'cobro': {
      const regla = fromInput ? entenderCobro(value) : reglaDeChip(value);
      if (!regla) { nota = 'No lo entendí del todo. Probá con "el 5", "4.º día hábil", "último día hábil" o "último día del mes".'; ctx.render(); return; }
      draft.payRule = regla;
      const t = textoDeCobro({ payRule: regla });
      shown = t.charAt(0).toUpperCase() + t.slice(1);
      break;
    }
    case 'provincia':
      draft.province = PROVINCES.includes(value) ? value : '';
      if (fromInput && !draft.province) { nota = 'Elegí tu provincia de la lista.'; ctx.render(); return; }
      shown = draft.province ? provinceLabel(draft.province) : 'Prefiero no decirlo';
      break;
    case 'ciudad': draft.city = value.slice(0, 40); shown = value || 'Saltear'; break;
    case 'medios': {
      if (fromInput) { // "Otro": se agrega y se queda en la misma pregunta
        const nombre = value.slice(0, 40);
        const conocido = WALLETS.find((w) => normalize(w.name) === normalize(nombre));
        if (conocido) { if (!draft.wallets.includes(conocido.id)) draft.wallets.push(conocido.id); }
        else if (nombre && !draft.customWallets.some((c) => normalize(c) === normalize(nombre))) draft.customWallets.push(nombre);
        ctx.render(); return;
      }
      const names = [...draft.wallets.map((id) => (WALLETS.find((w) => w.id === id) || {}).name), ...draft.customWallets].filter(Boolean);
      shown = names.length ? names.join(', ') : 'Ninguno de estos';
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
  guideInput(ctx, d) { if (String(d.value || '').trim()) answer(ctx, d.value, true); else if (step === 'provincia') answer(ctx, '', true); },
  guideToggleWallet(ctx, el) {
    const id = el.dataset.id;
    draft.wallets = draft.wallets.includes(id) ? draft.wallets.filter((x) => x !== id) : [...draft.wallets, id];
    ctx.render();
  },
  guideRemoveCustom(ctx, el) { draft.customWallets = draft.customWallets.filter((x) => x !== el.dataset.name); ctx.render(); },
  guideBack(ctx) {
    const last = trail.pop();
    step = last ? last.step : 'hola';
    nota = '';
    ctx.render();
  },
  guideFinish(ctx) {
    const d = draft;
    ctx.commit((s) => {
      s.ready = true;
      const regla = d.payRule || { tipo: 'dia', dia: 1 };
      s.profile = { ...s.profile, name: d.name || s.profile.name, payRule: regla, paydayVaries: regla.tipo === 'varia', payday: regla.tipo === 'dia' ? regla.dia : regla.tipo === 'ultimo' ? 31 : 1, province: d.province, city: d.city };
      if (d.salary) s.incomes.push({ id: uid(), date: todayISO(), amount: d.salary, type: 'sueldo', note: 'Sueldo' });
      s.wallets = [...new Set([...(s.wallets || []), ...d.wallets])];
      s.customWallets = s.customWallets || [];
      for (const name of d.customWallets) {
        const id = 'x:' + normalize(name).replace(/[^a-z0-9]+/g, '-');
        if (s.customWallets.some((w) => w.id === id)) { if (!s.wallets.includes(id)) s.wallets.push(id); continue; }
        s.customWallets.push({ id, name, kind: /tarjeta/i.test(name) ? 'Tarjetas' : /banco/i.test(name) ? 'Bancos' : 'Billeteras' });
        s.wallets.push(id);
      }
    });
    step = 'hola'; trail = []; draft = fresh(); nota = '';
    ctx.go('inicio');
  },
};
