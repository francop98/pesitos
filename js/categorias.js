// Catálogos: categorías de gasto, formas de ahorro, monedas,
// medios de pago y desafíos.

// Las palabras van sin tildes y en minúscula. Pueden ser frases ("bienes personales").
// Los ids viejos (super, comida, delivery, …) no cambian: los gastos guardados siguen iguales.
export const CATEGORIES = [
  { id: 'super', short: 'Súper', label: 'Supermercado', icon: 'cart', words: ['super', 'supermercado', 'supermercados', 'coto', 'carrefour', 'dia', 'jumbo', 'disco', 'vea', 'changomas', 'chango mas', 'cooperativa', 'supercoop', 'almacen', 'verduleria', 'verdura', 'verduras', 'fruta', 'frutas', 'carniceria', 'carne', 'pollo', 'polleria', 'pescaderia', 'fiambreria', 'fiambre', 'chino', 'autoservicio', 'mayorista', 'makro', 'vital', 'yaguar', 'maxiconsumo', 'diarco', 'toledo', 'anonima', 'la anonima', 'libertad', 'walmart', 'hiper', 'hipermercado', 'mercado', 'compras', 'mercaderia', 'leche', 'pan', 'huevos', 'yerba', 'dietetica', 'granja', 'feria', 'devoto', 'tata', 'cordiez', 'mami', 'el abastecedor'] },
  { id: 'comida', short: 'Comida', label: 'Comida afuera', icon: 'food', words: ['resto', 'restaurante', 'restaurant', 'restoran', 'bar', 'cafe', 'cafeteria', 'cafecito', 'almuerzo', 'cena', 'desayuno', 'merienda', 'brunch', 'birra', 'cerveza', 'cerveceria', 'vino', 'tragos', 'pizza', 'pizzeria', 'empanadas', 'burger', 'hamburguesa', 'hamburgueseria', 'mcdonalds', 'mc donalds', 'burger king', 'mostaza', 'kfc', 'starbucks', 'havanna', 'cafe martinez', 'bonafide', 'freddo', 'grido', 'helado', 'heladeria', 'panaderia', 'facturas', 'medialunas', 'parrilla', 'asado', 'sushi', 'milanesa', 'lomito', 'choripan', 'pancho', 'rotiseria', 'vianda', 'comedor', 'buffet', 'cantina', 'bodegon', 'tenedor libre', 'take away', 'propina'] },
  { id: 'delivery', short: 'Delivery', label: 'Delivery', icon: 'bike', words: ['delivery', 'pedidosya', 'pedidos ya', 'rappi', 'pedido', 'didi food', 'uber eats', 'envio comida'] },
  { id: 'kiosco', short: 'Kiosco', label: 'Kiosco y antojos', icon: 'candy', words: ['kiosco', 'kiosko', 'maxikiosco', 'golosina', 'golosinas', 'alfajor', 'alfajores', 'chocolate', 'chicle', 'caramelos', 'gaseosa', 'coca', 'agua mineral', 'snack', 'papas fritas', 'cigarrillos', 'puchos', 'atado', 'tabaco', 'vape', 'oxxo', 'antojo'] },
  { id: 'transporte', short: 'Transporte', label: 'Transporte y auto', icon: 'fuel', words: ['nafta', 'ypf', 'shell', 'axion', 'puma', 'gulf', 'combustible', 'gasoil', 'gnc', 'carga nafta', 'sube', 'colectivo', 'bondi', 'subte', 'tren', 'micro', 'uber', 'cabify', 'didi', 'taxi', 'remis', 'peaje', 'autopista', 'telepase', 'estacionamiento', 'parking', 'cochera', 'mecanico', 'taller', 'service', 'gomeria', 'cubiertas', 'neumaticos', 'aceite', 'lavadero de autos', 'lavado auto', 'repuestos', 'seguro auto', 'seguro del auto', 'patente', 'auto', 'moto', 'bici', 'bicicleta', 'monopatin'] },
  { id: 'vivienda', short: 'Vivienda', label: 'Alquiler y expensas', icon: 'key', words: ['alquiler', 'expensas', 'inmobiliaria', 'hipoteca', 'cuota casa', 'consorcio', 'deposito garantia', 'garantia', 'administracion'] },
  { id: 'servicios', short: 'Servicios', label: 'Servicios (luz, gas, internet)', icon: 'bolt', words: ['luz', 'gas', 'agua', 'edenor', 'edesur', 'edelap', 'edea', 'epec', 'epe', 'edet', 'eden', 'edes', 'metrogas', 'naturgy', 'camuzzi', 'litoral gas', 'ecogas', 'gasnor', 'aysa', 'absa', 'aguas', 'internet', 'wifi', 'fibra', 'telecentro', 'fibertel', 'personal', 'movistar', 'claro', 'tuenti', 'telefono', 'celular', 'abono', 'recarga', 'cable', 'directv', 'flow', 'telered', 'garrafa', 'servicio', 'servicios', 'factura'] },
  { id: 'hogar', short: 'Hogar', label: 'Hogar', icon: 'home', words: ['ferreteria', 'pintureria', 'limpieza', 'articulos de limpieza', 'muebles', 'mueble', 'colchon', 'easy', 'sodimac', 'blaisten', 'bazar', 'lavadero', 'lavanderia', 'tintoreria', 'heladera', 'lavarropas', 'cocina', 'horno', 'microondas', 'aire acondicionado', 'ventilador', 'estufa', 'decoracion', 'deco', 'plantas', 'vivero', 'jardin', 'plomero', 'electricista', 'gasista', 'cerrajero', 'arreglo', 'reparacion', 'empleada', 'limpieza casa', 'muchacha', 'mudanza', 'sabanas', 'toallas', 'cortinas', 'lampara', 'focos'] },
  { id: 'salud', short: 'Salud', label: 'Salud', icon: 'heart', words: ['farmacia', 'farmacity', 'medico', 'medica', 'remedio', 'remedios', 'medicamento', 'medicamentos', 'dentista', 'odontologo', 'ortodoncia', 'analisis', 'laboratorio', 'consulta', 'turno medico', 'guardia', 'clinica', 'sanatorio', 'hospital', 'prepaga', 'obra social', 'osde', 'swiss medical', 'galeno', 'omint', 'medife', 'sancor salud', 'ioma', 'optica', 'anteojos', 'lentes', 'psicologo', 'psicologa', 'terapia', 'kinesiologo', 'kinesiologia', 'nutricionista', 'vacuna', 'estudios'] },
  { id: 'cuidado', short: 'Cuidado', label: 'Cuidado personal', icon: 'sparkle', words: ['peluqueria', 'peluquero', 'barberia', 'barbero', 'corte de pelo', 'perfumeria', 'perfume', 'cosmeticos', 'maquillaje', 'manicura', 'unas', 'depilacion', 'cera', 'shampoo', 'crema', 'desodorante', 'cepillo', 'afeitadora', 'spa', 'masajes', 'estetica', 'tintura', 'simplicity', 'pigmento', 'rouge'] },
  { id: 'ropa', short: 'Ropa', label: 'Ropa y calzado', icon: 'shirt', words: ['ropa', 'zapatillas', 'zapatos', 'botas', 'ojotas', 'remera', 'remeras', 'jean', 'jeans', 'pantalon', 'campera', 'buzo', 'camisa', 'vestido', 'pollera', 'medias', 'ropa interior', 'malla', 'cartera', 'mochila', 'nike', 'adidas', 'puma ropa', 'zara', 'h&m', 'shein', 'dexter', 'moov', 'grimoldi', 'cheeky', 'mimo', 'falabella', 'tienda', 'indumentaria', 'calzado', 'outlet', 'reloj', 'anillo', 'bijou'] },
  { id: 'ocio', short: 'Salidas', label: 'Salidas y ocio', icon: 'ticket', words: ['cine', 'cinemark', 'hoyts', 'recital', 'show', 'concierto', 'entrada', 'entradas', 'teatro', 'boliche', 'fiesta', 'juego', 'juegos', 'steam', 'playstation', 'xbox', 'nintendo', 'salida', 'previa', 'museo', 'parque', 'karaoke', 'bowling', 'escape', 'casino', 'quiniela', 'loteria', 'apuesta', 'bingo', 'ticketek', 'all access', 'passline'] },
  { id: 'suscripciones', short: 'Suscripciones', label: 'Suscripciones', icon: 'repeat', words: ['netflix', 'spotify', 'disney', 'disney+', 'hbo', 'max', 'prime', 'prime video', 'amazon prime', 'paramount', 'star+', 'apple tv', 'youtube', 'youtube premium', 'icloud', 'google one', 'google drive', 'chatgpt', 'openai', 'claude', 'canva', 'adobe', 'office', 'microsoft 365', 'dropbox', 'deezer', 'tidal', 'crunchyroll', 'mubi', 'suscripcion', 'membresia', 'meli+', 'nivel 6', 'patreon', 'twitch'] },
  { id: 'deporte', short: 'Deporte', label: 'Deporte y gimnasio', icon: 'dumbbell', words: ['gym', 'gimnasio', 'smart fit', 'smartfit', 'megatlon', 'sportclub', 'sport club', 'club', 'cuota club', 'padel', 'paddle', 'futbol', 'cancha', 'tenis', 'natacion', 'pileta', 'yoga', 'pilates', 'crossfit', 'funcional', 'running', 'maraton', 'boxeo', 'entrenador', 'personal trainer', 'deporte', 'deportes', 'suplementos', 'proteina', 'decathlon'] },
  { id: 'tecnologia', short: 'Tecnología', label: 'Tecnología', icon: 'laptop', words: ['notebook', 'computadora', 'compu', 'pc', 'monitor', 'teclado', 'mouse', 'auriculares', 'parlante', 'cargador', 'cable usb', 'iphone', 'samsung', 'motorola', 'xiaomi', 'apple', 'tablet', 'ipad', 'smart tv', 'televisor', 'tele', 'consola', 'fravega', 'garbarino', 'musimundo', 'compumundo', 'naldo', 'mercado libre', 'mercadolibre', 'meli', 'tecnologia', 'impresora', 'pendrive', 'disco externo', 'funda', 'templado', 'arreglo celular'] },
  { id: 'educacion', short: 'Educación', label: 'Educación', icon: 'book', words: ['curso', 'cursos', 'libro', 'libros', 'facultad', 'universidad', 'colegio', 'escuela', 'jardin de infantes', 'cuota colegio', 'matricula', 'utiles', 'libreria', 'fotocopias', 'apuntes', 'clases', 'clase particular', 'profesor', 'ingles', 'idiomas', 'udemy', 'coursera', 'platzi', 'coderhouse', 'posgrado', 'maestria', 'diplomatura', 'capacitacion'] },
  { id: 'chicos', short: 'Hijos', label: 'Hijos', icon: 'baby', words: ['panales', 'pañales', 'bebe', 'mamadera', 'leche de formula', 'guarderia', 'jardin maternal', 'juguete', 'juguetes', 'jugueteria', 'cochecito', 'babysitter', 'nineras', 'niñera', 'colonia', 'cumple infantil', 'mundo bebe', 'hijos', 'hijo', 'hija'] },
  { id: 'mascotas', short: 'Mascotas', label: 'Mascotas', icon: 'paw', words: ['veterinaria', 'veterinario', 'vete', 'mascota', 'mascotas', 'perro', 'gato', 'balanceado', 'alimento perro', 'alimento gato', 'piedritas', 'pet shop', 'petshop', 'puppis', 'pipeta', 'antipulgas', 'paseador', 'guarderia canina', 'royal canin', 'pro plan', 'dog chow', 'cat chow', 'excellent'] },
  { id: 'viajes', short: 'Viajes', label: 'Viajes y vacaciones', icon: 'plane', words: ['viaje', 'viajes', 'vacaciones', 'pasaje', 'pasajes', 'vuelo', 'avion', 'aerolineas', 'aerolineas argentinas', 'flybondi', 'jetsmart', 'latam', 'hotel', 'hostel', 'airbnb', 'booking', 'despegar', 'almundo', 'turismo', 'excursion', 'equipaje', 'valija', 'cabana', 'camping', 'buquebus', 'colonia express', 'micro larga distancia', 'plataforma 10'] },
  { id: 'regalos', short: 'Regalos', label: 'Regalos y donaciones', icon: 'gift', words: ['regalo', 'regalos', 'cumple', 'cumpleanos', 'aniversario', 'dia de la madre', 'dia del padre', 'navidad', 'reyes', 'amigo invisible', 'flores', 'floreria', 'donacion', 'colecta', 'vaquita'] },
  { id: 'impuestos', short: 'Impuestos', label: 'Impuestos y trámites', icon: 'doc', words: ['impuesto', 'impuestos', 'abl', 'arba', 'agip', 'afip', 'arca', 'monotributo', 'ganancias', 'bienes personales', 'inmobiliario', 'tasa municipal', 'tasas', 'rentas', 'multa', 'multas', 'fotomulta', 'vtv', 'licencia de conducir', 'registro', 'escribano', 'escribania', 'tramite', 'tramites', 'dni', 'pasaporte', 'contador', 'sellos', 'autonomos'] },
  { id: 'bancarios', short: 'Comisiones', label: 'Comisiones e intereses', icon: 'percent', words: ['comision', 'comisiones', 'mantenimiento de cuenta', 'mantenimiento cuenta', 'cargo', 'cargos', 'interes', 'intereses', 'punitorios', 'recargo', 'mora', 'renovacion tarjeta', 'seguro tarjeta', 'costo financiero', 'iva comision', 'percepcion', 'impuesto pais'] },
  { id: 'varios', short: 'Varios', label: 'Gastos varios', icon: 'dots', words: [] },
  { id: 'otros', short: 'Otros', label: 'Otros', icon: 'tag', words: [] },
];

