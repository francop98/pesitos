// Catálogos: categorías de gasto, formas de ahorro, monedas,
// medios de pago y desafíos.

// Las palabras van sin tildes y en minúscula. Pueden ser frases ("bienes personales").
// Los ids viejos (super, comida, delivery, …) no cambian: los gastos guardados siguen iguales.
export const CATEGORIES = [
  { id: 'super', short: 'Súper', label: 'Súper y almacén', icon: 'cart', hint: 'súper, almacén, verdulería, carnicería', words: ['super', 'supermercado', 'supermercados', 'coto', 'carrefour', 'dia', 'jumbo', 'disco', 'vea', 'changomas', 'chango mas', 'cooperativa', 'supercoop', 'almacen', 'verduleria', 'verdura', 'verduras', 'fruta', 'frutas', 'carniceria', 'carne', 'pollo', 'polleria', 'pescaderia', 'fiambreria', 'fiambre', 'chino', 'autoservicio', 'mayorista', 'makro', 'vital', 'yaguar', 'maxiconsumo', 'diarco', 'toledo', 'anonima', 'la anonima', 'libertad', 'walmart', 'hiper', 'hipermercado', 'mercado', 'compras', 'mercaderia', 'leche', 'pan', 'huevos', 'yerba', 'dietetica', 'granja', 'feria', 'devoto', 'tata', 'cordiez', 'mami', 'el abastecedor', 'supermercado chino', 'almacen de barrio', 'despensa', 'proveeduria', 'autoservicio chino', 'fiambres', 'queso', 'quesos', 'lacteos', 'gaseosas', 'bebidas', 'vinoteca', 'distribuidora', 'limpieza super', 'cotodigital', 'carrefour express', 'jumbo online', 'la serenisima', 'harina', 'arroz', 'fideos', 'aceite de girasol', 'azucar', 'cafe molido', 'galletitas', 'yogur', 'manteca', 'papas', 'tomates', 'cebollas', 'sodero', 'soda', 'bidones', 'agua bidon', 'huevos de campo', 'pollo entero', 'carne picada', 'milanesas de carne'] },
  { id: 'casa', short: 'Casa', label: 'Casa y servicios', icon: 'home', hint: 'alquiler, expensas, luz, gas, internet, celular, streaming, arreglos', words: ['alquiler', 'expensas', 'inmobiliaria', 'hipoteca', 'cuota casa', 'consorcio', 'deposito garantia', 'garantia', 'administracion', 'alquiler depto', 'alquiler casa', 'expensas edificio', 'cuota hipoteca', 'credito hipotecario', 'uva hipotecario', 'gastos de escribania', 'mudanza depto', 'reparacion edificio', 'encargado', 'portero', 'luz', 'gas', 'agua', 'edenor', 'edesur', 'edelap', 'edea', 'epec', 'epe', 'edet', 'eden', 'edes', 'metrogas', 'naturgy', 'camuzzi', 'litoral gas', 'ecogas', 'gasnor', 'aysa', 'absa', 'aguas', 'internet', 'wifi', 'fibra', 'telecentro', 'fibertel', 'personal', 'movistar', 'claro', 'tuenti', 'telefono', 'celular', 'abono', 'recarga', 'cable', 'directv', 'flow', 'telered', 'garrafa', 'servicio', 'servicios', 'factura', 'factura luz', 'factura gas', 'factura agua', 'boleta', 'boleta luz', 'servicio de luz', 'energia', 'electricidad', 'gas natural', 'agua corriente', 'cloacas', 'telefonia', 'linea', 'plan celular', 'datos moviles', 'recarga sube', 'recarga celular', 'carga celular', 'personal flow', 'movistar hogar', 'claro hogar', 'starlink', 'cablevision', 'supercanal', 'gigared', 'cooperativa electrica', 'cooperativa de agua', 'abono internet', 'municipalidad agua', 'tasa de agua', 'alarma', 'monitoreo', 'adt', 'prosegur', 'securitas', 'ferreteria', 'pintureria', 'limpieza', 'articulos de limpieza', 'muebles', 'mueble', 'colchon', 'easy', 'sodimac', 'blaisten', 'bazar', 'lavadero', 'lavanderia', 'tintoreria', 'heladera', 'lavarropas', 'cocina', 'horno', 'microondas', 'aire acondicionado', 'ventilador', 'estufa', 'decoracion', 'deco', 'plantas', 'vivero', 'plomero', 'electricista', 'gasista', 'cerrajero', 'arreglo', 'reparacion', 'empleada', 'limpieza casa', 'muchacha', 'mudanza', 'sabanas', 'toallas', 'cortinas', 'lampara', 'focos', 'articulos hogar', 'cosas de la casa', 'bazar casa', 'vajilla', 'ollas', 'sarten', 'cubiertos', 'vasos', 'platos', 'almohada', 'acolchado', 'frazada', 'alfombra', 'silla', 'mesa ratona', 'sillon', 'placard', 'estante', 'repisa', 'pintura', 'pinceles', 'herramientas', 'taladro', 'tornillos', 'clavos', 'canilla', 'cerradura', 'llave', 'enchufe', 'foco led', 'pilas', 'detergente', 'lavandina', 'jabon en polvo', 'suavizante', 'esponja', 'escoba', 'trapo', 'bolsas de residuo', 'papel higienico', 'rollo de cocina', 'servilletas', 'insecticida', 'fumigacion', 'jardinero', 'pileta casa', 'cloro pileta', 'tienda de deco', 'home center', 'ikea', 'falabella home', 'carrefour hogar', 'netflix', 'spotify', 'disney', 'disney+', 'hbo', 'max', 'prime', 'prime video', 'amazon prime', 'paramount', 'star+', 'apple tv', 'youtube', 'youtube premium', 'icloud', 'google one', 'google drive', 'chatgpt', 'openai', 'claude', 'canva', 'adobe', 'office', 'microsoft 365', 'dropbox', 'deezer', 'tidal', 'crunchyroll', 'mubi', 'suscripcion', 'membresia', 'meli+', 'nivel 6', 'patreon', 'twitch', 'netflix premium', 'spotify premium', 'spotify familiar', 'disney plus', 'hbo max', 'max hbo', 'prime video amazon', 'paramount plus', 'star plus', 'apple music', 'apple one', 'icloud+', 'youtube music', 'chatgpt plus', 'claude pro', 'gemini', 'copilot', 'notion', 'canva pro', 'adobe creative', 'lightroom', 'office 365', 'dropbox plus', 'nordvpn', 'vpn', 'duolingo', 'duolingo plus', 'tinder', 'bumble', 'linkedin premium', 'strava', 'diario', 'diario clarin', 'la nacion', 'infobae', 'suscripcion diario', 'revista', 'flow personal', 'telecentro play', 'directv go', 'dgo', 'fanatiz', 'tyc sports play', 'espn', 'disney+ espn', 'universal+', 'mercado libre nivel', 'kindle unlimited', 'audible', 'xbox', 'game pass'] },
  { id: 'transporte', short: 'Transporte', label: 'Transporte y auto', icon: 'fuel', hint: 'nafta, SUBE, Uber, peajes, service', words: ['nafta', 'ypf', 'shell', 'axion', 'puma', 'gulf', 'combustible', 'gasoil', 'gnc', 'carga nafta', 'sube', 'colectivo', 'bondi', 'subte', 'tren', 'micro', 'uber', 'cabify', 'taxi', 'remis', 'peaje', 'autopista', 'telepase', 'estacionamiento', 'parking', 'cochera', 'mecanico', 'taller', 'service', 'gomeria', 'cubiertas', 'neumaticos', 'aceite', 'lavadero de autos', 'lavado auto', 'repuestos', 'seguro auto', 'seguro del auto', 'patente', 'auto', 'moto', 'bici', 'bicicleta', 'monopatin', 'cargar nafta', 'carga gnc', 'ypf full', 'estacion de servicio', 'shell select', 'combustible auto', 'infinia', 'v power', 'boleto', 'pasaje colectivo', 'tren mitre', 'tren roca', 'tren sarmiento', 'subte linea', 'emova', 'uber moto', 'cabify moto', 'beat', 'taxi aeropuerto', 'remis aeropuerto', 'peajes', 'ausol', 'autopistas del sol', 'autopista illia', 'tag', 'estacionamiento medido', 'parquimetro', 'grua', 'acarreo', 'alineacion', 'balanceo', 'frenos', 'embrague', 'bateria auto', 'escape', 'chapa y pintura', 'lavado', 'lavadero auto', 'cubierta', 'neumatico', 'service auto', 'cambio de aceite', 'vtv auto', 'cuota auto', 'plan de ahorro auto', 'plan ovalo', 'seguro moto', 'casco', 'repuesto moto'] },
  { id: 'salud', short: 'Salud', label: 'Salud y cuidado', icon: 'heart', hint: 'farmacia, médico, prepaga, peluquería, gimnasio', words: ['farmacia', 'farmacity', 'medico', 'medica', 'remedio', 'remedios', 'medicamento', 'medicamentos', 'dentista', 'odontologo', 'ortodoncia', 'analisis', 'laboratorio', 'consulta', 'turno medico', 'guardia', 'clinica', 'sanatorio', 'hospital', 'prepaga', 'obra social', 'osde', 'swiss medical', 'galeno', 'omint', 'medife', 'sancor salud', 'ioma', 'optica', 'anteojos', 'lentes', 'psicologo', 'psicologa', 'terapia', 'kinesiologo', 'kinesiologia', 'nutricionista', 'vacuna', 'estudios', 'farmacia online', 'farmaonline', 'dr ahorro', 'medicacion', 'antibiotico', 'ibuprofeno', 'paracetamol', 'vitaminas', 'turno', 'copago', 'bono consulta', 'orden medica', 'radiografia', 'ecografia', 'resonancia', 'tomografia', 'analisis de sangre', 'dermatologo', 'ginecologo', 'pediatra', 'oftalmologo', 'traumatologo', 'cardiologo', 'clinico', 'odontologia', 'limpieza dental', 'implante', 'brackets', 'psiquiatra', 'fonoaudiologo', 'podologo', 'osteopata', 'obra social osde', 'accord salud', 'hospital italiano', 'hospital aleman', 'swiss', 'medicus', 'avalian', 'union personal', 'osecac', 'osde 210', 'osde 310', 'peluqueria', 'peluquero', 'barberia', 'barbero', 'corte de pelo', 'perfumeria', 'perfume', 'cosmeticos', 'maquillaje', 'manicura', 'unas', 'depilacion', 'cera', 'shampoo', 'crema', 'desodorante', 'cepillo', 'afeitadora', 'spa', 'masajes', 'estetica', 'tintura', 'simplicity', 'pigmento', 'rouge', 'corte', 'barba', 'tintura pelo', 'alisado', 'keratina', 'brushing', 'manos y pies', 'esmaltado', 'semipermanente', 'lifting', 'cejas', 'pestanas', 'depilacion definitiva', 'laser', 'tratamiento facial', 'skincare', 'cosmetica', 'labial', 'protector solar', 'perfume importado', 'colonia', 'gel', 'cera de pelo', 'maquinita', 'gillette', 'dentifrico', 'pasta dental', 'cepillo de dientes', 'hilo dental', 'toallitas', 'toallitas femeninas', 'tampones', 'algodon', 'farmacity perfumeria', 'juleriaque', 'natura', 'avon', 'tsu cosmeticos', 'gym', 'gimnasio', 'smart fit', 'smartfit', 'megatlon', 'sportclub', 'sport club', 'club', 'cuota club', 'padel', 'paddle', 'futbol', 'cancha', 'tenis', 'natacion', 'pileta', 'yoga', 'pilates', 'crossfit', 'funcional', 'running', 'maraton', 'boxeo', 'entrenador', 'personal trainer', 'deporte', 'deportes', 'suplementos', 'proteina', 'decathlon', 'cuota gimnasio', 'gym cuota', 'pase libre', 'clases de', 'zumba', 'spinning', 'natacion cuota', 'escuela de natacion', 'tenis clase', 'golf', 'surf', 'escalada', 'trekking', 'ciclismo', 'bici fija', 'paddle cancha', 'alquiler cancha', 'futbol 5', 'futbol cinco', 'torneo', 'inscripcion carrera', 'zapatillas deporte', 'raqueta', 'paleta padel', 'pelota', 'pesas', 'colchoneta', 'smart fit cuota', 'megatlon cuota', 'sport club cuota', 'fitness', 'entrenamiento'] },
  { id: 'comida', short: 'Comida afuera', label: 'Comida afuera', icon: 'food', hint: 'restaurantes, bares, delivery, kiosco', words: ['resto', 'restaurante', 'restaurant', 'restoran', 'bar', 'cafe', 'cafeteria', 'cafecito', 'almuerzo', 'cena', 'desayuno', 'merienda', 'brunch', 'birra', 'cerveza', 'cerveceria', 'vino', 'tragos', 'pizza', 'pizzeria', 'empanadas', 'burger', 'hamburguesa', 'hamburgueseria', 'mcdonalds', 'mc donalds', 'burger king', 'mostaza', 'kfc', 'starbucks', 'havanna', 'cafe martinez', 'bonafide', 'freddo', 'grido', 'helado', 'heladeria', 'panaderia', 'facturas', 'medialunas', 'parrilla', 'asado', 'sushi', 'milanesa', 'lomito', 'choripan', 'pancho', 'rotiseria', 'vianda', 'comedor', 'buffet', 'cantina', 'bodegon', 'tenedor libre', 'take away', 'propina', 'parrilla libre', 'resto bar', 'cerveceria artesanal', 'afterwork', 'after office', 'cafe con leche', 'cortado', 'tostado', 'medialuna', 'torta', 'pasteleria', 'confiteria', 'sanguches', 'sandwich', 'sandwicheria', 'shawarma', 'tacos', 'wok', 'ramen', 'poke', 'pasta', 'pastas', 'ñoquis', 'noquis', 'picada', 'vermut', 'fernet', 'vinito', 'paty', 'almuerzo laburo', 'almuerzo trabajo', 'comida trabajo', 'el club de la milanesa', 'kansas', 'la cabrera', 'tea connection', 'le pain quotidien', 'balcarce', 'wendys', 'subway', 'tienda de cafe', 'lucciano', 'rapanui', 'cuarto de kilo', 'kilo de helado', 'delivery', 'pedidosya', 'pedidos ya', 'rappi', 'pedido', 'didi food', 'uber eats', 'envio comida', 'pedido pedidosya', 'envio', 'glovo', 'didi', 'justo', 'mercado pago delivery', 'delivery comida', 'pizza delivery', 'empanadas delivery', 'kiosco', 'kiosko', 'maxikiosco', 'golosina', 'golosinas', 'alfajor', 'alfajores', 'chocolate', 'chicle', 'caramelos', 'gaseosa', 'coca', 'agua mineral', 'snack', 'papas fritas', 'cigarrillos', 'puchos', 'atado', 'tabaco', 'vape', 'oxxo', 'antojo', 'bebida', 'energizante', 'speed', 'monster', 'turron', 'bon o bon', 'mantecol', 'caramelo', 'pastillas', 'chupetin', 'galletitas kiosco', 'yerba kiosco', 'encendedor', 'cigarrillo', 'philip morris', 'marlboro', 'lucky', 'camel'] },
  { id: 'compras', short: 'Salidas y compras', label: 'Salidas y compras', icon: 'ticket', hint: 'salidas, ropa, tecnología, viajes, regalos', words: ['cine', 'cinemark', 'hoyts', 'recital', 'show', 'concierto', 'entrada', 'entradas', 'teatro', 'boliche', 'fiesta', 'juego', 'juegos', 'steam', 'playstation', 'nintendo', 'salida', 'previa', 'museo', 'parque', 'karaoke', 'bowling', 'casino', 'quiniela', 'loteria', 'apuesta', 'bingo', 'ticketek', 'all access', 'passline', 'salida con amigos', 'salida al cine', 'cena show', 'espectaculo', 'festival', 'stand up', 'obra de teatro', 'partido', 'entrada cancha', 'futbol entrada', 'platea', 'popular', 'abono socio', 'parque de diversiones', 'temaikén', 'temaiken', 'zoologico', 'acuario', 'museo entrada', 'kermesse', 'paintball', 'karting', 'laser tag', 'arcade', 'sala de juegos', 'billar', 'pool', 'dardos', 'bar de juegos', 'juego de mesa', 'libro juego', 'playstation plus', 'xbox game pass', 'juego steam', 'fichas', 'tragamonedas', 'prode', 'ropa', 'zapatillas', 'zapatos', 'botas', 'ojotas', 'remera', 'remeras', 'jean', 'jeans', 'pantalon', 'campera', 'buzo', 'camisa', 'vestido', 'pollera', 'medias', 'ropa interior', 'malla', 'cartera', 'mochila', 'nike', 'adidas', 'puma ropa', 'zara', 'h&m', 'shein', 'dexter', 'moov', 'grimoldi', 'falabella', 'tienda', 'indumentaria', 'calzado', 'outlet', 'reloj', 'anillo', 'bijou', 'ropa deportiva', 'zapatillas running', 'jogging', 'calza', 'short', 'bermuda', 'pijama', 'corpino', 'boxer', 'bombacha', 'traje', 'corbata', 'saco', 'tapado', 'abrigo', 'gorra', 'gorro', 'bufanda', 'guantes', 'lentes de sol', 'anteojos de sol', 'cinturon', 'billetera', 'paraguas', 'arreglo de ropa', 'costurera', 'modista', 'zapateria', 'lavado de ropa', 'tintoreria ropa', 'topper', 'fila', 'reebok', 'vans', 'converse', 'levis', 'lacoste', 'tommy', 'kosiuko', 'akiabara', 'rapsodia', 'sweet', '47 street', 'wanama', 'bensimon', 'la martina', 'penguin', 'paez', 'hush puppies', 'prune', 'mishka', 'sarkany', 'stone', 'netshoes', 'dafiti', 'notebook', 'computadora', 'compu', 'pc', 'monitor', 'teclado', 'mouse', 'auriculares', 'parlante', 'cargador', 'cable usb', 'iphone', 'samsung', 'motorola', 'xiaomi', 'apple', 'tablet', 'ipad', 'smart tv', 'televisor', 'tele', 'consola', 'fravega', 'garbarino', 'musimundo', 'compumundo', 'naldo', 'mercado libre', 'mercadolibre', 'meli', 'tecnologia', 'impresora', 'pendrive', 'disco externo', 'funda', 'templado', 'arreglo celular', 'celular nuevo', 'telefono nuevo', 'iphone 15', 'iphone 16', 'samsung galaxy', 'auriculares bluetooth', 'airpods', 'smartwatch', 'reloj inteligente', 'apple watch', 'cargador celular', 'cable cargador', 'protector pantalla', 'vidrio templado', 'memoria', 'disco ssd', 'placa de video', 'gamer', 'silla gamer', 'joystick', 'control', 'camara', 'gopro', 'drone', 'router', 'repetidor wifi', 'chromecast', 'fire tv', 'tv box', 'proyector', 'parlante bluetooth', 'jbl', 'sony', 'lg', 'philips', 'noblex', 'bgh', 'tcl', 'hp', 'lenovo', 'dell', 'asus', 'acer', 'service celular', 'arreglo de compu', 'tecnico pc', 'software', 'licencia', 'antivirus', 'app', 'aplicacion', 'viaje', 'viajes', 'vacaciones', 'pasaje', 'pasajes', 'vuelo', 'avion', 'aerolineas', 'aerolineas argentinas', 'flybondi', 'jetsmart', 'latam', 'hotel', 'hostel', 'airbnb', 'booking', 'despegar', 'almundo', 'turismo', 'excursion', 'equipaje', 'valija', 'cabana', 'camping', 'buquebus', 'colonia express', 'micro larga distancia', 'plataforma 10', 'pasaje avion', 'pasaje micro', 'pasaje bus', 'omnibus', 'via bariloche', 'flecha bus', 'chevallier', 'andesmar', 'plusmar', 'condor estrella', 'el rapido', 'crucero del norte', 'hotel noche', 'hospedaje', 'alojamiento', 'posada', 'apart', 'cabañas', 'cabanas', 'alquiler temporario', 'temporada', 'reserva hotel', 'turismo aventura', 'tour', 'city tour', 'excursion ballenas', 'entrada parque nacional', 'parque nacional', 'seguro de viaje', 'assist card', 'universal assistance', 'tarjeta de embarque', 'valija extra', 'duty free', 'free shop', 'casa de cambio', 'dolares viaje', 'alquiler auto', 'rent a car', 'hertz', 'localiza', 'avis', 'nafta viaje', 'peaje viaje', 'smiles', 'millas', 'aerolineas plus', 'arajet', 'sky airline', 'copa airlines', 'iberia', 'american airlines', 'regalo', 'regalos', 'cumple', 'cumpleanos', 'aniversario', 'dia de la madre', 'dia del padre', 'navidad', 'reyes', 'amigo invisible', 'flores', 'floreria', 'donacion', 'colecta', 'vaquita', 'regalo de cumple', 'regalo de navidad', 'regalo dia del nino', 'dia del nino', 'dia del amigo', 'dia de los enamorados', 'san valentin', 'regalo novia', 'regalo novio', 'regalo mama', 'regalo papa', 'regalo amigo', 'regalo casamiento', 'lista de bodas', 'baby shower', 'bautismo', 'comunion', 'egresados', 'tarjeta regalo', 'gift card', 'giftcard', 'caja regalo', 'bigbox', 'envoltorio', 'ramo', 'ramo de flores', 'torta cumple', 'colecta trabajo', 'cooperacion', 'donaciones', 'ong', 'unicef', 'caritas', 'cruz roja', 'medicos sin fronteras', 'fundacion', 'ofrenda', 'diezmo', 'propina regalo'] },
  { id: 'familia', short: 'Familia', label: 'Familia', icon: 'baby', hint: 'hijos, mascotas, colegio, cursos', words: ['panales', 'pañales', 'bebe', 'mamadera', 'leche de formula', 'guarderia', 'jardin maternal', 'juguete', 'juguetes', 'jugueteria', 'cochecito', 'babysitter', 'nineras', 'niñera', 'cumple infantil', 'mundo bebe', 'hijos', 'hijo', 'hija', 'panal', 'pañal', 'toallitas bebe', 'leche bebe', 'nutrilon', 'sancor bebe', 'vancouver', 'pediatra bebe', 'colegio hijos', 'cuota jardin', 'jardin de infantes', 'jardin', 'salita', 'escuela hijos', 'utiles escolares', 'vianda colegio', 'kiosco colegio', 'excursion colegio', 'cumple hijo', 'cumple hija', 'pelotero', 'juego infantil', 'plaza blanda', 'ropa de bebe', 'ropa nene', 'ropa nena', 'cheeky', 'mimo', 'gymboree', 'zapatillas nene', 'mochila nene', 'juguete nene', 'lego', 'barbie', 'hot wheels', 'owoko', 'ninera', 'cuidadora', 'colonia de vacaciones', 'actividad chicos', 'natacion chicos', 'futbol infantil', 'danza chicos', 'clases chicos', 'mesada', 'veterinaria', 'veterinario', 'vete', 'mascota', 'mascotas', 'perro', 'gato', 'balanceado', 'alimento perro', 'alimento gato', 'piedritas', 'pet shop', 'petshop', 'puppis', 'pipeta', 'antipulgas', 'paseador', 'guarderia canina', 'royal canin', 'pro plan', 'dog chow', 'cat chow', 'excellent', 'comida perro', 'comida gato', 'alimento balanceado', 'bolsa de alimento', 'eukanuba', 'old prince', 'vital can', 'sieger', 'agility', 'pedigree', 'whiskas', 'felix', 'arena gato', 'arena sanitaria', 'correa', 'collar', 'cucha', 'rascador', 'juguete perro', 'vacuna perro', 'vacuna gato', 'antiparasitario', 'desparasitario', 'castracion', 'peluqueria canina', 'bano perro', 'paseador de perros', 'guarderia perro', 'veterinario consulta', 'clinica veterinaria', 'petshop online', 'curso', 'cursos', 'libro', 'libros', 'facultad', 'universidad', 'colegio', 'escuela', 'cuota colegio', 'matricula', 'utiles', 'libreria', 'fotocopias', 'apuntes', 'clases', 'clase particular', 'profesor', 'ingles', 'idiomas', 'udemy', 'coursera', 'platzi', 'coderhouse', 'posgrado', 'maestria', 'diplomatura', 'capacitacion', 'cuota facultad', 'cuota universidad', 'inscripcion', 'examen', 'final', 'libros facultad', 'apunte', 'fotocopia', 'impresion', 'resma', 'cuadernos', 'lapiceras', 'mochila escolar', 'uniforme', 'guardapolvo', 'colegio privado', 'instituto', 'academia', 'curso online', 'seminario', 'congreso', 'certificacion', 'clases de ingles', 'clases de apoyo', 'profesora particular', 'maestra particular', 'autoescuela', 'escuela de manejo', 'cultural inglesa', 'wall street english', 'open english', 'british', 'alianza francesa', 'dante alighieri', 'domestika', 'crehana', 'linkedin learning'] },
  { id: 'otros', short: 'Otros', label: 'Otros', icon: 'tag', hint: 'impuestos, trámites, comisiones y lo demás', words: ['impuesto', 'impuestos', 'abl', 'arba', 'agip', 'afip', 'arca', 'monotributo', 'ganancias', 'bienes personales', 'inmobiliario', 'tasa municipal', 'tasas', 'rentas', 'multa', 'multas', 'fotomulta', 'vtv', 'licencia de conducir', 'registro', 'escribano', 'escribania', 'tramite', 'tramites', 'dni', 'pasaporte', 'contador', 'sellos', 'autonomos', 'inmobiliario rural', 'municipal', 'tasa de seguridad', 'tasa vial', 'alumbrado barrido', 'alumbrado', 'abl caba', 'arba inmobiliario', 'patente arba', 'impuesto automotor', 'impuesto inmobiliario', 'ingresos brutos', 'iibb', 'iva', 'declaracion jurada', 'ddjj', 'anticipo ganancias', 'anticipo', 'plan de pagos afip', 'plan de pagos', 'moratoria', 'sellado', 'tasa de justicia', 'registro automotor', 'transferencia auto', 'cedula verde', 'cedula azul', 'renovacion licencia', 'registro conducir', 'partida de nacimiento', 'apostilla', 'legalizacion', 'certificado', 'antecedentes penales', 'gestor', 'gestoria', 'honorarios contador', 'estudio contable', 'abogado', 'honorarios', 'comision', 'comisiones', 'mantenimiento de cuenta', 'mantenimiento cuenta', 'cargo', 'cargos', 'interes', 'intereses', 'punitorios', 'recargo', 'mora', 'renovacion tarjeta', 'seguro tarjeta', 'costo financiero', 'iva comision', 'percepcion', 'impuesto pais', 'comision mantenimiento', 'comision tarjeta', 'comision por', 'cargo mensual', 'cargo administrativo', 'costo de mantenimiento', 'paquete bancario', 'renovacion anual', 'seguro de vida tarjeta', 'seguro saldo deudor', 'interes financiacion', 'intereses financiacion', 'intereses punitorios', 'intereses compensatorios', 'cargo por mora', 'pago minimo', 'refinanciacion', 'adelanto en efectivo', 'iva sobre comision', 'impuesto debitos', 'impuesto al cheque', 'percepcion ganancias', 'percepcion afip', 'retencion', 'gastos bancarios', 'comision transferencia', 'comision extraccion', 'cajero', 'extraccion cajero', 'red link', 'banelco'] },
];

