// =========================================================
// Pesitos — guía de inversiones: plazo fijo, fondos, cauciones, letras (LECAP),
// bonos, obligaciones negociables, acciones, CEDEARs, dólar MEP y cripto.
// Es material educativo, no una recomendación personal.
// Tasas de letras en vivo: ArgentinaDatos /v1/finanzas/letras (gratis, se actualiza
// en cada día hábil). Se guarda 6 horas en el dispositivo.
// =========================================================

import { pesos as money, esc } from './formato.js';
import { openModal, setModalBody } from './interfaz.js';
import { expectedInflation } from './datosvivos.js';

const URL_LETRAS = 'https://api.argentinadatos.com/v1/finanzas/letras';
const K_LETRAS = 'pesitos_letras';
const TTL = 6 * 60 * 60 * 1000;

// riesgo 1 (muy bajo) a 5 (muy alto)
export const INSTRUMENTOS = [
  { id: 'pf', nombre: 'Plazo fijo', grupo: 'Renta fija en pesos', riesgo: 1, plazo: '30 días o más', moneda: 'Pesos', donde: 'Tu banco o billetera', que: 'Prestás tu plata al banco a una tasa fija. Está cubierto por el seguro de depósitos hasta el tope vigente.', ojo: 'No podés disponer de ella antes del vencimiento (salvo el precancelable).' },
  { id: 'mm', nombre: 'Fondo money market', grupo: 'Renta fija en pesos', riesgo: 1, plazo: 'Disponible al instante', moneda: 'Pesos', donde: 'Billeteras (Mercado Pago, Ualá, Personal Pay…) y bancos', que: 'Es lo que usan las cuentas remuneradas: un fondo que invierte en plazos fijos y cauciones de muy corto plazo. Rinde todos los días.', ojo: 'La tasa cambia día a día. No es un depósito: no tiene seguro de depósitos.' },
  { id: 'caucion', nombre: 'Caución', grupo: 'Renta fija en pesos', riesgo: 1, plazo: '1 a 30 días', moneda: 'Pesos', donde: 'Una cuenta en un broker (ALyC)', que: 'Prestás pesos a otros inversores en la bolsa, con garantía de títulos. Es como un plazo fijo cortito.', ojo: 'El broker cobra una comisión que en plazos muy cortos se come parte de la ganancia.' },
  { id: 'lecap', nombre: 'Letras del Tesoro (LECAP)', grupo: 'Renta fija en pesos', riesgo: 2, plazo: '1 a 12 meses', moneda: 'Pesos', donde: 'Broker (ALyC) o la app de inversiones de tu banco', que: 'Le prestás al Estado nacional a tasa fija: comprás hoy a un precio y al vencimiento cobrás un monto conocido. Se pueden vender antes en la bolsa.', ojo: 'Si las vendés antes, el precio puede ser mayor o menor al que pagaste.' },
  { id: 'cer', nombre: 'Bonos que ajustan por inflación (CER)', grupo: 'Renta fija en pesos', riesgo: 2, plazo: '6 meses a varios años', moneda: 'Pesos', donde: 'Broker (ALyC)', que: 'Su capital se ajusta por inflación (índice CER) y además pagan una tasa. Protegen tu poder de compra.', ojo: 'Si la inflación baja más de lo esperado, rinden menos que una tasa fija.' },
  { id: 'soberanos', nombre: 'Bonos en dólares del Estado', grupo: 'Renta fija en dólares', riesgo: 4, plazo: 'Varios años', moneda: 'Dólares', donde: 'Broker (ALyC)', que: 'Bonos de la deuda argentina (los "Globales" y "Bonares"). Pagan intereses y devuelven capital en dólares, cada 6 meses.', ojo: 'El precio sube y baja con el riesgo país. Argentina ya reestructuró su deuda varias veces.' },
  { id: 'on', nombre: 'Obligaciones negociables (ON)', grupo: 'Renta fija en dólares', riesgo: 3, plazo: '1 a 10 años', moneda: 'Dólares (algunas en pesos)', donde: 'Broker (ALyC)', que: 'Préstamos a empresas (petroleras, bancos, energéticas). Pagan intereses en dólares, en general cada 3 o 6 meses.', ojo: 'Depende de que la empresa pague. Conviene repartir entre varias empresas.' },
  { id: 'mep', nombre: 'Dólar MEP', grupo: 'Dólares', riesgo: 2, plazo: 'Cuando quieras', moneda: 'Dólares', donde: 'Home banking o broker', que: 'La forma legal de comprar dólares a precio de mercado, a través de la compra y venta de un bono.', ojo: 'Los dólares quietos no rinden: se pueden poner en ONs o plazo fijo en dólares.' },
  { id: 'acciones', nombre: 'Acciones argentinas', grupo: 'Renta variable', riesgo: 5, plazo: 'Largo (3 años o más)', moneda: 'Pesos', donde: 'Broker (ALyC)', que: 'Comprás una parte de una empresa que cotiza en Bolsa (YPF, Galicia, Pampa…). Ganás si sube el precio y con los dividendos.', ojo: 'Pueden bajar mucho en poco tiempo. Solo con plata que no vas a necesitar.' },
  { id: 'cedear', nombre: 'CEDEARs', grupo: 'Renta variable', riesgo: 4, plazo: 'Largo (3 años o más)', moneda: 'Pesos (siguen al dólar)', donde: 'Broker (ALyC) o app de tu banco', que: 'Certificados que representan acciones o fondos del exterior (Apple, Coca-Cola, el índice S&P 500) y se compran en pesos.', ojo: 'Suben y bajan con la acción y con el dólar CCL. Los fondos de índice (como SPY) reparten mejor el riesgo.' },
  { id: 'cripto', nombre: 'Cripto y dólares digitales', grupo: 'Alternativas', riesgo: 5, plazo: 'Variable', moneda: 'Dólares digitales / cripto', donde: 'Exchanges registrados ante la CNV', que: 'Las stablecoins (USDT, USDC) siguen al dólar; bitcoin y el resto son muy volátiles.', ojo: 'No tienen garantía de ningún Estado. Usá solo exchanges registrados en la CNV.' },
];

