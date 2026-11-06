// =========================================================
// Pesitos — modos: tu plata (personal) y espacios compartidos (familia, pareja).
// Un espacio es otro "Pesitos" completo que ven y cargan todas las personas
// que se suman con un código. Tu plata personal sigue siendo solo tuya.
// La lista de tus espacios se guarda en tu plata personal (s.espacios) y,
// para tenerla a mano estando en un espacio, también en este dispositivo.
// =========================================================

import { esc } from './formato.js';
import { openModal, closeModal, toast, setModalBody, icon } from './interfaz.js';
import * as nube from './sincronizacion.js';

const kLista = (uid) => `pesitos_espacios:${uid}`;
export const kModo = (uid) => `pesitos_modo:${uid}`;
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };

/** Tus espacios (los de tu plata personal y los guardados en este dispositivo). */
export function misEspacios(uid, s = null) {
  const loc = leer(kLista(uid), []);
  const per = s && !s.espacio && Array.isArray(s.espacios) ? s.espacios : [];
  const out = [...per];
  for (const e of loc) if (!out.some((x) => x.id === e.id)) out.push(e);
  return out.filter((e) => !(s && !s.espacio && (s.espaciosSalidos || []).includes(e.id)));
}
export function recordarEspacios(uid, lista) { escribir(kLista(uid), lista); }

const nombreModo = (s) => (s && s.espacio ? s.espacio.nombre || 'Compartido' : 'Mi plata');
/** "con Sofi y Juan" / "solo vos por ahora" */
export const conTxt = (con) => (!con ? '' : con.length ? `con ${con.length > 1 ? con.slice(0, -1).join(', ') + ' y ' + con[con.length - 1] : con[0]}` : 'solo vos por ahora');

/** Botón del encabezado de Inicio: en qué modo estás. */
export function chipModo(s) {
  if (s.demo || (!s.espacio && !(s.espacios || []).length)) return '';
  return `<button class="chip modo-chip ${s.espacio ? 'compartido' : ''}" data-action="openEspacios" aria-label="Cambiar de modo: ahora ${esc(nombreModo(s))}">${icon(s.espacio ? 'people' : 'user', 14, 2.2)} ${esc(nombreModo(s))}${s.espacio && (s.espacio.con || []).length ? `<span class="modo-con"> · ${esc(conTxt(s.espacio.con))}</span>` : ''}</button>`;
}

function cuerpo(ctx, extra = '') {
  const s = ctx.state; const lista = misEspacios(ctx.uid, s);
  const fila = (id, nombre, sub, activo) => `<button class="row modo-op ${activo ? 'activo' : ''}" data-action="cambiarModo" data-id="${esc(id)}" ${activo ? 'aria-current="true"' : ''}>
      <span class="cat-icon ${activo ? 'green' : ''}">${icon(id ? 'people' : 'user', 18)}</span>
      <span class="grow"><span class="name">${esc(nombre)}</span><span class="meta">${esc(sub)}</span></span>${activo ? '<span class="pill ok">Abierto</span>' : icon('chevron', 16)}</button>`;
  return `<p class="small muted" style="margin:0">Tu plata es solo tuya. Un espacio compartido es para llevar la plata de la casa entre varias personas: todos ven y cargan lo mismo.</p>
    <div class="card tight">
      ${fila('', 'Mi plata', 'Personal: solo vos', !s.espacio)}
      ${lista.map((e) => { const con = s.espacio && s.espacio.id === e.id ? s.espacio.con : e.con; return fila(e.id, e.nombre, `Compartido${con ? ' ' + conTxt(con) : ''}`, s.espacio && s.espacio.id === e.id); }).join('')}
    </div>
    ${s.espacio ? `<div class="btn-row"><button class="btn small green" data-action="invitarEspacio">${icon('send', 16)} Invitar a alguien</button><button class="btn small" data-action="verMiembros">${icon('people', 16)} Quiénes están</button></div>` : ''}
    <div id="esp-extra">${extra}</div>
    ${s.espacio ? '' : `<details class="card"><summary><strong>Crear un espacio compartido</strong></summary>
      <form class="form" data-submit="crearEspacio" style="margin-top:8px"><div class="field"><label for="es-n">Nombre</label><input id="es-n" name="nombre" placeholder="Ej: Casa, Familia, Con Sofi" maxlength="40" required></div>
      <span class="hint">Después invitás a tu pareja o tu familia con un código.</span>
      <button class="btn primary block" type="submit">Crear</button></form></details>`}
    <details class="card"><summary><strong>Tengo un código para sumarme</strong></summary>
      <form class="form" data-submit="unirseEspacio" style="margin-top:8px"><div class="field"><label for="es-c">Código</label><input id="es-c" name="codigo" placeholder="Ej: K7M2QX9P" maxlength="12" autocapitalize="characters" autocomplete="off" required></div>
      <button class="btn primary block" type="submit">Sumarme</button></form></details>
    ${s.espacio ? `<button class="btn ghost small" data-action="salirEspacio" style="align-self:flex-start">Salir de "${esc(s.espacio.nombre)}"</button>` : ''}`;
}

const yo = (ctx) => ((ctx.state.espacio ? ctx.miNombre : ctx.state.profile && ctx.state.profile.name) || ctx.miNombre || '').split(' ')[0];

