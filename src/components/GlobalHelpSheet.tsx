import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { useHelp, PAGE_HELP } from "@/lib/help";

export default function GlobalHelpSheet() {
  const { open, setOpen, currentPath } = useHelp();
  const content = PAGE_HELP[currentPath] ?? PAGE_HELP["/"];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 5000, backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 5001,
              background: "var(--ink3)", borderTop: "1px solid var(--border2)",
              borderRadius: "22px 22px 0 0", padding: "1.2rem 1.2rem 2rem",
              maxHeight: "78vh", overflowY: "auto",
              maxWidth: 640, margin: "0 auto",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border2)", margin: "0 auto 14px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={18} style={{ color: "var(--ready)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 900 }}>{content.title}</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {content.steps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{ display: "flex", gap: 12, padding: "10px 12px", borderRadius: 14, background: "var(--glass)", border: "1px solid var(--border2)" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: ".78rem", marginBottom: 3 }}>{s.heading}</p>
                    <p style={{ fontSize: ".68rem", color: "var(--muted2)", lineHeight: 1.5 }}>{s.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
