// =========================================================
// Pesitos — importar movimientos
// Del banco o la billetera (Excel o CSV), del resumen de la tarjeta (PDF) o
// pegando el texto. Todo se lee en tu dispositivo: el archivo no se sube.
// Antes de guardar, te muestro todo para revisar y marco los repetidos.
// Librerías en assets/vendor/ (SheetJS y pdf.js).
// =========================================================

import { openModal, setModalBody, toast, icon, closeModal, borrarConDeshacer } from './interfaz.js';
import { medioOptions } from './acciones.js';
import { guessCategory } from './interprete.js';
import { allCategories } from './categorias.js';
import { uid } from './almacenamiento.js';
import { esc, money, normalize, toISO, parseISO } from './formato.js';
import { cuentaPrincipal } from './cuentas.js';

const VENDOR = new URL('../assets/vendor/', import.meta.url).href;
const cargados = {};
function cargarScript(src) {
  if (!cargados[src]) {
    cargados[src] = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok;
      s.onerror = () => { delete cargados[src]; mal(new Error('No pude cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  return cargados[src];
}

// ---------- números y fechas ----------
const MESES = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

/** "-1.234,56", "(1.234,56)", "1.234,56-", "$ 1,234.56", 1234.56 → número con signo */
export function aMonto(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  if (/^[^\d−–-]*[−–-]/.test(s)) neg = true; // "-1.234", "$ -1.234", "−1.234"
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** Fecha de una celda o texto → 'AAAA-MM-DD' (o '') */
export function aFecha(v) {
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return toISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  const s = normalize(String(v || '')).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return armar(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})\b/);
  if (m) return armar(anio(m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[/.\-\s]+([a-z]{3})[a-z]*\.?[/.\-\s]+(\d{2,4})\b/);
  if (m && MESES[m[2]]) return armar(anio(m[3]), MESES[m[2]], +m[1]);
  return '';
}
const anio = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));
function armar(y, mes, d) {
  const f = new Date(y, mes - 1, d);
  return f.getMonth() === mes - 1 && f.getDate() === d && y > 2000 && y < 2100 ? toISO(f) : '';
}

const CUOTA = /\b(?:c(?:uota)?\.?\s*|cta\.?\s*)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i;
const SALTEAR = /\b(saldo|su pago|pago minimo|pago en pesos|pago en dolares|total|subtotal|cierre|vencimiento|limite|tasa|t\.?n\.?a|t\.?e\.?a|c\.?f\.?t|resumen|consumos? de)\b/;

// ---------- texto (PDF o pegado) ----------
/** Líneas de un resumen → movimientos { date, note, amount (con signo), cuota, cuotas } */
export function filasDeTexto(texto) {
  const out = [];
  const FECHA = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s.-]+[a-zA-Z]{3}[a-zA-Z]*\.?[\s.-]+\d{2,4})\s+(.*)$/;
  const MONTO_FIN = /\s(\(?-?\$?\s?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\)?-?)\s*$/;
  for (const raw of String(texto || '').split(/\r?\n/)) {
    const l = raw.replace(/\s+/g, ' ').trim();
    const m = l.match(FECHA);
    if (!m) continue;
    const date = aFecha(m[1]);
    if (!date) continue;
    let resto = ' ' + m[2];
    const mm = resto.match(MONTO_FIN);
    if (!mm) continue;
    const amount = aMonto(mm[1]);
    resto = resto.slice(0, mm.index);
    // si quedó otro monto al final (columna de pesos y de dólares), lo sacamos de la descripción
    resto = resto.replace(/\s\(?-?\$?\s?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\)?-?\s*$/, '');
    let cuota = 0; let cuotas = 1;
    const c = resto.match(CUOTA);
    if (c) { cuota = +c[1]; cuotas = +c[2]; resto = resto.replace(c[0], ' '); }
    const note = limpiarNota(resto);
    if (!amount || !note || SALTEAR.test(normalize(note))) continue;
    out.push({ date, note, amount, cuota, cuotas });
  }
  return out;
}

