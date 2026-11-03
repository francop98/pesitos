// Herramientas para decidir: ¿me lo compro?, cuotas o contado,
// cuánto ahorrar por mes, cuánto rinde mi plata y conversor.

import { money, MONTHS_LONG, esc } from './formato.js';
import { lastSalary, resumenCuotas } from './calculos.js';
import { BILLETERAS_QUE_RINDEN } from './rendimientos.js';
import { expectedInflation } from './datosvivos.js';
import { parseAmount } from './interprete.js';
import { icon, screenHead, openModal, setModalBody } from './interfaz.js';
import { lessonCard } from './aprender.js';

const GRUPOS = [
  ['Antes de comprar', [
    { action: 'openBuy', icon: 'cart', title: '¿Me lo compro?', text: 'Cómo impacta una compra en tu día, tu mes y tus metas.' },
    { action: 'openInstallments', icon: 'card', title: 'Cuotas o contado', text: 'Con o sin interés, con la inflación: cuánto ganás o perdés de verdad.' },
  ]],
  ['Hacer rendir tu plata', [
    { action: 'openRinde', icon: 'percent', title: '¿Dónde rinde más?', text: 'Billeteras y plazos fijos ordenados por lo que pagan, y cuánto ganás con tu tasa.' },
    { action: 'openPfDolar', icon: 'trend', title: 'Plazo fijo o dólar', text: 'A cuánto tiene que estar el dólar para que convenga más que el plazo fijo.' },
    { action: 'openGoalCalc', icon: 'sprout', title: '¿Cuánto ahorrar por mes?', text: 'Para llegar a un monto en una fecha.' },
  ]],
  ['Monedas', [
    { action: 'openConverter', icon: 'swap', title: 'Conversor de monedas', text: 'Dólar, euro, real, bitcoin y oro, con cotización del día.' },
  ]],
];

