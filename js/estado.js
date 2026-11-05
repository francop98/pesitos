// Estado de los datos (#/estado): de dónde sale cada dato externo, cuándo se
// actualizó por última vez y si algo anda mal. Si una fuente se atrasa, acá se ve
// (y la app lo dice en vez de mostrar datos viejos como si fueran nuevos).

import { esc } from './formato.js';
import { icon, screenHead } from './interfaz.js';
import { refreshLive } from './datosvivos.js';
import { refreshRates } from './cotizaciones.js';

const HORA = 3600000; const DIA = 24 * HORA;
const hace = (ms) => {
  if (!ms) return 'nunca';
  const d = Date.now() - ms;
  if (d < 2 * 60000) return 'recién';
  if (d < HORA) return `hace ${Math.round(d / 60000)} min`;
  if (d < DIA) return `hace ${Math.round(d / HORA)} h`;
  const n = Math.round(d / DIA); return `hace ${n} día${n === 1 ? '' : 's'}`;
};
const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Lista de fuentes con su estado: ok | atrasado | falla */
export function fuentes(s) {
  const out = [];
  const live = s.live || {};
  const salud = live.salud || null;
  // promos
  {
    let est = 'ok'; let det = '';
    if (!live.at) { est = 'falla'; det = 'Todavía no las pude traer.'; }
    else {
      const atraso = salud && salud.fuente ? salud.fuente.atraso : null;
      if (salud && salud.fuente && !salud.fuente.ok) est = 'falla';
      else if (atraso !== null && atraso >= 2) est = 'atrasado';
      else if (Date.now() - live.at > 2 * DIA) est = 'atrasado';
      det = `Listado del ${fecha(live.fuenteFecha)}${atraso ? ` (hace ${atraso} día${atraso === 1 ? '' : 's'})` : ''}. ${salud ? `${salud.promos.vigentes} promos vigentes${salud.promos.topeSinConfirmar ? `, ${salud.promos.topeSinConfirmar} con tope sin confirmar` : ''}. ` : ''}Lo trajiste ${hace(live.at)}.`;
    }
    out.push({ id: 'promos', nombre: 'Promos, reintegros y topes', fuente: 'Con qué pago (listado público, revisado contra la web de cada banco)', frec: 'El servidor lo revisa 2 veces por día; la app, cada hora', est, det });
  }
  // inflación
  {
    // solo datos oficiales (no los de ejemplo)
    const real = { ...((s.live && s.live.ipc) || {}), ...((s.ipcAuto && s.ipcAuto.data) || {}) };
    const k = Object.keys(real).sort().pop();
    const u = k ? { mk: k, value: real[k] } : null; const at = (s.ipcAuto && s.ipcAuto.at) || (s.live && s.live.at);
    let est = u ? 'ok' : 'falla';
    if (u) { const [y, m] = u.mk.split('-').map(Number); const meses = (new Date().getFullYear() - y) * 12 + (new Date().getMonth() + 1 - m); if (meses > 2) est = 'atrasado'; }
    out.push({ id: 'ipc', nombre: 'Inflación', fuente: 'INDEC (API oficial datos.gob.ar)', frec: 'Una vez por mes (la app la revisa cada 6 h)', est,
      det: u ? `Último dato: ${MESES[Number(u.mk.slice(5)) - 1]} ${u.mk.slice(0, 4)} (${String(u.value).replace('.', ',')}%). Revisado ${hace(at)}.` : 'Sin datos todavía.' });
  }
  // dólar
  {
    const r = s.rates || {};
    const est = !r.okAt ? 'falla' : Date.now() - r.okAt > 6 * HORA ? 'atrasado' : 'ok';
    out.push({ id: 'dolar', nombre: 'Dólar y cripto', fuente: 'DolarApi y CoinGecko', frec: 'Cada 5 minutos con la app abierta', est, det: `Actualizado ${hace(r.okAt)}.${r.ok === false && r.okAt ? ' El último intento falló: muestro el último dato bueno.' : ''}` });
  }
  // tasas
  {
    const r = s.rendimientos || {};
    const est = !r.at ? 'falla' : Date.now() - r.at > 4 * DIA ? 'atrasado' : 'ok';
    out.push({ id: 'tasas', nombre: 'Tasas (plazo fijo, billeteras, FCI)', fuente: 'ArgentinaDatos (datos del BCRA y la CNV)', frec: 'Cada 12 horas', est, det: `Último dato nuevo ${hace(r.at)}.` });
  }
  // letras
  {
    let g = null; try { g = JSON.parse(localStorage.getItem('pesitos_letras') || 'null'); } catch { g = null; }
    out.push({ id: 'letras', nombre: 'Letras del Tesoro (LECAP)', fuente: 'ArgentinaDatos', frec: 'Cada 6 horas, cuando abrís Inversiones', est: !g ? 'ok' : Date.now() - g.at > 3 * DIA ? 'atrasado' : 'ok', det: g ? `Traídas ${hace(g.at)}.` : 'Se traen cuando abrís Herramientas → Letras, bonos y acciones.' });
  }
  // feriados
  {
    const f = s.feriados || {}; const y = new Date().getFullYear();
    out.push({ id: 'feriados', nombre: 'Feriados (para el día de cobro y vencimientos)', fuente: 'ArgentinaDatos', frec: 'Una vez por semana', est: f.years && f.years[y] ? 'ok' : 'falla', det: f.years && f.years[y] ? `${f.years[y].length} feriados de ${y} cargados.` : 'Sin datos: uso los días hábiles normales.' });
  }
  return out;
}