function limpiarNota(t) {
  let s = String(t || '')
    .replace(/\b\d{5,}\b/g, ' ')            // números de comprobante
    .replace(/\s+/g, ' ').trim()
    .replace(/^[*#K-]\s+/, '')               // marcas del resumen ("*", "K")
    .replace(/^(merpago|mercadopago|mpago|mp|payu\*?ar|dlo|dlocal|pedidosya|rappi)\s?\*\s?(?=\S)/i, (m) => (/rappi|pedidosya/i.test(m) ? m.replace('*', ' ') : ''))
    .trim();
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s*])\p{L}/gu, (c) => c.toUpperCase());
  return s.slice(0, 60);
}

// ---------- planillas (Excel / CSV) ----------
const ROLES = [
  { id: 'fecha', label: 'Fecha', re: /^(fecha|fec\.?|date|dia|fecha (de )?(operacion|movimiento|origen|compra))/ },
  { id: 'desc', label: 'Descripción', re: /(descrip|concepto|detalle|movimiento|comercio|referencia|establecimiento|description)/ },
  { id: 'monto', label: 'Importe (con signo)', re: /^(importe|monto|pesos|\$|importe en pesos|monto en pesos|amount|valor|total)/ },
  { id: 'debito', label: 'Débito (salidas)', re: /(debito|debe|egreso|salida|cargo)/ },
  { id: 'credito', label: 'Crédito (entradas)', re: /(credito|haber|ingreso|entrada|abono)/ },
  { id: 'cuotas', label: 'Cuotas', re: /(cuota)/ },
];

/** Busca la fila de títulos y adivina qué es cada columna. */
export function detectarColumnas(filas) {
  for (let i = 0; i < Math.min(filas.length, 25); i++) {
    const fila = (filas[i] || []).map((c) => normalize(String(c == null ? '' : c)).trim());
    const mapa = {};
    fila.forEach((c, j) => {
      if (!c) return;
      for (const r of ROLES) if (mapa[r.id] === undefined && r.re.test(c) && !Object.values(mapa).includes(j)) { mapa[r.id] = j; break; }
    });
    if (mapa.fecha !== undefined && (mapa.monto !== undefined || mapa.debito !== undefined || mapa.credito !== undefined)) return { cabecera: i, mapa };
  }
  return { cabecera: -1, mapa: {} };
}

export function filasDePlanilla(filas, cabecera, mapa) {
  const out = [];
  for (let i = cabecera + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const date = aFecha(f[mapa.fecha]);
    if (!date) continue;
    let amount = 0;
    if (mapa.monto !== undefined) amount = aMonto(f[mapa.monto]);
    if (!amount && (mapa.debito !== undefined || mapa.credito !== undefined)) {
      const deb = Math.abs(aMonto(f[mapa.debito])); const cre = Math.abs(aMonto(f[mapa.credito]));
      amount = cre ? cre : -deb;
      if (deb && !cre) amount = -deb;
    }
    if (!amount) continue;
    let desc = mapa.desc !== undefined ? String(f[mapa.desc] || '') : '';
    let cuota = 0; let cuotas = 1;
    const txtCuota = mapa.cuotas !== undefined ? String(f[mapa.cuotas] || '') : desc;
    const c = txtCuota.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/);
    if (c && (mapa.cuotas !== undefined || CUOTA.test(desc))) { cuota = +c[1]; cuotas = +c[2]; desc = desc.replace(CUOTA, ' '); }
    const note = limpiarNota(desc) || 'Movimiento';
    if (SALTEAR.test(normalize(note)) && /saldo|total/.test(normalize(note))) continue;
    out.push({ date, note, amount, cuota, cuotas });
  }
  return out;
}

async function leerPlanilla(file) {
  await cargarScript(VENDOR + 'xlsx/xlsx.full.min.js');
  const XLSX = window.XLSX;
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    wb = XLSX.read(txt, { type: 'string', raw: true, cellDates: false });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  }
  let mejor = { filas: [], cabecera: -1, mapa: {} };
  for (const nombre of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '' });
    const d = detectarColumnas(filas);
    if (d.cabecera >= 0) return { filas, ...d };
    if (!mejor.filas.length) mejor = { filas, cabecera: -1, mapa: {} };
  }
  return mejor;
}

async function leerPdf(file) {
  await cargarScript(VENDOR + 'pdf/pdf.min.js');
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf/pdf.worker.min.js';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const lineas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const porY = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!porY.has(y)) porY.set(y, []);
      porY.get(y).push(it);
    }
    [...porY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => lineas.push(items.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str.trim()).join(' ')));
  }
  return lineas.join('\n');
}

