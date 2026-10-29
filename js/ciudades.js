// =========================================================
// Pesitos — ciudades de cada provincia
// Se bajan solas del servicio oficial de datos geográficos (Georef, datos.gob.ar,
// gratis y sin clave) y quedan guardadas en el dispositivo. Si no hay conexión,
// se usa una lista corta de las ciudades principales.
// =========================================================

import { esc, normalize } from './formato.js';

const ID_GEOREF = { 'Buenos Aires': '06', CABA: '02', Catamarca: '10', Chaco: '22', Chubut: '26', 'Córdoba': '14', Corrientes: '18', 'Entre Ríos': '30', Formosa: '34', Jujuy: '38', 'La Pampa': '42', 'La Rioja': '46', Mendoza: '50', Misiones: '54', 'Neuquén': '58', 'Río Negro': '62', Salta: '66', 'San Juan': '70', 'San Luis': '74', 'Santa Cruz': '78', 'Santa Fe': '82', 'Santiago del Estero': '86', 'Tierra del Fuego': '94', 'Tucumán': '90' };

// las más grandes de cada provincia: aparecen primero y sirven sin conexión
const PRINCIPALES = {
  'Buenos Aires': ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'San Nicolás de los Arroyos', 'Pergamino', 'Olavarría', 'Junín', 'Azul', 'Necochea', 'Zárate', 'Campana', 'Luján', 'Pilar', 'Quilmes', 'Lomas de Zamora', 'La Matanza', 'Morón', 'San Isidro', 'Tigre', 'Lanús', 'Avellaneda', 'Banfield', 'Chivilcoy', 'Tres Arroyos', 'Punta Alta', 'Villa Gesell', 'Pinamar', 'Chascomús', 'Bragado'],
  CABA: ['Ciudad de Buenos Aires'],
  Catamarca: ['San Fernando del Valle de Catamarca', 'Andalgalá', 'Belén', 'Tinogasta'],
  Chaco: ['Resistencia', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Charata', 'Barranqueras'],
  Chubut: ['Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Rawson', 'Esquel'],
  'Córdoba': ['Córdoba', 'Río Cuarto', 'Villa María', 'San Francisco', 'Villa Carlos Paz', 'Alta Gracia', 'Bell Ville', 'Jesús María', 'Río Tercero'],
  Corrientes: ['Corrientes', 'Goya', 'Paso de los Libres', 'Mercedes', 'Curuzú Cuatiá'],
  'Entre Ríos': ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Victoria', 'Villaguay'],
  Formosa: ['Formosa', 'Clorinda', 'Pirané'],
  Jujuy: ['San Salvador de Jujuy', 'Palpalá', 'San Pedro', 'Libertador General San Martín', 'Perico'],
  'La Pampa': ['Santa Rosa', 'General Pico', 'Toay', 'Realicó'],
  'La Rioja': ['La Rioja', 'Chilecito', 'Aimogasta'],
  Mendoza: ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú', 'San Martín', 'Malargüe'],
  Misiones: ['Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Apóstoles'],
  'Neuquén': ['Neuquén', 'Cutral Có', 'Plottier', 'Zapala', 'San Martín de los Andes', 'Centenario'],
  'Río Negro': ['San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Viedma', 'Allen', 'Villa Regina'],
  Salta: ['Salta', 'San Ramón de la Nueva Orán', 'Tartagal', 'General Güemes', 'Metán'],
  'San Juan': ['San Juan', 'Rawson', 'Chimbas', 'Rivadavia', 'Santa Lucía'],
  'San Luis': ['San Luis', 'Villa Mercedes', 'Merlo', 'Juana Koslay'],
  'Santa Cruz': ['Río Gallegos', 'Caleta Olivia', 'Pico Truncado', 'El Calafate', 'Puerto Deseado'],
  'Santa Fe': ['Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto', 'Reconquista', 'Villa Gobernador Gálvez', 'Santo Tomé', 'Esperanza', 'Casilda'],
  'Santiago del Estero': ['Santiago del Estero', 'La Banda', 'Termas de Río Hondo', 'Añatuya'],
  'Tierra del Fuego': ['Ushuaia', 'Río Grande', 'Tolhuin'],
  'Tucumán': ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Concepción', 'Banda del Río Salí', 'Aguilares'],
};

const memoria = {};
const kCache = (p) => `pesitos_ciudades:${ID_GEOREF[p] || p}`;
const titulo = (t) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, (c) => c.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y|El)\b/g, (w) => w.toLowerCase()) : t);