const riesgoTxt = ['', 'Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];
const barraRiesgo = (r) => `<span class="riesgo r${r}" aria-label="Riesgo ${riesgoTxt[r].toLowerCase()}"><span class="riesgo-k">Riesgo</span>${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= r ? 'on' : ''}"></i>`).join('')}<b>${riesgoTxt[r]}</b></span>`;
// qué quiere decir cada nivel de riesgo
const RIESGO_EXPLICA = `<details class="card riesgo-ayuda"><summary><strong>¿Qué es "Riesgo: muy bajo, medio, alto"?</strong></summary>
  <span class="small">Es la chance de que <b>pierdas plata</b> o de que valga menos cuando la necesites:</span>
  <span class="small">${barraRiesgo(1)} Casi no puede bajar. Sabés de antemano cuánto ganás.</span>
  <span class="small">${barraRiesgo(2)} Ganancia bastante segura, pero el precio se mueve un poco si vendés antes.</span>
  <span class="small">${barraRiesgo(3)} Depende de que una empresa pague. Puede bajar algo en el camino.</span>
  <span class="small">${barraRiesgo(4)} Puede bajar bastante en semanas (por el riesgo país o el dólar).</span>
  <span class="small">${barraRiesgo(5)} Puede subir o bajar mucho, incluso a la mitad. Solo con plata que no vas a usar en años.</span>