// ---------- armar la vista previa ----------
let borrador = null; // { filas: [...], medio, invertir, fuente, planilla? }

function esTarjeta(medio) { return String(medio || '').startsWith('card:'); }

function preparar(s, movs, medio) {
  const tarjeta = esTarjeta(medio);
  const hayNegativos = movs.some((m) => m.amount < 0);
  // tarjeta: positivo = consumo. Cuenta: negativo = gasto (si todo viene en positivo, son gastos)
  const positivoEsGasto = tarjeta || !hayNegativos;
  return movs.map((m) => {
    const gasto = positivoEsGasto ? m.amount > 0 : m.amount < 0;
    const kind = gasto ? 'expense' : 'income';
    const abs = Math.abs(m.amount);
    const cuotas = tarjeta && m.cuotas > 1 ? m.cuotas : 1;
    const total = abs * cuotas;
    const dup = esRepetido(s, kind, m.date, total, abs);
    const omitir = tarjeta && !gasto; // pagos y devoluciones de la tarjeta
    return { ...m, kind, abs, total, cuotas, dup, omitir, category: kind === 'expense' ? guessCategory(m.note, s.learned) : '' };
  });
}

function esRepetido(s, kind, date, total, cuota) {
  const d0 = parseISO(date);
  const cerca = (iso) => Math.abs(parseISO(iso) - d0) <= 3 * 864e5;
  const lista = kind === 'expense' ? s.expenses : s.incomes;
  return lista.some((e) => cerca(e.date) && (Math.abs(e.amount - total) < 1 || Math.abs(e.amount / (e.installments || 1) - cuota) < 1));
}

