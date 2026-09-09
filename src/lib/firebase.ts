// src/lib/firebase.ts
// Replace the values below with your own Firebase project config, or create
// a .env file from .env.example, to enable real auth/sync.
//
// IMPORTANT: this file is SAFE TO IMPORT even with no Firebase project
// configured. The app's wallet, routes, and all core features work fully
// in-memory without Firebase — Firebase only adds optional cloud sign-in
// and data sync on top. We never throw here, so a missing .env never
// produces a blank white screen.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only treat Firebase as "configured" if the essentials are present —
// otherwise initializeApp() can throw and crash the whole app on load.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
  } catch (err) {
    // Defensive: never let a bad config crash app load.
    console.warn("Firebase failed to initialize — running without cloud sync.", err);
    app = null; authInstance = null; dbInstance = null; storageInstance = null;
  }
}

export const auth    = authInstance;
export const db      = dbInstance;
export const storage = storageInstance;
export const googleProvider = new GoogleAuthProvider();

export default app;
