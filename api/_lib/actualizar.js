// Actualización de datos públicos, 100% gratis:
// - Promos: fuente principal "descuentos-ar-datos" (ver fuente.js) + complemento
//   opcional con Tavily y Gemini para los medios que esa fuente no cubre.
// - Inflación (IPC del INDEC): API oficial de series de tiempo (datos.gob.ar).
// Todo se guarda en Firestore (colección "publico").

import { db } from './firebase.js';
import { FUENTE, promosFuente } from './fuente.js';
import { complementoActivo, promosComplemento } from './complemento.js';
import { enviarAvisos, avisarDueno } from './avisos.js';

export const TZ = 'America/Argentina/Buenos_Aires';
export const todayAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // AAAA-MM-DD

// Medios de la app que la fuente principal no trae: los busca el complemento
const SIN_FUENTE = { 'Banco Nación': 'nacion', 'Tarjeta Naranja': 'naranja' }; // nombre → id en la app
// Ojo: con sort=desc la API pierde el último mes publicado; se pide en orden normal desde hace 2 años
const ipcUrl = (today) => `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26:percent_change&start_date=${Number(today.slice(0, 4)) - 2}-01&limit=1000&format=json`;

export const refs = () => { const d = db(); return { DOC: d.collection('publico').doc('datos'), CFG: d.collection('publico').doc('config') }; };

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(banco|tarjeta|de|del|la|el)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

async function ipcOficial(today) {
  const r = await fetch(ipcUrl(today), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`IPC ${r.status}`);
  const out = {};
  for (const [date, v] of (await r.json()).data || []) {
    if (v == null) continue;
    const pct = Math.abs(v) < 1 ? v * 100 : v;
    out[String(date).slice(0, 7)] = Math.round(pct * 100) / 100;
  }
  return out;
}

// Control de calidad de los datos: qué tan nuevos son y si algo se ve raro.
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
export function revisarSalud({ today, promos, fuenteOk, fuenteFecha, ipc, ipcOk, status }) {
  const problemas = [];
  const atraso = fuenteFecha ? diasEntre(String(fuenteFecha).slice(0, 10), today) : null;
  if (!fuenteOk) problemas.push(`La fuente de promos falló (${String(status.fuente || '').slice(0, 60)})`);
  else if (atraso !== null && atraso >= 2) problemas.push(`La fuente de promos no se actualiza hace ${atraso} días`);
  const vigentes = promos.filter((p) => p.validTo >= today).length;
  if (vigentes < 80) problemas.push(`Hay pocas promos vigentes (${vigentes})`);
  const meses = Object.keys(ipc || {}).sort(); const ultimoIpc = meses[meses.length - 1] || null;
  // el INDEC publica a mitad de mes el dato del mes anterior: más de 2 meses de atraso es raro
  const [y, m] = today.split('-').map(Number); const hace2 = `${m <= 2 ? y - 1 : y}-${String(((m + 9) % 12) + 1).padStart(2, '0')}`;
  if (!ipcOk) problemas.push('No se pudo leer la inflación del INDEC');
  else if (ultimoIpc && ultimoIpc < hace2) problemas.push(`La inflación del INDEC no tiene dato nuevo desde ${ultimoIpc}`);
  return {
    revisado: new Date().toISOString(),
    fuente: { ok: fuenteOk, fecha: fuenteFecha || null, atraso },
    promos: { vigentes, topeSinConfirmar: promos.filter((p) => p.capUnknown && !p.cap).length },
    ipc: { ok: ipcOk, ultimo: ultimoIpc },
    problemas,
  };
}

export async function actualizar({ turno = 'manana' } = {}) {
  const { DOC, CFG } = refs();
  const today = todayAR();
  const prev = (await DOC.get()).data() || {};
  const status = {};
  let promos = null;
  let fuenteFecha = prev.fuenteFecha || null;

  try {
    const f = await promosFuente(today);
    promos = f.promos; fuenteFecha = f.actualizado;
    status.fuente = `ok: ${promos.length} promos (fuente del ${f.actualizado})`;
  } catch (e) { status.fuente = `error: ${e.message}`; }

  // complemento: una vez por día (a la mañana), solo para lo que falta
  let extraPromos = (prev.promos || []).filter((p) => p.auto && p.validTo >= today);
  if (complementoActivo() && turno !== 'tarde' && promos) {
    try {
      const extras = ((await CFG.get()).data() || {}).extraWallets || [];
      const cubiertos = new Set(promos.map((p) => norm(p.walletName)).filter(Boolean));
      const faltan = [...Object.keys(SIN_FUENTE), ...extras].filter((n) => !cubiertos.has(norm(n)));
      if (faltan.length) {
        const c = await promosComplemento(faltan, today);
        // los medios propios de la app van con su id; los agregados por usuarios, con su nombre
        if (c.promos.length) extraPromos = c.promos.map(({ walletName, ...p }) => (SIN_FUENTE[walletName] ? { ...p, wallet: SIN_FUENTE[walletName] } : { ...p, walletName }));
        status.complemento = `ok: ${c.promos.length} promos de ${c.buscados.join(', ')}`;
      } else status.complemento = 'nada que completar';
    } catch (e) { status.complemento = `error: ${e.message}`; }
  } else if (!complementoActivo()) status.complemento = 'apagado (faltan TAVILY_API_KEY o GEMINI_API_KEY)';

  let ipc = prev.ipc || {};
  try { ipc = { ...ipc, ...(await ipcOficial(today)) }; status.ipc = 'ok'; } catch (e) { status.ipc = `error: ${e.message}`; }

  // avisos de la mañana (solo en la corrida de las 9)
  if (turno !== 'tarde') { try { status.avisos = await enviarAvisos(today); } catch (e) { status.avisos = `error: ${e.message}`; } }

  const base = promos || (prev.promos || []).filter((p) => !p.auto && p.validTo >= today); // si la fuente falló, se conservan las anteriores vigentes
  const todas = [...base, ...extraPromos];
  const salud = revisarSalud({ today, promos: todas, fuenteOk: !!promos, fuenteFecha, ipc, ipcOk: status.ipc === 'ok', status });
  const doc = {
    promos: todas,
    ipc,
    fuenteFecha,
    sources: [{ name: FUENTE.name, url: FUENTE.url }],
    status,
    salud,
    duenoAvisado: prev.duenoAvisado || null,
    updatedAt: new Date().toISOString(),
  };
  // si algo anda mal, un aviso al dueño (una vez por día como máximo)
  if (salud.problemas.length && prev.duenoAvisado !== today) {
    try { status.dueno = await avisarDueno('Pesitos: revisá los datos', salud.problemas.join(' · ').slice(0, 220)); if (/^ok/.test(status.dueno)) doc.duenoAvisado = today; } catch (e) { status.dueno = `error: ${e.message}`; }
  }
  if (!doc.promos.length && !Object.keys(ipc).length) throw new Error(`Sin datos: ${JSON.stringify(status)}`);
  await DOC.set(doc);
  return doc;
}
