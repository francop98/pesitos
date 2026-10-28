// =========================================================
// Pesitos — clave de Pesitos (charla)
// Crear la clave, mostrar el código de recuperación, pedir la clave en un
// dispositivo nuevo y recuperar el acceso con el código.
// La llave que cifra tus datos vive en js/cifrado.js.
// =========================================================

import { esc } from './formato.js';
import { wordmark, icon, sprout, toast, openModal, closeModal } from './interfaz.js';
import { crearLlave, abrirLlave, claveValida, cambiarClave, nuevoCodigoRecuperacion, limpiarCodigo } from './cifrado.js';

const send = (label = 'Seguir') => `<button type="submit" class="icon-btn green" aria-label="${label}">${icon('send', 20, 2.2)}</button>`;
const campo = (id, ph, extra = '') => `<form class="quick" data-clave-form="${id}" autocomplete="off" novalidate>
    <label for="k-${id}" class="sr-only">${esc(ph)}</label>
    <input id="k-${id}" name="value" type="password" placeholder="${esc(ph)}" data-autofocus ${extra}>
    <button type="button" class="pass-eye inline" data-clave="ver" aria-label="Mostrar">${icon('eye', 20)}</button>${send()}</form>`;

function pantalla({ bubbles, controls, nota = '', atras = false }) {
  return `<section class="guide auth">
    <header class="guide-top">${atras ? `<button class="icon-btn back on-green" data-clave="atras" aria-label="Volver">${icon('back', 20, 2.2)}</button>` : '<span style="width:44px"></span>'}
      <div class="guide-brand">${wordmark(26, '#FFFFFF', '#C6F36B')}<span>Tu economista de bolsillo</span></div><span style="width:44px"></span></header>
    <div class="chat guide-chat">
      ${bubbles.map((b, i) => `<div class="bot-row">${i === 0 ? `<span class="bot-avatar">${sprout(18)}</span>` : '<span class="bot-avatar ghost"></span>'}<div class="bubble bot">${b}</div></div>`).join('')}
      ${nota ? `<div class="bot-row"><span class="bot-avatar ghost"></span><div class="bubble bot aviso" role="alert">${esc(nota)}</div></div>` : ''}
    </div>
    <div class="guide-controls">${controls}</div>
  </section>`;
}

