// =========================================================
// Pesitos — foto del ticket
// Lee el ticket EN TU DISPOSITIVO (Tesseract, sin mandar la foto a ningún lado),
// busca el total, la fecha y el comercio, y te deja revisar antes de guardar.
// Las librerías están en assets/vendor/ (no dependen de servicios de terceros).
// =========================================================

import { openModal, setModalBody, toast, icon } from './interfaz.js';
import { entryForm } from './acciones.js';
import { guessCategory } from './interprete.js';
import { esc, normalize, toISO } from './formato.js';

const BASE = new URL('../assets/vendor/tesseract/', import.meta.url).href;
let cargando = null;

function cargarScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => mal(new Error('No pude cargar ' + src));
    document.head.appendChild(s);
  });
}

async function lector() {
  if (!cargando) {
    cargando = (async () => {
      if (!window.Tesseract) await cargarScript(BASE + 'tesseract.min.js');
      return window.Tesseract.createWorker('spa', 1, {
        workerPath: BASE + 'worker.min.js',
        corePath: BASE,
        langPath: BASE.replace(/\/$/, ''),
        workerBlobURL: false,
        cacheMethod: 'none', // el service worker ya lo guarda
      });
    })().catch((e) => { cargando = null; throw e; });
  }
  return cargando;
}

/** Achica y pasa a grises la foto: lee mejor y mucho más rápido. */
async function prepararImagen(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const max = 1800;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.filter = 'grayscale(1) contrast(1.35)';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b || file), 'image/png'));
}

// ---------- interpretar el texto del ticket ----------
const MONTO = /\$?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/g;
function aNumero(raw) {
  let s = raw.replace(/[$\s]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
const montosDe = (linea) => [...linea.matchAll(MONTO)].map((m) => aNumero(m[1])).filter((n) => n > 0);

const NO_COMERCIO = /\b(cuit|c\.?u\.?i\.?t|iva|responsable|inscripto|monotributo|ticket|factura|fecha|hora|caja|cajero|ing\.?\s*br|ingresos brutos|inicio de act|domicilio|tel|consumidor final|nro|p\.?v\.?|cae|original|comprobante|cant|precio|descripcion)\b/;

/** Del texto de un ticket saca { amount, date, merchant }. */
export function parsearTicket(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const norm = lineas.map((l) => normalize(l));

  // total: la última línea con "total" (que no sea subtotal), o "a pagar" / "importe"
  let amount = 0;
  for (let i = norm.length - 1; i >= 0 && !amount; i--) {
    if (/\b(total|a pagar|importe total|tot\.?)\b/.test(norm[i]) && !/sub\s*-?\s*total|total (items|articulos|unidades)|total iva/.test(norm[i])) {
      const ms = montosDe(lineas[i]);
      if (ms.length) amount = ms[ms.length - 1];
      else if (lineas[i + 1]) { const sig = montosDe(lineas[i + 1]); if (sig.length) amount = sig[sig.length - 1]; }
    }
  }
  if (!amount) { // sin "total": el monto con decimales más alto
    const todos = lineas.flatMap((l) => [...l.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}(?!\d)/g)].map((m) => aNumero(m[0])));
    amount = todos.length ? Math.max(...todos) : 0;
  }

  // fecha
  let date = '';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  for (const l of lineas) {
    const m = l.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    if (!m) continue;
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (d.getDate() === Number(m[1]) && d <= hoy && hoy - d < 400 * 864e5) { date = toISO(d); break; }
  }

  // comercio: una de las primeras líneas con letras, que no sea dato fiscal
  let merchant = '';
  for (let i = 0; i < Math.min(lineas.length, 8); i++) {
    const l = lineas[i];
    const letras = (l.match(/[a-záéíóúñ]/gi) || []).length;
    if (letras < 3 || letras < l.length * 0.5 || NO_COMERCIO.test(norm[i])) continue;
    merchant = l.replace(/[^\p{L}\p{N}&.' -]/gu, '').replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?)$/i, '').trim();
    if (merchant.length >= 3) break;
  }
  if (merchant === merchant.toUpperCase()) merchant = merchant.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return { amount: Math.round(amount * 100) / 100, date, merchant };
}

// ---------- pantalla ----------
export function abrirTicket() {
  openModal('Foto del ticket', `<div id="ticket-body">
    <p class="text">Sacale una foto al ticket (o elegí una de la galería). Lo leo acá en tu celular: la foto no se sube a ningún lado.</p>
    <label class="btn primary block" for="ticket-cam">${icon('camera', 18)} Sacar foto</label>
    <input id="ticket-cam" type="file" accept="image/*" capture="environment" data-change="ticketFoto" hidden>
    <label class="btn block" for="ticket-gal">Elegir de la galería</label>
    <input id="ticket-gal" type="file" accept="image/*" data-change="ticketFoto" hidden>
    <p class="small muted">Tip: con buena luz, el ticket estirado y que se vea el TOTAL.</p>
  </div>`);
}

export const ticketActions = {
  openTicket() { abrirTicket(); },
  async ticketFoto(ctx, el) {
    const file = el.files && el.files[0];
    if (!file) return;
    setModalBody('#ticket-body', `<div class="card"><span class="text"><b>Leyendo el ticket…</b></span><span class="small muted" id="ticket-prog">La primera vez tarda un poco más (bajo el lector, unos 6 MB).</span></div>`);
    try {
      const [w, img] = await Promise.all([lector(), prepararImagen(file)]);
      const { data } = await w.recognize(img);
      const r = parsearTicket(data.text);
      if (!r.amount) {
        setModalBody('#ticket-body', `<div class="result warn"><strong>No encontré el total</strong><span class="text">Probá con otra foto, más cerca y con buena luz. O cargalo a mano.</span></div>
          <button class="btn primary block" data-action="openTicket">Probar de nuevo</button>
          <button class="btn block" data-action="newEntry" data-kind="expense">Cargar a mano</button>`);
        return;
      }
      const draft = { amount: r.amount, date: r.date || toISO(new Date()), note: r.merchant || 'Compra', category: guessCategory(r.merchant || '', ctx.state.learned) };
      setModalBody('#ticket-body', `<p class="text">Esto leí del ticket${r.merchant ? ` de <b>${esc(r.merchant)}</b>` : ''}. Revisalo y guardalo:</p>${entryForm(ctx.state, draft, 'expense')}`);
    } catch (e) {
      console.warn(e);
      setModalBody('#ticket-body', `<div class="result warn"><strong>No pude leer la foto</strong><span class="text">Revisá tu conexión (la primera vez tengo que bajar el lector) y probá de nuevo.</span></div>
        <button class="btn primary block" data-action="openTicket">Probar de nuevo</button>`);
    }
  },
};
