// Firebase Admin para las funciones de Vercel (mismo esquema que DBTYCS).
// Variable de entorno: FIREBASE_SERVICE_ACCOUNT_JSON (el JSON completo de la cuenta de servicio).

import admin from 'firebase-admin';

export function db() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('Falta la variable FIREBASE_SERVICE_ACCOUNT_JSON en Vercel');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}

/** Auth de Firebase (para buscar al dueño de la app por su email). */
export function auth() { db(); return admin.auth(); }
