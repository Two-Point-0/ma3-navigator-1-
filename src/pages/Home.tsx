import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bus, Car, Plane, Store, MapPin, Gamepad2, ArrowRight, Zap } from "lucide-react";
import { useWallet } from "@/lib/wallet";

const SECTIONS = [
  { href: "/ma3",    icon: Bus,    color: "var(--stop)", label: "Ma3 Track",   desc: "Routes · Planner · Rail · Live vehicles" },
  { href: "/ndai",   icon: Car,    color: "var(--ready)", label: "Ndai Ride",   desc: "Book a private ride across Nairobi" },
  { href: "/fly",    icon: Plane,  color: "var(--go)", label: "Fly",         desc: "Flights · Airport transfers · Packages" },
  { href: "/market", icon: Store,  color: "var(--ready)", label: "Market",      desc: "Supermarket prices · Budget planner" },
  { href: "/explore",icon: MapPin, color: "var(--go)", label: "Explore",     desc: "Food · Thrift · Entertainment spots" },
  { href: "/mirth",  icon: Gamepad2, color: "var(--ready)", label: "Mirth",       desc: "Games · Daily votes · Sports betting" },
];

export default function HomePage() {
  const { wallet } = useWallet();

  return (
    <div className="inner">
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "2rem 0 1.5rem" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            Nairobi's Urban Companion
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-.03em", marginBottom: 8 }}>
            Ma<span style={{ color: "var(--ready)" }}>3</span>
          </h1>
          <p style={{ fontSize: ".72rem", color: "var(--muted2)", letterSpacing: ".2em", textTransform: "uppercase" }}>Move · Market · Mirth</p>
        </motion.div>
      </div>

      {/* Wallet summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,179,0,.05)", borderColor: "rgba(255,179,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,179,0,.12)", border: "1px solid rgba(255,179,0,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} style={{ color: "var(--ready)" }} />
          </div>
          <div>
            <p style={{ fontSize: ".6rem", color: "var(--muted)", letterSpacing: ".15em", textTransform: "uppercase" }}>Wallet Balance</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700, color: "var(--ready)" }}>
              KES {wallet.balance.toLocaleString()}
            </p>
          </div>
        </div>
        <Link href="/profile">
          <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: ".7rem" }}>
            Top Up <ArrowRight size={11} />
          </button>
        </Link>
      </motion.div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
        {[
          { label: "Routes", value: "136", color: "var(--fire)" },
          { label: "Stops", value: "2.3K", color: "var(--go)" },
          { label: "Rail Lines", value: "5", color: "var(--sage)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "10px 8px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem", fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: ".55rem", color: "var(--muted)", letterSpacing: ".12em", textTransform: "uppercase" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Section grid */}
      <div className="sec-label" style={{ marginBottom: 8 }}>Sections</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {SECTIONS.map(({ href, icon: Icon, color, label, desc }, i) => (
          <motion.div key={href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
            <Link href={href}>
              <div className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: ".15s" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15`, border: `1.5px solid ${color}35`, flexShrink: 0 }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: ".85rem", fontWeight: 700 }}>{label}</p>
                  <p style={{ fontSize: ".65rem", color: "var(--muted2)" }}>{desc}</p>
                </div>
                <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", fontSize: ".55rem", color: "var(--muted)", letterSpacing: ".15em", textTransform: "uppercase", paddingBottom: 8 }}>
        Built for Nairobi · GTFS Digital Matatus
      </p>
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
      </div>
    </div>
  );
}
