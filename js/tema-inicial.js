// Tema y tamaño de letra elegidos en el menú.
// Se carga en el <head> (sin "defer") para aplicarlos antes de dibujar la página y que no parpadee.
try {
  var t = localStorage.getItem('pesitos_tema');
  if (t === 'claro' || t === 'oscuro') document.documentElement.setAttribute('data-tema', t);
  var l = localStorage.getItem('pesitos_letra');
  if (l === 'grande' || l === 'enorme') document.documentElement.setAttribute('data-letra', l);
} catch (e) { /* sin acceso a localStorage: queda el tema automático */ }
