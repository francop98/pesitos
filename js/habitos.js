// Lo que Pesitos aprende de vos.
// Mira tus últimos meses y semanas (gastos, ingresos, cómo y dónde pagás) y arma
// sugerencias concretas, con un botón para aplicarlas. Todo se calcula en tu
// dispositivo con tus datos: nada sale de la app.
// Devuelve objetos con la misma forma que las sugerencias de js/guia.js:
// { id, titulo, text, yes?: { label, action, data }, impact, why, tipo }

import { money, esc, monthKey, addMonthKey, todayISO, toISO, addDays } from './formato.js';
import { listaCuentas, cuentaPrincipal } from './cuentas.js';
import { monthExpenses, monthIncome, fixedTotal, budget, mainGoal } from './calculos.js';
import { catLabel, catReal } from './categorias.js';
import { merchantKey } from './interprete.js';
import { conQuePagar } from './reintegros.js';

const parte = (e) => (e.installments > 1 ? e.amount / e.installments : e.amount);
const redondo = (v, a = 1000) => Math.max(a, Math.round(v / a) * a);
const GUSTOS = new Set(['comida', 'compras']);
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** Meses completos anteriores al actual con datos cargados (hasta 3). */
function mesesConDatos(s) {
  const mk = monthKey(); const out = [];
  for (let k = 1; k <= 4 && out.length < 3; k++) {
    const m = addMonthKey(mk, -k);
    const hay = s.expenses.some((e) => !e.pending && e.date.slice(0, 7) === m);
    if (hay) out.push(m);
  }
  return out;
}

/** Desde cuándo hay datos (para no sacar conclusiones con una semana de uso). */
function diasDeUso(s) {
  const primero = s.expenses.reduce((a, e) => (!a || e.date < a ? e.date : a), '');
  if (!primero) return 0;
  return Math.round((Date.now() - new Date(primero + 'T12:00:00').getTime()) / 86400000);
}

