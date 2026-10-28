# Publicar Pesitos en Vercel

Mismo esquema que DBTYCS: GitHub + Vercel (la app y las funciones de `/api`) + Firebase (Firestore).
Se configura **una sola vez**. Después, cada vez que subís cambios a GitHub, Vercel publica solo, y los datos se actualizan solos.

## Qué se actualiza solo

| Dato | De dónde sale | Cada cuánto |
|---|---|---|
| Dólar blue | DolarHoy, vía DolarApi.com | Cada 5 minutos y al volver a la app |
| Euro, real, peso uruguayo y chileno | DolarApi.com | Cada 5 minutos |
| Bitcoin, Ethereum, USDT, oro | CoinGecko | Cada 5 minutos |
| Inflación (IPC INDEC) | API oficial de series de tiempo (datos.gob.ar); respaldo: `/api/datos` | Cada 6 horas |
| Promos de bancos, billeteras y tarjetas | Fuente gratuita [descuentos-ar-datos](https://github.com/lubelrivero-design/descuentos-ar-datos) (la publica a diario la app "Con qué pago"); lo que falta lo completan Tavily + Gemini (opcional, gratis). Se guarda en Firestore | Todos los días a las 9:00 y a las 15:00 (Vercel Cron) |

## Puesta en marcha (una vez)

### 1. Firebase
- Firestore creada (ya está).
- **Cuenta de servicio:** Consola de Firebase → ⚙️ Configuración del proyecto → *Cuentas de servicio* → **Generar nueva clave privada**. Se descarga un archivo `.json`. **No lo subas a GitHub.**

### 2. Complemento de promos (opcional, gratis, sin tarjeta)
Sirve para los bancos que la fuente principal no cubre (por ejemplo Banco Nación o los que agregues vos). Sin estas claves la app funciona igual.
- **Tavily** (buscador): entrá a https://app.tavily.com, creá la cuenta y copiá la API key. Plan gratis: 1.000 búsquedas por mes; Pesitos usa como máximo unas 190.
- **Gemini** (lee las notas): entrá a https://aistudio.google.com → *Get API key* → **Create API key**. No actives la facturación: el plan gratis alcanza.

### 3. Vercel
1. **Add New → Project** → importá el repositorio de Pesitos desde GitHub.
2. *Framework Preset*: **Other**. Sin comando de build. Directorio raíz: el del proyecto.
3. En *Settings → Environment Variables* (Production y Preview), agregá:

| Variable | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | El contenido completo del `.json` de la cuenta de servicio (todo, con las llaves) |
| `CRON_SECRET` | Una clave inventada **solo con letras y números** (sin `$` ni símbolos) |
| `TAVILY_API_KEY` | Opcional. La clave de Tavily |
| `GEMINI_API_KEY` | Opcional. La clave de Gemini |
| `GEMINI_MODEL` | Opcional. Por defecto usa el Gemini Flash más nuevo |

4. **Deploy.** Vercel te da la dirección: `https://pesitos.vercel.app` (o la que elijas).
5. **Primera carga de promos:** *Settings → Cron Jobs* → en `/api/actualizar` tocá **Run**. Tarda unos segundos. Después corre solo dos veces por día.

### 4. En el celular
Abrí la dirección de Vercel → menú del navegador → **Agregar a pantalla de inicio**.

## Archivos del servidor
```
api/
├── datos.js            Lo que lee la app: promos vigentes (de tu provincia) e inflación
├── actualizar.js       Tarea programada (Vercel Cron) protegida con CRON_SECRET
└── _lib/
    ├── actualizar.js   Junta todo, valida y guarda en Firestore
    ├── fuente.js       Fuente principal de promos (descuentos-ar-datos)
    ├── complemento.js  Tavily + Gemini para los medios que faltan
    ├── zona.js         Promos por provincia
    └── firebase.js     Firebase Admin con FIREBASE_SERVICE_ACCOUNT_JSON
vercel.json             Programación: 9:00 y 15:00 todos los días (hora de Argentina)
package.json            Dependencia firebase-admin para las funciones
```

## Si algo falla
- **Vercel → Logs** muestra el error de cada función.
- La respuesta de `/api/actualizar` (y Firestore → `publico/datos` → `status`) dice si cada parte anduvo: fuente, complemento e inflación.
- Si una actualización falla, la app sigue usando las promos guardadas (las vencidas se ocultan solas) y se reintenta en la próxima corrida.

## Costo
**$0.** GitHub, Vercel (Hobby), Firebase (Spark), la fuente de promos, Tavily y Gemini (planes gratis) no cobran. Ninguno pide tarjeta.
- `401` en `/api/actualizar` = `CRON_SECRET` mal cargado.