export const hayProblemas = (s) => fuentes(s).some((f) => f.est !== 'ok');

const ETQ = { ok: ['check', 'Al día', 'ok'], atrasado: ['clock', 'Atrasado', 'warn'], falla: ['close', 'Sin datos', 'bad'] };

export function render(s) {
  const fs = fuentes(s);
  const malos = fs.filter((f) => f.est !== 'ok').length;
  const prob = ((s.live || {}).salud || {}).problemas || [];
  return `<section class="screen">
    ${screenHead('Estado de los datos', '<button class="btn small" data-action="estadoActualizar">Actualizar</button>', 'De dónde sale cada dato y qué tan nuevo es')}
    <div class="card ${malos ? 'amber' : 'lime'}"><strong>${malos ? `${malos} fuente${malos === 1 ? '' : 's'} para revisar` : 'Todo al día'}</strong>
      <span class="text">${malos ? 'Mientras tanto uso el último dato bueno y te lo marco como "a confirmar". Tus gastos, cuentas y "Hoy podés gastar" no dependen de esto.' : 'Todas las fuentes respondieron bien. Tus gastos, cuentas y "Hoy podés gastar" funcionan aunque alguna falle.'}</span>
      ${prob.length ? `<span class="small">${prob.map((p) => `• ${esc(p)}`).join('<br>')}</span>` : ''}</div>
    <div class="card tight">${fs.map((f) => { const [ic, txt, cl] = ETQ[f.est]; return `<div class="row estado-fila">
      <span class="estado-ic ${cl}" aria-hidden="true">${icon(ic, 16, 2.4)}</span>
      <span class="grow"><span class="name">${esc(f.nombre)} <span class="estado-txt ${cl}">${txt}</span></span>
        <span class="meta">${esc(f.det)}</span>
        <span class="meta">Fuente: ${esc(f.fuente)} · ${esc(f.frec)}</span></span></div>`; }).join('')}</div>
    <p class="small muted" style="margin:0">Pesitos no inventa datos: si una fuente no responde, te muestro el último dato bueno con su fecha. Los topes que el banco no publica figuran como "tope sin confirmar" y el reintegro se calcula "hasta" ese monto: si te llega otro, abrí la compra y corregilo.</p>
  </section>`;
}

export const actions = {
  async estadoActualizar(ctx) {
    await Promise.all([refreshLive(ctx, true), refreshRates(ctx, true)]);
    ctx.render();
  },
};
