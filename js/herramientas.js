// Herramientas para decidir: ¿me lo compro?, cuotas o contado,
// cuánto ahorrar por mes, cuánto rinde mi plata y conversor.

import { money, MONTHS_LONG, esc } from './formato.js';
import { lastSalary, resumenCuotas } from './calculos.js';
import { BILLETERAS_QUE_RINDEN } from './rendimientos.js';
import { expectedInflation } from './datosvivos.js';
import { parseAmount } from './interprete.js';
import { icon, screenHead, openModal, setModalBody } from './interfaz.js';
import { lessonCard } from './aprender.js';

const TOOLS = [
  { action: 'openBuy', icon: 'cart', title: '¿Me lo compro?', text: 'Cómo impacta una compra en tu día, tu mes y tus metas.' },
  { action: 'openInstallments', icon: 'card', title: 'Cuotas o contado', text: 'Con o sin interés, con la inflación: cuánto ganás o perdés de verdad.' },
  { action: 'openPfDolar', icon: 'trend', title: 'Plazo fijo o dólar', text: 'A cuánto tiene que estar el dólar para que convenga más que el plazo fijo.' },
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
  </section>`;
}

const amt = (v) => parseAmount(v) || 0;

const pctTxt = (v, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
const tasaTxt = (v) => String(v).replace('.', ',');

// a dónde va la plata mientras pagás las cuotas
function opcionesPlata(s) {
  const tasas = (s.rendimientos && s.rendimientos.tasas) || {};
  const pf = mejorPlazoFijo(s);
  return [
    ['sueldo', 'Pago cada cuota con mi sueldo del mes'],
    ...BILLETERAS_QUE_RINDEN.filter((b) => tasas[b.id]).map((b) => [`tna:${tasas[b.id].tna}`, `Tengo la plata y la dejo en ${b.nombre} (${tasaTxt(tasas[b.id].tna)}% anual)`]),
    ...(pf ? [[`tna:${pf.tna}`, `Tengo la plata y la pongo en plazo fijo (${tasaTxt(pf.tna)}% anual)`]] : []),
    ['tna:0', 'Tengo la plata y la dejo guardada sin que rinda'],
  ];
}
function mejorPlazoFijo(s) {
  const pf = Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {});
  if (!pf.length) return null;
  const prov = pf.find(([n]) => /provincia de buenos aires/i.test(n));
  const [entidad, tna] = prov || pf.sort((a, b) => b[1] - a[1])[0];
  return { entidad, tna };
}

const nombreBanco = (n) => n.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y)\b/g, (w) => w.toLowerCase()).replace(/\bS\.a\.(u\.)?/gi, (w) => w.toUpperCase());
const sinTildes = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function bancosHtml(s, q) {
  const pf = Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {}).sort((a, b) => b[1] - a[1]);
  const qq = sinTildes(String(q || '').trim());
  const lista = pf.filter(([n]) => !qq || sinTildes(n).includes(qq) || sinTildes(nombreBanco(n)) === qq);
  const todos = qq && lista.length === 1 && sinTildes(nombreBanco(lista[0][0])) === qq ? pf : lista; // ya elegido: mostrar todos
  return todos.length ? todos.map(([n, v]) => `<button type="button" class="ciudad-op${sinTildes(nombreBanco(n)) === qq ? ' on' : ''}" data-action="pfElegirBanco" data-v="${v}" data-n="${esc(nombreBanco(n))}"><span>${esc(nombreBanco(n))}</span><b>${tasaTxt(v)}%</b></button>`).join('') : '<span class="small muted">No encuentro ese banco. Podés escribir la tasa a mano arriba.</span>';
}

function installmentsForm(s, d = {}) {
  const rc = resumenCuotas(s);
  return `<form class="form" data-submit="calcInstallments">
    <div class="field"><label for="iq-p">Precio (de lista o en cuotas)</label><input id="iq-p" name="price" inputmode="decimal" value="${d.price || ''}" placeholder="Ej: 300.000" required></div>
    <div class="field-row">
      <div class="field"><label for="iq-n">Cantidad de cuotas</label><input id="iq-n" name="n" inputmode="numeric" value="${d.n || ''}" placeholder="Ej: 6" required></div>
      <div class="field"><label for="iq-c">Valor de cada cuota</label><input id="iq-c" name="cuota" inputmode="decimal" value="${d.cuota || ''}" placeholder="Vacío = sin interés"></div>
    </div>
    <div class="field"><label for="iq-d">Descuento si pagás de contado (%)</label><input id="iq-d" name="disc" inputmode="decimal" value="${d.disc || ''}" placeholder="Ej: 10 (vacío si no hay)"></div>
    <div class="field"><label for="iq-m">¿Cómo pagarías las cuotas?</label><select id="iq-m" name="modo">${opcionesPlata(s).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
      <span class="hint">Si tenés la plata hoy, lo que rinde mientras pagás de a poco también cuenta.</span></div>
    <button class="btn primary block" type="submit">Comparar</button>
  </form><div id="iq-result"></div>
  ${rc.compras ? `<div class="card lime"><strong>Tus compras en cuotas</strong>
    <span class="text">${rc.compras} ${rc.compras === 1 ? 'compra' : 'compras'} por ${money(rc.total)}. Con la inflación, en plata del día en que compraste te salieron <b>${money(rc.pv)}</b>: la inflación te ahorró <b>${money(rc.licuado)}</b>.</span>
    <span class="small muted">Uso la inflación real del INDEC para los meses publicados y la esperada para el resto. Tocá cualquier compra en cuotas en Movimientos para ver su detalle.</span></div>` : ''}`;
}

// valor de hoy de una serie de cuotas, con la inflación mensual i
const valorHoy = (cuota, n, i) => { let pv = 0; for (let k = 1; k <= n; k++) pv += cuota / Math.pow(1 + i, k); return pv; };

export const actions = {
  openInstallments(ctx, el) { openModal('Cuotas o contado', installmentsForm(ctx.state), { push: !!(el && el.dataset.push) }); },
  calcInstallments(ctx, d) {
    const price = amt(d.price);
    const n = Math.max(1, parseInt(d.n, 10) || 1);
    if (!price) return;
    const cuota = amt(d.cuota) || price / n;
    const conInteres = !!amt(d.cuota) && cuota * n > price * 1.005;
    const disc = parseFloat(String(d.disc || '0').replace(',', '.')) || 0;
    const infl = expectedInflation(ctx.state);
    const i = infl / 100;
    const total = cuota * n;
    const cash = price * (1 - disc / 100);
    const pv = valorHoy(cuota, n, i);
    const recargo = total - cash; // lo que pagás de más en pesos (interés + descuento perdido)
    const licua = total - pv; // lo que la inflación se "come" de las cuotas
    let veredicto; let detalle; let gana;
    if (d.modo === 'sueldo' || !d.modo) {
      gana = cash - pv; // >0: convienen las cuotas
      veredicto = gana >= 0 ? `Convienen las cuotas: ganás ${money(gana)}` : `Conviene pagar de contado: ahorrás ${money(-gana)}`;
      detalle = `Las ${n} cuotas, llevadas a plata de hoy, valen <b>${money(pv)}</b>. De contado pagás <b>${money(cash)}</b>.`;
    } else {
      const tna = Number(String(d.modo).split(':')[1]) || 0;
      const r = tna / 100 * 30 / 365;
      let saldo = cash; // la plata que no gastaste de contado
      for (let k = 1; k <= n; k++) saldo = saldo * (1 + r) - cuota;
      const final = saldo; const finalHoy = saldo / Math.pow(1 + i, n);
      gana = finalHoy;
      veredicto = final >= 0 ? `Convienen las cuotas: te quedan ${money(final)}` : `Conviene pagar de contado: con cuotas te faltan ${money(-final)}`;
      detalle = `Si en vez de pagar ${money(cash)} de contado dejás esa plata ${tna ? `rindiendo al ${tasaTxt(tna)}% anual` : 'guardada'} y vas sacando ${money(cuota)} por mes, al terminar ${final >= 0 ? `te sobran <b>${money(final)}</b> (≈ ${money(finalHoy)} en plata de hoy)` : `te faltan <b>${money(-final)}</b>`}.`;
    }
    setModalBody('#iq-result', `<div class="result ${gana >= 0 ? 'ok' : 'warn'}">
      <strong>${veredicto}</strong>
      <span class="text">${detalle}</span>
      <div class="cuentas-cuotas">
        <div class="split small"><span>Total en cuotas</span><b>${money(total)}</b></div>
        <div class="split small"><span>${conInteres ? 'Interés' : 'Recargo'}${disc ? ' y descuento que perdés' : ''}</span><b>${recargo > 0.5 ? '+' + money(recargo) : '$0'}${recargo > 0.5 ? ` (${pctTxt(recargo / cash)})` : ''}</b></div>
        <div class="split small"><span>Lo que la inflación se come de las cuotas</span><b class="pos">−${money(licua)}</b></div>
      </div>
      ${!conInteres && !disc ? '<span class="small">Sin interés y sin descuento por contado, las cuotas siempre convienen: pagás lo mismo, pero más adelante y con plata que vale menos.</span>' : ''}
      <span class="small">Inflación esperada: ${tasaTxt(infl)}% por mes (promedio de los últimos 3 meses del INDEC, se actualiza sola). Si la inflación baja, las cuotas convienen menos.</span>
    </div>
    <button class="btn ghost small" data-action="openLesson" data-id="cuotas" data-push="1">¿Cómo se calcula?</button>`);
  },

  openPfDolar(ctx) {
    const s = ctx.state;
    const r = (s.rates && s.rates.USD) || {};
    const pf = Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {}).sort((a, b) => b[1] - a[1]);
    const def = mejorPlazoFijo(s);
    openModal('Plazo fijo o dólar', `<form class="form" data-submit="calcPfDolar">
      <div class="field"><label for="pd-a">¿Cuántos pesos tenés?</label><input id="pd-a" name="amount" inputmode="decimal" placeholder="Ej: 1.000.000" required></div>
      <div class="field-row">
        <div class="field"><label for="pd-d">Plazo (días)</label><input id="pd-d" name="days" inputmode="numeric" value="30"></div>
        <div class="field"><label for="pd-t">Tasa del plazo fijo (TNA %)</label><input id="pd-t" name="tna" inputmode="decimal" value="${def ? tasaTxt(def.tna) : ''}" placeholder="Ej: 32" required></div>
      </div>
      ${pf.length ? `<div class="field banco-picker"><label for="pd-b">O elegí el banco</label><input id="pd-b" placeholder="Escribí para buscar (ej: Galicia)" autocomplete="off" data-input="pfFiltrar" value="${def ? esc(nombreBanco(def.entidad)) : ''}">
        <div class="ciudad-lista banco-lista" data-banco-lista>${bancosHtml(s, '')}</div><span class="hint">Tasas para clientes que publica el BCRA, se actualizan solas.</span></div>` : ''}
      <div class="field-row">
        <div class="field"><label for="pd-v">Dólar hoy (venta)</label><input id="pd-v" name="venta" inputmode="decimal" value="${r.venta ? Math.round(r.venta) : ''}" required></div>
        <div class="field"><label for="pd-c">Dólar hoy (compra)</label><input id="pd-c" name="compra" inputmode="decimal" value="${r.compra ? Math.round(r.compra) : ''}"></div>
      </div>
      <span class="small muted">Precargado con el dólar blue del día. Si usás el oficial o el MEP, cambialo.</span>
      <button class="btn primary block" type="submit">Comparar</button>
    </form><div id="pd-result"></div>`);
  },
  pfFiltrar(ctx, el) { const l = document.querySelector('#modal [data-banco-lista]'); if (l) l.innerHTML = bancosHtml(ctx.state, el.value); },
  pfElegirBanco(ctx, el) {
    const i = document.getElementById('pd-t'); if (i) i.value = tasaTxt(el.dataset.v);
    const b = document.getElementById('pd-b'); if (b) b.value = el.dataset.n;
    const l = document.querySelector('#modal [data-banco-lista]'); if (l) l.innerHTML = bancosHtml(ctx.state, el.dataset.n);
  },
  calcPfDolar(ctx, d) {
    const monto = amt(d.amount); const dias = Math.max(1, parseInt(d.days, 10) || 30);
    const tna = parseFloat(String(d.tna || '').replace(',', '.')) || 0;
    const venta = amt(d.venta); const compra = amt(d.compra) || venta;
    if (!monto || !tna || !venta) return;
    const pfFinal = monto * (1 + tna / 100 * dias / 365);
    const dolares = monto / venta;
    const equilibrio = pfFinal / dolares; // dólar (compra) al vencimiento que empata
    const suba = equilibrio / compra - 1;
    const subaMes = Math.pow(1 + suba, 30 / dias) - 1;
    const siQueda = dolares * compra;
    const infl = expectedInflation(ctx.state) / 100;
    const inflPlazo = Math.pow(1 + infl, dias / 30) - 1;
    setModalBody('#pd-result', `<div class="result ok">
      <strong>El dólar tiene que estar arriba de ${money(equilibrio)} en ${dias} días</strong>
      <span class="text">Si al vencimiento el dólar (compra) está <b>por debajo de ${money(equilibrio)}</b>, gana el plazo fijo. <b>Por encima</b>, gana el dólar.</span>
      <span class="text">Hoy está a ${money(compra)}: tendría que subir <b>${pctTxt(suba)}</b> en ${dias} días (≈ ${pctTxt(subaMes)} por mes).</span>
      <div class="cuentas-cuotas">
        <div class="split small"><span>Plazo fijo al vencimiento</span><b>${money(pfFinal)}</b></div>
        <div class="split small"><span>Dólares que comprás hoy</span><b>US$ ${(Math.round(dolares * 100) / 100).toLocaleString('es-AR')}</b></div>
        <div class="split small"><span>Si el dólar no se mueve, al venderlos</span><b>${money(siQueda)}</b></div>
      </div>
      <span class="small">Ojo con la diferencia entre compra y venta: si comprás y vendés enseguida, perdés ${money(monto - siQueda)}. La inflación esperada para ese plazo es ${pctTxt(inflPlazo)}: el plazo fijo ${tna / 100 * dias / 365 >= inflPlazo ? 'le gana' : 'no le gana'}.</span>
    </div>`);
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
        <div class="field"><label for="y-d">Plazo (días)</label><input id="y-d" name="days" inputmode="numeric" placeholder="Ej: 30" required></div>
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

