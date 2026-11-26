import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, MapPin, type LucideIcon } from "lucide-react";

/** Everything a poster shows. Sights, mapped places and local businesses are all turned into this shape. */
export interface PosterData {
  id: string; title: string; subtitle?: string; imageUrl?: string; altImageUrl?: string; /** Extra places to try if the first picture is missing (for example .png then .jpg). */ imageUrls?: string[]; icon: LucideIcon;
  summary?: string; highlights?: string[];
  facts: { icon: LucideIcon; label: string; text: string }[];
  tips?: string[]; note?: string;
}

/** A full-screen poster: one picture on top, the key facts under it. Used for sights, places and local businesses. */
export default function PosterModal({ poster, onClose, actions, children }: { poster: PosterData | null; onClose: () => void; actions?: ReactNode; children?: ReactNode }) {
  const [failed, setFailed] = useState(0);
  const [tall, setTall] = useState(false);
  useEffect(() => { setFailed(0); setTall(false); }, [poster?.id]);
  const urls = poster ? (poster.imageUrls?.length ? poster.imageUrls : [poster.imageUrl, poster.altImageUrl].filter((u): u is string => !!u)) : [];
  const current = urls[failed];
  useEffect(() => {
    if (!poster) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [poster, onClose]);
  const Icon = poster?.icon ?? MapPin;
  return createPortal(<AnimatePresence>
    {poster && <motion.div key={poster.id} role="dialog" aria-modal="true" aria-label={poster.title} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: .22 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#070b17", color: "#f8fafc", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {current && <img key={`probe-${failed}`} src={current} alt="" aria-hidden onLoad={event => setTall(event.currentTarget.naturalHeight / Math.max(1, event.currentTarget.naturalWidth) > 1.25)} onError={() => setFailed(count => count + 1)} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />}
      {tall && current ? <div style={{ maxWidth: 560, margin: "0 auto", position: "relative" }}>
        <button aria-label="Close poster" onClick={onClose} style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top))", right: 14, zIndex: 2, width: 42, height: 42, borderRadius: "50%", border: "1px solid #ffffff55", background: "#0b1530cc", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={20} /></button>
        <img src={current} alt={poster.title} style={{ display: "block", width: "100%", height: "auto" }} />
        <div style={{ padding: "10px 16px calc(28px + env(safe-area-inset-bottom))" }}>
          {children}
          {actions && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{actions}</div>}
          {poster.note && <p style={{ fontSize: ".58rem", color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>{poster.note}</p>}
        </div>
      </div> : <>
      <div style={{ position: "relative", width: "100%", height: "min(46dvh, 420px)", background: "linear-gradient(135deg,#0b1530,#1d4ed8)" }}>
        {current && <img key={failed} src={current} alt={poster.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {!current && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Icon size={64} strokeWidth={1.4} color="#ffffffcc" /></div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,#070b17 0%,transparent 45%)" }} />
        <button aria-label="Close poster" onClick={onClose} style={{ position: "absolute", top: "max(14px, env(safe-area-inset-top))", right: 14, width: 42, height: 42, borderRadius: "50%", border: "1px solid #ffffff55", background: "#0b1530cc", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={20} /></button>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 10 }}>
          {poster.subtitle && <p style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: ".66rem", color: "#fbbf24", fontWeight: 700 }}><Icon size={13} />{poster.subtitle}</p>}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.45rem", lineHeight: 1.15, fontWeight: 900 }}>{poster.title}</h2>
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 16px calc(28px + env(safe-area-inset-bottom))" }}>
        {children}
        {poster.summary && <p style={{ fontSize: ".78rem", lineHeight: 1.55, margin: "6px 0 10px" }}>{poster.summary}</p>}
        {poster.highlights && poster.highlights.length > 0 && <ul style={{ margin: "0 0 10px 18px", fontSize: ".72rem", lineHeight: 1.6 }}>{poster.highlights.map(item => <li key={item}>{item}</li>)}</ul>}
        {poster.facts.map(fact => <div key={fact.label} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #ffffff1f" }}>
          <fact.icon size={16} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
          <div><small style={{ color: "#94a3b8", fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{fact.label}</small><p style={{ fontSize: ".74rem", lineHeight: 1.5 }}>{fact.text}</p></div>
        </div>)}
        {poster.tips && poster.tips.length > 0 && <div style={{ padding: "9px 0" }}><small style={{ color: "#94a3b8", fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Good to know</small>{poster.tips.map(tip => <p key={tip} style={{ fontSize: ".72rem", lineHeight: 1.5, marginTop: 3 }}>{tip}</p>)}</div>}
        {actions && <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{actions}</div>}
        {poster.note && <p style={{ fontSize: ".58rem", color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>{poster.note}</p>}
      </div></>}
    </motion.div>}
  </AnimatePresence>, document.body);
}
