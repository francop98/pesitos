// Pruebas de punta a punta: abren la app en un navegador de verdad (sin internet,
// con Firebase de mentira) y revisan lo principal. Ver tests/LEEME.md.

import { servidor, abrir, entrar, ir, estado, cambiar, texto } from './ayudante.mjs';

const resultados = [];
const ok = (nombre, cond, det = '') => { resultados.push([!!cond, nombre, det]); console.log(`${cond ? '✓' : '✗'} ${nombre}${!cond && det ? ` — ${det}` : ''}`); };
const srv = await servidor();

// ---------- 1. Bienvenida en un celular: montos de gastos fijos y fondo quieto ----------
{
  const { b, p, errores } = await abrir(srv.url, 'Pixel 5');
  await entrar(p, { demo: false });
  const tocar = async (s) => { await p.tap(s); await p.waitForTimeout(350); };
  const fondo = () => p.evaluate(() => scrollY);
  let movio = 0;
  await tocar('[data-action=guideNext][data-value=go]'); movio += await fondo();
  await tocar('[data-action=guideNext][data-value=dep]'); movio += await fondo();
  await p.tap('#g-salary'); await p.keyboard.type('1200000'); await tocar('.guide-monto button[type=submit]'); movio += await fondo();
  const ops = await p.$$('.guide-controls [data-action=guideNext]'); await ops[ops.length - 1].tap(); await p.waitForTimeout(350);
  for (const n of ['Alquiler', 'Expensas', 'Luz', 'Gas', 'Agua', 'Internet', 'Celular']) { await tocar(`[data-action=guideFijo][data-n="${n}"]`); await p.keyboard.type('12000'); movio += await fondo(); }
  const valores = await p.$$eval('.guide-fijos input', (l) => l.map((e) => e.value));
  ok('Bienvenida: se pueden escribir los montos de 7 gastos fijos', valores.length === 7 && valores.every((v) => v === '12.000'), JSON.stringify(valores));
  // con el teclado abierto (pantalla más baja) el campo sigue a la vista
  await p.tap('.guide-fijos input >> nth=3');
  const vp = p.viewportSize(); await p.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) }); await p.waitForTimeout(500);
  const vis = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok('Bienvenida: con el teclado abierto el campo se ve', vis);
  await p.setViewportSize(vp); await p.waitForTimeout(300);
  await tocar('.guide-fijos button[type=submit]'); movio += await fondo();
  ok('Bienvenida: el fondo nunca se desplaza', movio === 0, `scrollY sumado: ${movio}`);
  ok('Bienvenida: los montos llegan a la respuesta', /Alquiler \$\s?12\.000/.test(await texto(p, '.guide-chat')));
  ok('Bienvenida: sin errores de la página', !errores.length, errores.join(' | '));
  await b.close();
}

