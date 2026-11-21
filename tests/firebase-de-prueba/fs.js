// Firebase de mentira para los tests: guarda todo en el navegador (no toca la nube).
const LS = () => JSON.parse(localStorage.getItem('__fs') || '{}');
const W = (v) => localStorage.setItem('__fs', JSON.stringify(v));
export function initializeFirestore() { return {}; }
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export function doc(db, ...p) { return { path: p.join('/') }; }
export function collection(db, ...p) { return { path: p.join('/') }; }
export const serverTimestamp = () => '__ts';
export const deleteField = () => '__del';
const mezclar = (a, v) => { const o = { ...(a || {}), ...v }; for (const k of Object.keys(o)) if (o[k] === '__del') delete o[k]; return o; };
export async function getDoc(r) { const d = LS()[r.path]; return { exists: () => !!d, data: () => d }; }
export async function setDoc(r, v, o) { if (window.__offline) throw new Error('offline'); const s = LS(); s[r.path] = o && o.merge ? mezclar(s[r.path], v) : v; W(s); }
export async function deleteDoc(r) { const s = LS(); delete s[r.path]; W(s); }
export async function getDocs(c) { if (window.__offline) throw new Error('offline'); const s = LS(); const docs = Object.keys(s).filter((k) => k.startsWith(c.path + '/') && !k.slice(c.path.length + 1).includes('/')).map((k) => ({ id: k.split('/').pop(), ref: { path: k }, data: () => s[k] })); return { forEach: (f) => docs.forEach(f), size: docs.length }; }
export function writeBatch() { const ops = []; return { set: (r, v, o) => ops.push(['s', r, v, o]), delete: (r) => ops.push(['d', r]), async commit() { if (window.__offline) throw new Error('offline'); window.__commits = (window.__commits || 0) + 1; const s = LS(); for (const [t, r, v, o] of ops) { if (t === 's') s[r.path] = o && o.merge ? mezclar(s[r.path], v) : v; else delete s[r.path]; } W(s); } }; }
export const arrayUnion = (...v) => ({ __au: v });
export const arrayRemove = (...v) => ({ __ar: v });
export async function updateDoc(r, v) {
  if (window.__offline) throw new Error('offline');
  const s = LS(); const d = { ...(s[r.path] || {}) };
  if (!s[r.path]) throw new Error('not-found');
  for (const [k, x] of Object.entries(v)) {
    const parts = k.split('.'); let o = d; for (const p of parts.slice(0, -1)) { o[p] = { ...(o[p] || {}) }; o = o[p]; }
    const last = parts[parts.length - 1];
    if (x && x.__au) o[last] = [...new Set([...(o[last] || []), ...x.__au])];
    else if (x && x.__ar) o[last] = (o[last] || []).filter((y) => !x.__ar.includes(y));
    else if (x === '__del') delete o[last];
    else o[last] = x;
  }
  s[r.path] = d; W(s);
}