/** Lista de ciudades de una provincia (primero las principales). */
export async function ciudadesDe(prov) {
  if (!prov) return [];
  if (memoria[prov]) return memoria[prov];
  const armar = (todas) => {
    const vistos = new Set(); const out = [];
    for (const c of [...(PRINCIPALES[prov] || []), ...todas]) { const k = normalize(c); if (c && !vistos.has(k)) { vistos.add(k); out.push(c); } }
    return out;
  };
  try {
    const guardado = JSON.parse(localStorage.getItem(kCache(prov)) || 'null');
    if (guardado && guardado.lista && Date.now() - guardado.t < 90 * 864e5) return (memoria[prov] = armar(guardado.lista));
  } catch { /* nada */ }
  if (!ID_GEOREF[prov] || prov === 'CABA') return (memoria[prov] = armar([]));
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://apis.datos.gob.ar/georef/api/localidades-censales?provincia=${ID_GEOREF[prov]}&campos=nombre&max=5000&orden=nombre`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    const lista = [...new Set((j.localidades_censales || []).map((x) => titulo(String(x.nombre || '').trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    try { localStorage.setItem(kCache(prov), JSON.stringify({ t: Date.now(), lista })); } catch { /* nada */ }
    return (memoria[prov] = armar(lista));
  } catch {
    return armar([]); // sin conexión: solo las principales (no se guarda, se reintenta)
  }
}

/** Campo para elegir la ciudad: escribís y te sugiere, o elegís de la lista. */
export function campoCiudad({ id, name = 'city', prov, valor = '', enviar = false }) {
  return `<div class="ciudad-picker" data-prov="${esc(prov || '')}" data-enviar="${enviar ? '1' : ''}">
    <input id="${id}" name="${name}" value="${esc(valor)}" placeholder="Escribí o elegí tu ciudad" autocomplete="off" maxlength="40" data-input="ciudadFiltrar" data-ciudad-input>
    <div class="ciudad-lista" role="listbox" aria-label="Ciudades" data-ciudad-lista><span class="small muted">Cargando ciudades…</span></div>
  </div>`;
}

const MAX = 40;
async function pintarLista(picker) {
  const lista = picker.querySelector('[data-ciudad-lista]');
  const input = picker.querySelector('[data-ciudad-input]');
  if (!lista || !input) return;
  const todas = await ciudadesDe(picker.dataset.prov);
  const q = normalize(input.value.trim());
  const coinciden = q ? todas.filter((c) => normalize(c).includes(q)).sort((a, b) => normalize(a).startsWith(q) === normalize(b).startsWith(q) ? 0 : normalize(a).startsWith(q) ? -1 : 1) : todas;
  const elegida = todas.find((c) => normalize(c) === q);
  if (!todas.length) { lista.innerHTML = ''; return; }
  lista.innerHTML = coinciden.length
    ? coinciden.slice(0, MAX).map((c) => `<button type="button" class="ciudad-op${elegida === c ? ' on' : ''}" role="option" aria-selected="${elegida === c}" data-action="ciudadElegir" data-v="${esc(c)}">${esc(c)}</button>`).join('')
      + (coinciden.length > MAX ? `<span class="small muted ciudad-mas">Y ${coinciden.length - MAX} más: escribí para encontrarla.</span>` : '')
    : `<span class="small muted">No la encuentro en la lista. Si es tu ciudad, dejala escrita así.</span>`;
}

/** Llamar después de dibujar un campoCiudad. */
export function activarCiudades(root = document) {
  root.querySelectorAll('.ciudad-picker').forEach((p) => pintarLista(p));
}

export const ciudadActions = {
  ciudadFiltrar(ctx, el) { const p = el.closest('.ciudad-picker'); if (p) pintarLista(p); },
  ciudadElegir(ctx, el) {
    const p = el.closest('.ciudad-picker');
    const input = p.querySelector('[data-ciudad-input]');
    input.value = el.dataset.v;
    if (p.dataset.enviar) { const f = input.closest('form'); if (f) f.requestSubmit(); return; }
    pintarLista(p);
  },
  // en "Mis datos": al cambiar la provincia, cambia la lista
  ciudadProvincia(ctx, el) {
    const p = el.closest('form').querySelector('.ciudad-picker');
    if (!p) return;
    p.dataset.prov = el.value;
    pintarLista(p);
  },
};
