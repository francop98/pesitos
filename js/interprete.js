// Entiende frases como "súper 48 lucas", "nafta 30mil ayer",
// "heladera 540000 en 12 cuotas", "cobré sueldo 1,2 palos"
// o el texto de un comprobante: "Pagaste $ 12.500,00 a FARMACITY".

import { allCategories, catReal, CATEGORIES } from './categorias.js';
import { normalize, toISO, addDays } from './formato.js';

const STOP = new Set(['pagaste', 'pague', 'compre', 'gaste', 'gastaste', 'pagamos', 'en', 'a', 'al', 'de', 'del', 'por', 'el', 'la', 'los', 'las', 'con', 'un', 'una', 'para', 'me', 'mi', 'y', 'hoy', 'ayer', 'anteayer', 'cuotas', 'cuota', 'sin', 'interes', 'pesos', 'transferiste', 'enviaste', 'realizaste', 'pago', 'compra', 'cobre', 'me', 'pagaron', 'ingreso', 'ingresaron', 'recibiste', 'recibi']);
const MULT = { luca: 1e3, lucas: 1e3, mil: 1e3, k: 1e3, palo: 1e6, palos: 1e6, millon: 1e6, millones: 1e6 };

function toNumber(raw) {
  let s = raw.replace(/\$/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3}){2,}(\.\d{1,2})?$/.test(s) || /^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s = s.replace(/,/g, ''); // 1,234,567 (formato inglés)
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Monto suelto: "900 lucas", "1,2 palos", "85.000"
export function parseAmount(text) {
  return parseEntry('monto ' + String(text || '')).amount;
}

export function merchantKey(note) {
  const words = normalize(note).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w) && !/^\d/.test(w));
  return words[0] || '';
}

export function guessCategory(text, learned = {}, entre = null) {
  const t = ' ' + normalize(text).replace(/[^a-z0-9&+]+/g, ' ').trim() + ' ';
  const words = t.trim().split(' ').filter(Boolean);
  if (!entre) for (const w of words) if (learned[w]) return catReal(learned[w]);
  // singular simple: "remeras" → "remera", "panaderías" → "panaderia"
  const sing = new Set(words.map((w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)));
  const exactas = new Set(words);
  let mejor = 'otros'; let puntos = 0;
  for (const c of entre ? CATEGORIES.filter((x) => entre.includes(x.id)) : allCategories()) {
    if (c.custom) {
      const l = normalize(c.label);
      if (l && t.includes(' ' + l)) { const p = l.length + 20; if (p > puntos) { puntos = p; mejor = c.id; } }
      continue;
    }
    for (const w of c.words) {
      let p = 0;
      if (w.includes(' ')) { if (t.includes(' ' + w + ' ')) p = w.length + 10; }
      else if (exactas.has(w)) p = w.length + 5;
      else if (sing.has(w)) p = w.length + 3;
      else if (w.length >= 5 && t.includes(w)) p = w.length;
      if (p > puntos) { puntos = p; mejor = c.id; }
    }
  }
  return mejor;
}

export function parseEntry(input, learned = {}) {
  const original = String(input || '').trim();
  let t = normalize(original);
  const result = { kind: 'expense', amount: 0, category: 'otros', note: '', installments: 1, date: toISO(new Date()), incomeType: 'extra' };

  // cuotas
  const cuotas = t.match(/(\d{1,2})\s*cuotas?/);
  if (cuotas) { result.installments = Math.max(1, parseInt(cuotas[1], 10)); t = t.replace(cuotas[0], ' '); }

  // fecha: "ayer", "anteayer", "el lunes", "15/10", "15/10/2026", "el 15"
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const notFuture = (d) => (d > today ? null : d);
  let m;
  if (/\banteayer\b/.test(t)) { result.date = toISO(addDays(today, -2)); t = t.replace(/\banteayer\b/, ' '); }
  else if (/\bayer\b/.test(t)) { result.date = toISO(addDays(today, -1)); t = t.replace(/\bayer\b/, ' '); }
  else if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
    let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && d > today) d = new Date(y - 1, Number(m[2]) - 1, Number(m[1]));
    if (notFuture(d) && d.getDate() === Number(m[1])) { result.date = toISO(d); t = t.replace(m[0], ' '); }
  } else if ((m = t.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+pasado)?\b/))) {
    const idx = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].indexOf(m[1]);
    let back = (today.getDay() - idx + 7) % 7; if (back === 0) back = 7;
    result.date = toISO(addDays(today, -back)); t = t.replace(m[0], ' ');
  } else if ((m = t.match(/\bel\s+(\d{1,2})\b(?!\s*cuotas?)/))) {
    let d = new Date(today.getFullYear(), today.getMonth(), Number(m[1]));
    if (d > today) d = new Date(today.getFullYear(), today.getMonth() - 1, Number(m[1]));
    if (d.getDate() === Number(m[1])) { result.date = toISO(d); t = t.replace(m[0], ' '); }
  }

  // ingresos
  if (/^\s*\+|\b(cobre|me pagaron|ingreso|ingresaron|recibi|recibiste|sueldo|aguinaldo|vendi|venta|bono)\b/.test(t)) {
    result.kind = 'income';
    result.incomeType = /\bsueldo\b/.test(t) ? 'sueldo' : 'extra';
  }

  // monto: el número con multiplicador gana; si no, el más grande
  const re = /\$?\s*(\d[\d.,]*)\s*(lucas?|mil|k|palos?|millon(?:es)?)?\b/g;
  let best = 0; let bestText = '';
  for (const m of t.matchAll(re)) {
    let n = toNumber(m[1]);
    if (m[2]) n *= MULT[m[2]] || 1;
    if (m[2] && n > 0) { best = n; bestText = m[0]; break; }
    if (n > best) { best = n; bestText = m[0]; }
  }
  result.amount = best >= 100 ? Math.round(best) : Math.round(best * 1e6) / 1e6;
  if (bestText) t = t.replace(bestText, ' ');

  // descripción
  const words = t.split(/[^a-z0-9ñ]+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  const note = words.join(' ').trim();
  result.note = note ? note.charAt(0).toUpperCase() + note.slice(1) : (result.kind === 'income' ? 'Ingreso' : 'Gasto');
  if (result.kind === 'expense') result.category = guessCategory(original, learned);
  return result;
}
