// Capa de datos local: la copia rápida de tus datos en este dispositivo.
// Hay una copia por cuenta (pesitos:v1:<uid>). La nube (Firestore) la maneja
// js/sincronizacion.js: cada guardado acá también se envía a tu cuenta.
import { CATEGORY_ALIAS, CAT_DIVIDIDAS, CAT_SEPARADAS } from './categorias.js';
import { guessCategory } from './interprete.js';

const LEGACY_KEY = 'pesitos:v1'; // datos de antes de que existieran las cuentas
let KEY = LEGACY_KEY;

/** Elige la copia local de la cuenta que ingresó. */
export function useAccount(uid) { KEY = uid ? `${LEGACY_KEY}:${uid}` : LEGACY_KEY; }

/** Datos de antes de las cuentas (para subirlos en el primer ingreso). */
export function loadLegacy() {
  try { const raw = localStorage.getItem(LEGACY_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch { return null; }
}
export function clearLegacy() { try { localStorage.removeItem(LEGACY_KEY); } catch { /* nada */ } }
export function hasLocal() { try { return Boolean(localStorage.getItem(KEY)); } catch { return false; } }

export function defaultRules() {
  return {
    payFirst: { on: false, pct: 15 },       // apartar un % al cobrar (se activa al elegir modo de ahorro)
    raiseHalf: { on: false, pct: 50 },      // un % de cada aumento a metas
    r503020: { on: false },                 // al menos 20% de ahorro
    roundup: { on: false, to: 1000 },       // redondeo de cada gasto
    extraPct: { on: false, pct: 30 },       // un % de cada ingreso extra
    custom: [],                             // { id, name, type, value, category?, on }
  };
}

export function emptyState() {
  return {
    version: 3,
    oroGramos: true, // el oro se guarda en gramos (antes, en onzas)
    ready: false,
    demo: false,
    profile: { name: '', payday: 1, paydayVaries: false, focus: '', focusText: '', province: '' },
    savingMode: null, // 'payFirst' | 'leftover' | 'roundup' | 'fixed' | 'none' (lo elige el usuario)
    customCategories: [], // { id, label }
    customWallets: [],    // { id, name, kind }
    weekSeen: '',         // último resumen semanal visto (lunes AAAA-MM-DD)
    lessonsSeen: {},      // lecciones de "Aprendé" ya leídas
    snooze: {},           // { clave: 'AAAA-MM-DD' } tarjetas pospuestas
    settings: { usdRate: 1400, expectedMonthlyInflation: 2, manualRates: {} },
    incomes: [],      // { id, date, amount, type: 'sueldo' | 'extra', note }
    expenses: [],     // { id, date, amount, category, note, installments, cardId?, pending? }
    fixed: [],        // { id, name, amount, lastAmount?, dueDay }
    goals: [],        // { id, name, target, saved, monthly, main? }
    holdings: [],     // { id, type, name, amount, currency }
    transfers: [],    // { id, date, amount, note } plata que pasaste a ahorro
    cards: [],        // { id, name, closeDay, dueDay, limit }
    bills: [],        // pagos programados { id, name, amount, date, repeat, category, saveAhead }
    paid: {},         // pagos hechos { 'tipo:id:período': { date, amount, due, onTime } }
    expectedIncomes: [], // cobros esperados { id, name, amount, date, repeat, account }
    received: {},     // cobros esperados ya recibidos { clave: { date, amount } }
    notifiedOn: '',   // último día en que se mostró el aviso de vencimientos
    wallets: [],      // ids de bancos, billeteras y tarjetas que usás
    ipc: {},          // { 'AAAA-MM': inflación mensual en % }
    rules: defaultRules(),
    setAside: {},     // { 'AAAA-MM': true } si ya apartaste el ahorro del mes
    setAsideSnooze: '',
    challenge: null,  // { id, start }
    customChallenges: [],
    promos: [],       // promos que cargaste a mano { id, name, day, category, pct, cap }
    savedByApp: {},   // { 'AAAA-MM': monto }
    learned: {},      // { palabra: categoría } lo que aprende de tus correcciones
    chat: [],
    asked: {},        // preguntas de "Pesitos quiere saber"
    askLog: null,
    dismissed: {},    // sugerencias de mejora descartadas
    rates: null,      // cotizaciones guardadas
    lastClose: null,  // { date, balance } último cierre semanal
  };
}

export function migrate(data) {
  const base = emptyState();
  const s = {
    ...base, ...data,
    profile: { ...base.profile, ...(data.profile || {}) },
    rules: { ...base.rules, ...(data.rules || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
  };
  for (const k of Object.keys(base.rules)) if (k !== 'custom') s.rules[k] = { ...base.rules[k], ...(s.rules[k] || {}) };
  if (!Array.isArray(s.rules.custom)) s.rules.custom = [];
  if (data.profile && Array.isArray(data.profile.wallets) && !s.wallets.length) s.wallets = [];
  s.holdings = (s.holdings || []).map((h) => ({ ...h, type: h.type === 'dolares' ? 'divisas' : h.type, currency: h.currency || 'ARS' }));
  // Versiones anteriores tenían "Págate primero" activo por defecto, sin que el usuario lo eligiera:
  // se apaga para que primero elija su modo de ahorro.
  if (!s.savingMode && (data.version || 1) < 3) s.rules.payFirst.on = false;
  // oro: de onzas a gramos (una sola vez)
  if (!data.oroGramos) {
    const G = 31.1035;
    s.holdings = s.holdings.map((h) => (h.currency === 'XAU' ? { ...h, amount: Math.round(Number(h.amount || 0) * G * 100) / 100 } : h));
    if (s.rates && s.rates.crypto && s.rates.crypto.XAU) s.rates = { ...s.rates, crypto: { ...s.rates.crypto, XAU: s.rates.crypto.XAU / G } };
    if (s.settings.manualRates && s.settings.manualRates.XAU) s.settings.manualRates = { ...s.settings.manualRates, XAU: s.settings.manualRates.XAU / G };
  }
  s.oroGramos = true;
  // categorías unidas (v21 y v23: quedan 8). Los datos viejos se pasan solos a la nueva.
  const AL = CATEGORY_ALIAS;
  const re = (c) => AL[c] || c;
  for (const l of [s.expenses, s.fixed, s.promos, s.bills, s.misBeneficios, s.customChallenges, (s.rules || {}).custom]) for (const x of l || []) { if (AL[x.category]) x.category = re(x.category); if (AL[x.categoria]) x.categoria = re(x.categoria); }
  for (const k of Object.keys(s.learned || {})) if (AL[s.learned[k]]) s.learned[k] = re(s.learned[k]);
  if (s.presupuestos) { const n = {}; for (const [k, v] of Object.entries(s.presupuestos)) n[re(k)] = (n[re(k)] || 0) + Number(v || 0); s.presupuestos = n; }
  if (s.catPrefs) {
    const u = (l) => [...new Set((l || []).map(re))];
    const antes = new Set(s.catPrefs.eliminadas || []);
    const miembros = (x) => Object.keys(AL).filter((k) => AL[k] === x);
    // una categoría queda eliminada si la habías borrado, o si borraste todas las que se unieron en ella
    const elim = [...new Set([...antes].map(re))].filter((x) => x !== 'otros' && (antes.has(x) || miembros(x).every((k) => antes.has(k))));
    s.catPrefs = { ...s.catPrefs, lista: u(s.catPrefs.lista), ocultas: u(s.catPrefs.ocultas).filter((x) => x !== 'otros'), eliminadas: elim };
  }
  if (s.challenge && AL[s.challenge.category]) s.challenge = { ...s.challenge, category: re(s.challenge.category) };
  if (!data.cats25) separarCategorias(s);
  // v26: el redondeo pasa a ser un extra; la principal queda "lo que sobre"
  if (s.savingMode === 'roundup') { s.savingMode = 'leftover'; s.rules.roundup.on = true; }
  s.version = base.version;
  return s;
}

// v25: "Casa y servicios", "Familia", "Transporte y auto", "Salud y cuidado" y
// "Salidas y compras" se separaron. Cada dato se vuelve a reconocer por lo que dice,
// solo entre las categorías en las que se dividió la suya (una sola vez).
function separarCategorias(s) {
  const D = CAT_DIVIDIDAS;
  const cuenta = {}; // para elegir a dónde van los presupuestos: la más usada
  const nueva = (cat, texto) => {
    if (!D[cat]) return cat;
    let n = guessCategory(texto || '', {}, D[cat]);
    if (n === 'otros' && !D[cat].includes('otros')) n = CAT_SEPARADAS[cat] || cat;
    (cuenta[cat] = cuenta[cat] || {})[n] = (cuenta[cat][n] || 0) + 1;
    return n;
  };
  const texto = (x) => [x.note, x.name, x.nombre, x.merchant, x.comercio].filter(Boolean).join(' ');
  for (const l of [s.expenses, s.fixed, s.promos, s.bills, s.misBeneficios, s.customChallenges, (s.rules || {}).custom]) {
    for (const x of l || []) {
      if (x.category) x.category = nueva(x.category, texto(x));
      if (x.categoria) x.categoria = nueva(x.categoria, texto(x));
      for (const p of x.splits || []) if (p.category) p.category = nueva(p.category, texto(x));
    }
  }
  for (const k of Object.keys(s.learned || {})) if (D[s.learned[k]]) s.learned[k] = nueva(s.learned[k], k);
  const masUsada = (cat) => { const c = cuenta[cat] || {}; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || CAT_SEPARADAS[cat] || cat; };
  if (s.presupuestos) { const n = {}; for (const [k, v] of Object.entries(s.presupuestos)) { const k2 = D[k] ? masUsada(k) : k; n[k2] = (n[k2] || 0) + Number(v || 0); } s.presupuestos = n; }
  if (s.challenge && D[s.challenge.category]) s.challenge = { ...s.challenge, category: masUsada(s.challenge.category) };
  if (s.catPrefs) {
    const SOLO = { casa: ['vivienda', 'servicios', 'hogar', 'suscripciones'], familia: ['educacion', 'mascotas'] }; // las que salieron solo de esa
    const sep = (k) => SOLO[k] || [k];
    const u = (l) => [...new Set((l || []).flatMap(sep))];
    s.catPrefs = { ...s.catPrefs, lista: u(s.catPrefs.lista), ocultas: u(s.catPrefs.ocultas), eliminadas: u(s.catPrefs.eliminadas) };
  }
  s.cats25 = true;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento disponible */ }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* nada */ }
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
