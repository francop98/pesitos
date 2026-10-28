// Herramientas para decidir: ¿me lo compro?, cuotas o contado,
// cuánto ahorrar por mes, cuánto rinde mi plata y conversor.

import { money, MONTHS_LONG } from './formato.js';
import { installmentsVsCash, lastSalary } from './calculos.js';
import { expectedInflation } from './datosvivos.js';
import { parseAmount } from './interprete.js';
import { icon, screenHead, openModal, setModalBody } from './interfaz.js';
import { lessonCard } from './aprender.js';

const TOOLS = [
  { action: 'openBuy', icon: 'cart', title: '¿Me lo compro?', text: 'Cómo impacta una compra en tu día, tu mes y tus metas.' },
  { action: 'openInstallments', icon: 'card', title: 'Cuotas o contado', text: 'Compará el valor real de las cuotas contra el precio de contado.' },
  { action: 'openGoalCalc', icon: 'sprout', title: '¿Cuánto ahorrar por mes?', text: 'Para llegar a un monto en una fecha.' },
  { action: 'openYield', icon: 'trend', title: '¿Cuánto rinde mi plata?', text: 'Interés de un plazo fijo o cuenta, y si le gana a la inflación.' },
  { action: 'openConverter', icon: 'swap', title: 'Conversor de monedas', text: 'Dólar blue, euro, real, bitcoin y oro, con cotización del día.' },
];

export function render(s) {
  return `<section class="screen">
    ${screenHead('Herramientas', '', 'Para decidir mejor antes de gastar')}
    ${TOOLS.map((t) => `<button class="card tool" data-action="${t.action}" style="border:none;text-align:left;flex-direction:row;align-items:center">
      <span class="cat-icon green" style="width:44px;height:44px;border-radius:12px">${icon(t.icon, 22)}</span>
      <span style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-weight:800;font-size:15px">${t.title}</span><span class="small muted">${t.text}</span></span>
      ${icon('chevron', 18)}
    </button>`).join('')}
    ${lessonCard(s, 'herramientas')}
  </section>`;
}

const amt = (v) => parseAmount(v) || 0;

function installmentsForm(d = {}) {
  return `<form class="form" data-submit="calcInstallments">
    <div class="field"><label for="iq-p">Precio de contado (o de lista)</label><input id="iq-p" name="price" inputmode="decimal" value="${d.price || ''}" placeholder="Ej: 300.000" required></div>
    <div class="field-row">
      <div class="field"><label for="iq-n">Cantidad de cuotas</label><input id="iq-n" name="n" inputmode="numeric" value="${d.n || 12}"></div>
      <div class="field"><label for="iq-c">Valor de cada cuota</label><input id="iq-c" name="cuota" inputmode="decimal" value="${d.cuota || ''}" placeholder="Si es sin interés, dejalo vacío"></div>
    </div>
    <div class="field"><label for="iq-d">Descuento por pagar de contado (%)</label><input id="iq-d" name="disc" inputmode="decimal" value="${d.disc || ''}" placeholder="Ej: 10"></div>
    <button class="btn primary block" type="submit">Comparar</button>
  </form><div id="iq-result"></div>`;
}