export function aprendizajes(s) {
  const out = [];
  const dismissed = s.dismissed || {};
  const mk = monthKey();
  const uso = diasDeUso(s);
  if (uso < 21) return out; // con menos de 3 semanas de datos, todavía no hay patrones
  const meses = mesesConDatos(s);
  const push = (x) => { if (!dismissed[x.id]) out.push(x); };
  const g = mainGoal(s);

  // 1. Cuánto podés ahorrar: lo que te sobró los últimos meses sin separarlo
  if (meses.length >= 2) {
    const sobras = meses.map((m) => { const inc = monthIncome(s, m); return { inc, sobra: inc - monthExpenses(s, m).total - fixedTotal(s, m) - (s.transfers || []).filter((t) => t.date.slice(0, 7) === m).reduce((a, t) => a + t.amount, 0) }; }).filter((x) => x.inc > 0);
    if (sobras.length >= 2) {
      const prom = sobras.reduce((a, x) => a + x.sobra, 0) / sobras.length;
      const inc = sobras.reduce((a, x) => a + x.inc, 0) / sobras.length;
      const minimo = Math.min(...sobras.map((x) => x.sobra));
      if (prom > inc * 0.05 && minimo > 0) {
        const prop = redondo(Math.min(prom * 0.7, minimo));
        const yaTiene = (s.rules.custom || []).find((c) => c.id === 'aprendido');
        if (!yaTiene || Math.abs(yaTiene.value - prop) > prop * 0.2) {
          const meses4 = g && g.target > g.saved && prop > 0 ? Math.ceil((g.target - g.saved) / (prop + (g.monthly || 0))) : 0;
          push({ id: `apr-ahorro-${mk}`, tipo: 'ahorro', titulo: 'Podés ahorrar más', impact: prop,
            text: `Los últimos ${sobras.length} meses te sobraron en promedio ${money(prom)} que no separaste. Te propongo apartar ${money(prop)} apenas cobrás: como ya te sobraba, no vas a notar la diferencia.${meses4 ? ` Con eso, "${g.name}" llega en ${meses4 === 1 ? '1 mes' : `${meses4} meses`}.` : ''}`,
            why: 'Calculado con lo que te sobró de verdad, dejando un margen',
            yes: { label: `Ahorrar ${money(prop)} por mes`, action: 'aprAhorro', data: `data-amount="${prop}"` } });
        }
      } else if (prom < -inc * 0.03) {
        push({ id: `apr-deficit-${mk}`, tipo: 'alerta', titulo: 'Estás gastando más de lo que entra', impact: Math.round(-prom),
          text: `Los últimos ${sobras.length} meses gastaste en promedio ${money(-prom)} más de lo que cobraste. Eso sale de ahorros o de deuda. Abajo te marco dónde recortar primero.`,
          why: 'Lo más urgente para tu plata', yes: { label: 'Ver dónde recortar', action: 'goTo', data: 'data-route="#/estadisticas"' } });
      }
    }
  }

  // 2. Tu ritmo real de cada día comparado con el que planeaste
  const b = budget(s);
  if (b.normalDaily > 0 && uso >= 28) {
    const desde = toISO(addDays(new Date(), -28)); const hoy = todayISO();
    const real = s.expenses.filter((e) => !e.pending && !e.fromSavings && e.date >= desde && e.date < hoy && !(e.installments > 1)).reduce((a, e) => a + parte(e), 0) / 28;
    if (real > 0 && real < b.normalDaily * 0.8 && diarioModo(s) !== 'ahorrador') {
      push({ id: `apr-ritmo-bajo-${mk}`, tipo: 'diario', titulo: 'Gastás menos de lo que planeaste', impact: Math.round((b.normalDaily - real) * 30),
        text: `Las últimas 4 semanas gastaste ${money(real)} por día y tu ritmo es ${money(b.normalDaily)}. Te conviene el modo Ahorrador: lo que no gastás va casi todo a ${g ? `"${g.name}"` : 'ahorro'} en vez de acumularse para gastar.`,
        why: 'Así lo que te sobra no se gasta solo', yes: { label: 'Pasar a modo Ahorrador', action: 'aprModo', data: 'data-v="ahorrador"' } });
    } else if (real > b.normalDaily * 1.15) {
      push({ id: `apr-ritmo-alto-${mk}`, tipo: 'alerta', titulo: 'Venís por encima de tu ritmo', impact: Math.round((real - b.normalDaily) * 30),
        text: `Las últimas 4 semanas gastaste ${money(real)} por día, ${Math.round((real / b.normalDaily - 1) * 100)}% más que tu ritmo de ${money(b.normalDaily)}. A este paso te faltan unos ${money((real - b.normalDaily) * 30)} por mes.`,
        why: 'Si seguís así, llegás justo al cobro', yes: null });
    }
  }

  // 3. Categorías: lo habitual de cada una, y un tope donde más te conviene
  if (meses.length >= 2) {
    const porCat = {};
    for (const m of meses) for (const [c0, v] of Object.entries(monthExpenses(s, m).byCat)) { const c = catReal(c0); (porCat[c] = porCat[c] || []).push(v); }
    const actual = monthExpenses(s, mk).byCat;
    const dia = new Date().getDate(); const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const topes = s.presupuestos || {};
    const lista = Object.entries(porCat).filter(([, l]) => l.length >= 2).map(([c, l]) => ({ c, prom: l.reduce((a, v) => a + v, 0) / meses.length, act: Object.entries(actual).filter(([k]) => catReal(k) === c).reduce((a, [, v]) => a + v, 0) }));
    // este mes vas muy arriba en una categoría
    if (dia >= 8) {
      for (const x of lista) {
        const proy = x.act / dia * diasMes;
        if (x.prom > 10000 && proy > x.prom * 1.3 && x.act > x.prom * 0.5) {
          push({ id: `apr-cat-${x.c}-${mk}`, tipo: 'alerta', titulo: `${catLabel(x.c)}: este mes viene alto`, impact: Math.round(proy - x.prom),
            text: `En ${catLabel(x.c).toLowerCase()} solés gastar ${money(x.prom)} por mes y este mes ya vas ${money(x.act)}. A este ritmo terminás en ${money(proy)}: ${money(proy - x.prom)} más que lo habitual.`,
            why: 'Comparado con tus últimos meses',
            yes: topes[x.c] ? null : { label: `Ponerle tope de ${money(redondo(x.prom))}`, action: 'aprTope', data: `data-cat="${esc(x.c)}" data-amount="${redondo(x.prom)}"` } });
          break;
        }
      }
    }
    // el gusto que más pesa, sin tope: bajarlo un 15%
    const gusto = lista.filter((x) => GUSTOS.has(x.c) && !topes[x.c] && x.prom > 20000).sort((a, b2) => b2.prom - a.prom)[0];
    if (gusto) {
      const tope = redondo(gusto.prom * 0.85); const ahorro = Math.round(gusto.prom - tope);
      const dias = g && g.monthly > 0 ? Math.round(ahorro / (g.monthly / 30)) : 0;
      push({ id: `apr-gusto-${gusto.c}`, tipo: 'recorte', titulo: 'Un recorte que casi no se nota', impact: ahorro,
        text: `En ${catLabel(gusto.c).toLowerCase()} gastás en promedio ${money(gusto.prom)} por mes. Si le ponés un tope de ${money(tope)} (un 15% menos), ahorrás ${money(ahorro)} por mes${dias ? ` y "${g.name}" llega ${dias} días antes cada mes` : ''}.`,
        why: 'Los gustos son lo más fácil de ajustar', yes: { label: `Tope de ${money(tope)}`, action: 'aprTope', data: `data-cat="${esc(gusto.c)}" data-amount="${tope}"` } });
    }
  }

  // 4. Compras chicas que se repiten (el mismo lugar muchas veces)
  if (!(s.challenge && s.challenge.id === 'hormiga7')) {
    const desde = toISO(addDays(new Date(), -30)); const grupos = {};
    for (const e of s.expenses) {
      if (e.pending || e.date < desde || e.installments > 1) continue;
      const k = merchantKey(e.note); if (!k) continue;
      (grupos[k] = grupos[k] || []).push(e);
    }
    const rep = Object.entries(grupos).map(([k, l]) => ({ k, l, total: l.reduce((a, e) => a + parte(e), 0) }))
      .filter((x) => x.l.length >= 6 && x.total / x.l.length < 15000 && GUSTOS.has(catReal(x.l[0].category)))
      .sort((a, b2) => b2.total - a.total)[0];
    if (rep) {
      const nombre = rep.l[rep.l.length - 1].note;
      push({ id: `apr-repite-${rep.k}-${mk}`, tipo: 'recorte', titulo: 'Algo que repetís mucho', impact: Math.round(rep.total / 2),
        text: `En los últimos 30 días compraste ${rep.l.length} veces "${nombre}": ${money(rep.total)} en total. Si lo bajás a la mitad, ahorrás unos ${money(rep.total / 2)} por mes. Un desafío ayuda.`,
        why: 'Los gastos chicos repetidos suman mucho', yes: { label: 'Empezar desafío de 7 días', action: 'startChallenge', data: 'data-id="hormiga7"' } });
    }
  }

  // 5. Dónde pagás: un medio tuyo que te devuelve más que el que usás
  {
    const desde = toISO(addDays(new Date(), -60)); const grupos = {};
    for (const e of s.expenses) {
      if (e.pending || e.date < desde) continue;
      const k = merchantKey(e.note); if (!k) continue;
      (grupos[k] = grupos[k] || []).push(e);
    }
    let mejor = null;
    for (const [k, l] of Object.entries(grupos)) {
      if (l.length < 2) continue;
      const ult = l[l.length - 1];
      const prom = l.reduce((a, e) => a + parte(e), 0) / l.length;
      const usado = ult.cardId ? (s.cards || []).find((c) => c.id === ult.cardId) : null;
      const usadoIds = usado ? [usado.banco, usado.marca, `card:${usado.id}`] : [ult.accountId || s.cuentaPrincipal];
      let ops = [];
      try { ops = conQuePagar(s, { texto: ult.note, categoria: ult.category, monto: prom }).filter((o) => o.tuyo && o.wallet !== 'todos'); } catch { ops = []; }
      if (!ops.length) continue;
      const top = ops[0];
      if (usadoIds.includes(top.wallet)) continue;
      const conUsado = ops.find((o) => usadoIds.includes(o.wallet));
      const gana = (top.ahorro - (conUsado ? conUsado.ahorro : 0)) * Math.max(1, Math.round(l.length / 2));
      const v = medioValor(s, top.wallet);
      if (v !== null && gana >= 1000 && (!mejor || gana > mejor.gana)) mejor = { k, ult, top, gana, v };
    }
    if (mejor) {
      push({ id: `apr-medio-${mejor.k}-${mejor.top.wallet}`, tipo: 'medio', titulo: 'Pagando con otro medio, te devuelven más', impact: Math.round(mejor.gana),
        text: `En "${mejor.ult.note}" solés pagar con otro medio. Con ${mejor.top.nombre} (${mejor.top.pct}%${mejor.top.cap ? `, tope ${money(mejor.top.cap)}` : ''}) te devolverían unos ${money(mejor.gana)} por mes. ¿Te lo propongo primero la próxima vez?`,
        why: 'Según las promos vigentes y tus compras de los últimos 2 meses',
        yes: { label: `Usar ${mejor.top.nombre} ahí`, action: 'aprMedio', data: `data-k="${esc(mejor.k)}" data-v="${esc(mejor.v)}"` } });
    }
  }

  // 6. El día de la semana que más gastás (para planear)
  if (uso >= 42) {
    const desde = toISO(addDays(new Date(), -56)); const porDia = [0, 0, 0, 0, 0, 0, 0];
    for (const e of s.expenses) if (!e.pending && e.date >= desde && !(e.installments > 1) && GUSTOS.has(catReal(e.category))) porDia[new Date(e.date + 'T12:00:00').getDay()] += e.amount;
    const tot = porDia.reduce((a, v) => a + v, 0);
    const max = Math.max(...porDia); const d = porDia.indexOf(max);
    const resto = (tot - max) / 6;
    if (tot > 0 && resto > 0 && max > resto * 2) {
      push({ id: `apr-dia-${d}`, tipo: 'info', titulo: 'Tu día más caro', impact: Math.round((max - resto) / 8),
        text: `Los ${DIAS[d]} gastás en salidas, comida afuera y compras ${(max / resto).toFixed(1).replace('.', ',')} veces más que el resto de los días. Si lo planeás antes (cuánto vas a gastar ese día), es más fácil no pasarte.`,
        why: 'Visto en tus últimas 8 semanas', yes: null });
    }
  }

  return out.sort((a, c) => c.impact - a.impact);
}

