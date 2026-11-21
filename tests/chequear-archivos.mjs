// Chequeo rápido, sin instalar nada (solo Node): antes de subir cambios, corré
//   node tests/chequear-archivos.mjs
// Revisa que:
//  1. la lista de sw.js (SHELL) tenga todos los archivos de la app y ninguno que no exista
//     (si falta uno, la app no anda sin conexión; si sobra uno, el service worker no se instala);
//  2. cada @import de styles.css apunte a un archivo que existe;
//  3. cada import entre archivos JS apunte a un archivo que existe;
//  4. no haya CSS ni JS escritos dentro de los .html (cada lenguaje en su archivo).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');
const lista = (dir, ext) => readdirSync(join(RAIZ, dir)).filter((f) => f.endsWith(ext)).map((f) => `${dir}/${f}`);
const errores = [];

// 1. sw.js
const sw = leer('sw.js');
const shell = [...sw.slice(sw.indexOf('const SHELL')).split('];')[0].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
const deben = ['index.html', 'manifest.webmanifest', 'styles.css', 'main.js', ...lista('css', '.css'), ...lista('js', '.js'), ...lista('pages', '.html')];
for (const f of deben) if (!shell.includes(f)) errores.push(`sw.js: falta './${f}' en la lista SHELL`);
for (const f of shell) if (!existsSync(join(RAIZ, f))) errores.push(`sw.js: './${f}' está en la lista pero el archivo no existe`);
const version = (sw.match(/const CACHE = '([^']+)'/) || [])[1];

// 2. styles.css
for (const m of leer('styles.css').matchAll(/@import url\("([^"]+)"\)/g)) if (!existsSync(join(RAIZ, m[1]))) errores.push(`styles.css: importa ${m[1]}, que no existe`);
const importados = [...leer('styles.css').matchAll(/@import url\("([^"]+)"\)/g)].map((m) => m[1]);
for (const f of lista('css', '.css')) if (!importados.includes(f)) errores.push(`styles.css: ${f} existe pero no se importa`);

// 3. imports de JS
for (const f of ['main.js', ...lista('js', '.js')]) {
  for (const m of leer(f).matchAll(/(?:^|\n)\s*import[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
    const destino = normalize(join(dirname(f), m[1]));
    if (!existsSync(join(RAIZ, destino))) errores.push(`${f}: importa ${m[1]}, que no existe`);
  }
}

// 4. nada de <style>, style="" ni <script> con código dentro de los HTML
for (const f of ['index.html', ...lista('pages', '.html')]) {
  const h = leer(f);
  if (/<style[\s>]/i.test(h)) errores.push(`${f}: tiene un bloque <style> (va en css/)`);
  if (/\sstyle="/i.test(h)) errores.push(`${f}: tiene un atributo style="" (va en css/)`);
  for (const m of h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/\ssrc=/.test(m[1]) && m[2].trim()) errores.push(`${f}: tiene JS escrito adentro (va en js/)`);
}

if (errores.length) {
  console.log(`✗ ${errores.length} problema${errores.length === 1 ? '' : 's'}:`);
  for (const e of errores) console.log('  - ' + e);
  process.exit(1);
}
console.log(`✓ Todo en orden: ${shell.length} archivos en sw.js (${version}), CSS e imports completos, HTML sin CSS ni JS adentro.`);
