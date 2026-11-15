import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * A big pop-up in the middle of the screen. It sits between the top bar and the bottom menu, so those
 * stay usable, and it is large enough to type in comfortably.
 */
export default function CenterModal({ open, title, icon, onClose, children }: { open: boolean; title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  return <AnimatePresence>{open && <>
    <motion.div key="shade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", top: "var(--top-h)", bottom: "var(--nav-h)", left: 0, right: 0, zIndex: 1100, background: "rgba(0,0,0,.5)", backdropFilter: "blur(5px)" }} />
    <motion.div key="card" role="dialog" aria-label={title} initial={{ opacity: 0, scale: .96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 14 }} transition={{ duration: .18 }}
      className="ios-glass" style={{ position: "fixed", top: "calc(var(--top-h) + 8px)", bottom: "calc(var(--nav-h) + 10px)", left: 8, right: 8, maxWidth: 640, margin: "0 auto", zIndex: 1101, borderRadius: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px", borderBottom: "1px solid var(--border)" }}>
        {icon}<b style={{ flex: 1, fontSize: ".82rem" }}>{title}</b>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={15} /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 18px", WebkitOverflowScrolling: "touch" }}>{children}</div>
    </motion.div>
  </>}</AnimatePresence>;
}
