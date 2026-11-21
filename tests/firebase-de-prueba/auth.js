// Firebase de mentira para los tests: guarda todo en el navegador (no toca la nube).
const LS = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const W = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const listeners = [];
function mk(u) { if (!u) return null; return { uid: u.uid, email: u.email, displayName: u.displayName || '', emailVerified: !!u.emailVerified, providerData: [{ providerId: u.provider }],
  async reload() { const x = LS('__users', {})[u.email]; Object.assign(this, { emailVerified: !!x.emailVerified }); }, async getIdToken() { return 't'; } }; }
const auth = { currentUser: null, languageCode: 'es' };
function setUser(u) { auth.currentUser = mk(u); W('__session', u ? u.email : null); listeners.forEach((f) => f(auth.currentUser)); }
export function getAuth() { const e = LS('__session', null); if (e && !auth.currentUser) auth.currentUser = mk(LS('__users', {})[e]); return auth; }
export function onAuthStateChanged(a, f) { listeners.push(f); setTimeout(() => f(auth.currentUser), 10); }
const err = (code) => Object.assign(new Error(code), { code });
export async function signInWithEmailAndPassword(a, email, pass) { const u = LS('__users', {})[email]; if (!u || u.pass !== pass) throw err('auth/invalid-credential'); setUser(u); return { user: auth.currentUser }; }
export async function createUserWithEmailAndPassword(a, email, pass) { const us = LS('__users', {}); if (us[email]) throw err('auth/email-already-in-use'); if (pass.length < 6) throw err('auth/weak-password'); us[email] = { uid: 'u' + Object.keys(us).length + 'x', email, pass, provider: 'password', emailVerified: false }; W('__users', us); setUser(us[email]); return { user: auth.currentUser }; }
export async function sendEmailVerification() { window.__verifSent = (window.__verifSent || 0) + 1; }
export async function sendPasswordResetEmail(a, e) { window.__reset = e; }
export class GoogleAuthProvider { setCustomParameters() {} }
export async function signInWithPopup() { const us = LS('__users', {}); const email = 'google@test.com'; us[email] = us[email] || { uid: 'g1', email, provider: 'google.com', displayName: 'Franco Pugliese', emailVerified: true }; W('__users', us); setUser(us[email]); }
export async function signInWithRedirect() {}
export async function getRedirectResult() { return null; }
export async function updateProfile(u, d) { const us = LS('__users', {}); us[u.email].displayName = d.displayName; W('__users', us); u.displayName = d.displayName; }
export async function updatePassword(u, p) { const us = LS('__users', {}); us[u.email].pass = p; W('__users', us); }
export const EmailAuthProvider = { credential: (e, p) => ({ e, p }) };
export async function reauthenticateWithCredential(u, c) { if (LS('__users', {})[u.email].pass !== c.p) throw err('auth/wrong-password'); }
export async function reauthenticateWithPopup() {}
export async function deleteUser(u) { const us = LS('__users', {}); delete us[u.email]; W('__users', us); setUser(null); }
export async function signOut() { setUser(null); }
export async function setPersistence() {}
export const browserLocalPersistence = {};