// el valor que usa el formulario de gasto para ese medio ('' = cuenta principal)
function medioValor(s, wallet) {
  const card = (s.cards || []).find((c) => c.banco === wallet || c.marca === wallet);
  if (card) return `card:${card.id}`;
  if (listaCuentas(s).some((c) => c.id === wallet)) return wallet === cuentaPrincipal(s) ? '' : `acc:${wallet}`;
  return null;
}

const diarioModo = (s) => (s.diario && s.diario.modo) || (s.diario && s.diario.reparto !== undefined ? '' : 'ahorrador');

/** Un resumen de lo que ya sé de vos (para la pantalla del asesor). */
export function loQueSe(s) {
  const out = [];
  const meses = mesesConDatos(s);
  if (meses.length) {
    const prom = meses.reduce((a, m) => a + monthExpenses(s, m).total, 0) / meses.length;
    out.push(`Gastás en promedio <b>${money(prom)}</b> por mes en gastos variables (últimos ${meses.length === 1 ? 'mes' : `${meses.length} meses`}).`);
    const porCat = {};
    for (const m of meses) for (const [c, v] of Object.entries(monthExpenses(s, m).byCat)) porCat[catReal(c)] = (porCat[catReal(c)] || 0) + v / meses.length;
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) out.push(`Lo que más pesa: ${top.map(([c, v]) => `${esc(catLabel(c).toLowerCase())} (${money(v)})`).join(', ')}.`);
  }
  const aprend = Object.keys(s.learned || {}).length;
  if (aprend) out.push(`Reconozco sola la categoría de <b>${aprend}</b> ${aprend === 1 ? 'lugar' : 'lugares'} que corregiste.`);
  const medios = Object.keys(s.medioAprendido || {}).length;
  if (medios) out.push(`Recuerdo con qué pagás en <b>${medios}</b> ${medios === 1 ? 'lugar' : 'lugares'}.`);
  if (!out.length) out.push('Todavía estoy conociéndote. Con 3 semanas de gastos anotados empiezo a darte consejos a tu medida.');
  return out;
}

