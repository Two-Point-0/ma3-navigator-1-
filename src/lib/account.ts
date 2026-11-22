import { useEffect, useState } from "react";
import type { WalletTx } from "@/lib/wallet";

const KEY = "ma3_nickname";
export function getNickname(): string { try { return (localStorage.getItem(KEY) || "").trim(); } catch { return ""; } }
export function setNickname(name: string) { try { localStorage.setItem(KEY, name.trim().slice(0, 24)); window.dispatchEvent(new Event("ma3-nickname")); } catch { /* storage blocked */ } }
export function useNickname(): string {
  const [n, setN] = useState(getNickname);
  useEffect(() => { const f = () => setN(getNickname()); window.addEventListener("ma3-nickname", f); return () => window.removeEventListener("ma3-nickname", f); }, []);
  return n;
}

/** The route the client pays for most often, read from wallet payments labelled "Something · Route name". */
export function topRoute(history: WalletTx[]): { label: string; code: string } | null {
  const counts = new Map<string, number>();
  for (const tx of history) {
    if (tx.kind !== "payment") continue;
    const label = tx.label.includes(" · ") ? tx.label.split(" · ").slice(1).join(" · ") : "";
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best = "";
  counts.forEach((c, l) => { if (!best || c > (counts.get(best) ?? 0)) best = l; });
  if (!best) return null;
  const code = /R-?\d+[A-Z]?/i.exec(best)?.[0]?.toUpperCase() ?? best.slice(0, 6);
  return { label: best, code };
}
