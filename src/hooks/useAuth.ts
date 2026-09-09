// src/hooks/useAuth.ts
// Tracks Firebase auth state — returns the current user or null.
// Safe to use even with no Firebase project configured.

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) { setLoading(false); return; }
    let unsub: (() => void) | undefined;
    (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  return { user, loading };
}
