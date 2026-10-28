// =========================================================
// Pesitos — tema (claro / oscuro / automático) y tamaño de letra
// Se guardan en este dispositivo. index.html los aplica antes de dibujar
// para que la pantalla no parpadee.
// =========================================================

const K_TEMA = 'pesitos_tema';   // 'auto' | 'claro' | 'oscuro'
const K_LETRA = 'pesitos_letra'; // 'normal' | 'grande' | 'enorme'

const leer = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };

export const temaActual = () => leer(K_TEMA, 'auto');
export const letraActual = () => leer(K_LETRA, 'normal');

function colorBarra() {
  const oscuro = document.documentElement.getAttribute('data-tema') === 'oscuro'
    || (temaActual() === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', oscuro ? '#0F1412' : '#1F6F4A');
}

export function aplicarTema(t = temaActual()) {
  try { localStorage.setItem(K_TEMA, t); } catch { /* nada */ }
  if (t === 'claro' || t === 'oscuro') document.documentElement.setAttribute('data-tema', t);
  else document.documentElement.removeAttribute('data-tema');
  colorBarra();
}

export function aplicarLetra(l = letraActual()) {
  try { localStorage.setItem(K_LETRA, l); } catch { /* nada */ }
  if (l === 'grande' || l === 'enorme') document.documentElement.setAttribute('data-letra', l);
  else document.documentElement.removeAttribute('data-letra');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', colorBarra);
colorBarra();
