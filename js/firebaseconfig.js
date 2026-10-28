// =========================================================
// Pesitos — conexión con Firebase (Authentication + Firestore)
// Pegá acá el bloque firebaseConfig de tu proyecto:
// Consola de Firebase → ⚙️ Configuración del proyecto → General →
// Tus apps → Pesitos (web) → Configuración del SDK → Config.
// No es una clave secreta: la seguridad la dan las reglas (firestore.rules).
// =========================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDtqURVsYM7THf2Ct-G4g28rfCHHYRegYQ',
  authDomain: 'pesitos-4dd84.firebaseapp.com',
  projectId: 'pesitos-4dd84',
  storageBucket: 'pesitos-4dd84.firebasestorage.app',
  messagingSenderId: '211249503486',
  appId: '1:211249503486:web:30ab1a91ba916f058699af',
};

export const firebaseListo = () => Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.appId);

let app = null;
let auth = null;
let db = null;

export function iniciarFirebase() {
  if (app || !firebaseListo()) return { app, auth, db };
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  auth.languageCode = 'es'; // mails de verificación y de contraseña en español
  try {
    // copia local de la nube: funciona sin conexión y envía lo pendiente al volver
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  return { app, auth, db };
}

export const firebase = () => iniciarFirebase();