</details>`;

// ---------- simulación con tu monto ----------
let est = null; // estado de la app (para tasas, dólar e inflación)
const tasaPF = () => { const pf = Object.entries((est && est.rendimientos && est.rendimientos.plazoFijo) || {}).sort((a, b) => b[1] - a[1]); return pf.length ? { banco: pf[0][0], tna: Number(pf[0][1]) } : null; };
const tasaMM = () => { const t = Object.entries((est && est.rendimientos && est.rendimientos.tasas) || {}).filter(([, v]) => v && v.tna).sort((a, b) => b[1].tna - a[1].tna); return t.length ? Number(t[0][1].tna) : 0; };
const mep = () => { const r = (est && est.rates) || {}; return ((r.dolares || {}).bolsa || {}).venta || (r.USD || {}).venta || 0; };
const usdTxt = (v) => `US$ ${Math.round(v).toLocaleString('es-AR')}`;
const nombreB = (n) => n.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
function simulacion(i, M) {
  if (!M) return '';
  const linea = (t) => `<div class="inv-sim"><span class="small"><b>Con ${money(M)}:</b> ${t}</span></div>`;
  const g = (tna, dias) => M * tna / 100 * dias / 365;
  switch (i.id) {
    case 'pf': { const t = tasaPF(); return t ? linea(`en 30 días ganarías <b>${money(g(t.tna, 30))}</b> (${String(t.tna).replace('.', ',')}% anual, ${esc(nombreB(t.banco))}, la mejor tasa de hoy).`) : ''; }
    case 'mm': { const t = tasaMM(); return t ? linea(`ganarías unos <b>${money(g(t, 1))} por día</b> y ${money(g(t, 30))} en un mes (la billetera que más paga hoy, ${String(t).replace('.', ',')}% anual).`) : ''; }
    case 'caucion': { const t = tasaPF(); return t ? linea(`suele pagar parecido al plazo fijo: en 30 días, algo menos de ${money(g(t.tna, 30))} después de la comisión del broker.`) : ''; }
    case 'cer': { const inf = est ? expectedInflation(est) : 0; return inf ? linea(`si la inflación va a ${String(inf).replace('.', ',')}% por mes, en 6 meses tu plata se ajusta a ≈ <b>${money(M * Math.pow(1 + inf / 100, 6))}</b>, más la tasa del bono.`) : ''; }
    case 'soberanos': case 'on': case 'mep': { const v = mep(); return v ? linea(`comprás ≈ <b>${usdTxt(M / v)}</b> (dólar MEP a ${money(v)}).${i.id === 'mep' ? '' : ' Esos dólares cobran intereses en dólares.'}`) : ''; }
    case 'acciones': case 'cedear': case 'cripto': {
      const [sube, baja] = i.riesgo >= 5 ? [0.4, 0.4] : [0.25, 0.25];
      return linea(`si sube ${Math.round(sube * 100)}% tendrías ${money(M * (1 + sube))}; si baja ${Math.round(baja * 100)}%, ${money(M * (1 - baja))}. Es un ejemplo de cuánto se puede mover en un año, no un pronóstico.`);
    }
    default: return '';
  }
}

// ---------- letras en vivo ----------
function letrasGuardadas() {
  try { const x = JSON.parse(localStorage.getItem(K_LETRAS) || 'null'); return x && Array.isArray(x.letras) ? x : null; } catch { return null; }
}
const pct = (x) => { const v = Number(x); return Number.isFinite(v) ? (Math.abs(v) <= 1.5 ? v * 100 : v) : NaN; };
function normalizar(raw) {
  const lista = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.letras) ? raw.letras : []);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return lista.map((l) => {
    const vto = String(l.fechaVencimiento || l.vencimiento || '').slice(0, 10);
    const [y, m, d] = vto.split('-').map(Number);
    const dias = y ? Math.round((new Date(y, m - 1, d) - hoy) / 86400000) : NaN;
    return { ticker: String(l.ticker || l.simbolo || ''), tna: pct(l.tnaPorcentaje ?? l.tna), tem: pct(l.temPorcentaje ?? l.tem), tea: pct(l.teaPorcentaje ?? l.tea), precio: Number(l.precioArs ?? l.precio), vto, dias };
  }).filter((l) => l.ticker && l.dias > 0 && l.tna > 0 && l.tna < 200).sort((a, b) => a.dias - b.dias);
}
async function traerLetras() {
  const g = letrasGuardadas();
  if (g && Date.now() - g.at < TTL) return g;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(URL_LETRAS, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const raw = await r.json();
    const letras = normalizar(raw);
    if (!letras.length) throw new Error('vacío');
    const x = { at: Date.now(), fecha: (raw && raw.fechaActualizacion) || '', letras };
    try { localStorage.setItem(K_LETRAS, JSON.stringify(x)); } catch { /* sin espacio */ }
    return x;
  } catch { return g; } finally { clearTimeout(t); }
}

// una por plazo: la más cercana a 1, 3, 6 y 12 meses
function porPlazo(letras) {
  const out = [];
  for (const [d, l] of [[30, '≈ 1 mes'], [90, '≈ 3 meses'], [180, '≈ 6 meses'], [365, '≈ 1 año']]) {
    const c = letras.reduce((best, x) => (!best || Math.abs(x.dias - d) < Math.abs(best.dias - d) ? x : best), null);
    if (c && !out.some((o) => o.ticker === c.ticker)) out.push({ ...c, etiqueta: l });
  }
  return out;
}
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '—');
function letrasHtml(x, monto = 1000000) {
  if (!x || !x.letras.length) return '<p class="small muted u-m-0">No pude traer las tasas de las letras ahora. Se cargan solas cuando haya conexión.</p>';
  const filas = porPlazo(x.letras);
  return `<div class="card tight">${filas.map((l) => {
    const gan = monto * (l.tna / 100) * (l.dias / 365);
    return `<div class="row"><span class="grow"><span class="name">${esc(l.ticker)} <span class="pill">${l.etiqueta}</span></span><span class="meta">Vence el ${l.vto.split('-').reverse().join('/')} (${l.dias} días) · ${f2(l.tem)}% por mes</span></span>
      <span class="u-d-flex-dir-column-items-end"><b>${f2(l.tna)}% TNA</b><span class="small muted">+${money(gan)}</span></span></div>`;
  }).join('')}</div>
  <span class="small muted">Lo que ganarías con ${money(monto)} hasta el vencimiento, antes de comisiones del broker. Fuente: ArgentinaDatos (precios de mercado del último día hábil${x.fecha ? `, ${new Date(x.fecha).toLocaleDateString('es-AR')}` : ''}).</span>`;
}

// ---------- pantalla ----------
let filtro = 'todos';
let montoInv = 1000000;
let montoUsuario = 0; // lo que escribiste (opcional): simula en todos los instrumentos
function cuerpo() {
  const grupos = [...new Set(INSTRUMENTOS.map((i) => i.grupo))];
  const lista = INSTRUMENTOS.filter((i) => filtro === 'todos' || i.grupo === filtro);
  return `<div class="chips inv-filtros">${[['todos', 'Todos'], ...grupos.map((g) => [g, g])].map(([v, l]) => `<button class="chip toggle" data-action="invFiltro" data-v="${esc(v)}" aria-pressed="${filtro === v}">${esc(l)}</button>`).join('')}</div>
    ${lista.map((i) => `<details class="card inv" data-id="${i.id}">
      <summary><span class="grow"><b>${esc(i.nombre)}</b><span class="small muted">${esc(i.moneda)} · ${esc(i.plazo)}</span></span>${barraRiesgo(i.riesgo)}</summary>
      <span class="text">${esc(i.que)}</span>
      <div class="split small"><span>Dónde se compra</span><b>${esc(i.donde)}</b></div>
      <span class="small">⚠️ ${esc(i.ojo)}</span>
      ${i.id === 'lecap' ? '' : simulacion(i, montoUsuario)}
      ${i.id === 'lecap' ? '<div data-letras><p class="small muted u-m-0">Buscando las tasas de hoy…</p></div>' : ''}
    </details>`).join('')}`;
}

export function abrir(s) {
  est = s || est;
  openModal('Letras, bonos y acciones', `
    <div class="card"><div class="field"><label for="inv-m">¿Cuánto invertirías? <span class="muted">(opcional, en pesos)</span></label><input id="inv-m" inputmode="decimal" value="${montoUsuario ? montoUsuario.toLocaleString('es-AR') : ''}" placeholder="Ej: 1.000.000" data-input="invMonto"><span class="hint">Lo uso para simular en todo lo que abras de esta sección. Si lo dejás vacío, las letras se calculan con $1.000.000.</span></div></div>
    <div class="card lime"><strong>¿Por dónde empiezo?</strong>
      <span class="small">Una regla simple según <b>cuándo vas a necesitar la plata</b>:</span>
      <div class="inv-plazos">
        <span><b>Este mes</b>Cuenta remunerada o fondo money market</span>
        <span><b>1 a 12 meses</b>Plazo fijo, cauciones o letras (LECAP)</span>
        <span><b>Más de 1 año</b>Bonos CER, ONs en dólares</span>
        <span><b>Más de 3 años</b>Una parte en CEDEARs o acciones, si bancás las bajas</span>
      </div>
      <span class="small muted">Antes de invertir: tené un fondo de emergencia (3 a 6 meses de gastos) en algo líquido.</span>
    </div>
    <div class="card"><strong>Letras del Tesoro hoy</strong>
      <div data-letras-top><p class="small muted u-m-0">Buscando las tasas de hoy…</p></div></div>
    <div class="section-title"><span>Instrumentos</span><span class="small muted">Tocá para ver</span></div>
    ${RIESGO_EXPLICA}
    <div id="inv-cuerpo">${cuerpo()}</div>
    <div class="card"><strong>Cómo empezar en la bolsa</strong>
      <span class="small">1. Abrí una cuenta en un broker (ALyC) registrado en la CNV, o usá la sección de inversiones de tu banco. Es gratis y se hace desde el celular.</span>
      <span class="small">2. Transferí pesos desde tu cuenta (a tu nombre).</span>
      <span class="small">3. Buscá el instrumento por su código (ticker) y comprá. Mirá las comisiones antes.</span>
      <a class="small" href="https://www.argentina.gob.ar/cnv/proteccion-al-inversor/agentes" target="_blank" rel="noopener">Cómo verificar que un broker esté registrado en la CNV ›</a>
    </div>
    <p class="small muted u-m-0">Es información general para entender las opciones, no una recomendación personal. Cada inversión tiene riesgos: informate bien o consultá a un asesor matriculado.</p>`);
  pintarLetras();
}

async function pintarLetras() {
  const g = letrasGuardadas();
  const poner = (x) => {
    document.querySelectorAll('#modal [data-letras-top], #modal [data-letras]').forEach((n) => { n.innerHTML = letrasHtml(x, montoInv); });
  };
  if (g) poner(g);
  const x = await traerLetras();
  poner(x);
}

export const actions = {
  openInversiones(ctx) { abrir(ctx.state); },
  invMonto(ctx, el) {
    const v = Number(String(el.value).replace(/\./g, '').replace(',', '.')) || 0;
    montoUsuario = v > 0 ? v : 0;
    montoInv = v > 0 ? v : 1000000; // vacío: el ejemplo de $1.000.000
    const g = letrasGuardadas();
    document.querySelectorAll('#modal [data-letras-top], #modal [data-letras]').forEach((n) => { n.innerHTML = letrasHtml(g, montoInv); });
    // las simulaciones de cada instrumento (dejo abiertos los que estaban abiertos)
    const abiertos = [...document.querySelectorAll('#modal details.inv[open]')].map((d) => d.dataset.id);
    setModalBody('#inv-cuerpo', cuerpo());
    abiertos.forEach((id) => { const d = document.querySelector(`#modal details.inv[data-id="${id}"]`); if (d) d.open = true; });
    document.querySelectorAll('#modal [data-letras]').forEach((n) => { n.innerHTML = letrasHtml(g, montoInv); });
  },
  invFiltro(ctx, el) { filtro = el.dataset.v; setModalBody('#inv-cuerpo', cuerpo()); const g = letrasGuardadas(); document.querySelectorAll('#modal [data-letras]').forEach((n) => { n.innerHTML = letrasHtml(g, montoInv); }); },
};
