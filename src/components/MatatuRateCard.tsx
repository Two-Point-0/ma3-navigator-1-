import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BusFront, Gem, Shield, Swords, Volume2, X, Zap, type LucideIcon } from "lucide-react";

export interface StatItem { key: string; label: string; sub?: string; value: number; color: string; Icon: LucideIcon }
export interface RateCardData { id: string; plate: string; title: string; routeLine: string; imageUrls: string[]; stats: { armour: number; sound: number; speed: number; value: number }; fareKes?: number | null; demo?: boolean }

const META = [
  { key: "armour", label: "Armour", sub: "Graffiti & art", color: "linear-gradient(90deg,#a855f7,#d8b4fe)", Icon: Shield },
  { key: "sound", label: "Combat", sub: "Sound system", color: "linear-gradient(90deg,#f97316,#fdba74)", Icon: Volume2 },
  { key: "speed", label: "Speed", sub: "Driving skill", color: "linear-gradient(90deg,#06b6d4,#67e8f9)", Icon: Zap },
  { key: "value", label: "Value", sub: "Service & care", color: "linear-gradient(90deg,#22c55e,#86efac)", Icon: Gem },
] as const;

export const statItems = (stats: RateCardData["stats"]): StatItem[] => META.map(item => ({ key: item.key, label: item.label, sub: item.sub, color: item.color, Icon: item.Icon, value: stats[item.key] }));

/** Same numbers every time for a plate, until real ratings are stored in the database. */
export function demoStats(seed: string): RateCardData["stats"] {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const pick = (shift: number) => 58 + ((h >>> shift) % 41);
  return { armour: pick(0), sound: pick(5), speed: pick(10), value: pick(15) };
}

