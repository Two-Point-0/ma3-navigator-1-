// src/hooks/useFirestore.ts
// Ready-made hooks for every piece of Ma3 data that needs to persist.

import { useState, useEffect } from "react";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot,
  orderBy, addDoc, serverTimestamp, increment,
  DocumentData,
} from "firebase/firestore";
import { db as dbRaw, isFirebaseConfigured } from "@/lib/firebase";
import { BusinessPin } from "@/data/ma3_core";

// These hooks are optional Firestore scaffolding — every function below
// requires a real Firebase project to be configured. They no-op safely
// when it isn't, rather than throwing and crashing the app.
const db = dbRaw as import("firebase/firestore").Firestore; // narrowed after isFirebaseConfigured guards below

// ─── WALLET ──────────────────────────────────────────────────────────────────
// Reads/writes the user's wallet balance and plan from Firestore.
// Document path: wallets/{uid}

export function useWalletFirestore(uid: string | null) {
  const [balance, setBalance]     = useState<number>(0);
  const [plan, setPlan]           = useState<string | null>(null);
  const [planAmount, setPlanAmt]  = useState<number>(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) { setLoading(false); return; }
    const ref = doc(db, "wallets", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setBalance(d.balance ?? 0);
        setPlan(d.plan ?? null);
        setPlanAmt(d.planAmount ?? 0);
      } else {
        // First time — seed with 500 KES welcome balance
        setDoc(ref, { balance: 500, plan: null, planAmount: 0, createdAt: serverTimestamp() });
      }
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const topUp = async (amount: number) => {
    if (!uid || !isFirebaseConfigured) return;
    await updateDoc(doc(db, "wallets", uid), { balance: increment(amount) });
  };

  const pay = async (amount: number): Promise<boolean> => {
    if (!uid || !isFirebaseConfigured || balance < amount) return false;
    await updateDoc(doc(db, "wallets", uid), { balance: increment(-amount) });
    // Write a transaction record
    await addDoc(collection(db, "wallets", uid, "transactions"), {
      amount: -amount, createdAt: serverTimestamp(), type: "ride",
    });
    return true;
  };

  const activatePlan = async (planName: string, amount: number) => {
    if (!uid || !isFirebaseConfigured) return;
    await updateDoc(doc(db, "wallets", uid), {
      plan: planName, planAmount: amount, balance: increment(amount),
      planActivatedAt: serverTimestamp(),
    });
  };

  return { balance, plan, planAmount, loading, topUp, pay, activatePlan };
}

// ─── BUSINESS PINS ───────────────────────────────────────────────────────────
// Real-time listener on all business pins. Everyone sees each other's pins.
// Collection: businessPins

export function useBusinessPins() {
  const [pins, setPins]     = useState<BusinessPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const q = query(collection(db, "businessPins"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPins(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessPin)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const addPin = async (pin: Omit<BusinessPin, "id">) => {
    if (!isFirebaseConfigured) return;
    await addDoc(collection(db, "businessPins"), {
      ...pin, createdAt: serverTimestamp(),
    });
  };

  const removePin = async (id: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, "businessPins", id));
  };

  return { pins, loading, addPin, removePin };
}

// ─── NGANYA VOTES ─────────────────────────────────────────────────────────────
// Weekly vote — one vote per user per nganya. Stored in: nganyaVotes/{nganjaId}
// Sub-collection voters/{uid} ensures one-vote-per-user enforced at Firestore level.

export function useNganyaVotes() {
  const [votes, setVotes]   = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const q = query(collection(db, "nganyaVotes"));
    const unsub = onSnapshot(q, (snap) => {
      const v: Record<string, number> = {};
      snap.docs.forEach(d => { v[d.id] = d.data().count ?? 0; });
      setVotes(v);
      setLoading(false);
    });
    return unsub;
  }, []);

  const vote = async (nganyadId: string, uid: string): Promise<boolean> => {
    if (!isFirebaseConfigured) return false;
    const voterRef = doc(db, "nganyaVotes", nganyadId, "voters", uid);
    const existing = await getDoc(voterRef);
    if (existing.exists()) return false; // already voted
    // Record voter + increment count atomically-ish
    await setDoc(voterRef, { votedAt: serverTimestamp() });
    const countRef = doc(db, "nganyaVotes", nganyadId);
    const snap = await getDoc(countRef);
    if (snap.exists()) {
      await updateDoc(countRef, { count: increment(1) });
    } else {
      await setDoc(countRef, { count: 1 });
    }
    return true;
  };

  const hasVoted = async (nganyadId: string, uid: string): Promise<boolean> => {
    if (!isFirebaseConfigured) return false;
    const snap = await getDoc(doc(db, "nganyaVotes", nganyadId, "voters", uid));
    return snap.exists();
  };

  return { votes, loading, vote, hasVoted };
}

// ─── STOP QUEUE (Lock-in) ────────────────────────────────────────────────────
// When a passenger locks in, write their destination to a queue document.
// Drivers/touts read the real-time queue for each stop.
// Collection: stopQueues/{stopId}/passengers/{uid}

export function useStopQueue(stopId: string | null) {
  const [queue, setQueue] = useState<DocumentData[]>([]);

  useEffect(() => {
    if (!stopId || !isFirebaseConfigured) return;
    const q = query(collection(db, "stopQueues", stopId, "passengers"));
    const unsub = onSnapshot(q, (snap) => {
      setQueue(snap.docs.map(d => d.data()));
    });
    return unsub;
  }, [stopId]);

  const lockIn = async (stopId: string, uid: string, destination: string, destLat: number, destLon: number) => {
    if (!isFirebaseConfigured) return;
    await setDoc(doc(db, "stopQueues", stopId, "passengers", uid), {
      destination, destLat, destLon,
      lockedAt: serverTimestamp(),
      // Auto-expires after 30 min — clean up with a Cloud Function or TTL rule
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  };

  const unlockFrom = async (stopId: string, uid: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, "stopQueues", stopId, "passengers", uid));
  };

  return { queue, lockIn, unlockFrom };
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
// Stores display name, city, plan, joined date.
// Document: users/{uid}

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<DocumentData | null>(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
    return unsub;
  }, [uid]);

  const updateProfile = async (data: Partial<DocumentData>) => {
    if (!uid || !isFirebaseConfigured) return;
    await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  };

  return { profile, updateProfile };
}