// Categorías propias del usuario (se registran al cargar el estado)
let customCats = [];
export function setCustomCategories(list) {
  customCats = (list || []).map((c) => ({ id: c.id, label: c.label, icon: 'tag', emoji: c.emoji || '', words: [], custom: true }));
}

/** Un solo emoji (el primero que se escriba), o vacío si no es un emoji. */
export function soloEmoji(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  let primero = t;
  try { primero = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)][0].segment; } catch { primero = Array.from(t)[0]; }
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(primero) ? primero : '';
}

/**
 * Categorías en el orden que eligió el usuario, sin las ocultas.
 * s.catPrefs = { orden: 'personalizado' | 'frecuentes' | 'alfabetico', lista: [ids], ocultas: [ids] }
 */
export function categoriasOrdenadas(s, { conOcultas = false } = {}) {
  const prefs = (s && s.catPrefs) || {};
  const ocultas = new Set(prefs.ocultas || []);
  let lista = allCategories().filter((c) => conOcultas || !ocultas.has(c.id));
  const orden = prefs.orden || 'frecuentes';
  if (orden === 'alfabetico') lista.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  else if (orden === 'personalizado' && (prefs.lista || []).length) {
    const pos = new Map(prefs.lista.map((id, i) => [id, i]));
    lista.sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 999) - (pos.has(b.id) ? pos.get(b.id) : 999));
  } else if (orden === 'frecuentes') {
    const desde = new Date(); desde.setDate(desde.getDate() - 90);
    const lim = desde.toISOString().slice(0, 10);
    const n = {};
    for (const e of (s && s.expenses) || []) if (e.date >= lim) n[e.category] = (n[e.category] || 0) + 1;
    const base = new Map(allCategories().map((c, i) => [c.id, i]));
    lista.sort((a, b) => (n[b.id] || 0) - (n[a.id] || 0) || base.get(a.id) - base.get(b.id));
  }
  return lista;
}
export const allCategories = () => [
  ...CATEGORIES.filter((c) => c.id !== 'varios' && c.id !== 'otros'),
  ...customCats,
  ...CATEGORIES.filter((c) => c.id === 'varios' || c.id === 'otros'),
];
export const catById = (id) => allCategories().find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
export const catLabel = (id) => catById(id).label;

