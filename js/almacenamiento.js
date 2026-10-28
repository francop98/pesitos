// Capa de datos local: la copia rápida de tus datos en este dispositivo.
// Hay una copia por cuenta (pesitos:v1:<uid>). La nube (Firestore) la maneja
// js/sincronizacion.js: cada guardado acá también se envía a tu cuenta.

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
  s.version = base.version;
  return s;
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