// v21 y v23: las categorías viejas se pasan solas a la nueva (8 categorías).
export const CATEGORY_ALIAS = {
  delivery: 'comida', kiosco: 'comida', cuidado: 'salud', deporte: 'salud', bancarios: 'otros', varios: 'otros', impuestos: 'otros',
  vivienda: 'casa', servicios: 'casa', hogar: 'casa', suscripciones: 'casa',
  ocio: 'compras', ropa: 'compras', tecnologia: 'compras', viajes: 'compras', regalos: 'compras',
  chicos: 'familia', mascotas: 'familia', educacion: 'familia',
};
export const catReal = (id) => CATEGORY_ALIAS[id] || id;

// Categorías propias del usuario (se registran al cargar el estado)
let customCats = [];
export function setCustomCategories(list, borradas) {
  customCats = (list || []).map((c) => ({ id: c.id, label: c.label, icon: 'tag', emoji: c.emoji || '', words: [], custom: true }));
  if (borradas !== undefined) eliminadas = new Set(borradas || []);
}
// categorías de Pesitos que el usuario eliminó (se pueden restaurar)
let eliminadas = new Set();

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
  ...CATEGORIES.filter((c) => c.id !== 'otros' && !eliminadas.has(c.id)),
  ...customCats,
  ...CATEGORIES.filter((c) => c.id === 'otros'),
];
export const catById = (id0) => { const id = catReal(id0); return allCategories().find((c) => c.id === id) || CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]; };
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
  { id: 'USD', label: 'Dólar', sym: 'US$', decimals: 2 },
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
  { id: 'delivery30', name: '30 días sin delivery ni comida afuera', days: 30, type: 'noCat', category: 'comida' },
  { id: 'salidas15', name: '15 días sin salidas ni compras', days: 15, type: 'noCat', category: 'compras' },
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
  { id: 'porGasto', label: 'Un monto cada vez que gasto en una categoría', unit: '$', cat: true },
  { id: 'bajoTope', label: 'Si gasto menos de un tope en una categoría, la diferencia', unit: '$', cat: true },
  { id: 'pctIngresos', label: 'Un % de todo lo que entra (sueldo y extras)', unit: '%' },
  { id: 'porSemana', label: 'Un monto fijo por semana', unit: '$' },
  { id: 'porDia', label: 'Un monto por día', unit: '$' },
];
CUSTOM_RULE_TYPES.find((t) => t.id === 'catPct').cat = true;
// Reglas listas para usar (se crean con un toque y después se pueden editar)
export const RULE_PRESETS = [
  { name: 'Impuesto al antojo', type: 'porGasto', category: 'comida', value: 1000, txt: (m) => `Cada vez que pedís delivery o comés afuera, apartás ${m(1000)}.` },
  { name: 'Lo que no gasto en el súper', type: 'bajoTope', category: 'super', value: 0, txt: () => 'Ponés un tope para el súper y lo que no usás va al ahorro.' },
  { name: 'Moneda por día', type: 'porDia', value: 500, txt: (m) => `${m(500)} por día, casi sin darte cuenta: unos ${m(15000)} por mes.` },
  { name: 'El 5% de todo lo que entra', type: 'pctIngresos', value: 5, txt: () => 'Sueldo, extras, lo que sea: el 5% va al ahorro.' },
  { name: 'Ahorro semanal', type: 'porSemana', value: 10000, txt: (m) => `${m(10000)} cada semana: más fácil que juntar todo a fin de mes.` },
];
