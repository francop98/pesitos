// =============================================================
// Firebase (opcional, para la próxima etapa)
// -------------------------------------------------------------
// Hoy Pesitos guarda todo en el dispositivo (ver js/store.js).
// Para sincronizar entre celular y compu con tu cuenta:
//
// 1. Creá un proyecto en https://console.firebase.google.com
// 2. Activá Authentication (Google) y Firestore.
// 3. Pegá tu configuración abajo y descomentá el código.
// 4. En js/store.js, reemplazá load()/save() por loadRemote()/saveRemote().
//
// Estructura sugerida en Firestore:  users/{uid}  →  { ...estado de la app }
// Reglas de seguridad mínimas:
//   match /users/{uid} { allow read, write: if request.auth.uid == uid; }
// =============================================================

/*
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  appId: 'TU_APP_ID',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const onUser = (cb) => onAuthStateChanged(auth, cb);

export async function loadRemote(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}
export async function saveRemote(uid, state) {
  await setDoc(doc(db, 'users', uid), state);
}
*/