function dibujar(cont, opts) {
  cont.innerHTML = pantalla(opts);
  const f = cont.querySelector('[data-autofocus]');
  if (f && window.matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
  window.scrollTo(0, document.body.scrollHeight);
}

function verClave(cont) {
  const i = cont.querySelector('input[name=value]');
  if (i) i.type = i.type === 'password' ? 'text' : 'password';
}

/** Muestra el código de recuperación hasta que la persona confirma que lo guardó. */
function mostrarCodigo(cont, codigo, alListo, { titulo = '¡Listo! Tu clave quedó creada.' } = {}) {
  dibujar(cont, {
    bubbles: [esc(titulo), 'Este es tu <b>código de recuperación</b>. Si algún día te olvidás la clave, es la única forma de volver a abrir tus datos: nadie más los puede recuperar, ni siquiera Pesitos.',
      `<span class="codigo-rec">${esc(codigo)}</span>`, 'Guardalo en un lugar seguro: anotalo en papel, sacale una captura o guardalo en tu gestor de contraseñas.'],
    controls: `<div class="btn-row"><button class="btn" data-clave="copiar">${icon('paste', 18)} Copiar</button><button class="btn" data-clave="descargar">${icon('download', 18)} Descargar</button></div>
      <label class="check"><input type="checkbox" id="k-ok"> <span>Ya guardé mi código de recuperación</span></label>
      <button class="btn green block" data-clave="seguir" disabled>Seguir</button>`,
  });
  cont.onsubmit = null;
  cont.onchange = (e) => { if (e.target.id === 'k-ok') cont.querySelector('[data-clave=seguir]').disabled = !e.target.checked; };
  cont.onclick = async (e) => {
    const el = e.target.closest('[data-clave]');
    if (!el) return;
    if (el.dataset.clave === 'copiar') { try { await navigator.clipboard.writeText(codigo); toast('Código copiado'); } catch { toast('No pude copiarlo: anotalo a mano'); } }
    if (el.dataset.clave === 'descargar') {
      const blob = new Blob([`Código de recuperación de Pesitos\n\n${codigo}\n\nSirve para volver a abrir tus datos si te olvidás tu clave de Pesitos.\nGuardalo en un lugar seguro y no se lo compartas a nadie.\n`], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pesitos-codigo-de-recuperacion.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (el.dataset.clave === 'seguir') { cont.onchange = null; alListo(); }
  };
}

/** Primera vez: crear la clave de Pesitos. Resuelve con { llave, key } cuando terminó. */
export function crearClave(cont, { nombre = '' } = {}) {
  return new Promise((resolver) => {
    let paso = 'explicar'; let primera = ''; let nota = '';
    const render = () => {
      if (paso === 'explicar') {
        dibujar(cont, { nota, bubbles: [`${nombre ? `${esc(nombre)}, ahora` : 'Ahora'} lo más importante: tu <b>clave de Pesitos</b>.`, 'Con ella cifro tus datos en tu celular antes de guardarlos. Así nadie más puede leerlos: ni otras personas, ni quien administra la app.', 'Elegí una que te acuerdes: al menos 8 caracteres, con letras y números. Por ejemplo, una frase corta con un número.'],
          controls: campo('nueva', 'Tu clave de Pesitos', 'autocomplete="new-password"') + '<p class="small muted guide-hint">Es distinta de la contraseña con la que entrás. Te la pido solo cuando entrás desde otro dispositivo.</p>' });
      } else {
        dibujar(cont, { nota, atras: true, bubbles: ['Escribila de nuevo, para confirmar.'], controls: campo('repetir', 'Repetí tu clave', 'autocomplete="new-password"') });
      }
    };
    render();
    cont.onclick = (e) => {
      const el = e.target.closest('[data-clave]');
      if (!el) return;
      if (el.dataset.clave === 'ver') verClave(cont);
      if (el.dataset.clave === 'atras') { paso = 'explicar'; nota = ''; render(); }
    };
    cont.onsubmit = async (e) => {
      const f = e.target.closest('[data-clave-form]');
      if (!f) return;
      e.preventDefault();
      const v = f.value.value;
      if (paso === 'explicar') {
        const err = claveValida(v);
        if (err) { nota = err; render(); return; }
        primera = v; paso = 'repetir'; nota = ''; render(); return;
      }
      if (v !== primera) { nota = 'No coinciden. Probá de nuevo.'; paso = 'explicar'; primera = ''; render(); return; }
      dibujar(cont, { bubbles: ['Creando tu llave…'], controls: '' });
      const { llave, codigo, key } = await crearLlave(primera);
      mostrarCodigo(cont, codigo, () => resolver({ llave, key }));
    };
  });
}

/** Dispositivo nuevo: pedir la clave (o el código de recuperación). Resuelve con { key, llave }. */
export function pedirClave(cont, llave, { email = '', onSalir } = {}) {
  return new Promise((resolver) => {
    let modo = 'clave'; let nota = ''; let raw = null;
    const render = () => {
      if (modo === 'clave') dibujar(cont, { nota, bubbles: ['¡Hola de nuevo! Tus datos están cifrados.', `Escribí tu <b>clave de Pesitos</b>${email ? ` de ${esc(email)}` : ''} para abrirlos en este dispositivo.`],
        controls: campo('clave', 'Tu clave de Pesitos', 'autocomplete="current-password"') + '<div class="chips"><button class="chip big" data-clave="olvide">Me la olvidé</button><button class="chip big" data-clave="salir">Usar otra cuenta</button></div>' });
      if (modo === 'codigo') dibujar(cont, { nota, atras: true, bubbles: ['Escribí tu <b>código de recuperación</b> (el de 24 letras y números que guardaste cuando creaste la clave).'],
        controls: `<form class="quick" data-clave-form="codigo" autocomplete="off" novalidate><label for="k-codigo" class="sr-only">Código</label><input id="k-codigo" name="value" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" data-autofocus>${send()}</form>
          <p class="small muted guide-hint">Sin la clave ni el código no hay forma de abrir los datos: por eso son tan seguros.</p>` });
      if (modo === 'nueva') dibujar(cont, { nota, bubbles: ['¡Listo, recuperaste tu llave! Ahora elegí una clave de Pesitos nueva.'], controls: campo('nueva', 'Tu nueva clave', 'autocomplete="new-password"') });
    };
    render();
    cont.onclick = (e) => {
      const el = e.target.closest('[data-clave]');
      if (!el) return;
      if (el.dataset.clave === 'ver') verClave(cont);
      if (el.dataset.clave === 'olvide') { modo = 'codigo'; nota = ''; render(); }
      if (el.dataset.clave === 'atras') { modo = 'clave'; nota = ''; render(); }
      if (el.dataset.clave === 'salir' && onSalir) onSalir();
    };
    cont.onsubmit = async (e) => {
      const f = e.target.closest('[data-clave-form]');
      if (!f) return;
      e.preventDefault();
      const v = f.value.value;
      try {
        if (modo === 'clave') {
          dibujar(cont, { bubbles: ['Abriendo tus datos…'], controls: '' });
          const r = await abrirLlave(llave, v);
          resolver({ key: r.key, llave }); return;
        }
        if (modo === 'codigo') {
          if (limpiarCodigo(v).replace(/-/g, '').length !== 24) { nota = 'El código tiene 24 letras y números. Revisalo.'; render(); return; }
          dibujar(cont, { bubbles: ['Revisando el código…'], controls: '' });
          raw = (await abrirLlave(llave, v, { conCodigo: true })).raw;
          modo = 'nueva'; nota = ''; render(); return;
        }
        if (modo === 'nueva') {
          const err = claveValida(v);
          if (err) { nota = err; render(); return; }
          const nueva = await cambiarClave(llave, raw, v);
          const r = await abrirLlave(nueva, v);
          toast('Listo: ya podés usar tu clave nueva');
          resolver({ key: r.key, llave: nueva }); return;
        }
      } catch {
        nota = modo === 'clave' ? 'Esa no es tu clave de Pesitos. Probá de nuevo.' : 'Ese código no coincide. Revisalo letra por letra.';
        render();
      }
    };
  });
}

// ---------- desde Mi cuenta ----------
export function abrirGestionClave(llave, { guardarLlave }) {
  openModal('Clave de Pesitos', `
    <div class="card"><span class="small">🔐 Tus datos están cifrados con tu clave de Pesitos. Ni Pesitos ni nadie más puede leerlos.</span></div>
    <form class="form" id="f-cambiar-clave"><strong>Cambiar la clave</strong>
      <div class="field"><label for="ck-a">Clave actual</label><input id="ck-a" name="actual" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="ck-n">Clave nueva</label><input id="ck-n" name="nueva" type="password" autocomplete="new-password" required><span class="hint">Al menos 8 caracteres, con letras y números.</span></div>
      <p class="auth-error" role="alert" hidden></p>
      <button class="btn small" type="submit">Cambiar clave</button></form>
    <form class="form" id="f-nuevo-codigo"><strong>Nuevo código de recuperación</strong>
      <span class="small muted">Si perdiste el anterior. El viejo deja de servir.</span>
      <div class="field"><label for="ck-c">Tu clave de Pesitos</label><input id="ck-c" name="actual" type="password" autocomplete="current-password" required></div>
      <p class="auth-error" role="alert" hidden></p>
      <button class="btn small" type="submit">Generar código nuevo</button></form>`, { push: true });
  const body = document.querySelector('#modal .modal-body');
  const fallar = (f, m) => { const p = f.querySelector('.auth-error'); p.textContent = m; p.hidden = false; };
  body.querySelector('#f-cambiar-clave').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const err = claveValida(f.nueva.value); if (err) { fallar(f, err); return; }
    try {
      const { raw } = await abrirLlave(llave, f.actual.value);
      llave = await cambiarClave(llave, raw, f.nueva.value);
      await guardarLlave(llave); f.reset(); toast('Clave de Pesitos cambiada');
    } catch { fallar(f, 'La clave actual no es correcta.'); }
  };
  body.querySelector('#f-nuevo-codigo').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try {
      const { raw } = await abrirLlave(llave, f.actual.value);
      const r = await nuevoCodigoRecuperacion(llave, raw);
      llave = r.llave; await guardarLlave(llave);
      openModal('Tu nuevo código', `<p class="text" style="margin:0">Guardalo en un lugar seguro. El anterior ya no sirve.</p><span class="codigo-rec">${esc(r.codigo)}</span>
        <button class="btn block" data-action="copiarTexto" data-texto="${esc(r.codigo)}">${icon('paste', 18)} Copiar</button>
        <button class="btn primary block" data-action="closeModal">Ya lo guardé</button>`, { push: true });
    } catch { fallar(f, 'La clave no es correcta.'); }
  };
}

export const claveActions = {
  async copiarTexto(ctx, el) { try { await navigator.clipboard.writeText(el.dataset.texto); toast('Copiado'); } catch { toast('No pude copiarlo: anotalo a mano'); } },
  cerrarModal() { closeModal(); },
};