// Formas de ahorro / inversión. "asset" es la moneda o activo por defecto.
export const HOLDING_TYPES = [
  { id: 'remunerada', label: 'Cuenta remunerada o billetera', asset: 'ARS', color: '#C6F36B' },
  { id: 'plazo_fijo', label: 'Plazo fijo', asset: 'ARS', color: '#FFFFFF' },
  { id: 'uva', label: 'Plazo fijo UVA', asset: 'ARS', color: '#E9F7C8' },
  { id: 'fci', label: 'Fondo común de inversión (FCI)', asset: 'ARS', color: '#A9D8BE' },
  { id: 'divisas', label: 'Moneda extranjera (dólar, euro, real…)', asset: 'USD', color: '#7FB89A' },
  { id: 'cripto', label: 'Cripto (bitcoin, USDT…)', asset: 'BTC', color: '#F2B33D' },
  { id: 'oro', label: 'Oro', asset: 'XAU', color: '#E7C66B' },
  { id: 'acciones', label: 'Acciones o CEDEARs', asset: 'ARS', color: '#5FA884' },
  { id: 'bonos', label: 'Bonos o letras', asset: 'ARS', color: '#4C9473' },
  { id: 'caja', label: 'Caja de ahorro (sin rendimiento)', asset: 'ARS', color: '#3E7A5C' },
  { id: 'efectivo', label: 'Efectivo guardado', asset: 'ARS', color: '#2E6A4E' },
  { id: 'otros', label: 'Otra forma', asset: 'ARS', color: '#245B42' },
];
export const holdingType = (id) => HOLDING_TYPES.find((h) => h.id === id) || HOLDING_TYPES[HOLDING_TYPES.length - 1];

