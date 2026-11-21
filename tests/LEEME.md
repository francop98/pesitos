# Pruebas de Pesitos

Esta carpeta no se publica (está en `.vercelignore`): es solo para revisar la app antes de subir cambios.

## 1. Chequeo rápido (solo hace falta Node)

Desde la carpeta del proyecto:

```
node tests/chequear-archivos.mjs
```

Revisa que la lista de `sw.js` esté completa, que no falte ningún archivo importado y que los HTML no tengan CSS ni JS escritos adentro. Tarda menos de un segundo.

## 2. Pruebas de punta a punta (abren la app en un navegador)

La primera vez:

```
cd tests
npm install
npx playwright install chromium
```

Después, cada vez:

```
cd tests
npm test
```

Abren la app en Chromium, sin internet y con un Firebase de mentira (`firebase-de-prueba/`: guarda todo en el navegador, no toca tu cuenta ni la nube). Recorren la bienvenida en un celular, Inicio, Movimientos, Estadísticas, Por pagar, Mi plata, el cuadre con el banco y el resumen del mes. Al final dicen cuántas pasaron; si alguna falla, dice cuál.

Para sumar una prueba: agregala en `pruebas.mjs` con `ok('Qué se prueba', condición)`.