function vistaPrevia(s) {
  const b = borrador;
  const filas = b.filas;
  const usar = filas.filter((f) => !f.omitir);
  if (!usar.length) {
    return `<div class="result warn"><strong>No encontré movimientos</strong><span class="text">Revisá que el archivo tenga fecha y monto en cada fila.${b.planilla ? ' Podés elegir a mano qué columna es cada cosa.' : ''}</span></div>
      ${b.planilla ? `<button class="btn block" data-action="importarColumnas">Elegir columnas</button>` : ''}
      <button class="btn primary block" data-action="openImportar">Probar con otro archivo</button>`;
  }
  const gastos = usar.filter((f) => f.kind === 'expense');
  const ingresos = usar.filter((f) => f.kind === 'income');
  const dups = usar.filter((f) => f.dup).length;
  const cats = allCategories();
  const fila = (f) => {
    const i = filas.indexOf(f);
    return `<div class="imp-row${f.dup ? ' dup' : ''}">
      <input type="checkbox" name="r${i}" id="imp-r${i}" ${f.dup ? '' : 'checked'} aria-label="Importar ${esc(f.note)}">
      <label for="imp-r${i}" class="imp-main"><b>${esc(f.note)}</b><span class="small muted">${esc(f.date.split('-').reverse().join('/'))}${f.cuotas > 1 ? ` · cuota ${f.cuota || 1} de ${f.cuotas} (total ${money(f.total)})` : ''}${f.dup ? ' · <span class="neg">parece repetido</span>' : ''}</span></label>
      ${f.kind === 'expense' ? `<select name="c${i}" class="mini-select" aria-label="Categoría de ${esc(f.note)}">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === f.category ? 'selected' : ''}>${esc(c.short || c.label)}</option>`).join('')}</select>` : '<span class="small muted">Ingreso</span>'}
      <span class="imp-amt ${f.kind === 'income' ? 'pos' : ''}">${f.kind === 'income' ? '+' : ''}${money(f.cuotas > 1 ? f.abs : f.total)}</span>
    </div>`;
  };
  return `<form class="form" data-submit="importarGuardar">
    <p class="text">Encontré <b>${gastos.length} gasto${gastos.length === 1 ? '' : 's'}</b>${ingresos.length ? ` y <b>${ingresos.length} ingreso${ingresos.length === 1 ? '' : 's'}</b>` : ''}${b.fuente ? ` en <b>${esc(b.fuente)}</b>` : ''}.${dups ? ` Desmarqué ${dups} que ya tenías cargado${dups === 1 ? '' : 's'}.` : ''} Revisá y desmarcá lo que no quieras.</p>
    ${filas.some((f) => f.omitir) ? `<p class="small muted">No incluyo los pagos de la tarjeta ni las devoluciones.</p>` : ''}
    ${gastos.length ? `<h3 class="imp-h">Gastos</h3>${gastos.map(fila).join('')}` : ''}
    ${ingresos.length ? `<h3 class="imp-h">Ingresos</h3>${ingresos.map(fila).join('')}` : ''}
    ${!esTarjeta(b.medio) ? `<button type="button" class="btn ghost small" data-action="importarInvertir">¿Están al revés? Invertir gastos e ingresos</button>` : ''}
    ${b.planilla ? `<button type="button" class="btn ghost small" data-action="importarColumnas">Cambiar qué columna es cada cosa</button>` : ''}
    <button class="btn primary block" type="submit">Importar lo marcado</button>
  </form>`;
}

function formColumnas() {
  const { filas, cabecera, mapa } = borrador.planilla;
  const cab = filas[Math.max(0, cabecera)] || [];
  const ancho = Math.max(...filas.slice(0, 30).map((f) => (f || []).length), 0);
  const opciones = (sel) => `<option value="">—</option>${Array.from({ length: ancho }, (_, j) => `<option value="${j}" ${sel === j ? 'selected' : ''}>Columna ${j + 1}${cab[j] ? `: ${esc(String(cab[j]).slice(0, 24))}` : ''}</option>`).join('')}`;
  const ejemplo = filas.slice(Math.max(0, cabecera) + 1, Math.max(0, cabecera) + 4).map((f) => `<li class="small muted">${(f || []).map((c) => esc(String(c instanceof Date ? toISO(c) : c).slice(0, 18))).join(' | ')}</li>`).join('');
  return `<form class="form" data-submit="importarMapear">
    <p class="text">Decime qué columna es cada cosa:</p>
    <div class="field"><label for="imp-cab">Los títulos están en la fila</label><input id="imp-cab" name="cabecera" inputmode="numeric" value="${cabecera + 1}"></div>
    ${ROLES.map((r) => `<div class="field"><label for="imp-${r.id}">${r.label}</label><select id="imp-${r.id}" name="${r.id}">${opciones(mapa[r.id])}</select></div>`).join('')}
    ${ejemplo ? `<p class="small">Primeras filas:</p><ul class="imp-ej">${ejemplo}</ul>` : ''}
    <button class="btn primary block" type="submit">Seguir</button>
  </form>`;
}

function mostrar(ctx) { setModalBody('#importar-body', vistaPrevia(ctx.state)); }

// ---------- pantalla ----------
export const importarActions = {
  openImportar(ctx, el) {
    const medio = (el && el.dataset && el.dataset.medio) || (ctx.state.cards[0] ? `card:${ctx.state.cards[0].id}` : `acc:${cuentaPrincipal(ctx.state)}`);
    borrador = null;
    openModal('Importar movimientos', `<div id="importar-body">
      <p class="text">Traé de una vez los gastos del <b>resumen de la tarjeta</b> (PDF) o los movimientos que <b>exportás del banco o la billetera</b> (Excel o CSV). Se lee acá en tu dispositivo: el archivo no se sube.</p>
      <div class="field"><label for="imp-medio">¿De dónde son?</label><select id="imp-medio" name="medio">${medioOptions(ctx.state, medio)}</select></div>
      <label class="btn primary block" for="imp-file">${icon('upload', 18)} Elegir archivo</label>
      <input id="imp-file" type="file" accept=".pdf,.csv,.txt,.xlsx,.xls,.ods,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-change="importarArchivo" hidden>
      <details class="imp-pegar"><summary>O pegá el texto del resumen</summary>
        <div class="field"><label for="imp-texto" class="sr-only">Texto</label><textarea id="imp-texto" rows="6" placeholder="12/10/26 SUPERMERCADO DIA 48.500,00&#10;14/10/26 NETFLIX 9.999,00"></textarea></div>
        <button type="button" class="btn block" data-action="importarTexto">Leer texto</button>
      </details>
      <p class="small muted">Una fila por movimiento, con fecha y monto. Las cuotas tipo "C.03/12" las reconozco solas.</p>
    </div>`);
  },
  async importarArchivo(ctx, el) {
    const file = el.files && el.files[0];
    if (!file) return;
    const medio = (document.getElementById('imp-medio') || {}).value || `acc:${cuentaPrincipal(ctx.state)}`;
    setModalBody('#importar-body', `<div class="card"><span class="text"><b>Leyendo ${esc(file.name)}…</b></span></div>`);
    try {
      let movs; let planilla = null;
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') movs = filasDeTexto(await leerPdf(file));
      else {
        planilla = await leerPlanilla(file);
        movs = planilla.cabecera >= 0 ? filasDePlanilla(planilla.filas, planilla.cabecera, planilla.mapa) : filasDeTexto(planilla.filas.map((f) => f.join(' ')).join('\n'));
      }
      borrador = { medio, fuente: file.name, planilla, movs, filas: preparar(ctx.state, movs, medio) };
      if (planilla && planilla.cabecera < 0 && !movs.length) { setModalBody('#importar-body', formColumnas()); return; }
      mostrar(ctx);
    } catch (e) {
      console.warn(e);
      setModalBody('#importar-body', `<div class="result warn"><strong>No pude leer ese archivo</strong><span class="text">Probá exportarlo como Excel o CSV desde tu banco, o pegá el texto del resumen.</span></div><button class="btn primary block" data-action="openImportar">Volver</button>`);
    }
  },
  importarTexto(ctx) {
    const t = (document.getElementById('imp-texto') || {}).value || '';
    const medio = (document.getElementById('imp-medio') || {}).value || `acc:${cuentaPrincipal(ctx.state)}`;
    const movs = filasDeTexto(t);
    borrador = { medio, fuente: '', planilla: null, movs, filas: preparar(ctx.state, movs, medio) };
    mostrar(ctx);
  },
  importarColumnas() { if (borrador && borrador.planilla) setModalBody('#importar-body', formColumnas()); },
  importarMapear(ctx, d) {
    const mapa = {};
    for (const r of ROLES) if (d[r.id] !== '' && d[r.id] !== undefined) mapa[r.id] = Number(d[r.id]);
    if (mapa.fecha === undefined || (mapa.monto === undefined && mapa.debito === undefined && mapa.credito === undefined)) { toast('Elegí al menos la fecha y el importe'); return; }
    const p = borrador.planilla;
    p.mapa = mapa; p.cabecera = Math.max(0, (parseInt(d.cabecera, 10) || 1) - 1);
    borrador.movs = filasDePlanilla(p.filas, p.cabecera, mapa);
    borrador.filas = preparar(ctx.state, borrador.movs, borrador.medio);
    mostrar(ctx);
  },
  importarInvertir(ctx) {
    if (!borrador) return;
    borrador.movs = borrador.movs.map((m) => ({ ...m, amount: -m.amount }));
    borrador.filas = preparar(ctx.state, borrador.movs, borrador.medio);
    mostrar(ctx);
  },
  importarGuardar(ctx, d) {
    if (!borrador) return;
    const [tipo, id] = String(borrador.medio).split(':');
    const elegidas = borrador.filas.map((f, i) => ({ f, i })).filter(({ f, i }) => !f.omitir && d['r' + i]);
    if (!elegidas.length) { toast('No marcaste ninguno'); return; }
    const ng = elegidas.filter(({ f }) => f.kind === 'expense').length; const ni = elegidas.length - ng;
    borrarConDeshacer(ctx, `Importé ${ng} gasto${ng === 1 ? '' : 's'}${ni ? ` y ${ni} ingreso${ni === 1 ? '' : 's'}` : ''} (con la etiqueta #importado)`, (s) => {
      for (const { f, i } of elegidas) {
        if (f.kind === 'income') {
          s.incomes.push({ id: uid(), date: f.date, amount: f.abs, type: 'extra', note: f.note, ...(tipo === 'acc' ? { accountId: id } : {}), tags: ['importado'] });
        } else {
          const category = d['c' + i] || f.category || 'otros';
          s.expenses.push({ id: uid(), date: f.date, amount: Math.round(f.total * 100) / 100, category, note: f.note, installments: tipo === 'card' ? f.cuotas : 1, ...(tipo === 'card' ? { cardId: id } : { accountId: id }), tags: ['importado'] });
        }
      }
    });
    borrador = null;
    closeModal();
  },
};