export const habitosActions = {
  aprAhorro(ctx, el) {
    const v = Math.round(Number(el.dataset.amount) || 0); if (!v) return;
    ctx.commit((s) => {
      s.rules.custom = s.rules.custom || [];
      const r = s.rules.custom.find((c) => c.id === 'aprendido');
      if (r) { r.value = v; r.on = true; } else s.rules.custom.push({ id: 'aprendido', name: 'Lo que te sobraba', type: 'fixedMonthly', value: v, on: true });
      if (el.dataset.sid) s.dismissed[el.dataset.sid] = true;
    });
    import('./interfaz.js').then((m) => m.toast(`Listo: separás ${money(v)} por mes. Lo ves en Mi plata → Plan de ahorro`));
  },
  aprTope(ctx, el) {
    const c = el.dataset.cat; const v = Math.round(Number(el.dataset.amount) || 0); if (!c || !v) return;
    ctx.commit((s) => { s.presupuestos = { ...(s.presupuestos || {}), [c]: v }; if (el.dataset.sid) s.dismissed[el.dataset.sid] = true; });
    import('./interfaz.js').then((m) => m.toast(`Tope de ${money(v)} por mes en ${catLabel(c).toLowerCase()}`));
  },
  aprModo(ctx, el) {
    ctx.commit((s) => { s.diario = { ...(s.diario || {}), modo: el.dataset.v }; if (el.dataset.sid) s.dismissed[el.dataset.sid] = true; });
    import('./interfaz.js').then((m) => m.toast('Listo: modo Ahorrador'));
  },
  aprMedio(ctx, el) {
    ctx.commit((s) => { s.medioAprendido = { ...(s.medioAprendido || {}), [el.dataset.k]: el.dataset.v }; if (el.dataset.sid) s.dismissed[el.dataset.sid] = true; });
    import('./interfaz.js').then((m) => m.toast('Listo: la próxima vez te lo propongo primero'));
  },
};