// Monedas y activos que se pueden convertir
export const ASSETS = [
  { id: 'ARS', label: 'Pesos', sym: '$', decimals: 0 },
  { id: 'USD', label: 'Dólar (blue)', sym: 'US$', decimals: 2 },
  { id: 'EUR', label: 'Euro', sym: '€', decimals: 2 },
  { id: 'BRL', label: 'Real', sym: 'R$', decimals: 2 },
  { id: 'UYU', label: 'Peso uruguayo', sym: '$U', decimals: 0 },
  { id: 'CLP', label: 'Peso chileno', sym: 'CLP$', decimals: 0 },
  { id: 'BTC', label: 'Bitcoin', sym: '₿', decimals: 6 },
  { id: 'ETH', label: 'Ethereum', sym: 'ETH', decimals: 4 },
  { id: 'USDT', label: 'USDT', sym: 'USDT', decimals: 2 },
  { id: 'XAU', label: 'Oro (gramos)', sym: 'g', decimals: 2 },
];
export const assetById = (id) => ASSETS.find((a) => a.id === id) || ASSETS[0];

// Bancos, billeteras y tarjetas (para sugerir promos)
export const WALLETS = [
  { id: 'cuentadni', name: 'Cuenta DNI', kind: 'Billeteras' },
  { id: 'mercadopago', name: 'Mercado Pago', kind: 'Billeteras' },
  { id: 'modo', name: 'MODO', kind: 'Billeteras' },
  { id: 'naranjax', name: 'Naranja X', kind: 'Billeteras' },
  { id: 'uala', name: 'Ualá', kind: 'Billeteras' },
  { id: 'personalpay', name: 'Personal Pay', kind: 'Billeteras' },
  { id: 'bnamas', name: 'BNA+', kind: 'Billeteras' },
  { id: 'fiwind', name: 'Fiwind', kind: 'Billeteras' },
  { id: 'cocos', name: 'Cocos', kind: 'Billeteras' },
  { id: 'prex', name: 'Prex', kind: 'Billeteras' },
  { id: 'lemon', name: 'Lemon', kind: 'Billeteras' },
  { id: 'claropay', name: 'Claro Pay', kind: 'Billeteras' },
  { id: 'letsbit', name: 'Letsbit', kind: 'Billeteras' },
  { id: 'provincia', name: 'Banco Provincia', kind: 'Bancos' },
  { id: 'nacion', name: 'Banco Nación', kind: 'Bancos' },
  { id: 'galicia', name: 'Galicia', kind: 'Bancos' },
  { id: 'santander', name: 'Santander', kind: 'Bancos' },
  { id: 'bbva', name: 'BBVA', kind: 'Bancos' },
  { id: 'macro', name: 'Macro', kind: 'Bancos' },
  { id: 'icbc', name: 'ICBC', kind: 'Bancos' },
  { id: 'supervielle', name: 'Supervielle', kind: 'Bancos' },
  { id: 'credicoop', name: 'Credicoop', kind: 'Bancos' },
  { id: 'ciudad', name: 'Banco Ciudad', kind: 'Bancos' },
  { id: 'brubank', name: 'Brubank', kind: 'Bancos' },
  { id: 'visa', name: 'Visa', kind: 'Tarjetas' },
  { id: 'mastercard', name: 'Mastercard', kind: 'Tarjetas' },
  { id: 'amex', name: 'American Express', kind: 'Tarjetas' },
  { id: 'cabal', name: 'Cabal', kind: 'Tarjetas' },
  { id: 'naranja', name: 'Tarjeta Naranja', kind: 'Tarjetas' },
];
// Medios de pago que el usuario agrega y no están en la lista
let customWallets = [];
export function setCustomWallets(list) { customWallets = list || []; }
// Provincias (para mostrar solo las promos que valen donde vivís)
export const PROVINCES = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
export const provinceLabel = (p) => (p === 'Buenos Aires' ? 'Provincia de Buenos Aires' : p === 'CABA' ? 'Ciudad de Buenos Aires' : p);

