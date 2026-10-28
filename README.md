# Pesitos · Tu economista de bolsillo

Web app de finanzas personales: registrás en segundos, se ordena sola, te dice cuánto podés gastar hoy y te ayuda a llegar a tus metas.

HTML, CSS y JavaScript sin frameworks ni build. Se instala en el celular como app (PWA).

## Cómo abrirla en VS Code

1. Descomprimí el zip y abrí la carpeta `pesitos` en VS Code.
2. Instalá la extensión **Live Server** (VS Code te la sugiere al abrir la carpeta).
3. Clic derecho en `index.html` → **Open with Live Server**.

Hace falta un servidor local porque la app usa módulos de JavaScript: abrir `index.html` con doble clic no funciona.

Al entrar podés arrancar con tus datos o tocar **Ver la app con datos de ejemplo**.

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

Además: categorías propias, carga con fecha retroactiva ("15/10", "el lunes", "ayer" o el selector de fecha), resumen semanal automático cada lunes a las 00:00, confirmación del sueldo de cada mes y sugerencias ordenadas por impacto.

### Cotizaciones
- Dólar blue: [DolarApi.com](https://dolarapi.com), que toma los valores de DolarHoy.
- Euro, real, peso uruguayo y chileno: DolarApi.com.
- Bitcoin, Ethereum, USDT y oro (PAX Gold, 1 token = 1 onza): CoinGecko.
- Se actualizan cada 30 minutos o con el botón "Actualizar". Sin conexión usa las últimas guardadas o el dólar de respaldo de Ajustes.

### Promos
Se actualizan solas, gratis, desde el servicio de Pesitos en Vercel (`api/`):
- **Fuente principal:** [descuentos-ar-datos](https://github.com/lubelrivero-design/descuentos-ar-datos), que publica a diario las promos de más de 40 bancos y billeteras (la mantiene la app "Con qué pago").
- **Complemento opcional:** Tavily + Gemini (planes gratis) buscan los medios de pago que falten.
- Pesitos las cruza con tus medios de pago y tu provincia. `js/promos-catalog.js` queda solo como respaldo.

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

```
pesitos/
├── index.html              Estructura base y navegación
├── manifest.webmanifest    PWA: ícono, nombre y "Compartir → Pesitos"
├── sw.js                   Funcionamiento sin conexión
├── css/styles.css          Estilos (colores de la marca en :root)
├── assets/                 Íconos de la app
└── js/
    ├── app.js              Arranque, navegación y eventos
    ├── store.js            Guardado de datos (hoy en el dispositivo)
    ├── firebase.js         Plantilla para pasar a Firebase
    ├── calc.js             Presupuesto, reglas, metas, sueldo real, tarjetas
    ├── rates.js            Cotizaciones en vivo y conversor
    ├── promos-catalog.js   Promos de referencia (actualizar cada mes)
    ├── guide.js            Preguntas de a poco y sugerencias de mejora
    ├── advisor.js          Consejos automáticos y respuestas del asesor
    ├── parser.js           Entiende "súper 48 lucas"
    ├── categories.js       Categorías, tipos de ahorro y desafíos
    ├── actions.js          Acciones compartidas (carga, edición, ajustes)
    ├── demo.js             Datos de ejemplo
    ├── format.js / ui.js   Formatos, íconos, logo y modales
    └── views/              Una pantalla por archivo
```

Para agregar una acción: poné `data-action="miAccion"` en un botón (o `data-submit` en un form) y definí `miAccion(ctx, el)` en el `actions` de la pantalla.

## Datos importantes
- **La inflación de los datos de ejemplo es inventada.** Con tus datos, cargá el IPC mensual del INDEC en *Sueldo → Inflación mensual*.
- Las promos de ejemplo también son inventadas: cargá las de tus bancos en *Asesor → Tus promos*.
- Los datos quedan en el navegador del dispositivo. Desde *Ajustes* (tu inicial arriba a la derecha) podés exportar e importar una copia.
- Las recomendaciones son educativas y generales, no asesoramiento financiero personalizado.

## Próximos pasos
1. **Publicar en Vercel** (ver `DEPLOY.md`) y sumar login con Google + sincronización entre dispositivos con Firebase (ver `js/firebase.js`).
2. **Importar el resumen de la tarjeta** en PDF.
3. **Asesor con IA**: conectar `advisor.js` a un modelo desde una función de Vercel (`api/`).
4. **Leer comprobantes en imagen** (captura de pantalla).
5. App nativa de Android con Capacitor para leer notificaciones de pago.
