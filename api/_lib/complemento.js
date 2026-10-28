// Complemento gratuito para los medios de pago que la fuente principal no cubre
// (por ejemplo, los bancos que agregan los usuarios):
// 1) Tavily busca notas de promos de este mes (plan gratis: 1.000 búsquedas por mes).
// 2) Gemini Flash (plan gratis de Google AI Studio) lee esas notas y arma la lista.
// Solo corre si están TAVILY_API_KEY y GEMINI_API_KEY. Si falla, no afecta lo demás.

const CATEGORIES = ['super', 'comida', 'delivery', 'transporte', 'hogar', 'salud', 'ropa', 'ocio', 'suscripciones', 'educacion', 'otros'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MAX_BUSQUEDAS = 6; // por corrida: ~6 × 31 días ≈ 190 de las 1.000 gratis
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const complementoActivo = () => Boolean(process.env.TAVILY_API_KEY && process.env.GEMINI_API_KEY);

async function buscar(query) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 3, include_raw_content: 'text', country: 'argentina' }),
  });
  if (!r.ok) throw new Error(`Tavily ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x) => ({ url: x.url, title: x.title, text: String(x.raw_content || x.content || '').slice(0, 3500) }));
}

async function gemini(text) {
  const models = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean);
  let last = '';
  for (const model of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
    });
    if (r.status === 404) { last = `modelo ${model} no disponible`; continue; }
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return ((j.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('');
  }
  throw new Error(`Gemini: ${last}`);
}

// nombres: medios de pago sin promos en la fuente principal
export async function promosComplemento(nombres, today) {
  const [y, m] = today.split('-');
  const mes = `${MESES[Number(m) - 1]} ${y}`;
  const elegidos = nombres.slice(0, MAX_BUSQUEDAS);
  const notas = [];
  for (const n of elegidos) {
    try { for (const r of await buscar(`promociones descuentos reintegros ${n} ${mes} Argentina`)) notas.push({ ...r, medio: n }); } catch (e) { console.warn(e.message); }
  }
  if (!notas.length) return { promos: [], buscados: elegidos };
  const prompt = `Hoy es ${today}. Leé estas notas y extraé las promociones VIGENTES de ${mes} de estos medios de pago: ${elegidos.join(', ')}.
Respondé SOLO un JSON: {"promos":[{"walletName":"<uno de: ${elegidos.join(' | ')}>","days":[<0=domingo … 6=sábado>],"merchant":"<comercio o rubro>","category":"<${CATEGORIES.join('|')}>","pct":<número>,"cap":<tope en pesos o 0>,"cond":"<condiciones cortas>","zone":"<Nacional o provincia>","validFrom":"AAAA-MM-DD","validTo":"AAAA-MM-DD","source":"<url de la nota>"}]}
Reglas: solo promos que figuren en el texto; nada inventado; si no dice la fecha de fin, usá el último día del mes; si no dice días, son los 7.

${notas.map((x, i) => `### Nota ${i + 1} (${x.medio}) — ${x.title}\n${x.url}\n${x.text}`).join('\n\n')}`;
  const raw = await gemini(prompt);
  let data;
  try { data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { return { promos: [], buscados: elegidos }; }
  const ok = new Map(elegidos.map((n) => [n.toLowerCase(), n]));
  const urls = new Set(notas.map((x) => x.url));
  const promos = (data.promos || [])
    .filter((p) => p && ok.has(String(p.walletName || '').toLowerCase()) && Number(p.pct) > 0 && Number(p.pct) <= 100)
    .map((p) => ({
      wallet: 'otro',
      walletName: ok.get(String(p.walletName).toLowerCase()),
      days: [...new Set((Array.isArray(p.days) && p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((d) => d >= 0 && d <= 6))],
      merchant: String(p.merchant || '').slice(0, 80),
      category: CATEGORIES.includes(p.category) ? p.category : 'otros',
      pct: Math.round(Number(p.pct)),
      cap: Math.max(0, Math.round(Number(p.cap) || 0)),
      cond: String(p.cond || '').slice(0, 180),
      zone: String(p.zone || 'Nacional').slice(0, 60),
      validFrom: isDate(p.validFrom) ? p.validFrom : today,
      validTo: isDate(p.validTo) ? p.validTo : `${y}-${m}-28`,
      source: urls.has(p.source) ? p.source : '',
      auto: true,
    }))
    .filter((p) => p.days.length && p.validTo >= today);
  return { promos, buscados: elegidos };
}