export const espacioActions = {
  openEspacios(ctx) { openModal('Modo', `<div id="esp-body" class="form">${cuerpo(ctx)}</div>`); },
  setModoSel(ctx, el) { document.querySelector('#drawer [data-drawer-cerrar]')?.click(); el.dataset.v = el.value; return espacioActions.setModo(ctx, el); },
  // desde el menú (La app): como el tema, tocás y cambia
  async setModo(ctx, el) {
    const id = el.dataset.v || '';
    if (id === '__nuevo') { espacioActions.openEspacios(ctx); return; }
    if ((ctx.state.espacio ? ctx.state.espacio.id : '') === id) return;
    await ctx.abrirModo(id || null, id ? (misEspacios(ctx.uid, ctx.state).find((e) => e.id === id) || {}).nombre : null);
  },
  async cambiarModo(ctx, el) {
    const id = el.dataset.id || null;
    if ((ctx.state.espacio ? ctx.state.espacio.id : null) === id) { closeModal(); return; }
    closeModal();
    await ctx.abrirModo(id, id ? (misEspacios(ctx.uid, ctx.state).find((e) => e.id === id) || {}).nombre : null);
  },
  async crearEspacio(ctx, d) {
    const nombre = String(d.nombre || '').trim().slice(0, 40) || 'Familia';
    try {
      const id = await nube.crearEspacio({ uid: ctx.uid }, nombre, yo(ctx));
      const lista = [...misEspacios(ctx.uid, ctx.state).filter((e) => e.id !== id), { id, nombre }];
      recordarEspacios(ctx.uid, lista);
      ctx.commit((s) => { s.espacios = lista; });
      closeModal();
      await ctx.abrirModo(id, nombre, { nuevo: true });
      toast(`Listo: creaste "${nombre}". Invitá a alguien desde el botón de arriba`);
    } catch (e) { console.warn(e); toast('No pude crearlo. Revisá tu conexión.'); }
  },
  async unirseEspacio(ctx, d) {
    try {
      const e = await nube.unirse({ uid: ctx.uid }, d.codigo, yo(ctx));
      const lista = [...misEspacios(ctx.uid, ctx.state).filter((x) => x.id !== e.id), e];
      recordarEspacios(ctx.uid, lista);
      if (!ctx.state.espacio) ctx.commit((s) => { s.espacios = lista; });
      closeModal();
      await ctx.abrirModo(e.id, e.nombre);
      toast(`Listo: te sumaste a "${e.nombre}"`);
    } catch (err) {
      toast(err.message === 'vencido' ? 'Ese código venció: pedí uno nuevo' : err.message === 'codigo' ? 'No encontré ese código. Revisalo.' : 'No pude sumarte. Revisá el código y tu conexión.');
    }
  },
  async invitarEspacio(ctx) {
    const e = ctx.state.espacio; if (!e) return;
    try {
      const codigo = await nube.invitar(e.id);
      const texto = `Sumate a "${e.nombre}" en Pesitos para llevar la plata juntos. Entrá a ${location.origin}${location.pathname} → Menú → Modo → "Tengo un código" y poné: ${codigo}`;
      setModalBody('#esp-extra', `<div class="card lime"><strong>Código: <span class="codigo-esp">${codigo}</span></strong>
        <span class="small">Vale 7 días. La otra persona entra a Pesitos con su cuenta, va a Menú → Modo y lo escribe.</span>
        <div class="btn-row"><a class="btn small green" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">${icon('send', 16)} Mandar por WhatsApp</a><button class="btn small" data-action="copiarCodigo" data-c="${codigo}">Copiar</button></div></div>`);
    } catch (err) { console.warn(err); toast('No pude crear el código. Revisá tu conexión.'); }
  },
  copiarCodigo(ctx, el) { try { navigator.clipboard.writeText(el.dataset.c); toast('Código copiado'); } catch { toast(el.dataset.c); } },
  async verMiembros(ctx) {
    const e = ctx.state.espacio; if (!e) return;
    const d = await nube.leerEspacio(e.id).catch(() => null);
    const nombres = d ? (d.miembros || []).map((u) => (d.nombres || {})[u] || 'Sin nombre') : [];
    setModalBody('#esp-extra', `<div class="card"><strong>En "${esc(e.nombre)}"</strong>${nombres.length ? nombres.map((n) => `<span class="text">• ${esc(n)}</span>`).join('') : '<span class="small muted">No pude traer la lista ahora.</span>'}</div>`);
  },
  salirEspacio(ctx) {
    const e = ctx.state.espacio; if (!e) return;
    setModalBody('#esp-extra', `<div class="card amber"><strong>¿Salir de "${esc(e.nombre)}"?</strong><span class="small">Vas a dejar de verlo. Si sos la última persona, se borra todo lo que tiene.</span>
      <div class="btn-row"><button class="btn small" data-action="salirEspacioOk">Sí, salir</button></div></div>`);
  },
  async salirEspacioOk(ctx) {
    const e = ctx.state.espacio; if (!e) return;
    try {
      await nube.salirDeEspacio({ uid: ctx.uid }, e.id);
      const lista = misEspacios(ctx.uid, ctx.state).filter((x) => x.id !== e.id);
      recordarEspacios(ctx.uid, lista);
      closeModal();
      await ctx.abrirModo(null, null, { quitar: e.id });
      toast(`Saliste de "${e.nombre}"`);
    } catch (err) { console.warn(err); toast('No pude salir. Revisá tu conexión.'); }
  },
};
