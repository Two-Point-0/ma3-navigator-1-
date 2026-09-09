// src/context/AuthContext.tsx
// Wraps the whole app. Any component can call useAuthContext() to get the user.
// Works fully even with no Firebase project configured — falls back to a
// local guest session so nothing in the app ever depends on real Firebase
// credentials being present.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // No Firebase project configured — app runs in local/guest mode.
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      unsub = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setLoading(false);
        if (u && db) {
          const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
          await setDoc(doc(db, "users", u.uid), {
            displayName: u.displayName ?? "Ma3 Rider",
            email:       u.email ?? null,
            photoURL:    u.photoURL ?? null,
            isAnon:      u.isAnonymous,
            lastSeen:    serverTimestamp(),
          }, { merge: true });
        }
      });
    })();

    return () => unsub?.();
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      console.warn("Firebase not configured — add your config to .env to enable Google sign-in.");
      return;
    }
    const { signInWithPopup } = await import("firebase/auth");
    await signInWithPopup(auth, googleProvider);
  };

  const signInAsGuest = async () => {
    if (!isFirebaseConfigured || !auth) {
      // Local guest mode — no Firebase needed, the app already works fully without auth.
      setUser(null);
      return;
    }
    const { signInAnonymously } = await import("firebase/auth");
    await signInAnonymously(auth);
  };

  const logout = async () => {
    if (!isFirebaseConfigured || !auth) { setUser(null); return; }
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}
