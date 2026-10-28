# Pesitos · Tu economista de bolsillo

Web app de finanzas personales: registrás en segundos, se ordena sola, te dice cuánto podés gastar hoy y te ayuda a llegar a tus metas.

HTML, CSS y JavaScript sin frameworks ni build. Se instala en el celular como app (PWA).

## Cómo abrirla en VS Code

1. Descomprimí el zip y abrí la carpeta `pesitos` en VS Code.
2. Instalá la extensión **Live Server** (VS Code te la sugiere al abrir la carpeta).
3. Clic derecho en `index.html` → **Open with Live Server**.

Hace falta un servidor local porque la app usa módulos de JavaScript: abrir `index.html` con doble clic no funciona.

Al entrar te pide crear una cuenta o ingresar (mail y contraseña, o Google). Para que el ingreso funcione en tu compu con Live Server (que abre `127.0.0.1`), agregá `127.0.0.1` en Firebase → Authentication → Configuración → Dominios autorizados (`localhost` ya viene incluido).

### Probarla en el celular
Con Live Server corriendo, entrá desde el celular a `http://IP-DE-TU-COMPU:5500` (misma red Wi-Fi). Para instalarla como app y usar "Compartir → Pesitos" hace falta publicarla con HTTPS: se publica en Vercel (ver `DEPLOY.md`).

## Qué hace

| Pantalla | Qué tiene |
|---|---|
| **Arranque** | Charla guiada de 4 preguntas, todas salteables. Lo demás lo pregunta la app de a poco ("Pesitos quiere saber", máximo 3 por día) |
| **Inicio** | "Hoy podés gastar", carga rápida con Gasto/Ingreso, "Págate primero" (Ya lo aparté / Todavía no), meta principal, ¿Me lo compro?, cierre semanal, resumen de tarjeta, sugerencias de mejora, promos del día y contador de plata ahorrada |
| **Movimientos** | Ingresos y gastos por mes, gastos fijos con nombre libre (avisa si suben), comprobantes para confirmar, sugerencias de mejora |
| **Tarjetas** | Próximo resumen, cuotas pendientes (cuota X de N), compromisos de los próximos 6 meses, uso del límite |
| **Sueldo** | Evolución nominal vs real (ajustada por inflación), mejor mes, crecimiento real, cuánto pedir de aumento |
| **Ahorro** | Cuánto tenés, dónde y en qué moneda (pesos, dólares, euros, reales, cripto, oro…), cotizaciones en vivo, conversor, metas |
| **Asesor** | Forma de ahorrar elegida, reglas (5 incluidas + propias), desafíos (4 incluidos + propios), "Aprendé en 1 minuto", consultas |
| **Beneficios** | Promos de tus bancos, billeteras y tarjetas día por día (incluye los que agregues vos), filtro por rubro, promos propias |
| **Por pagar** | Agenda de vencimientos (fijos, resúmenes de tarjeta, pagos programados) y de cobros (sueldo, aguinaldo estimado, cobros propios, plazos fijos). Proyección de la plata hasta el cobro con alerta y opciones si no alcanza; vista lista o calendario; débitos automáticos; totales por cuenta; pagos parciales; ahorro de a poco para pagos grandes; historial de pagos a tiempo y aumentos; recordatorios en el calendario del celular (.ics) y avisos del dispositivo |
| **Tarjetas** (además) | Plan de pago del próximo resumen (cuánto cubre tu plata y cuánto saldría de ahorros), costo de pagar solo una parte (con la TNA del resumen), mejor día para compras grandes y aviso antes del cierre |
| **Herramientas** | ¿Me lo compro?, cuotas o contado, cuánto ahorrar por mes, cuánto rinde mi plata, conversor |
| **Buscar** | Búsqueda en vivo por texto, categoría, medio de pago, etiqueta, fechas y monto; exporta lo encontrado a Excel (CSV) |
| **Presupuestos** | Tope por categoría con barra de avance, sugerencia según tu promedio y aviso al pasar el 80 % y el 100 % |
| **Mis cuentas** | Saldo de cada cuenta (efectivo, bancos, billeteras) que se mueve solo con cada gasto, ingreso y pago; transferencias entre cuentas; patrimonio neto |
| **Deudas** | Lo que te deben y lo que debés, pagos parciales, recordatorio por WhatsApp; los gastos compartidos crean la deuda solos |
| **Estadísticas** | Torta por categoría, comparación con el período anterior, ingresos y gastos mes a mes, comercios, etiquetas y medios de pago; exporta a Excel o PDF |