export const allWallets = () => [...WALLETS, ...customWallets];
export const walletName = (id) => (allWallets().find((w) => w.id === id) || { name: id }).name;

// Desafíos de ejemplo. Tipos:
//  noCat:  no gastar en una categoría
//  capCat: no pasar un monto en una categoría
//  noSmall: ningún gasto menor a un monto (gastos hormiga)
export const CHALLENGES = [
  { id: 'delivery30', name: '30 días sin delivery', days: 30, type: 'noCat', category: 'delivery' },
  { id: 'salidas15', name: '15 días sin salidas pagas', days: 15, type: 'noCat', category: 'ocio' },
  { id: 'comida14', name: '14 días cocinando en casa', days: 14, type: 'noCat', category: 'comida' },
  { id: 'hormiga7', name: 'Una semana sin gastos hormiga', days: 7, type: 'noSmall', amount: 5000 },
];
export const CHALLENGE_TYPES = [
  { id: 'noCat', label: 'No gastar nada en una categoría' },
  { id: 'capCat', label: 'No pasar un monto en una categoría' },
  { id: 'noSmall', label: 'Sin gastos chicos (gastos hormiga)' },
];

export const CUSTOM_RULE_TYPES = [
  { id: 'pctSalary', label: 'Un % del sueldo', unit: '%' },
  { id: 'fixedMonthly', label: 'Un monto fijo por mes', unit: '$' },
  { id: 'catPct', label: 'Un % de lo que gasto en una categoría', unit: '%' },
];
