// Lo que comparten las pruebas: un servidor local para la app, el navegador con
// Firebase de mentira (nada sale a internet) y atajos para entrar y moverse.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export async function servidor() {
  const srv = createServer(async (req, res) => {
    const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    try {
      const cuerpo = await readFile(join(RAIZ, ruta || 'index.html'));
      res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta || 'index.html')] || 'application/octet-stream' });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}`, cerrar: () => srv.close() };
}

const FB = (n) => readFileSync(join(AQUI, 'firebase-de-prueba', n), 'utf8');

/** Abre un navegador; equipo: nombre de un celular de Playwright (ej. 'Pixel 5') o nada (computadora). */
export async function abrir(base, equipo) {
  const b = await chromium.launch();
  const ctx = await b.newContext(equipo ? { ...devices[equipo] } : { viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [n, f] of [['app', 'app.js'], ['auth', 'auth.js'], ['firestore', 'fs.js']]) await p.route(`**/firebasejs/**/firebase-${n}.js`, (r) => r.fulfill({ contentType: 'application/javascript', body: FB(f) }));
  await p.route('**/api/datos*', (r) => r.fulfill({ contentType: 'application/json', body: '{"promos":[],"ipc":{}}' }));
  await p.route(/dolarapi|argentinadatos|coingecko|datos\.gob|fonts\.g/, (r) => r.abort());
  p.base = base;
  return { b, p, errores };
}

/** Entra con Google (de mentira) y crea el PIN 2580. Con demo: true carga los datos de ejemplo. */
export async function entrar(p, { demo = true } = {}) {
  await p.goto(p.base + '/'); await p.waitForTimeout(600);
  await p.check('#a-acepto'); await p.click('[data-auth=google]'); await p.waitForTimeout(1200);
  await p.fill('#k-pin', '2580'); await p.press('#k-pin', 'Enter'); await p.fill('#k-repetir', '2580'); await p.press('#k-repetir', 'Enter'); await p.waitForTimeout(1800);
  if (demo) {
    await p.click('[data-action=loadDemo]'); await p.waitForTimeout(900);
    if (await p.$('.pin-teclado')) { for (const d of '2580') await p.click(`[data-pin="${d}"]`); await p.waitForTimeout(900); }
    if (await p.$('[data-tuto=saltar]')) { await p.click('[data-tuto=saltar]'); await p.waitForTimeout(400); }
  }
}

export const ir = async (p, ruta) => { await p.evaluate((r) => { location.hash = '#/' + r; }, ruta); await p.waitForTimeout(400); };
export const estado = (p) => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^pesitos:v1:[^e]/.test(x)); return JSON.parse(localStorage.getItem(k)); });
/** Cambia el estado guardado y recarga la pantalla. */
export async function cambiar(p, fn) {
  await p.evaluate((src) => {
    const k = Object.keys(localStorage).find((x) => /^pesitos:v1:[^e]/.test(x));
    const s = JSON.parse(localStorage.getItem(k)); (0, eval)(`(${src})`)(s); localStorage.setItem(k, JSON.stringify(s));
  }, fn.toString());
  await p.reload(); await p.waitForTimeout(1200);
  if (await p.$('.pin-teclado')) { for (const d of '2580') await p.click(`[data-pin="${d}"]`); await p.waitForTimeout(900); }
  if (await p.$('[data-tuto=saltar]')) { await p.click('[data-tuto=saltar]'); await p.waitForTimeout(400); }
}
export const texto = (p, sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
