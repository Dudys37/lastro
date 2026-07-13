// ═══ Firebase (F0) — inicialização única, config via .env ═══
// Crie um projeto no console do Firebase, ative Authentication (Google e
// E-mail/senha) e o Firestore, e copie a config web para o arquivo .env
// (modelo em .env.example). Nada de segredo hardcoded no repositório.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const app = initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