export const actions = {
  openInstallments(ctx, el) { openModal('Cuotas o contado', installmentsForm(), { push: !!(el && el.dataset.push) }); },
  calcInstallments(ctx, d) {
    const price = amt(d.price);
    const n = Math.max(1, parseInt(d.n, 10) || 1);
    const cuota = amt(d.cuota) || price / n;
    const disc = parseFloat(String(d.disc || '0').replace(',', '.')) || 0;
    if (!price) return;
    const infl = expectedInflation(ctx.state);
    const total = cuota * n;
    // valor de hoy de las cuotas (con la inflación esperada)
    const r = installmentsVsCash(total, n, 0, infl);
    const cash = price * (1 - disc / 100);
    const better = r.pv < cash ? 'cuotas' : 'contado';
    const recargo = total / price - 1;
    setModalBody('#iq-result', `<div class="result ${better === 'cuotas' ? 'ok' : 'warn'}">
      <strong>${better === 'cuotas' ? 'Convienen las cuotas' : 'Conviene pagar de contado'}</strong>
      <span class="text">${n} cuotas de ${money(cuota)} (total ${money(total)}${recargo > 0.005 ? `, ${Math.round(recargo * 100)}% más que el precio` : ''}) equivalen hoy a <b>${money(r.pv)}</b>. De contado pagás <b>${money(cash)}</b>.</span>
      <span class="text">Diferencia: ${money(Math.abs(cash - r.pv))} a favor de ${better === 'cuotas' ? 'las cuotas' : 'pagar de contado'}.</span>
      <span class="small">Calculado con una inflación esperada de ${String(infl).replace('.', ',')}% mensual (promedio de los últimos 3 meses del INDEC, se actualiza solo).</span>
    </div>
    <button class="btn ghost small" data-action="openLesson" data-id="cuotas" data-push="1">¿Cómo se calcula?</button>`);
  },

  openGoalCalc() {
    const now = new Date();
    const def = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    openModal('¿Cuánto ahorrar por mes?', `<form class="form" data-submit="calcGoal">
      <div class="field"><label for="gc-t">¿Cuánto necesitás?</label><input id="gc-t" name="target" inputmode="decimal" placeholder="Ej: 2.000.000" required></div>
      <div class="field-row">
        <div class="field"><label for="gc-d">¿Para cuándo?</label><input id="gc-d" name="when" type="month" value="${def}"></div>
        <div class="field"><label for="gc-h">Ya tenés</label><input id="gc-h" name="have" inputmode="decimal" placeholder="Ej: 0"></div>
      </div>
      <label style="display:flex;gap:10px;align-items:center;font-size:14px;font-weight:600;min-height:44px"><input type="checkbox" name="adjust" checked style="width:20px;height:20px"> Ajustar el monto por inflación (si es algo que se compra en pesos)</label>
      <button class="btn primary block" type="submit">Calcular</button>
    </form><div id="gc-result"></div>`);
  },
  calcGoal(ctx, d) {
    const target = amt(d.target); const have = amt(d.have);
    if (!target || !d.when) return;
    const [y, m] = d.when.split('-').map(Number);
    const now = new Date();
    const months = Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
    const infl = expectedInflation(ctx.state) / 100;
    const future = d.adjust ? target * Math.pow(1 + infl, months) : target;
    const monthly = Math.max(0, (future - have) / months);
    const sal = lastSalary(ctx.state);
    setModalBody('#gc-result', `<div class="result ok">
      <strong>${money(monthly)} por mes durante ${months} ${months === 1 ? 'mes' : 'meses'}</strong>
      ${d.adjust ? `<span class="text">Con la inflación esperada, en ${MONTHS_LONG[m - 1]} ${y} eso costaría cerca de ${money(future)}.</span>` : ''}
      ${sal ? `<span class="text">Es el ${Math.round((monthly / sal.amount) * 100)}% de tu sueldo.</span>` : ''}
      <span class="small">Si lo ahorrás en algo que rinda al menos como la inflación, te alcanza con menos.</span>
    </div>`);
  },

  openYield() {
    openModal('¿Cuánto rinde mi plata?', `<form class="form" data-submit="calcYield">
      <div class="field"><label for="y-a">Monto</label><input id="y-a" name="amount" inputmode="decimal" placeholder="Ej: 500.000" required></div>
      <div class="field-row">
        <div class="field"><label for="y-t">Tasa anual (TNA %)</label><input id="y-t" name="tna" inputmode="decimal" placeholder="La que te ofrece tu banco" required></div>
        <div class="field"><label for="y-d">Plazo (días)</label><input id="y-d" name="days" inputmode="numeric" value="30"></div>
      </div>
      <button class="btn primary block" type="submit">Calcular</button>
    </form><div id="y-result"></div>`);
  },
  calcYield(ctx, d) {
    const amount = amt(d.amount);
    const tna = parseFloat(String(d.tna).replace(',', '.')) || 0;
    const days = Math.max(1, parseInt(d.days, 10) || 30);
    if (!amount || !tna) return;
    const interest = amount * (tna / 100) * (days / 365);
    const monthlyRate = (tna / 100) * (30 / 365) * 100;
    const infl = expectedInflation(ctx.state);
    const inflPeriod = Math.pow(1 + infl / 100, days / 30) - 1;
    const real = (1 + interest / amount) / (1 + inflPeriod) - 1;
    setModalBody('#y-result', `<div class="result ${real >= 0 ? 'ok' : 'warn'}">
      <strong>Ganás ${money(interest)} en ${days} días</strong>
      <span class="text">Terminás con ${money(amount + interest)}. Equivale a ${monthlyRate.toFixed(2).replace('.', ',')}% por mes.</span>
      <span class="text">${real >= 0 ? `Le gana a la inflación esperada (${String(infl).replace('.', ',')}% mensual): ganás poder de compra.` : `No le gana a la inflación esperada (${String(infl).replace('.', ',')}% mensual): perdés algo de poder de compra.`}</span>
    </div>
    <button class="btn ghost small" data-action="openLesson" data-id="compuesto" data-push="1">Aprendé: el interés compuesto</button>`);
  },
};