// ---------- 2. La app con datos de ejemplo ----------
{
  const { b, p, errores } = await abrir(srv.url);
  await entrar(p);

  // Inicio
  ok('Inicio: una sola tarjeta principal (sin carrusel)', (await p.$$('.hero-inicio')).length === 1 && !(await p.$('[data-widget]')));
  ok('Inicio: muestra lo que queda hasta el cobro', /Hasta (el cobro|fin de mes): \$/.test(await texto(p, '.hero-cobro')));
  ok('Inicio: sin la tarjeta de la meta', !(await p.$('.goal-row')));
  await p.click('.topbar [data-action=alternarMontos]'); await p.waitForTimeout(400);
  ok('Inicio: el ojito oculta los números', /••••••/.test(await texto(p, '.hero-inicio')) && !/\$\s?\d/.test(await texto(p, '.hero-inicio')));
  await p.click('.topbar [data-action=alternarMontos]'); await p.waitForTimeout(400);
  ok('Inicio: y los vuelve a mostrar', /\$\s?\d/.test(await texto(p, '.hero-inicio')));
  ok('Inicio: la carga rápida no ofrece proyectos', !(await p.$('[data-action=pickProyecto]')));

  // Movimientos y Estadísticas
  await ir(p, 'movimientos');
  ok('Movimientos: sin el cartel "Te ahorraste con Pesitos"', !(await p.$('.mov-ahorro')));
  await ir(p, 'estadisticas');
  ok('Estadísticas: muestra lo que te ahorraste con Pesitos', /Te ahorraste con Pesitos/.test(await texto(p, '.mov-ahorro')));

  // Por pagar
  await ir(p, 'pagos');
  ok('Por pagar: sin gráfico ni "Hacerlo exacto"', !(await p.$('main .card.green svg')) && !(await p.$('[data-action=openClose]')));

  // Mi plata → Cuentas: opcional
  await ir(p, 'ahorro');
  ok('Mi plata: sin patrimonio arriba', !(await p.$('.patrimonio')));
  ok('Mi plata: saldo de cuentas opcional, en una línea', !!(await p.$('[data-action=openSeguirCuentas]')) && !(await p.$('main .row [data-action=abrirCuenta]')) && !/Cargar/.test(await texto(p, 'main')));
  await p.click('[data-action=openSeguirCuentas]'); await p.waitForTimeout(400);
  const campos = await p.$$('#modal input[name^=c_]');
  await campos[0].fill('100000'); await campos[1].fill('50000');
  await p.click('#modal button[type=submit]'); await p.waitForTimeout(500);
  let s = await estado(p);
  ok('Mi plata: sigue solo las cuentas elegidas', Object.keys(s.cuentas || {}).length === 2, JSON.stringify(s.cuentas));
  ok('Mi plata: muestra solo esas cuentas', (await p.$$('main [data-action=abrirCuenta]')).length === 2);

  // Cuadre al cobrar: simulo que las cargué antes del cobro y que no comparé desde entonces
  await cambiar(p, (st) => { for (const c of Object.values(st.cuentas)) c.desde = '2020-01-01'; st.comparacion = { ultima: '2020-01-01' }; });
  await ir(p, 'inicio');
  const hayCuadre = /Cobraste: ¿cuánto tenés hoy/.test(await texto(p, 'main')) || /Cobraste: ¿cuánto tenés hoy/.test(await (async () => { await p.click('[data-action=openNovedades]'); await p.waitForTimeout(400); const t = await texto(p, '#modal'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); return t; })());
  ok('Cuadre: después de cobrar te pregunta el saldo', hayCuadre);
  await ir(p, 'ahorro');
  await p.click('[data-action=openComparar]'); await p.waitForTimeout(400);
  const cmp = await p.$$('#modal input[name^=c_]');
  const calc = s.cuentas; void calc;
  await cmp[0].fill('1'); // mucho menos de lo calculado
  await p.click('#modal button[type=submit]'); await p.waitForTimeout(500);
  ok('Cuadre: si falta plata, pregunta qué fue', /Falta plata/.test(await texto(p, '#modal')));
  const antes = (await estado(p)).expenses.length;
  await p.click('[data-action=cuadreGastos]'); await p.waitForTimeout(500);
  s = await estado(p);
  const nuevo = s.expenses.find((e) => e.ajusteCuadre);
  ok('Cuadre: "Son gastos que no anoté" los suma en Otros', s.expenses.length === antes + 1 && nuevo && nuevo.category === 'otros' && nuevo.note === 'Gastos sin anotar');
  ok('Cuadre: el saldo queda en lo real', Object.values(s.cuentas).some((c) => c.saldo === 1));

  // Cómo te fue en el mes
  await cambiar(p, (st) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    st.expenses.push({ id: 'zz1', date: `${mk}-10`, amount: 50000, category: 'super', note: 'Súper', installments: 1 });
    st.incomes.push({ id: 'zz2', date: `${mk}-01`, amount: 900000, type: 'sueldo', note: 'Sueldo' });
    st.profile.payRule = { tipo: 'dia', dia: 1 }; delete st.cierres;
  });
  await ir(p, 'inicio');
  ok('Cierre de mes: aparece "Cómo te fue en…"', /Cómo te fue en/.test(await texto(p, '.cierre')));
  await p.click('[data-action=cierreVer]'); await p.waitForTimeout(500);
  ok('Cierre de mes: "Ver el detalle" abre Estadísticas de ese mes', /estadisticas/.test(p.url()) && !!(await p.$('[data-action=statsElegirMes][aria-pressed=true]')));
  await ir(p, 'inicio');
  await p.click('[data-action=cierreListo]'); await p.waitForTimeout(400);
  ok('Cierre de mes: "Listo" lo saca', !(await p.$('.cierre')));

  // Metas: un objetivo ya no ofrece proyectos
  await ir(p, 'ahorro'); await p.click('[data-action=ahorroVista][data-v=plan]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-action=openGoalForm]').click()); await p.waitForTimeout(300);
  await p.click('[data-action=nuevaMetaObjetivo]'); await p.waitForTimeout(300);
  ok('Metas: "Un objetivo" va directo al formulario (sin proyectos)', !!(await p.$('#modal form[data-submit=saveGoal]')) && !(await p.$('[data-action=nuevoProyecto]')));

  ok('App: sin errores de la página', !errores.length, errores.join(' | '));
  await b.close();
}

srv.cerrar();
const mal = resultados.filter((r) => !r[0]);
console.log(mal.length ? `\n✗ ${mal.length} de ${resultados.length} pruebas fallaron` : `\n✓ Las ${resultados.length} pruebas pasaron`);
process.exit(mal.length ? 1 : 0);
