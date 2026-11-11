# Revisión de Pesitos

Este archivo dice **qué depende de afuera** y **cómo revisar que la app siga al día**.
Cuando Franco pida "novedades", "revisá la app" o algo parecido, seguí el paso a paso de abajo en orden.

---

## 1. Lo que se revisa solo (no hay que hacer nada)

El cron de Vercel (`vercel.json`, todos los días a las 9 y a las 15 h de Argentina) corre `api/actualizar.js` y:

- trae las promos (descuentos-ar-datos) y la inflación (INDEC);
- prueba cada API externa que usa la app (`api/_lib/chequeo.js`): si responde y si el formato es el esperado;
- se fija si hay versiones nuevas de las librerías (firebase, firebase-admin, web-push);
- guarda el resultado en Firestore (`publico/datos.salud`);
- si algo falla **dos chequeos seguidos**, manda un aviso al celular del dueño (`OWNER_EMAIL` en Vercel, con los avisos activados en la app). Como máximo, un aviso por día.

Para verlo desde la app: **Menú ☰ → Estado de la app**.

---

## 2. Dependencias externas

| Qué | Para qué | Dónde está en el código | Se chequea solo |
|---|---|---|---|
| descuentos-ar-datos (GitHub, raw) | Promos de bancos y billeteras | `api/_lib/fuente.js` | Sí (fecha y cantidad) |
| Tavily + Gemini | Promos de Banco Nación y Naranja que la fuente no trae | `api/_lib/complemento.js` | Sí, en `status.complemento` |
| datos.gob.ar series (IPC) | Inflación | `api/_lib/actualizar.js`, `js/datosvivos.js` | Sí |
| datos.gob.ar georef | Ciudades por provincia | `js/ciudades.js` | Sí |
| DolarApi | Dólar oficial, blue, tarjeta, MEP; euro, real | `js/cotizaciones.js` | Sí |
| open.er-api.com | Otras monedas | `js/cotizaciones.js` | Sí |
| CoinGecko | Bitcoin, ethereum, USDT, oro | `js/cotizaciones.js` | Sí |
| ArgentinaDatos `/feriados` | Feriados (cobro del sueldo, vencimientos) | `js/feriados.js` | Sí; desde noviembre, también el año siguiente |
| ArgentinaDatos `/finanzas/...` | Plazo fijo, billeteras que rinden, FCI, letras | `js/rendimientos.js`, `js/inversiones.js` | Sí |
| Firebase JS (gstatic, versión fija en las URLs) | Login, base de datos, avisos | `js/autenticacion.js`, `js/sincronizacion.js`, `js/avisos.js`, `js/firebaseconfig.js` | Avisa si hay versión mayor nueva |
| firebase-admin, web-push (npm) | Servidor y avisos push | `package.json` | Avisa si hay versión mayor nueva |
| Google Fonts | Tipografía | `index.html` | No: si falla, usa la letra del sistema |
| Tesseract, pdf.js, SheetJS | Leer tickets, resúmenes en PDF y Excel | `assets/vendor/` (copias locales) | No hace falta: están dentro del repo |

Si se agrega una API nueva, sumala acá, en `FUENTES` de `api/_lib/chequeo.js` y en el `connect-src` de `vercel.json`.

---

## 3. Valores fijos que pueden quedar viejos

Estos no vienen de ninguna API: hay que confirmarlos con una búsqueda web en cada revisión.

| Valor | Dónde | Qué buscar |
|---|---|---|
| Percepción 30% por consumos en dólares (RG 5617/2024) | `PERCEPCION_USD` en `js/agenda.js` | Si cambió o se eliminó la percepción del dólar tarjeta |
| IVA 21% sobre intereses y mantenimiento de tarjeta | `js/agenda.js`, `js/flujo.js` | Normalmente no cambia |
| Promos de respaldo (si falla la fuente) | `PROMO_CATALOG` en `js/promosrespaldo.js` | Si el mes quedó muy viejo, actualizarlo o vaciarlo |
| Modelos de Gemini | `api/_lib/complemento.js` (`gemini-flash-latest`…) | Si Google los dio de baja (se ve en `status.complemento`) |
| Límites gratis de Vercel Hobby, Firebase Spark, Tavily y Gemini | — | Que todo siga siendo gratis |

---

## 4. Paso a paso cuando Franco pide novedades

1. **Traer el código actual.** `git clone --depth 1 https://github.com/francop98/pesitos` (no confiar en copias viejas).
2. **Leer el estado automático.** Abrir `https://pesitos-one.vercel.app/api/datos` y mirar `salud` (`problemas`, `externas.fuentes`, `externas.pendientes`, `fuente.fecha`, `ipc.ultimo`). Si no se puede abrir desde la sesión, pedirle a Franco una captura de **Menú → Estado de la app**.
3. **Fuente de promos.** Fecha del último cambio de `lubelrivero-design/descuentos-ar-datos`. Si tiene más de 2 días, **decírselo a Franco**.
4. **Valores fijos.** Repasar la tabla 3 con búsquedas web (fecha actual en la búsqueda). Anotar lo que cambió, con la fuente.
5. **Versiones.** Si `pendientes` dice que hay versión mayor nueva de firebase o firebase-admin, proponerla, pero no actualizar sin probar: cambia la API.
6. **Feriados del año que viene.** Desde noviembre, confirmar que ya estén. Si no, no es urgente; la app usa los del año en curso.
7. **Probar la app.** Correr la app local con Playwright (servidor estático + Firebase falso) y recorrer pantallas a 320, 375, 414, 768 y 1280 px, sin errores de consola y sin scroll del fondo con modales abiertos.
8. **Si hay que cambiar algo:**
   - subir la versión de caché en `sw.js` (`pesitos-vNN`);
   - entregar un zip **solo con los archivos modificados**, nombrado `pesitos-cambios-vNN.zip`;
   - responder en español rioplatense y terminar con los pasos de git.
9. **Anotar la revisión** al final de este archivo (fecha + qué se encontró).

### Reglas que no se rompen

- Nunca subir a GitHub el JSON de la cuenta de servicio ni archivos `.env`.
- Las claves van solo en las variables de entorno de Vercel (`FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` solo letras y números, `VAPID_PRIVATE_KEY`, `OWNER_EMAIL`, `TAVILY_API_KEY`, `GEMINI_API_KEY`).
- Todo gratis: no proponer servicios pagos.
- No crear cuentas en nombre de Franco.
- El nombre es "Pesitos"; solo el logo dice "pe$itos".

---

## Registro de revisiones

- 2026-11-11: se crea este archivo y el chequeo automático de fuentes externas (v35). Promos al día (fuente del 5/11 en la última mirada). Percepción del 30% vigente (Fortuna Web, sept. 2026).
