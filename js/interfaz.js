// Íconos, logo y componentes visuales compartidos.

import { esc, toISO } from './formato.js';
import { allCategories, categoriasOrdenadas } from './categorias.js';

const P = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  moves: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 14c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  receipt: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  cart: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 11h10M14 8h3l3 3v8a2 2 0 0 1-4 0v-4h-2"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.5 1.5-3 4-3 7h3"/>',
  bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-7h5l3 7M10 10L8 6H6M15 10l-2-4h3"/>',
  heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-1-3-5-4-5-1.5S10 8 12 8zM12 8c1-3 5-4 5-1.5S14 8 12 8z"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v13H5a2 2 0 0 1-2-2V5"/><circle cx="16" cy="14" r="1.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  text: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
};

export function icon(name, size = 22, width = 2) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.tag}</svg>`;
}

// Brote lleno (ícono de la app)
export function sprout(size = 24, color = '#C6F36B') {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 48 48"><path d="M24 42V26" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/><path d="M24 26C24 16 31 9 40 9 40 18 33 26 24 26Z" fill="${color}"/><path d="M24 31C24 23 18 18 10 18 10 26 16 31 24 31Z" fill="${color}"/></svg>`;
}

// Logotipo: "pesitos" con el brote en la i
export function wordmark(size = 26, ink = 'var(--ink)', leaf = 'var(--logo-leaf)') {
  const w = Math.round(size * 0.34); const h = Math.round(size * 1.1);
  return `<span class="wordmark" style="font-size:${size}px;color:${ink}" role="img" aria-label="Pesitos"><span aria-hidden="true">pe<span class="wm-dollar">$</span></span><svg aria-hidden="true" width="${w}" height="${h}" viewBox="0 0 16 50"><rect x="4.5" y="22" width="7" height="25" rx="2" fill="currentColor"/><path d="M8 18C8 12 11 8 16 8 16 13 13 17 8 18Z" style="fill:${leaf}"/><path d="M8 19C8 14 5 11 0 11 0 16 3 18.5 8 19Z" style="fill:${leaf}"/></svg><span aria-hidden="true">tos</span></span>`;
}

