import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

/**
 * A game window that covers the whole screen, so the game gets all the room the phone has.
 * It slides up and grows in, and slides away when closed. The game inside can place a dice pop-up in the middle (position: absolute).
 */
export default function GameShell({ open, title, icon, subtitle, onClose, children }: { open: boolean; title: string; icon?: ReactNode; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Rendered straight into <body> so no parent panel can shrink it: it always covers the whole screen.
  return createPortal(<AnimatePresence>{open && <motion.div key="game-shell" role="dialog" aria-modal="true" aria-label={title}
    initial={{ opacity: 0, y: "6%", scale: .94, borderRadius: 28 }} animate={{ opacity: 1, y: 0, scale: 1, borderRadius: 0 }} exit={{ opacity: 0, y: "8%", scale: .95 }}
    transition={{ type: "spring", stiffness: 260, damping: 28 }}
    style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column", background: "radial-gradient(120% 80% at 50% 0%, #14213d 0%, #070b14 62%)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", height: "100dvh" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px", borderBottom: "1px solid var(--border)" }}>
      {icon}<div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".86rem" }}>{title}</b>{subtitle && <small style={{ color: "var(--muted2)", fontSize: ".58rem" }}>{subtitle}</small>}</div>
      <button className="icon-btn" aria-label="Close game" onClick={onClose}><X size={16} /></button>
    </div>
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 18px", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column" }}>{children}</div>
  </motion.div>}</AnimatePresence>, document.body);
}
