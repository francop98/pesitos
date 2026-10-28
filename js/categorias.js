// Catálogos: categorías de gasto, formas de ahorro, monedas,
// medios de pago y desafíos.

export const CATEGORIES = [
  { id: 'super', label: 'Supermercado', icon: 'cart', words: ['super', 'supermercado', 'coto', 'carrefour', 'dia', 'jumbo', 'disco', 'vea', 'changomas', 'cooperativa', 'almacen', 'verduleria', 'carniceria', 'chino', 'mayorista', 'makro', 'vital', 'yaguar', 'toledo', 'anonima'] },
  { id: 'comida', label: 'Comida afuera', icon: 'food', words: ['resto', 'restaurante', 'restaurant', 'bar', 'cafe', 'cafecito', 'almuerzo', 'cena', 'birra', 'cerveza', 'pizza', 'burger', 'hamburguesa', 'mcdonalds', 'mostaza', 'helado', 'panaderia', 'facturas', 'medialunas', 'kiosco'] },
  { id: 'delivery', label: 'Delivery', icon: 'bike', words: ['delivery', 'pedidosya', 'rappi', 'pedido'] },
  { id: 'transporte', label: 'Transporte', icon: 'fuel', words: ['nafta', 'ypf', 'shell', 'axion', 'puma', 'combustible', 'gasoil', 'sube', 'colectivo', 'bondi', 'uber', 'cabify', 'didi', 'taxi', 'remis', 'peaje', 'estacionamiento', 'cochera', 'mecanico', 'gomeria'] },
  { id: 'hogar', label: 'Hogar', icon: 'home', words: ['ferreteria', 'limpieza', 'muebles', 'easy', 'sodimac', 'bazar', 'lavadero', 'heladera', 'lavarropas'] },
  { id: 'salud', label: 'Salud', icon: 'heart', words: ['farmacia', 'farmacity', 'medico', 'remedio', 'remedios', 'dentista', 'odontologo', 'analisis', 'consulta', 'perfumeria'] },
  { id: 'ropa', label: 'Ropa', icon: 'shirt', words: ['ropa', 'zapatillas', 'remera', 'jean', 'campera', 'buzo', 'zapatos'] },
  { id: 'ocio', label: 'Salidas y ocio', icon: 'ticket', words: ['cine', 'recital', 'entrada', 'entradas', 'teatro', 'boliche', 'juego', 'steam', 'salida', 'previa'] },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'repeat', words: ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime', 'youtube', 'icloud', 'gym', 'gimnasio', 'chatgpt'] },
  { id: 'regalos', label: 'Regalos', icon: 'gift', words: ['regalo', 'cumple', 'cumpleanos'] },
  { id: 'educacion', label: 'Educación', icon: 'book', words: ['curso', 'libro', 'libros', 'facultad', 'colegio', 'utiles', 'libreria'] },
  { id: 'varios', label: 'Gastos varios', icon: 'dots', words: [] },
  { id: 'otros', label: 'Otros', icon: 'tag', words: [] },
];

// Categorías propias del usuario (se registran al cargar el estado)
let customCats = [];
export function setCustomCategories(list) {
  customCats = (list || []).map((c) => ({ id: c.id, label: c.label, icon: 'tag', words: [], custom: true }));
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
  { id: 'XAU', label: 'Oro (onza troy)', sym: 'oz', decimals: 3 },
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