export function ring(p, size = 72, stroke = 8, label = '', color = 'var(--green)', track = 'var(--track)') {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, p));
  return `<svg class="ring" role="img" aria-label="${esc(label || Math.round(v * 100) + '%')}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${size >= 60 ? `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" style="fill:var(--ink)" font-size="${Math.round(size * 0.22)}" font-weight="800">${Math.round(v * 100)}%</text>` : ''}
  </svg>`;
}

export function tipCard(t) {
  const amber = t.tone === 'warn';
  return `<div class="card ${amber ? 'amber' : ''}">
    <div class="tip-head">${amber ? `<span style="color:var(--amber)">${icon('bulb', 22)}</span>` : `<span class="badge">${sprout(17)}</span>`}<strong>${esc(t.title)}</strong></div>
    <p class="text">${esc(t.text)}</p>
    ${t.cta ? `<button class="btn small ${amber ? '' : 'green'}" data-action="${t.cta.action}" ${t.cta.id ? `data-id="${esc(t.cta.id)}"` : ''}>${esc(t.cta.label)}</button>` : ''}
  </div>`;
}

// ---------- modal (hoja inferior con "volver") ----------
const modal = () => document.getElementById('modal');
let lastFocus = null;
const stack = []; // pantallas anteriores dentro del modal

function paint(title, body, animate) {
  const m = modal();
  const sheet = m.querySelector('.modal-sheet');
  sheet.innerHTML = `<div class="modal-head">
      <button class="icon-btn back" data-action="modalBack" aria-label="${stack.length ? 'Volver' : 'Cerrar'}">${icon('back', 20, 2.2)}</button>
      <h2 id="modal-title">${esc(title)}</h2>
    </div><div class="modal-body ${animate || ''}">${body}</div>`;
  const first = sheet.querySelector('.modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea');
  if (first && window.matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 30);
}

// openModal(título, html) abre una hoja nueva. Con { push: true } la apila
// sobre la actual y el botón "volver" regresa a la anterior.
export function openModal(title, body, opts = {}) {
  const m = modal();
  if (m.hidden) { lastFocus = document.activeElement; stack.length = 0; }
  else if (opts.push) stack.push({ title: m.querySelector('#modal-title').textContent, body: m.querySelector('.modal-body').innerHTML });
  else stack.length = 0;
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  paint(title, body, opts.push ? 'slide-in' : '');
}
export function modalBack() {
  const prev = stack.pop();
  if (!prev) return closeModal();
  paint(prev.title, prev.body, 'slide-back');
}
export function closeModal() {
  const m = modal();
  if (m.hidden) return;
  stack.length = 0;
  m.hidden = true;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// Barra superior de una pantalla con flecha para volver
export function screenHead(title, extra = '', subtitle = '') {
  return `<div class="topbar">
    <div class="head-left">
      <button class="icon-btn back" data-action="goBack" aria-label="Volver">${icon('back', 20, 2.2)}</button>
      <div><h1 class="title">${esc(title)}</h1>${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}</div>
    </div>
    ${extra}
  </div>`;
}

// Carga rápida con selector Gasto / Ingreso (Gasto por defecto)
// Ícono de una categoría: el emoji que eligió el usuario o el dibujo de Pesitos
export function catIcon(c, size = 18) {
  return c && c.emoji ? `<span class="cat-emoji" style="font-size:${Math.round(size * 1.05)}px" aria-hidden="true">${c.emoji}</span>` : icon((c && c.icon) || 'tag', size);
}

export function quickForm(id, s = null) {
  const cats = s ? categoriasOrdenadas(s) : allCategories();
  return `<form class="quick-card" data-submit="quickAdd" autocomplete="off">
    <div class="kind-toggle" role="group" aria-label="Tipo de movimiento">
      <button type="button" data-action="setKind" data-kind="expense" aria-pressed="true">${icon('down', 16, 2.4)} Gasto</button>
      <button type="button" data-action="setKind" data-kind="income" aria-pressed="false">${icon('up', 16, 2.4)} Ingreso</button>
    </div>
    <input type="hidden" name="kind" value="expense">
    <div class="quick">
      <label for="${id}" class="sr-only">Anotá un movimiento</label>
      <input id="${id}" name="q" placeholder="Ej: Supermercado 48.000" data-ph-expense="Ej: Supermercado 48.000" data-ph-income="Ej: Venta 85.000" enterkeyhint="done">
      <button type="button" class="icon-btn" data-action="openPaste" aria-label="Cargar comprobante">${icon('receipt', 20)}</button>
      <button type="submit" class="icon-btn dark" aria-label="Anotar">${icon('plus', 20, 2.2)}</button>
    </div>
    <input type="hidden" name="category" value="auto">
    <div class="cat-row" role="radiogroup" aria-label="Categoría">
      <button type="button" class="cat-chip" role="radio" data-action="pickCat" data-id="auto" aria-checked="true"><span class="cat-chip-ic">${icon('sprout', 18)}</span><span>Automática</span></button>
      ${cats.map((c) => `<button type="button" class="cat-chip" role="radio" data-action="pickCat" data-id="${esc(c.id)}" aria-checked="false"><span class="cat-chip-ic">${catIcon(c, 18)}</span><span>${esc(c.short || c.label)}</span></button>`).join('')}
      <button type="button" class="cat-chip mas" data-action="openCatManager" aria-label="Crear, ordenar u ocultar categorías"><span class="cat-chip-ic">${icon('plus', 18, 2.4)}</span><span>Más</span></button>
    </div>
    <div class="quick-opts">
      <span class="small muted quick-date-label">Fecha</span>
      <label class="sr-only" for="${id}-date">Fecha</label>
      <input id="${id}-date" name="date" type="date" class="mini-select" value="${toISO(new Date())}" max="${toISO(new Date())}">
    </div>
  </form>`;
}
export function setModalBody(selector, html) {
  const el = modal().querySelector(selector);
  if (el) el.innerHTML = html;
}

// ---------- toast ----------
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

export function hydrateNavIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}
