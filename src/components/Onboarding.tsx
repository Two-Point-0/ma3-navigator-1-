import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Bus, ShoppingCart, Gamepad2, Car, UserRound, Check } from "lucide-react";

export const ROLE_STORAGE_KEY = "ma3_user_role";
export type Ma3Role = "passenger" | "matatu-driver" | "carpool-driver";

const SLIDES = [
  { theme: "var(--stop)", icon: Bus, keyword: "MOVE", title: "Navigate Nairobi like a local", bullets: ["Search routes by number, Sacco, stop or destination", "Plan direct trips, transfers and walking legs", "See the next stop after boarding"] },
  { theme: "var(--ready)", icon: ShoppingCart, keyword: "MARKET", title: "Shop smart, stretch your money", bullets: ["Compare permitted retailer data with timestamps", "Build basic, standard and pro baskets", "Use family profiles for age-specific shopping"] },
  { theme: "var(--go)", icon: Gamepad2, keyword: "MIRTH", title: "Play, create and celebrate", bullets: ["Load lightweight games and cultural stories", "Discover Nganya creators and products", "Vote in community-led recognition events"] },
];

const ROLES: Array<{ id: Ma3Role; label: string; description: string; Icon: typeof UserRound }> = [
  { id: "passenger", label: "Passenger", description: "Plan trips, compare markets and explore Kenya.", Icon: UserRound },
  { id: "matatu-driver", label: "Matatu driver", description: "Broadcast consented location and view stop demand.", Icon: Bus },
  { id: "carpool-driver", label: "Carpool driver", description: "Share a planned trip and manage available seats.", Icon: Car },
];

interface OnboardingProps { onDone: () => void; }

export default function Onboarding({ onDone }: OnboardingProps) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState<Ma3Role | null>(null);
  const go = (next: number) => { setDir(next > slide ? 1 : -1); setSlide(next); };
  const finish = () => { localStorage.setItem("ma3_onboarding_done", "1"); if (role) localStorage.setItem(ROLE_STORAGE_KEY, role); onDone(); };
  const current = SLIDES[slide];
  const Icon = current.icon;
  const isLast = slide === SLIDES.length - 1;

  return <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "var(--ink)", display: "flex", flexDirection: "column" }}>
    <button onClick={finish} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font)", fontSize: ".72rem", cursor: "pointer", zIndex: 10 }}>Skip</button>
    <AnimatePresence mode="wait" custom={dir}>
      <motion.div key={slide} custom={dir} initial={{ opacity: 0, x: dir * 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 60 }} transition={{ duration: .32 }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 2rem 0" }}>
        <motion.div initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: 110, height: 110, borderRadius: 32, background: `color-mix(in srgb, ${current.theme} 12%, transparent)`, border: `2px solid color-mix(in srgb, ${current.theme} 35%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: current.theme, marginBottom: 28 }}><Icon size={48} strokeWidth={1.5} /></motion.div>
        <div style={{ padding: "4px 14px", borderRadius: 99, background: "var(--glass)", border: `1px solid ${current.theme}`, color: current.theme, fontFamily: "var(--font-display)", fontSize: ".65rem", fontWeight: 900, letterSpacing: ".2em", marginBottom: 12 }}>{current.keyword}</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 900, textAlign: "center", lineHeight: 1.25, marginBottom: 24 }}>{current.title}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>{current.bullets.map((b, i) => <motion.div key={b} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .15 + i * .07 }} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: "var(--glass)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Icon size={11} style={{ color: current.theme }} /></div><p style={{ fontSize: ".76rem", color: "var(--muted2)", lineHeight: 1.5, flex: 1 }}>{b}</p></motion.div>)}</div>
      </motion.div>
    </AnimatePresence>
    <div style={{ padding: "1.5rem 2rem 2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {isLast && <div style={{ width: "100%", maxWidth: 360 }}><p className="sec-label">Choose your starting workspace</p><div style={{ display: "grid", gap: 7 }}>{ROLES.map(({ id, label, description, Icon: RoleIcon }) => <button key={id} onClick={() => setRole(id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px", borderRadius: 12, background: role === id ? "rgba(217,119,6,.14)" : "var(--glass)", border: `1px solid ${role === id ? "var(--ready)" : "var(--border2)"}`, color: "var(--white)", cursor: "pointer" }}><RoleIcon size={17} style={{ color: role === id ? "var(--ready)" : "var(--muted2)" }} /><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".75rem" }}>{label}</b><small style={{ color: "var(--muted2)" }}>{description}</small></span>{role === id && <Check size={15} style={{ color: "var(--ready)" }} />}</button>)}</div></div>}
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>{SLIDES.map((_, i) => <button key={i} onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} style={{ width: i === slide ? 22 : 7, height: 7, borderRadius: 99, background: i === slide ? current.theme : "var(--border2)", border: "none", cursor: "pointer", transition: "all .3s ease" }} />)}</div>
      <button onClick={isLast ? finish : () => go(slide + 1)} disabled={isLast && !role} style={{ width: "100%", maxWidth: 360, padding: "14px 20px", borderRadius: 14, background: isLast && !role ? "var(--border2)" : current.theme, border: "none", color: slide === 1 ? "#000" : "#fff", fontFamily: "var(--font)", fontWeight: 800, fontSize: ".9rem", cursor: isLast && !role ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{isLast ? "Enter Ma3" : "Next"}{!isLast && <ChevronRight size={16} />}</button>
    </div>
  </div>;
}

export function useOnboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!localStorage.getItem("ma3_onboarding_done")) setShow(true); }, []);
  return { show, finish: () => setShow(false) };
}
