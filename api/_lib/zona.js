// ¿La promo vale en la provincia del usuario? (misma lógica que js/datosvivos.js)
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const KEYS = { 'Buenos Aires': ['provincia de buenos aires', 'pba', 'amba', 'bonaerense'], CABA: ['caba', 'ciudad de buenos aires', 'ciudad autonoma', 'amba'] };

export function inZone(zone, prov) {
  const z = norm(zone);
  if (!z || z.includes('nacional') || z.includes('todo el pais')) return true;
  if (!prov) return false;
  return (KEYS[prov] || [norm(prov)]).some((k) => z.includes(k));
}