export function render(s) {
  return `<section class="screen">
    ${screenHead('Herramientas', '', 'Para decidir mejor antes de gastar')}
    ${GRUPOS.map(([titulo, tools]) => `<div class="section-title"><span>${titulo}</span></div>
    ${tools.map((t) => `<button class="card tool" data-action="${t.action}" style="border:none;text-align:left;flex-direction:row;align-items:center">
      <span class="cat-icon green" style="width:44px;height:44px;border-radius:12px">${icon(t.icon, 22)}</span>
      <span style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-weight:800;font-size:15px">${t.title}</span><span class="small muted">${t.text}</span></span>
      ${icon('chevron', 18)}
    </button>`).join('')}`).join('')}
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

// dólares disponibles (DolarApi): blue, oficial, MEP, CCL, tarjeta, cripto
function tiposDolar(s) {
  const r = s.rates || {};
  const d = r.dolares || {};
  const orden = [['blue', 'Blue'], ['oficial', 'Oficial'], ['bolsa', 'MEP (bolsa)'], ['contadoconliqui', 'Contado con liqui'], ['tarjeta', 'Tarjeta'], ['cripto', 'Cripto']];
  const out = orden.filter(([id]) => d[id]).map(([id, nombre]) => ({ id, nombre, compra: d[id].compra, venta: d[id].venta }));
  if (!out.length && r.USD) out.push({ id: 'blue', nombre: 'Blue', compra: r.USD.compra, venta: r.USD.venta });
  if (!out.length) out.push({ id: 'blue', nombre: 'Blue' });
  return out;
}

// selector de banco: cerrado muestra el elegido; al tocarlo se abre con buscador
function bancoPicker(s, def, { destino = 'pd-t', calc = false } = {}) {
  const pf = Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {});
  if (!pf.length) return '';
  return `<div class="field banco-picker" data-destino="${destino}" ${calc ? 'data-calc="1"' : ''}><span class="label-like">Banco</span>
    <button type="button" class="banco-actual" data-action="pfAbrirBancos"><span data-banco-elegido>${def ? `${esc(nombreBanco(def.entidad))} · <b>${tasaTxt(def.tna)}%</b>` : 'Elegí un banco'}</span>${icon('chevron', 16, 2.4)}</button>
    <div class="banco-panel"><input placeholder="Escribí para buscar (ej: Galicia)" autocomplete="off" data-input="pfFiltrar" aria-label="Buscar banco">
      <div class="ciudad-lista banco-lista" data-banco-lista></div></div>
    <span class="hint">Tasas para clientes que publica el BCRA.</span></div>`;
}

let rindeTab = 'billeteras';
function rindeLista(s, monto) {
  const tasas = (s.rendimientos && s.rendimientos.tasas) || {};
  const filas = rindeTab === 'billeteras'
    ? BILLETERAS_QUE_RINDEN.filter((b) => tasas[b.id]).map((b) => ({ n: b.nombre, tna: Number(tasas[b.id].tna), fecha: tasas[b.id].fecha }))
    : Object.entries((s.rendimientos && s.rendimientos.plazoFijo) || {}).map(([n, v]) => ({ n: nombreBanco(n), tna: Number(v) }));
  filas.sort((a, b) => b.tna - a.tna);
  if (!filas.length) return '<p class="empty">Todavía no pude traer las tasas. Se cargan solas apenas haya conexión.</p>';
  const porDia = (tna) => monto * (Math.pow(1 + tna / 100 / 365, 1) - 1);
  const por30 = (tna) => (rindeTab === 'billeteras' ? monto * (Math.pow(1 + tna / 100 / 365, 30) - 1) : monto * tna / 100 * 30 / 365);
  const at = s.rendimientos && s.rendimientos.at;
  return `<div class="card tight">${filas.map((f, i) => `<div class="row"><span class="rank ${i === 0 ? 'top' : ''}">${i + 1}</span><span class="grow"><span class="name">${esc(f.n)}</span><span class="meta">${tasaTxt(f.tna)}% anual${rindeTab === 'billeteras' ? ` · ${money(porDia(f.tna))} por día` : ''}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end"><span class="amount pos">+${money(por30(f.tna))}</span><span class="small muted">en 30 días</span></span></div>`).join('')}</div>
    <span class="small muted">${rindeTab === 'billeteras' ? 'Las billeteras pagan intereses todos los días (con interés compuesto) y podés sacar la plata cuando quieras. La tasa sale del fondo en el que invierten y cambia día a día.' : 'El plazo fijo paga todo al final y la plata queda inmovilizada esos días. Tasas para clientes que publica el BCRA para cada banco.'} ${at ? `Actualizado ${new Date(at).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : ''}</span>`;
}

function installmentsForm(s, d = {}) {
  const rc = resumenCuotas(s);
  return `<form class="form" data-submit="calcInstallments">
    <div class="field"><label for="iq-p">Precio pagando de contado</label><input id="iq-p" name="price" inputmode="decimal" value="${d.price || ''}" placeholder="Ej: 300.000" required><span class="hint">Lo que pagás en efectivo o transferencia, con el descuento si hay.</span></div>
    <div class="field-row">
      <div class="field"><label for="iq-n">Cuotas</label><input id="iq-n" name="n" inputmode="numeric" value="${d.n || ''}" placeholder="Ej: 6" required></div>
      <div class="field"><label for="iq-c">Valor de cada cuota</label><input id="iq-c" name="cuota" inputmode="decimal" value="${d.cuota || ''}" placeholder="Vacío = sin interés"></div>
    </div>
    <div class="field"><label for="iq-m">¿Cómo pagarías las cuotas?</label><select id="iq-m" name="modo">${opcionesPlata(s).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
      <span class="hint">Si tenés la plata hoy, lo que rinde mientras pagás de a poco también cuenta.</span></div>
    <button class="btn primary block" type="submit">Comparar</button>
  </form><div id="iq-result"></div>
  ${rc.compras ? `<div class="card lime"><strong>Tus compras en cuotas</strong>
    <span class="text">${rc.compras} ${rc.compras === 1 ? 'compra' : 'compras'} por ${money(rc.total)}. Con la inflación, en plata del día en que compraste te salieron <b>${money(rc.pv)}</b>: la inflación te ahorró <b>${money(rc.licuado)}</b>.</span>
    <span class="small muted">Uso la inflación real del INDEC para los meses publicados y la esperada para el resto. Tocá cualquier compra en cuotas en Movimientos para ver su detalle.</span></div>` : ''}`;
}

// tasa mensual que hace que las cuotas valgan lo mismo que el contado (lo que "te cobran" las cuotas)
function tasaImplicita(cash, cuota, n) {
  const vh = (r) => { let pv = 0; for (let k = 1; k <= n; k++) pv += cuota / Math.pow(1 + r, k); return pv; };
  if (Math.abs(vh(0) - cash) < 0.5) return 0;
  let lo = -0.5; let hi = 1.5;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (vh(m) > cash) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// valor de hoy de una serie de cuotas, con la inflación mensual i
const valorHoy = (cuota, n, i) => { let pv = 0; for (let k = 1; k <= n; k++) pv += cuota / Math.pow(1 + i, k); return pv; };

export const actions = {
  openInstallments(ctx, el) { openModal('Cuotas o contado', installmentsForm(ctx.state), { push: !!(el && el.dataset.push) }); },
  calcInstallments(ctx, d) {
    const s = ctx.state;
    const cash = amt(d.price);
    const n = Math.max(1, parseInt(d.n, 10) || 1);
    if (!cash) return;
    const cuota = amt(d.cuota) || cash / n;
    const total = cuota * n;
    const infl = expectedInflation(s); const i = infl / 100;
    const r = tasaImplicita(cash, cuota, n); // por mes
    const recargo = total - cash;
    const resultado = (inf) => cash - valorHoy(cuota, n, inf); // >0: convienen las cuotas (en plata de hoy)
    const gana = resultado(i);
    let veredicto; let detalle;
    if (d.modo === 'sueldo' || !d.modo) {
      veredicto = gana >= 0 ? `Convienen las cuotas: ganás ${money(gana)}` : `Conviene pagar de contado: ahorrás ${money(-gana)}`;
      detalle = `Pagando con tu sueldo de cada mes, las ${n} cuotas de ${money(cuota)} valen hoy <b>${money(valorHoy(cuota, n, i))}</b>. De contado pagás <b>${money(cash)}</b>.`;
    } else {
      const tna = Number(String(d.modo).split(':')[1]) || 0;
      const rr = tna / 100 * 30 / 365;
      let saldo = cash; for (let k = 1; k <= n; k++) saldo = saldo * (1 + rr) - cuota;
      veredicto = saldo >= 0 ? `Convienen las cuotas: te quedan ${money(saldo)}` : `Conviene pagar de contado: con cuotas te faltan ${money(-saldo)}`;
      detalle = `Si en vez de pagar ${money(cash)} de contado dejás esa plata ${tna ? `rindiendo al ${tasaTxt(tna)}% anual` : 'guardada'} y vas sacando ${money(cuota)} por mes, al terminar ${saldo >= 0 ? `te sobran <b>${money(saldo)}</b> (≈ ${money(saldo / Math.pow(1 + i, n))} en plata de hoy)` : `te faltan <b>${money(-saldo)}</b>`}.`;
    }
    // escenarios: ¿y si la inflación cambia?
    const esc3 = [['Si la inflación baja a la mitad', i / 2], ['Con la inflación esperada', i], ['Si la inflación sube 50%', i * 1.5]].map(([l, inf]) => { const v = resultado(inf); return `<div class="split small"><span>${l} (${tasaTxt((inf * 100).toFixed(1))}%/mes)</span><b class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? `Cuotas +${money(v)}` : `Contado +${money(-v)}`}</b></div>`; }).join('');
    const sal = lastSalary(s);
    const fin = (() => { const x = new Date(); x.setMonth(x.getMonth() + n); return `${MONTHS_LONG[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ''}`; })();
    setModalBody('#iq-result', `<div class="result ${gana >= 0 ? 'ok' : 'warn'}">
      <strong>${veredicto}</strong>
      <span class="text">${detalle}</span>
      <span class="text">${r <= 0.0005 ? '<b>Las cuotas no tienen interés</b>' : `Las cuotas te cobran <b>${pctTxt(r)} por mes</b> (${pctTxt(Math.pow(1 + r, 12) - 1, 0)} anual)`}. La inflación esperada es ${tasaTxt(infl)}% por mes: ${r < i ? 'como es mayor, la inflación "paga" parte de las cuotas.' : 'como es menor, el interés le gana a la inflación.'}</span>
    </div>
    <div class="card"><strong>¿Y si la inflación cambia?</strong>${esc3}
      <span class="small muted">${resultado(i / 2) >= 0 && resultado(i * 1.5) >= 0 ? 'Las cuotas convienen en los tres casos: es una decisión segura.' : resultado(i / 2) < 0 && resultado(i * 1.5) < 0 ? 'El contado conviene en los tres casos.' : 'Depende de qué pase con la inflación: si esperás que baje, mejor contado.'}</span></div>
    <div class="card"><strong>En tu bolsillo</strong>
      <div class="split small"><span>Total en cuotas</span><b>${money(total)}</b></div>
      <div class="split small"><span>${recargo > 0.5 ? 'Pagás de más (interés o recargo)' : 'Recargo'}</span><b>${recargo > 0.5 ? `+${money(recargo)} (${pctTxt(recargo / cash)})` : '$0'}</b></div>
      <div class="split small"><span>Cada mes, hasta ${fin}</span><b>${money(cuota)}${sal ? ` · ${Math.max(1, Math.round((cuota / sal.amount) * 100))}% de tu sueldo` : ''}</b></div>
      ${sal && cuota / sal.amount > 0.15 ? '<span class="small">Ojo: la cuota es más del 15% de tu sueldo. Sumada a otras cuotas, puede apretarte el mes.</span>' : ''}
    </div>
    <button class="btn ghost small" data-action="openLesson" data-id="cuotas" data-push="1">¿Cómo se calcula?</button>`);
  },

  openPfDolar(ctx) {
    const s = ctx.state;
    const def = mejorPlazoFijo(s);
    const tipos = tiposDolar(s);
    const t0 = tipos.find((x) => x.id === 'blue') || tipos[0];
    openModal('Plazo fijo o dólar', `<form class="form" data-submit="calcPfDolar">
      <div class="field"><label for="pd-a">¿Cuántos pesos tenés?</label><input id="pd-a" name="amount" inputmode="decimal" placeholder="Ej: 1.000.000" required></div>
      <div class="field-row">
        <div class="field"><label for="pd-d">Plazo (días)</label><input id="pd-d" name="days" inputmode="numeric" value="30"></div>
        <div class="field"><label for="pd-t">Tasa del plazo fijo (TNA %)</label><input id="pd-t" name="tna" inputmode="decimal" value="${def ? tasaTxt(def.tna) : ''}" placeholder="Ej: 32" required></div>
      </div>
      ${bancoPicker(s, def)}
      <div class="field"><label for="pd-tipo">¿Qué dólar comprarías?</label><select id="pd-tipo" name="tipo" data-change="pfTipoDolar">${tipos.map((x) => `<option value="${x.id}" ${x === t0 ? 'selected' : ''}>${esc(x.nombre)}${x.venta ? ` · ${money(x.venta)}` : ''}</option>`).join('')}</select></div>
      <div class="field"><label for="pd-v">Precio al que lo comprás hoy</label><input id="pd-v" name="venta" inputmode="decimal" value="${t0 && t0.venta ? Math.round(t0.venta) : ''}" required>
        <span class="hint" data-pd-hint>${t0 && t0.venta ? 'Se actualiza solo cada 5 minutos (DolarApi). Si te lo venden a otro precio, cambialo.' : 'No pude traer la cotización: escribila.'}</span></div>
      <input type="hidden" name="compra" value="${t0 && t0.compra ? Math.round(t0.compra) : ''}">
      <button class="btn primary block" type="submit">Comparar</button>
    </form><div id="pd-result"></div>`);
  },
  pfTipoDolar(ctx, el) {
    const x = tiposDolar(ctx.state).find((t) => t.id === el.value);
    const f = el.closest('form'); if (!f || !x) return;
    f.venta.value = x.venta ? Math.round(x.venta) : '';
    f.compra.value = x.compra ? Math.round(x.compra) : '';
  },
  pfAbrirBancos(ctx, el) {
    const p = el.closest('.banco-picker'); if (!p) return;
    const abierto = p.classList.toggle('abierto');
    if (abierto) { const i = p.querySelector('input'); if (i) { i.value = ''; p.querySelector('[data-banco-lista]').innerHTML = bancosHtml(ctx.state, ''); setTimeout(() => i.focus(), 50); } p.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  },
  pfFiltrar(ctx, el) { const l = el.closest('.banco-picker')?.querySelector('[data-banco-lista]'); if (l) l.innerHTML = bancosHtml(ctx.state, el.value); },
  pfElegirBanco(ctx, el) {
    const p = el.closest('.banco-picker');
    const i = document.getElementById(p?.dataset.destino || 'pd-t'); if (i) i.value = tasaTxt(el.dataset.v);
    const b = p && p.querySelector('[data-banco-elegido]'); if (b) b.innerHTML = `${esc(el.dataset.n)} · <b>${tasaTxt(el.dataset.v)}%</b>`;
    if (p) p.classList.remove('abierto');
    if (p && p.dataset.calc) actions.calcRinde(ctx);
  },
  calcPfDolar(ctx, d) {
    const monto = amt(d.amount); const dias = Math.max(1, parseInt(d.days, 10) || 30);
    const tna = parseFloat(String(d.tna || '').replace(',', '.')) || 0;
    const venta = amt(d.venta); const compra = amt(d.compra) || venta;
    if (!monto || !tna || !venta) return;
    const pfFinal = monto * (1 + tna / 100 * dias / 365);
    const dolares = monto / venta;
    const equilibrio = pfFinal / dolares; // precio al que tendrías que poder vender cada dólar para empatar
    const suba = equilibrio / compra - 1;
    const subaMes = Math.pow(1 + Math.max(suba, -0.99), 30 / dias) - 1;
    const siQueda = dolares * compra;
    const infl = expectedInflation(ctx.state) / 100;
    const inflPlazo = Math.pow(1 + infl, dias / 30) - 1;
    setModalBody('#pd-result', `<div class="result ok">
      <strong>El dólar tiene que estar arriba de ${money(equilibrio)} en ${dias} días</strong>
      <span class="text">Si cuando vendas tus dólares te pagan <b>menos de ${money(equilibrio)}</b> por cada uno, gana el plazo fijo. <b>Más</b>, gana el dólar.</span>
      <span class="text">Hoy te lo compran a ${money(compra)}: tendría que subir <b>${pctTxt(suba)}</b> en ${dias} días (≈ ${pctTxt(subaMes)} por mes).</span>
      <div class="cuentas-cuotas">
        <div class="split small"><span>Plazo fijo al vencimiento</span><b>${money(pfFinal)}</b></div>
        <div class="split small"><span>Dólares que comprás hoy</span><b>US$ ${(Math.round(dolares * 100) / 100).toLocaleString('es-AR')}</b></div>
        <div class="split small"><span>Si el dólar no se mueve, al venderlos</span><b>${money(siQueda)}</b></div>
      </div>
      <span class="small">${compra < venta ? `Por qué hace falta que suba: el dólar se compra a ${money(venta)} y se vende a ${money(compra)}. Solo por esa diferencia, si comprás y vendés enseguida, perdés ${money(monto - siQueda)}. ` : ''}La inflación esperada para ese plazo es ${pctTxt(inflPlazo)}: el plazo fijo ${tna / 100 * dias / 365 >= inflPlazo ? 'le gana' : 'no le gana'}.</span>
    </div>`);
  },

  // ---------- ¿Dónde rinde más? ----------
  openRinde(ctx) {
    openModal('¿Dónde rinde más?', `<div class="field"><label for="rd-a">Si ponés</label><input id="rd-a" inputmode="decimal" value="1.000.000" data-input="calcRinde"></div>
      <div class="tabs" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button data-action="rindeTab" data-v="billeteras" aria-pressed="${rindeTab === 'billeteras'}">Billeteras (día a día)</button><button data-action="rindeTab" data-v="pf" aria-pressed="${rindeTab === 'pf'}">Plazo fijo (30 días)</button></div>
      <div id="rd-lista">${rindeLista(ctx.state, 1000000)}</div>
      <button class="btn block" data-action="openYield" data-push="1">${icon('percent', 18)} ¿Te ofrecen otra tasa? Calculá cuánto ganás</button>`);
  },
  rindeTab(ctx, el) { rindeTab = el.dataset.v; document.querySelectorAll('#modal [data-action=rindeTab]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); actions.calcRinde(ctx); },
  calcRinde(ctx) { const a = amt(document.getElementById('rd-a')?.value) || 0; setModalBody('#rd-lista', rindeLista(ctx.state, a)); },

  openGoalCalc() {
    const now = new Date();
    const def = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    openModal('¿Cuánto ahorrar por mes?', `<form class="form" data-submit="calcGoal">
      <div class="field"><label for="gc-t">¿Cuánto necesitás?</label><input id="gc-t" name="target" inputmode="decimal" placeholder="Ej: 2.000.000" required></div>
      <div class="field"><label for="gc-d">¿Para cuándo?</label><input id="gc-d" name="when" type="month" value="${def}"></div>
      <div class="field"><label for="gc-h">¿Cuánto ya tenés?</label><input id="gc-h" name="have" inputmode="decimal" placeholder="Ej: 0"></div>
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

  openYield(ctx, el) {
    openModal('¿Cuánto rinde mi plata?', `<form class="form" data-submit="calcYield">
      <div class="field"><label for="y-a">Monto</label><input id="y-a" name="amount" inputmode="decimal" placeholder="Ej: 500.000" required></div>
      <div class="field-row">
        <div class="field"><label for="y-t">Tasa anual (TNA %)</label><input id="y-t" name="tna" inputmode="decimal" placeholder="La que te ofrece tu banco" required></div>
        <div class="field"><label for="y-d">Plazo (días)</label><input id="y-d" name="days" inputmode="numeric" placeholder="Ej: 30" required></div>
      </div>
      <button class="btn primary block" type="submit">Calcular</button>
    </form><div id="y-result"></div>`, { push: !!(el && el.dataset && el.dataset.push) });
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