Además: gastos en otras monedas (con la cotización del día), dividir un gasto en varias categorías, gastos compartidos, etiquetas (`#viaje`), deshacer al borrar, foto del ticket (se lee en el dispositivo), importar el resumen de la tarjeta (PDF) o el Excel/CSV del banco, bloqueo con huella o PIN, avisos en el celular con la app cerrada, atajos al mantener apretado el ícono, categorías propias, carga con fecha retroactiva ("15/10", "el lunes", "ayer" o el selector de fecha), resumen semanal automático cada lunes a las 00:00, confirmación del sueldo de cada mes y sugerencias ordenadas por impacto.

### Cotizaciones
- Dólar blue: [DolarApi.com](https://dolarapi.com), que toma los valores de DolarHoy.
- Euro, real, peso uruguayo y chileno: DolarApi.com.
- Bitcoin, Ethereum, USDT y oro (PAX Gold, 1 token = 1 onza): CoinGecko.
- Se actualizan cada 30 minutos o con el botón "Actualizar". Sin conexión usa las últimas guardadas.

### Promos
Se actualizan solas, gratis, desde el servicio de Pesitos en Vercel (`api/`):
- **Fuente principal:** [descuentos-ar-datos](https://github.com/lubelrivero-design/descuentos-ar-datos), que publica a diario las promos de más de 40 bancos y billeteras (la mantiene la app "Con qué pago").
- **Complemento opcional:** Tavily + Gemini (planes gratis) buscan los medios de pago que falten.
- Pesitos las cruza con tus medios de pago y tu provincia. `js/promosrespaldo.js` queda solo como respaldo.

### Sugerencias de mejora
Pesitos revisa lo que cargaste y propone correcciones: gastos cargados como fijos que en realidad varían, gastos anotados dos veces (como fijo y como gasto) y pagos que se repiten todos los meses y conviene pasar a fijos.

### Carga rápida: ejemplos que entiende
- `Supermercado 48.000` · `Nafta 30.000 ayer` · `Café 2.500`
- `Heladera 540.000 en 12 cuotas visa` (si el texto nombra una tarjeta cargada, la compra va a esa tarjeta)
- Con el botón **Ingreso**: `Sueldo 1.200.000` · `Venta 85.000`
- Texto de un comprobante: `Pagaste $ 12.500,00 a FARMACITY`
- También entiende formas coloquiales ("48 lucas", "1,2 palos").

Si corregís la categoría de un gasto, la próxima vez la reconoce sola.

## Estructura

Misma base que DBTYCS y Rutenda: archivos principales en la raíz, una carpeta `js/` plana con un archivo por función, `api/` para el servidor y las reglas de Firebase en el repositorio.

```
pesitos/
├── index.html              Estructura base y navegación
├── main.js                 Arranque: cuenta, nube, navegación y eventos
├── styles.css              Estilos (colores de la marca y tema oscuro en :root)
├── manifest.webmanifest    PWA: ícono, nombre y "Compartir → Pesitos"
├── sw.js                   Funcionamiento sin conexión
├── firestore.rules         Reglas de seguridad de Firestore (se pegan en la consola)
├── vercel.json             Tareas programadas y configuración de Vercel
├── package.json            Dependencias del servidor (firebase-admin, web-push)
├── pages/                  terminos.html y privacidad.html
├── assets/                 Íconos de la app y vendor/ (Tesseract, pdf.js y SheetJS, para leer tickets y resúmenes en el dispositivo)
├── api/                    Servidor en Vercel: datos.js, actualizar.js y _lib/
└── js/
    ├── firebaseconfig.js   Conexión con Firebase (Authentication + Firestore)
    ├── autenticacion.js    Ingreso, crear cuenta, Google, verificación, Mi cuenta
    ├── sincronizacion.js   Tus datos en la nube (usuarios/{uid}), cifrados, con cola de pendientes
    ├── cifrado.js          Cifrado de extremo a extremo (AES-GCM + PBKDF2, llave en el dispositivo)
    ├── clave.js            Clave de Pesitos y código de recuperación (charla)
    ├── rendimientos.js     Cuánto rinden billeteras y plazos fijos (TNA automática, ArgentinaDatos)
    ├── feriados.js         Días hábiles, feriados y día de cobro (1.er hábil, último hábil…)
    ├── almacenamiento.js   Copia local por cuenta y estructura de los datos
    ├── menu.js             Menú ☰: Mis datos, tema, letra, copia, Mi cuenta…
    ├── tema.js             Tema claro/oscuro y tamaño de letra
    ├── bienvenida.js       Charla de arranque
    ├── inicio.js           Pantalla principal
    ├── movimientos.js · tarjetas.js · pagos.js · sueldo.js · ahorro.js
    ├── asesor.js · beneficios.js · herramientas.js     (una pantalla por archivo)
    ├── calculos.js         Presupuesto, reglas, metas, sueldo real, tarjetas
    ├── agenda.js · flujo.js   Vencimientos, cobros y proyección de la plata
    ├── cotizaciones.js     Cotizaciones en vivo y conversor
    ├── datosvivos.js       Inflación y promos que se actualizan solas
    ├── promosrespaldo.js   Promos de respaldo (se ocultan solas al vencer)
    ├── guia.js             Preguntas de a poco y sugerencias de mejora
    ├── economista.js       Consejos automáticos y respuestas del asesor
    ├── aprender.js         Lecciones de 1 minuto
    ├── interprete.js       Entiende "súper 48 lucas"
    ├── categorias.js       Categorías, medios de pago, provincias y desafíos
    ├── acciones.js         Acciones compartidas (carga, edición, copias)
    ├── ejemplo.js          Datos de ejemplo
    ├── cuentas.js · miscuentas.js     Saldos por cuenta, transferencias y patrimonio
    ├── presupuestos.js · deudas.js · buscar.js · estadisticas.js   (una pantalla por archivo)
    ├── exportar.js         Excel (CSV) y PDF
    ├── ticket.js           Foto del ticket (OCR en el dispositivo)
    ├── importar.js         Importar resumen de tarjeta (PDF) o Excel/CSV del banco
    ├── bloqueo.js          Bloqueo con huella o PIN
    ├── avisos.js           Avisos en el celular (push)
    └── formato.js · interfaz.js   Formatos, íconos, logo y modales
```

Para agregar una acción: poné `data-action="miAccion"` en un botón (o `data-submit` en un form) y definí `miAccion(ctx, el)` en el `actions` de la pantalla.

## Cuentas y datos
- La cuenta es obligatoria: mail y contraseña (con verificación de mail) o Google.
- Tus datos se cifran en el dispositivo (AES-GCM) con una llave que solo abre tu **clave de Pesitos** o tu **código de recuperación**: en Firestore (`usuarios/{uid}`) solo hay texto ilegible y nadie más puede leerlo, ni quien administra el proyecto (`js/cifrado.js`, `firestore.rules`).
- Encabezados de seguridad (CSP, HSTS, X-Frame-Options…) en `vercel.json`. Si cambiás el `<script>` de `index.html` o de `pages/`, hay que actualizar su hash en la CSP. El dispositivo guarda una copia para abrir rápido y funcionar sin conexión; lo que cargás sin internet se envía solo cuando vuelve.
- Avisos en el celular (opcional): si los activás, se guarda sin cifrar solo **qué días** hay algo y cuántas cosas (`usuarios/{uid}/avisos/agenda`) y la suscripción del navegador (`usuarios/{uid}/push`). Nunca montos ni nombres.
- La clave de Pesitos es libre (la que quieras); cuanto más larga, más segura.
- Desde *Menú → Copia de seguridad* podés descargar o restaurar un archivo, y desde *Menú → Mi cuenta*, eliminar la cuenta con todos sus datos.
- Las recomendaciones son educativas y generales, no asesoramiento financiero personalizado.

## Próximos pasos
1. **Asesor con IA**: conectar `economista.js` a un modelo desde una función de Vercel (`api/`).
2. App nativa de Android con Capacitor para leer notificaciones de pago.
