// =========================================================
// Pesitos — buscar y filtrar movimientos
// Por texto, tipo, categoría, cuenta o tarjeta, etiqueta, fechas y montos.
// =========================================================

import { money, esc, normalize, todayISO, addMonthKey, monthKey } from './formato.js';
import { screenHead, icon } from './interfaz.js';
import { categoriasOrdenadas, catById } from './categorias.js';
import { listaCuentas } from './cuentas.js';
import { expenseRow, incomeRow } from './movimientos.js';
import { descargarCSV } from './exportar.js';

let f = { q: '', tipo: 'todo', cat: '', medio: '', tag: '', desde: '', hasta: '', min: '', max: '' };

export function filtrar(s, filtro = f) {
  const q = normalize(filtro.q || '').trim();
  const min = Number(String(filtro.min || '').replace(/\./g, '').replace(',', '.')) || 0;
  const max = Number(String(filtro.max || '').replace(/\./g, '').replace(',', '.')) || 0;
  const ok = (x, kind) => {
    if (filtro.desde && x.date < filtro.desde) return false;
    if (filtro.hasta && x.date > filtro.hasta) return false;
    if (min && x.amount < min) return false;
    if (max && x.amount > max) return false;
    if (filtro.tag && !(x.tags || []).includes(filtro.tag)) return false;
    if (filtro.medio) {
      const [t, id] = filtro.medio.split(':');
      if (t === 'card' && x.cardId !== id) return false;
      if (t === 'acc' && x.accountId !== id) return false;
    }
    if (filtro.cat && kind === 'e' && x.category !== filtro.cat && !(x.splits || []).some((p) => p.category === filtro.cat)) return false;
    if (filtro.cat && kind === 'i') return false;
    if (q) {
      const hay = normalize([x.note, kind === 'e' ? catById(x.category).label : 'ingreso', (x.tags || []).join(' '), x.shared ? x.shared.with : '', String(Math.round(x.amount))].join(' '));
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };
  const exps = filtro.tipo === 'ingresos' ? [] : s.expenses.filter((e) => !e.pending && ok(e, 'e')).map((e) => ({ ...e, _k: 'e' }));
  const incs = filtro.tipo === 'gastos' ? [] : s.incomes.filter((i) => ok(i, 'i')).map((i) => ({ ...i, _k: 'i' }));
  return [...exps, ...incs].sort((a, b) => b.date.localeCompare(a.date));
}

export const todasLasEtiquetas = (s) => [...new Set([...s.expenses, ...s.incomes].flatMap((x) => x.tags || []))].sort();

export function render(s) {
  const res = filtrar(s);
  const gastos = res.filter((x) => x._k === 'e').reduce((a, x) => a + x.amount, 0);
  const ingresos = res.filter((x) => x._k === 'i').reduce((a, x) => a + x.amount, 0);
  const tags = todasLasEtiquetas(s);
  const hayFiltros = f.cat || f.medio || f.tag || f.desde || f.hasta || f.min || f.max || f.tipo !== 'todo';
  const rangos = [['', 'Siempre'], ['mes', 'Este mes'], ['3m', '3 meses'], ['anio', 'Este año']];
  const rangoActual = !f.desde && !f.hasta ? '' : f.desde === `${monthKey()}-01` && !f.hasta ? 'mes' : f.desde === `${addMonthKey(monthKey(), -2)}-01` && !f.hasta ? '3m' : f.desde === `${todayISO().slice(0, 4)}-01-01` && !f.hasta ? 'anio' : 'otro';
  return `<section class="screen">
    ${screenHead('Buscar movimientos')}
    <form class="quick" data-submit="buscar" role="search" autocomplete="off">
      <label for="bq" class="sr-only">Buscar</label>
      <input id="bq" name="q" value="${esc(f.q)}" placeholder="Ej: coto, nafta, #vacaciones, 48000" data-input="buscarEnVivo" enterkeyhint="search">
      <button type="submit" class="icon-btn green" aria-label="Buscar">${icon('search', 20)}</button>
    </form>
    <div class="tabs" role="group" aria-label="Tipo">${[['todo', 'Todo'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos']].map(([v, l]) => `<button data-action="buscarTipo" data-v="${v}" aria-pressed="${f.tipo === v}">${l}</button>`).join('')}</div>
    <div class="chips">${rangos.map(([v, l]) => `<button class="chip toggle" data-action="buscarRango" data-v="${v}" aria-pressed="${rangoActual === v}">${l}</button>`).join('')}</div>
    <details class="card filtros" ${hayFiltros && (f.cat || f.medio || f.min || f.max || rangoActual === 'otro') ? 'open' : ''}>
      <summary><strong>Más filtros</strong>${hayFiltros ? ' <span class="pill ok">activos</span>' : ''}</summary>
      <form class="form" data-submit="buscarFiltros" style="margin-top:10px">
        <div class="field-row">
          <div class="field"><label for="bf-c">Categoría</label><select id="bf-c" name="cat"><option value="">Todas</option>${categoriasOrdenadas(s, { conOcultas: true }).map((c) => `<option value="${esc(c.id)}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="bf-m">Cuenta o tarjeta</label><select id="bf-m" name="medio"><option value="">Todas</option>${listaCuentas(s).map((c) => `<option value="acc:${esc(c.id)}" ${f.medio === 'acc:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}${s.cards.map((c) => `<option value="card:${esc(c.id)}" ${f.medio === 'card:' + c.id ? 'selected' : ''}>Tarjeta ${esc(c.name)}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="bf-d">Desde</label><input id="bf-d" name="desde" type="date" value="${esc(f.desde)}"></div>
          <div class="field"><label for="bf-h">Hasta</label><input id="bf-h" name="hasta" type="date" value="${esc(f.hasta)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="bf-min">Monto desde</label><input id="bf-min" name="min" inputmode="decimal" value="${esc(f.min)}" placeholder="$"></div>
          <div class="field"><label for="bf-max">Monto hasta</label><input id="bf-max" name="max" inputmode="decimal" value="${esc(f.max)}" placeholder="$"></div>
        </div>
        <div class="btn-row"><button class="btn small primary" type="submit">Aplicar</button><button class="btn small" type="button" data-action="buscarLimpiar">Limpiar</button></div>
      </form>
    </details>
    ${tags.length ? `<div class="chips">${tags.map((t) => `<button class="chip toggle" data-action="buscarTag" data-v="${esc(t)}" aria-pressed="${f.tag === t}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="stat-grid">
      <div class="stat"><span class="k">${res.length} movimiento${res.length === 1 ? '' : 's'}</span><span class="v">${money(gastos)}</span><span class="small muted">en gastos</span></div>
      <div class="stat"><span class="k">Ingresos</span><span class="v pos">${money(ingresos)}</span>${res.length ? `<button class="btn small" data-action="buscarExportar" style="margin-top:4px">${icon('download', 16)} Excel</button>` : ''}</div>
    </div>
    <div class="card tight">${res.length ? res.slice(0, 200).map((x) => (x._k === 'e' ? expenseRow(s, x) : incomeRow(x, s))).join('') + (res.length > 200 ? `<p class="empty">Y ${res.length - 200} más. Afiná la búsqueda para verlos.</p>` : '') : '<p class="empty">No encontré movimientos con esos filtros.</p>'}</div>
  </section>`;
}

export const actions = {
  buscar(ctx, d) { f.q = d.q || ''; ctx.render(); },
  buscarEnVivo(ctx, el) { f.q = el.value; ctx.render(); const i = document.getElementById('bq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
  buscarTipo(ctx, el) { f.tipo = el.dataset.v; ctx.render(); },
  buscarTag(ctx, el) { f.tag = f.tag === el.dataset.v ? '' : el.dataset.v; ctx.render(); },
  buscarRango(ctx, el) {
    const v = el.dataset.v; f.hasta = '';
    f.desde = v === 'mes' ? `${monthKey()}-01` : v === '3m' ? `${addMonthKey(monthKey(), -2)}-01` : v === 'anio' ? `${todayISO().slice(0, 4)}-01-01` : '';
    ctx.render();
  },
  buscarFiltros(ctx, d) { Object.assign(f, { cat: d.cat || '', medio: d.medio || '', desde: d.desde || '', hasta: d.hasta || '', min: d.min || '', max: d.max || '' }); ctx.render(); },
  buscarLimpiar(ctx) { f = { q: f.q, tipo: 'todo', cat: '', medio: '', tag: '', desde: '', hasta: '', min: '', max: '' }; ctx.render(); },
  buscarExportar(ctx) { descargarCSV(ctx.state, filtrar(ctx.state), 'pesitos-busqueda'); },
  // desde otras pantallas: abrir la búsqueda ya filtrada
  buscarCon(ctx, el) { f = { q: '', tipo: 'todo', cat: '', medio: '', tag: '', desde: '', hasta: '', min: '', max: '', ...JSON.parse(el.dataset.filtro || '{}') }; ctx.go('buscar'); },
};