/** Game-style bars: the number counts up and the bar slides in. */
export function StatBars({ items }: { items: StatItem[] }) {
  return <div style={{ display: "grid", gap: 11 }}>{items.map((item, index) => <div key={item.key}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ".72rem", fontWeight: 800, color: "#f8fafc" }}><item.Icon size={13} /> {item.label}<small style={{ color: "#94a3b8", fontWeight: 600 }}>· {item.sub}</small></span>
      <b style={{ fontFamily: "var(--font-mono)", fontSize: ".78rem", color: "#f8fafc" }}>{Math.round(item.value)}</b>
    </div>
    <div style={{ height: 9, borderRadius: 99, background: "#ffffff1a", overflow: "hidden" }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, item.value))}%` }} transition={{ duration: .7, delay: index * .08, ease: "easeOut" }} style={{ height: "100%", borderRadius: 99, background: item.color }} />
    </div>
  </div>)}</div>;
}

function Picture({ urls, size = 78 }: { urls: string[]; size?: number }) {
  const [failed, setFailed] = useState(0);
  const src = urls[failed];
  return <div style={{ width: size, height: size, borderRadius: 14, border: "2px solid #fbbf24", background: "#0b1530", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
    {src ? <img key={failed} src={src} alt="" onError={() => setFailed(count => count + 1)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BusFront size={size * .45} color="#fbbf24" />}
  </div>;
}

function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  return createPortal(<AnimatePresence>{open && <motion.div role="dialog" aria-modal="true" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
    style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(2,6,16,.72)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 14, overflowY: "auto" }}>
    <motion.div initial={{ y: 18, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, opacity: 0 }} onClick={event => event.stopPropagation()}
      style={{ width: "min(100%, 440px)", maxHeight: "92dvh", overflowY: "auto", borderRadius: 22, border: "1px solid #fbbf2466", background: "linear-gradient(160deg,#0f1630,#070b17)", color: "#f8fafc", padding: 16, boxShadow: "0 0 40px #fbbf2422" }}>{children}</motion.div>
  </motion.div>}</AnimatePresence>, document.body);
}

export function RateCardModal({ card, onClose, onFaceOff }: { card: RateCardData | null; onClose: () => void; onFaceOff?: () => void }) {
  return <Sheet open={!!card} onClose={onClose} label="Matatu rate card">{card && <>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Picture urls={card.imageUrls} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "1.05rem", lineHeight: 1.2 }}>{card.title}</b>
        <small style={{ color: "#94a3b8" }}>{card.plate}</small>
        <small style={{ display: "block", color: "#fbbf24", fontWeight: 700, marginTop: 2 }}>{card.routeLine}</small>
      </div>
      <button aria-label="Close" onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #ffffff33", background: "#ffffff14", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={16} /></button>
    </div>
    <p style={{ margin: "16px 0 9px", fontSize: ".6rem", letterSpacing: ".08em", color: "#94a3b8", fontWeight: 800 }}>RATE CARD</p>
    <StatBars items={statItems(card.stats)} />
    {card.fareKes != null && <p style={{ margin: "14px 0 0", fontSize: ".72rem" }}>Usual fare <b style={{ color: "#fbbf24", fontFamily: "var(--font-mono)" }}>KES {card.fareKes}</b></p>}
    {card.demo && <p style={{ margin: "8px 0 0", fontSize: ".55rem", color: "#94a3b8" }}>Demo scores. Real scores come from rider votes.</p>}
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      {onFaceOff && <button className="btn btn-ready" style={{ flex: 1, justifyContent: "center" }} onClick={onFaceOff}><Swords size={14} /> Face-off</button>}
      <button className="btn btn-ghost" style={{ flex: onFaceOff ? 0 : 1, justifyContent: "center" }} onClick={onClose}>Close</button>
    </div>
  </>}</Sheet>;
}

/** Two matatus side by side. Bars grow from the middle; the better score wins the row. */
export function FaceOffModal({ pair, onClose, onVote }: { pair: [RateCardData, RateCardData] | null; onClose: () => void; onVote: (winner: RateCardData) => void }) {
  return <Sheet open={!!pair} onClose={onClose} label="Matatu face-off">{pair && (() => {
    const [a, b] = pair; const rowsA = statItems(a.stats), rowsB = statItems(b.stats);
    const totalA = rowsA.reduce((s, r) => s + r.value, 0), totalB = rowsB.reduce((s, r) => s + r.value, 0);
    return <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><b style={{ display: "flex", gap: 6, alignItems: "center" }}><Swords size={16} color="#fbbf24" /> Face-off</b><button aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #ffffff33", background: "#ffffff14", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={15} /></button></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "center" }}>{[a, b].map((card, index) => <div key={card.id} style={{ display: "grid", justifyItems: "center", gap: 5 }}><Picture urls={card.imageUrls} size={64} /><b style={{ fontSize: ".72rem", lineHeight: 1.2 }}>{card.title}</b><small style={{ color: "#fbbf24" }}>{card.plate}</small><small style={{ color: (index === 0 ? totalA >= totalB : totalB >= totalA) ? "#4ade80" : "#94a3b8", fontWeight: 800 }}>Total {Math.round(index === 0 ? totalA : totalB)}</small></div>)}</div>
      <div style={{ display: "grid", gap: 11, margin: "14px 0" }}>{rowsA.map((row, index) => { const other = rowsB[index]; return <div key={row.key}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", fontWeight: 800, marginBottom: 3 }}><span style={{ color: row.value >= other.value ? "#4ade80" : "#f8fafc" }}>{Math.round(row.value)}</span><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><row.Icon size={12} /> {row.label}</span><span style={{ color: other.value >= row.value ? "#4ade80" : "#f8fafc" }}>{Math.round(other.value)}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <div style={{ height: 9, borderRadius: "99px 0 0 99px", background: "#ffffff1a", display: "flex", justifyContent: "flex-end", overflow: "hidden" }}><motion.div initial={{ width: 0 }} animate={{ width: `${row.value}%` }} transition={{ duration: .7 }} style={{ height: "100%", background: row.color }} /></div>
          <div style={{ height: 9, borderRadius: "0 99px 99px 0", background: "#ffffff1a", overflow: "hidden" }}><motion.div initial={{ width: 0 }} animate={{ width: `${other.value}%` }} transition={{ duration: .7 }} style={{ height: "100%", background: other.color }} /></div>
        </div></div>; })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button className="btn btn-ready" style={{ justifyContent: "center", fontSize: ".66rem" }} onClick={() => onVote(a)}>Vote {a.plate}</button><button className="btn btn-ready" style={{ justifyContent: "center", fontSize: ".66rem" }} onClick={() => onVote(b)}>Vote {b.plate}</button></div>
    </>; })()}</Sheet>;
}
