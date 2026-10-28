// =========================================================
// Pesitos — día de cobro y días hábiles (con feriados de Argentina)
// Feriados: ArgentinaDatos (api.argentinadatos.com/v1/feriados/AAAA),
// se bajan solos y quedan guardados. Sin conexión, cuenta solo los fines de semana.
//
// Formas de cobrar (profile.payRule):
//   { tipo: 'dia', dia: 5 }          el 5 de cada mes (si el mes es más corto, el último día)
//   { tipo: 'habil', n: 4 }          el 4.º día hábil del mes
//   { tipo: 'ultimoHabil' }          el último día hábil del mes
//   { tipo: 'ultimo' }               el último día del mes
//   { tipo: 'varia' }                varía: se toma fin de mes como referencia
// =========================================================

const TTL = 7 * 24 * 60 * 60 * 1000;
let cargando = false;
let cache = {}; // { 'AAAA': Set de 'AAAA-MM-DD' }

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function usarFeriados(s) {
  cache = {};
  for (const [y, list] of Object.entries((s.feriados && s.feriados.years) || {})) cache[y] = new Set(list);
}

export async function refreshFeriados(ctx) {
  const f = ctx.state.feriados;
  const y = new Date().getFullYear();
  const faltan = [y, y + 1].filter((x) => !(f && f.years && f.years[x]));
  // si faltan años se reintenta cada 30 minutos (no en cada pantalla), si no, una vez por semana
  if (cargando || (f && Date.now() - f.at < (faltan.length ? 30 * 60 * 1000 : TTL))) return;
  cargando = true;
  const years = { ...((f && f.years) || {}) };
  for (const year of [y, y + 1]) {
    try {
      const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${year}`, { headers: { Accept: 'application/json' } });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) years[year] = j.map((x) => x.fecha).filter(Boolean); }
    } catch { /* sin conexión */ }
  }
  cargando = false;
  const cambio = JSON.stringify(years) !== JSON.stringify((f && f.years) || {});
  if (cambio || !f) ctx.update((s) => { s.feriados = { at: Date.now(), years }; });
  else ctx.state.feriados.at = Date.now(); // sin cambios: no hace falta redibujar
}

export function esHabil(d) {
  const w = d.getDay();
  if (w === 0 || w === 6) return false;
  const set = cache[d.getFullYear()];
  return !(set && set.has(iso(d)));
}

/** Regla de cobro de un perfil (compatible con el viejo "payday"). */
export function reglaDeCobro(profile = {}) {
  if (profile.payRule && profile.payRule.tipo) return profile.payRule;
  if (profile.paydayVaries) return { tipo: 'varia' };
  const d = Number(profile.payday) || 1;
  return d >= 31 ? { tipo: 'ultimo' } : { tipo: 'dia', dia: d };
}

/** Fecha de cobro de un mes (m: 0 a 11). */
export function fechaDeCobro(profile, y, m) {
  const r = reglaDeCobro(profile);
  const ultimo = new Date(y, m + 1, 0);
  switch (r.tipo) {
    case 'habil': {
      let n = 0;
      for (let d = new Date(y, m, 1); d <= ultimo; d.setDate(d.getDate() + 1)) if (esHabil(d) && ++n === (r.n || 1)) return new Date(d);
      return ultimo;
    }
    case 'ultimoHabil': {
      for (let d = new Date(ultimo); d.getDate() >= 1 && d.getMonth() === m; d.setDate(d.getDate() - 1)) if (esHabil(d)) return new Date(d);
      return ultimo;
    }
    case 'ultimo':
    case 'varia': return ultimo;
    default: return new Date(y, m, Math.min(r.dia || 1, ultimo.getDate()));
  }
}

const ORD = ['', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
/** "el 5 de cada mes", "el 4.º día hábil", "el último día hábil"… */
export function textoDeCobro(profile) {
  const r = reglaDeCobro(profile);
  switch (r.tipo) {
    case 'habil': return `el ${ORD[r.n] || `${r.n}.º`} día hábil del mes`;
    case 'ultimoHabil': return 'el último día hábil del mes';
    case 'ultimo': return 'el último día del mes';
    case 'varia': return 'en una fecha que varía';
    default: return `el ${r.dia} de cada mes`;
  }
}

const NUM = { primer: 1, primero: 1, '1er': 1, uno: 1, segundo: 2, dos: 2, tercer: 3, tercero: 3, tres: 3, cuarto: 4, cuatro: 4, quinto: 5, cinco: 5, sexto: 6, seis: 6, septimo: 7, siete: 7, octavo: 8, ocho: 8, noveno: 9, nueve: 9, decimo: 10, diez: 10 };
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Entiende lo que escribe la gente: "último día hábil", "4to día hábil", "el 5", "fin de mes", "primer día hábil". */
export function entenderCobro(texto) {
  const t = norm(texto).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/var[ií]a|cambia|no tengo|distint/.test(t)) return { tipo: 'varia' };
  const habil = /h[aá]bil|habiles|laborable/.test(t);
  if (/ultimo|fin de mes|final/.test(t)) return habil ? { tipo: 'ultimoHabil' } : { tipo: 'ultimo' };
  const n = (t.match(/(\d{1,2})/) || [])[1];
  const palabra = Object.keys(NUM).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  if (habil) {
    const v = n ? Number(n) : palabra ? NUM[palabra] : 1;
    return v >= 1 && v <= 22 ? { tipo: 'habil', n: v } : null;
  }
  if (n) { const d = Number(n); if (d >= 1 && d <= 31) return d === 31 ? { tipo: 'ultimo' } : { tipo: 'dia', dia: d }; }
  if (/primer|principio|inicio|comienzo/.test(t)) return { tipo: 'dia', dia: 1 };
  return null;
}
